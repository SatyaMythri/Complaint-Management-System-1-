jest.mock("../utils/sendEmail", () => jest.fn().mockResolvedValue());

process.env.JWT_SECRET = "test-jwt-secret";

const request = require("supertest");
const app = require("../app");
const { connect, clearDatabase, closeDatabase } = require("./dbHandler");

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

// There's no admin-creation endpoint exposed over HTTP (by design — an
// admin has to be promoted directly in the DB), so tests promote a
// normal user to admin directly via the model, the same way you would
// in a real deployment.
async function createAdmin(overrides = {}) {
    const User = require("../models/User");

    const { token, userId } = await createUser({
        email: "admin@example.com",
        ...overrides
    });

    await User.findByIdAndUpdate(userId, { role: "admin" });

    // role is embedded in the JWT, so log in again to get a fresh token
    // that reflects the new role
    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: overrides.email || "admin@example.com", password: overrides.password || "password1" });

    return { token: loginRes.body.token, userId };
}

function complaintPayload(overrides = {}) {
    return {
        title: "Main Street",
        category: "Roads",
        description: "There is a large pothole blocking traffic",
        priority: "High",
        ...overrides
    };
}

describe("POST /api/complaints/add (ownership + validation)", () => {

    test("rejects requests with no auth token", async () => {
        const res = await request(app)
            .post("/api/complaints/add")
            .send(complaintPayload());

        expect(res.status).toBe(401);
    });

    test("ignores a client-supplied createdBy and uses the JWT owner", async () => {
        const alice = await createUser({ email: "alice@example.com" });
        const bob = await createUser({ name: "Bob", email: "bob@example.com" });

        const res = await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "There is a large pothole blocking traffic")
            .field("priority", "High")
            .field("createdBy", bob.userId); // attacker tries to spoof owner

        expect(res.status).toBe(201);

        const Complaint = require("../models/Complaint");
        const saved = await Complaint.findOne({});

        expect(String(saved.createdBy)).toBe(String(alice.userId));
        expect(String(saved.createdBy)).not.toBe(String(bob.userId));
    });

    test("rejects a description under 10 characters", async () => {
        const alice = await createUser({ email: "alice2@example.com" });

        const res = await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "short");

        expect(res.status).toBe(400);
    });

    test("rejects an invalid priority value", async () => {
        const alice = await createUser({ email: "alice3@example.com" });

        const res = await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "There is a large pothole blocking traffic")
            .field("priority", "Urgent");

        expect(res.status).toBe(400);
    });

    test("seeds the history array with the initial Pending entry", async () => {
        const alice = await createUser({ email: "alice4@example.com" });

        await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "There is a large pothole blocking traffic")
            .field("priority", "High");

        const Complaint = require("../models/Complaint");
        const saved = await Complaint.findOne({});

        expect(saved.history.length).toBe(1);
        expect(saved.history[0].status).toBe("Pending");
    });

});

describe("GET /api/complaints/user/:id (ownership)", () => {

    test("rejects a user reading another user's complaints", async () => {
        const alice = await createUser({ email: "alice5@example.com" });
        const bob = await createUser({ name: "Bob", email: "bob5@example.com" });

        const res = await request(app)
            .get(`/api/complaints/user/${bob.userId}`)
            .set("Authorization", `Bearer ${alice.token}`);

        expect(res.status).toBe(403);
    });

    test("allows a user to read their own complaints", async () => {
        const alice = await createUser({ email: "alice6@example.com" });

        const res = await request(app)
            .get(`/api/complaints/user/${alice.userId}`)
            .set("Authorization", `Bearer ${alice.token}`);

        expect(res.status).toBe(200);
        expect(res.body.complaints).toBeDefined();
        expect(res.body.totalPages).toBeDefined();
    });

});

