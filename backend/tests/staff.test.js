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

// Promotes a freshly-registered user directly via the model, then logs
// in again so the returned token's embedded role reflects the promotion
// (the JWT is minted at login time, so a stale token still says "user").
async function createWithRole(role, overrides = {}) {
    const { userId } = await createUser(overrides);

    await User.findByIdAndUpdate(userId, { role });

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
            email: overrides.email || "user@example.com",
            password: overrides.password || "password1"
        });

    return { token: loginRes.body.token, userId };
}

async function submitComplaint(token) {
    await request(app)
        .post("/api/complaints/add")
        .set("Authorization", `Bearer ${token}`)
        .field("title", "Main Street")
        .field("category", "Roads")
        .field("description", "There is a large pothole blocking traffic")
        .field("priority", "High");

    return Complaint.findOne({}).sort({ createdAt: -1 });
}

describe("Role enum on User model", () => {

    test("rejects an invalid role value", async () => {
        const user = new User({
            name: "Bad Role",
            email: "badrole@example.com",
            password: "hashed",
            role: "superuser"
        });

        const err = user.validateSync();
        expect(err).toBeDefined();
    });

});

describe("GET /api/auth/users (admin only)", () => {

    test("blocks non-admins", async () => {
        const user = await createUser({ email: "u1@example.com" });

        const res = await request(app)
            .get("/api/auth/users")
            .set("Authorization", `Bearer ${user.token}`);

        expect(res.status).toBe(403);
    });

    test("lets an admin list users, optionally filtered by role", async () => {
        await createUser({ email: "citizen@example.com" });
        const staff = await createWithRole("staff", { email: "staff1@example.com" });
        const admin = await createWithRole("admin", { email: "admin1@example.com" });

        const res = await request(app)
            .get("/api/auth/users?role=staff")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].email).toBe("staff1@example.com");
    });

});

describe("PUT /api/auth/users/:id/role (admin only)", () => {

    test("blocks non-admins", async () => {
        const alice = await createUser({ email: "alice@example.com" });
        const bob = await createUser({ email: "bob@example.com" });

        const res = await request(app)
            .put(`/api/auth/users/${bob.userId}/role`)
            .set("Authorization", `Bearer ${alice.token}`)
            .send({ role: "staff" });

        expect(res.status).toBe(403);
    });

    test("promotes a user to staff", async () => {
        const target = await createUser({ email: "target@example.com" });
        const admin = await createWithRole("admin", { email: "admin2@example.com" });

        const res = await request(app)
            .put(`/api/auth/users/${target.userId}/role`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ role: "staff" });

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe("staff");
    });

    test("rejects an invalid role value", async () => {
        const target = await createUser({ email: "target2@example.com" });
        const admin = await createWithRole("admin", { email: "admin3@example.com" });

        const res = await request(app)
            .put(`/api/auth/users/${target.userId}/role`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ role: "superuser" });

        expect(res.status).toBe(400);
    });

    test("blocks an admin from changing their own role", async () => {
        const admin = await createWithRole("admin", { email: "admin4@example.com" });

        const res = await request(app)
            .put(`/api/auth/users/${admin.userId}/role`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ role: "user" });

        expect(res.status).toBe(400);
    });

});

describe("PUT /api/complaints/assign/:id (admin only)", () => {

    test("blocks non-admins from assigning", async () => {
        const citizen = await createUser({ email: "citizen2@example.com" });
        const complaint = await submitComplaint(citizen.token);

        const staff = await createWithRole("staff", { email: "staff2@example.com" });

        const res = await request(app)
            .put(`/api/complaints/assign/${complaint._id}`)
            .set("Authorization", `Bearer ${staff.token}`)
            .send({ staffId: staff.userId });

        expect(res.status).toBe(403);
    });

    test("assigns a complaint to a staff member and records it in history", async () => {
        const citizen = await createUser({ email: "citizen3@example.com" });
        const complaint = await submitComplaint(citizen.token);

        const staff = await createWithRole("staff", { email: "staff3@example.com" });
        const admin = await createWithRole("admin", { email: "admin5@example.com" });

        const res = await request(app)
            .put(`/api/complaints/assign/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ staffId: staff.userId });

        expect(res.status).toBe(200);
        expect(res.body.complaint.assignedTo._id).toBe(staff.userId);

        const updated = await Complaint.findById(complaint._id);
        expect(String(updated.assignedTo)).toBe(staff.userId);
        expect(updated.history.length).toBe(2); // initial submission + assignment
        expect(updated.history[1].remarks).toContain("Assigned to");
    });

    test("rejects assigning to a plain citizen (not staff/admin)", async () => {
        const citizen = await createUser({ email: "citizen4@example.com" });
        const complaint = await submitComplaint(citizen.token);

        const otherCitizen = await createUser({ email: "citizen5@example.com" });
        const admin = await createWithRole("admin", { email: "admin6@example.com" });

        const res = await request(app)
            .put(`/api/complaints/assign/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ staffId: otherCitizen.userId });

        expect(res.status).toBe(400);
    });

});

