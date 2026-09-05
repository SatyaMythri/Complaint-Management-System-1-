const express = require("express");
const request = require("supertest");

const {
    handleValidationErrors,
    registerRules,
    addComplaintRules
} = require("../middleware/validate");

function buildTestApp(rules) {
    const app = express();
    app.use(express.json());
    app.post("/test", rules, handleValidationErrors, (req, res) => {
        res.json({ ok: true });
    });
    return app;
}

describe("registerRules validation", () => {
    const app = buildTestApp(registerRules);

    test("rejects missing name", async () => {
        const res = await request(app).post("/test").send({
            email: "a@b.com",
            password: "password1"
        });
        expect(res.status).toBe(400);
    });

    test("rejects invalid email", async () => {
        const res = await request(app).post("/test").send({
            name: "A",
            email: "not-an-email",
            password: "password1"
        });
        expect(res.status).toBe(400);
    });

    test("rejects short password", async () => {
        const res = await request(app).post("/test").send({
            name: "A",
            email: "a@b.com",
            password: "short1"
        });
        expect(res.status).toBe(400);
    });

    test("rejects password with no digit", async () => {
        const res = await request(app).post("/test").send({
            name: "A",
            email: "a@b.com",
            password: "nodigitpassword"
        });
        expect(res.status).toBe(400);
    });

    test("accepts a fully valid payload", async () => {
        const res = await request(app).post("/test").send({
            name: "Alice",
            email: "alice@example.com",
            password: "password1"
        });
        expect(res.status).toBe(200);
    });
});

describe("addComplaintRules validation", () => {
    const app = buildTestApp(addComplaintRules);

    test("rejects a description under 10 characters", async () => {
        const res = await request(app).post("/test").send({
            title: "Main St",
            category: "Roads",
            description: "short"
        });
        expect(res.status).toBe(400);
    });

    test("rejects a description over 300 characters", async () => {
        const res = await request(app).post("/test").send({
            title: "Main St",
            category: "Roads",
            description: "a".repeat(301)
        });
        expect(res.status).toBe(400);
    });

    test("rejects an invalid priority", async () => {
        const res = await request(app).post("/test").send({
            title: "Main St",
            category: "Roads",
            description: "This description is definitely long enough",
            priority: "Urgent"
        });
        expect(res.status).toBe(400);
    });

    test("accepts a valid complaint without priority (optional field)", async () => {
        const res = await request(app).post("/test").send({
            title: "Main St",
            category: "Roads",
            description: "This description is definitely long enough"
        });
        expect(res.status).toBe(200);
    });

    test("accepts a fully valid complaint", async () => {
        const res = await request(app).post("/test").send({
            title: "Main St",
            category: "Roads",
            description: "This description is definitely long enough",
            priority: "High"
        });
        expect(res.status).toBe(200);
    });
});