describe("GET /api/complaints (admin, pagination + search)", () => {

    async function seedComplaints(token, count, overrides = {}) {
        for (let i = 0; i < count; i++) {
            await request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${token}`)
                .field("title", overrides.title || `Location ${i}`)
                .field("category", overrides.category || "Roads")
                .field("description", `This is complaint number ${i} description text`)
                .field("priority", "Medium");
        }
    }

    test("non-admins are blocked from the admin list endpoint", async () => {
        const alice = await createUser({ email: "alice7@example.com" });

        const res = await request(app)
            .get("/api/complaints")
            .set("Authorization", `Bearer ${alice.token}`);

        expect(res.status).toBe(403);
    });

    test("paginates results according to limit/page", async () => {
        const alice = await createUser({ email: "alice8@example.com" });
        await seedComplaints(alice.token, 15);

        const admin = await createAdmin({ email: "admin2@example.com" });

        const page1 = await request(app)
            .get("/api/complaints?page=1&limit=10")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(page1.status).toBe(200);
        expect(page1.body.complaints.length).toBe(10);
        expect(page1.body.totalCount).toBe(15);
        expect(page1.body.totalPages).toBe(2);

        const page2 = await request(app)
            .get("/api/complaints?page=2&limit=10")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(page2.body.complaints.length).toBe(5);
    });

    test("search filters by title/category/description", async () => {
        const alice = await createUser({ email: "alice9@example.com" });

        await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Unique Pothole Street")
            .field("category", "Roads")
            .field("description", "A very specific and searchable description")
            .field("priority", "High");

        await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Different Location")
            .field("category", "Water Supply")
            .field("description", "A totally unrelated complaint here")
            .field("priority", "Low");

        const admin = await createAdmin({ email: "admin3@example.com" });

        const res = await request(app)
            .get("/api/complaints?search=Pothole")
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
        expect(res.body.totalCount).toBe(1);
        expect(res.body.complaints[0].title).toBe("Unique Pothole Street");
    });

    test("search input with regex special characters does not throw", async () => {
        const alice = await createUser({ email: "alice10@example.com" });
        await seedComplaints(alice.token, 1);

        const admin = await createAdmin({ email: "admin4@example.com" });

        const res = await request(app)
            .get("/api/complaints?search=" + encodeURIComponent("a.*b(c)["))
            .set("Authorization", `Bearer ${admin.token}`);

        expect(res.status).toBe(200);
    });

});

describe("PUT /api/complaints/update/:id (status history)", () => {

    test("appends to history instead of overwriting on each update", async () => {
        const alice = await createUser({ email: "alice11@example.com" });

        await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "There is a large pothole blocking traffic")
            .field("priority", "High");

        const Complaint = require("../models/Complaint");
        const complaint = await Complaint.findOne({});

        const admin = await createAdmin({ email: "admin5@example.com" });

        await request(app)
            .put(`/api/complaints/update/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "In Progress", remarks: "Assigned to field team" });

        await request(app)
            .put(`/api/complaints/update/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "Resolved", remarks: "Fixed the pothole" });

        const updated = await Complaint.findById(complaint._id);

        expect(updated.history.length).toBe(3); // initial + 2 updates
        expect(updated.history[0].status).toBe("Pending");
        expect(updated.history[1].status).toBe("In Progress");
        expect(updated.history[2].status).toBe("Resolved");
        expect(updated.status).toBe("Resolved");
    });

    test("rejects an invalid status value", async () => {
        const alice = await createUser({ email: "alice12@example.com" });

        await request(app)
            .post("/api/complaints/add")
            .set("Authorization", `Bearer ${alice.token}`)
            .field("title", "Main Street")
            .field("category", "Roads")
            .field("description", "There is a large pothole blocking traffic")
            .field("priority", "High");

        const Complaint = require("../models/Complaint");
        const complaint = await Complaint.findOne({});

        const admin = await createAdmin({ email: "admin6@example.com" });

        const res = await request(app)
            .put(`/api/complaints/update/${complaint._id}`)
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "Cancelled" });

        expect(res.status).toBe(400);
    });

    test("returns 404 for a non-existent complaint id", async () => {
        const admin = await createAdmin({ email: "admin7@example.com" });

        const res = await request(app)
            .put("/api/complaints/update/000000000000000000000000")
            .set("Authorization", `Bearer ${admin.token}`)
            .send({ status: "Resolved", remarks: "n/a" });

        expect(res.status).toBe(404);
    });

});