describe("GET /api/complaints — staff scoping", () => {

    test("staff only see complaints assigned to them", async () => {
        const citizen = await createUser({ email: "citizen6@example.com" });
        const complaintA = await submitComplaint(citizen.token);
        const complaintB = await submitComplaint(citizen.token);

        const staffA = await createWithRole("staff", { email: "staffA@example.com" });
        const staffB = await createWithRole("staff", { email: "staffB@example.com" });
        const admin = await createWithRole("admin", { email: "admin7@example.com" });

        await request(app)
            .put(`/api/complaints/assign/${complaintA._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ staffId: staffA.userId });

        await request(app)
            .put(`/api/complaints/assign/${complaintB._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ staffId: staffB.userId });

        const resA = await request(app)
            .get("/api/complaints")
            .set("Authorization", `Bearer ${staffA.token}`);

        expect(resA.status).toBe(200);
        expect(resA.body.totalCount).toBe(1);
        expect(String(resA.body.complaints[0]._id)).toBe(String(complaintA._id));
    });

    test("admin sees all complaints regardless of assignment", async () => {
        const citizen = await createUser({ email: "citizen7@example.com" });
        await submitComplaint(citizen.token);
        await submitComplaint(citizen.token);

        const admin = await createWithRole("admin", { email: "admin8@example.com" });

        const res = await request(app)
            .get("/api/complaints")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totalCount).toBe(2);
    });

});

describe("PUT /api/complaints/update/:id — staff ownership", () => {

    test("staff cannot update a complaint not assigned to them", async () => {
        const citizen = await createUser({ email: "citizen8@example.com" });
        const complaint = await submitComplaint(citizen.token);

        const staff = await createWithRole("staff", { email: "staffC@example.com" });

        const res = await request(app)
            .put(`/api/complaints/update/${complaint._id}`)
            .set("Authorization", `Bearer ${staff.token}`)
            .send({ status: "In Progress", remarks: "Looking into it" });

        expect(res.status).toBe(403);
    });

    test("staff can update a complaint assigned to them", async () => {
        const citizen = await createUser({ email: "citizen9@example.com" });
        const complaint = await submitComplaint(citizen.token);

        const staff = await createWithRole("staff", { email: "staffD@example.com" });
        const admin = await createWithRole("admin", { email: "admin9@example.com" });

        await request(app)
            .put(`/api/complaints/assign/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ staffId: staff.userId });

        const res = await request(app)
            .put(`/api/complaints/update/${complaint._id}`)
            .set("Authorization", `Bearer ${staff.token}`)
            .send({ status: "In Progress", remarks: "Looking into it" });

        expect(res.status).toBe(200);
        expect(res.body.complaint.status).toBe("In Progress");
    });

    test("admin can update any complaint regardless of assignment", async () => {
        const citizen = await createUser({ email: "citizen10@example.com" });
        const complaint = await submitComplaint(citizen.token);

        const admin = await createWithRole("admin", { email: "admin10@example.com" });

        const res = await request(app)
            .put(`/api/complaints/update/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "Resolved", remarks: "Fixed" });

        expect(res.status).toBe(200);
    });

});

describe("POST /api/complaints/add — staff/admin blocked from filing", () => {

    test("staff cannot submit a complaint", async () => {
        const staff = await createWithRole("staff", { email: "staffE@example.com" });

        const res = await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${staff.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "There is a large pothole blocking traffic")
            .field("priority", "High");

        expect(res.status).toBe(403);
    });

});