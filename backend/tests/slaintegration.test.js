jest.mock("../utils/sendEmail", () => jest.fn().mockResolvedValue());

process.env.JWT_SECRET = "test-jwt-secret";

const request = require("supertest");
const app = require("../app");
const { connect, clearDatabase, closeDatabase } = require("./dbHandler");
const User = require("../models/User");
const Complaint = require("../models/Complaint");

beforeAll(async () => {
    await connect();
});

afterEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await closeDatabase();
});

async function createUser(overrides = {}) {
    const user = {
        name: "Test User",
        email: "user@example.com",
        password: "password1",
        ...overrides
    };

    await request(app).post("/api/auth/register").send(user);

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: user.password });

    return { token: loginRes.body.token, userId: loginRes.body.user.id };
}

async function createAdmin(overrides = {}) {
    const { token, userId } = await createUser(overrides);
    await User.findByIdAndUpdate(userId, { role: "admin" });

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
            email: overrides.email || "user@example.com",
            password: overrides.password || "password1"
        });

    return { token: loginRes.body.token, userId };
}

async function submitComplaint(token, overrides = {}) {
    await request(app)
        .post("/api/complaints/add")
        .set("Authorization", `Bearer ${token}`)
        .field("title", overrides.title || "Main Street")
        .field("category", overrides.category || "Roads")
        .field("description", overrides.description || "There is a large pothole blocking traffic")
        .field("priority", overrides.priority || "High");

    return Complaint.findOne({}).sort({ createdAt: -1 });
}

describe("GET /api/complaints — SLA enrichment", () => {

    test("each complaint includes computed sla info", async () => {
        const citizen = await createUser({ email: "c1@example.com" });
        await submitComplaint(citizen.token, { priority: "High" });

        const admin = await createAdmin({ email: "admin1@example.com" });

        const res = await request(app)
            .get("/api/complaints")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.complaints[0].sla).toBeDefined();
        expect(res.body.complaints[0].sla.slaState).toBe("On Track");
        expect(res.body.complaints[0].sla.slaHours).toBe(24); // High priority
    });

    test("a complaint created far in the past shows as Overdue", async () => {
        const citizen = await createUser({ email: "c2@example.com" });
        const complaint = await submitComplaint(citizen.token, { priority: "High" }); // 24h SLA

        // Backdate creation and the initial history entry well past the SLA window
        const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await Complaint.findByIdAndUpdate(complaint._id, {
            createdAt: longAgo,
            "history.0.changedAt": longAgo
        });

        const admin = await createAdmin({ email: "admin2@example.com" });

        const res = await request(app)
            .get("/api/complaints")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.body.complaints[0].sla.slaState).toBe("Overdue");
        expect(res.body.complaints[0].sla.isOverdue).toBe(true);
    });

});

describe("GET /api/complaints/overdue", () => {

    test("blocks non-staff/admin users", async () => {
        const citizen = await createUser({ email: "c3@example.com" });

        const res = await request(app)
            .get("/api/complaints/overdue")
            .set("Authorization", `Bearer ${citizen.token}`);

        expect(res.status).toBe(403);
    });

    test("only returns complaints that are actually overdue", async () => {
        const citizen = await createUser({ email: "c4@example.com" });

        // On-track complaint (created now)
        await submitComplaint(citizen.token, { priority: "Low" }); // 168h SLA, definitely not overdue

        // Overdue complaint (backdated past its High-priority 24h SLA)
        const overdueComplaint = await submitComplaint(citizen.token, { priority: "High" });
        const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await Complaint.findByIdAndUpdate(overdueComplaint._id, {
            createdAt: longAgo,
            "history.0.changedAt": longAgo
        });

        const admin = await createAdmin({ email: "admin3@example.com" });

        const res = await request(app)
            .get("/api/complaints/overdue")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totalCount).toBe(1);
        expect(String(res.body.complaints[0]._id)).toBe(String(overdueComplaint._id));
    });

    test("resolved complaints never appear in the overdue queue, even if they breached SLA", async () => {
        const citizen = await createUser({ email: "c5@example.com" });
        const complaint = await submitComplaint(citizen.token, { priority: "High" });

        const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await Complaint.findByIdAndUpdate(complaint._id, {
            createdAt: longAgo,
            status: "Resolved",
            "history.0.changedAt": longAgo
        });

        const admin = await createAdmin({ email: "admin4@example.com" });

        const res = await request(app)
            .get("/api/complaints/overdue")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.body.totalCount).toBe(0);
    });

    test("staff only see their own overdue complaints", async () => {
        const citizen = await createUser({ email: "c6@example.com" });

        const complaintA = await submitComplaint(citizen.token, { priority: "High" });
        const complaintB = await submitComplaint(citizen.token, { priority: "High" });

        const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await Complaint.findByIdAndUpdate(complaintA._id, { createdAt: longAgo, "history.0.changedAt": longAgo });
        await Complaint.findByIdAndUpdate(complaintB._id, { createdAt: longAgo, "history.0.changedAt": longAgo });

        const staffA = await createUser({ email: "staffA@example.com" });
        await User.findByIdAndUpdate(staffA.userId, { role: "staff" });
        const staffALogin = await request(app).post("/api/auth/login").send({ email: "staffA@example.com", password: "password1" });

        const admin = await createAdmin({ email: "admin5@example.com" });

        await request(app)
            .put(`/api/complaints/assign/${complaintA._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ staffId: staffA.userId });

        const res = await request(app)
            .get("/api/complaints/overdue")
            .set("Authorization", `Bearer ${staffALogin.body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totalCount).toBe(1);
        expect(String(res.body.complaints[0]._id)).toBe(String(complaintA._id));
    });

});

describe("GET /api/complaints/stats — overdue count", () => {

    test("includes an overdue count based only on open complaints", async () => {
        const citizen = await createUser({ email: "c7@example.com" });

        const overdueComplaint = await submitComplaint(citizen.token, { priority: "High" });
        const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        await Complaint.findByIdAndUpdate(overdueComplaint._id, {
            createdAt: longAgo,
            "history.0.changedAt": longAgo
        });

        await submitComplaint(citizen.token, { priority: "Low" }); // not overdue

        const admin = await createAdmin({ email: "admin6@example.com" });

        const res = await request(app)
            .get("/api/complaints/stats")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.overdue).toBe(1);
    });

});