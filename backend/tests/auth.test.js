// Stub sendEmail before requiring the app, so tests never try to hit a
// real SMTP server.
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

async function registerAndLogin(overrides = {}) {
    const user = {
        name: "Alice Example",
        email: "alice@example.com",
        password: "password1",
        ...overrides
    };

    await request(app).post("/api/auth/register").send(user);

    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: user.password });

    return {
        token: loginRes.body.token,
        userId: loginRes.body.user.id,
        user
    };
}

describe("POST /api/auth/register", () => {

    test("rejects an invalid email", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Bob",
            email: "not-an-email",
            password: "password1"
        });

        expect(res.status).toBe(400);
    });

    test("rejects a password under 8 characters", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Bob",
            email: "bob@example.com",
            password: "short1"
        });

        expect(res.status).toBe(400);
    });

    test("rejects a password with no digit", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Bob",
            email: "bob@example.com",
            password: "nodigitshere"
        });

        expect(res.status).toBe(400);
    });

    test("accepts a valid registration", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Bob",
            email: "bob@example.com",
            password: "password1"
        });

        expect(res.status).toBe(201);
    });

    test("rejects a duplicate email", async () => {
        await request(app).post("/api/auth/register").send({
            name: "Bob",
            email: "bob@example.com",
            password: "password1"
        });

        const res = await request(app).post("/api/auth/register").send({
            name: "Bob Again",
            email: "bob@example.com",
            password: "password1"
        });

        expect(res.status).toBe(400);
    });

});

describe("POST /api/auth/login", () => {

    test("rejects wrong password", async () => {
        await registerAndLogin();

        const res = await request(app).post("/api/auth/login").send({
            email: "alice@example.com",
            password: "wrongpassword1"
        });

        expect(res.status).toBe(400);
    });

    test("returns a token on valid credentials", async () => {
        await request(app).post("/api/auth/register").send({
            name: "Alice",
            email: "alice@example.com",
            password: "password1"
        });

        const res = await request(app).post("/api/auth/login").send({
            email: "alice@example.com",
            password: "password1"
        });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.email).toBe("alice@example.com");
    });

});

describe("PUT /api/auth/update-profile/:id (ownership)", () => {

    test("rejects requests with no auth token", async () => {
        const res = await request(app)
            .put("/api/auth/update-profile/000000000000000000000000")
            .send({ name: "Hacked", email: "hacked@example.com" });

        expect(res.status).toBe(401);
    });

    test("rejects a user editing someone else's profile", async () => {
        const alice = await registerAndLogin({
            email: "alice2@example.com"
        });

        const bob = await registerAndLogin({
            name: "Bob",
            email: "bob2@example.com"
        });

        const res = await request(app)
            .put(`/api/auth/update-profile/${bob.userId}`)
            .set("Authorization", `Bearer ${alice.token}`)
            .send({ name: "Hacked Bob", email: "hacked@example.com" });

        expect(res.status).toBe(403);
    });

    test("allows a user to edit their own profile", async () => {
        const alice = await registerAndLogin({
            email: "alice3@example.com"
        });

        const res = await request(app)
            .put(`/api/auth/update-profile/${alice.userId}`)
            .set("Authorization", `Bearer ${alice.token}`)
            .send({ name: "Alice Updated", email: "alice3@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.user.name).toBe("Alice Updated");
    });

});

describe("PUT /api/auth/change-password/:id (ownership)", () => {

    test("rejects a user changing someone else's password", async () => {
        const alice = await registerAndLogin({
            email: "alice4@example.com"
        });

        const bob = await registerAndLogin({
            name: "Bob",
            email: "bob4@example.com"
        });

        const res = await request(app)
            .put(`/api/auth/change-password/${bob.userId}`)
            .set("Authorization", `Bearer ${alice.token}`)
            .send({
                currentPassword: bob.user.password,
                newPassword: "newpassword1"
            });

        expect(res.status).toBe(403);
    });

    test("allows a user to change their own password", async () => {
        const alice = await registerAndLogin({
            email: "alice5@example.com"
        });

        const res = await request(app)
            .put(`/api/auth/change-password/${alice.userId}`)
            .set("Authorization", `Bearer ${alice.token}`)
            .send({
                currentPassword: alice.user.password,
                newPassword: "newpassword1"
            });

        expect(res.status).toBe(200);
    });

});