jest.mock("../utils/sendEmail", () => jest.fn().mockResolvedValue());

// Mock the Cloudinary upload helper so tests never hit the real network
// or require real credentials — each call resolves with a fake but
// realistic-looking result, keyed off a counter so multiple uploads in
// the same test get distinct URLs/public_ids. The counter variable must
// be prefixed with "mock" (case-insensitive) — Jest's mock factories run
// before module scope exists and can only close over variables matching
// that naming convention.
let mockUploadCallCount = 0;

jest.mock("../config/cloudinary", () => ({
    uploadBufferToCloudinary: jest.fn(() => {
        mockUploadCallCount += 1;
        return Promise.resolve({
            secure_url: `https://res.cloudinary.com/test/image/upload/v1/complaint-management/fake-${mockUploadCallCount}.jpg`,
            public_id: `complaint-management/fake-${mockUploadCallCount}`
        });
    })
}));

process.env.JWT_SECRET = "test-jwt-secret";

const request = require("supertest");
const app = require("../app");
const { connect, clearDatabase, closeDatabase } = require("./dbHandler");
const Complaint = require("../models/Complaint");
const { uploadBufferToCloudinary } = require("../config/cloudinary");

beforeAll(async () => {
    await connect();
});

afterEach(async () => {
    await clearDatabase();
    uploadBufferToCloudinary.mockClear();
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

function baseFields(req) {
    return req
        .field("title", "Main Street")
        .field("category", "Roads")
        .field("description", "There is a large pothole blocking traffic")
        .field("priority", "High");
}

// A minimal valid JPEG/PNG-ish buffer isn't necessary — Multer's
// fileFilter only checks the declared mimetype on the multipart part,
// not the actual bytes, so a small buffer with the right field name and
// mimetype is enough to exercise the upload path.
function fakeFile(name = "photo.jpg") {
    return Buffer.from("fake-file-content");
}

describe("POST /api/complaints/add — attachments", () => {

    test("accepts a complaint with no attachments (optional)", async () => {
        const alice = await createUser({ email: "a1@example.com" });

        const res = await baseFields(
            request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${alice.token}`)
        );

        expect(res.status).toBe(201);

        const saved = await Complaint.findOne({});
        expect(saved.attachments).toHaveLength(0);
        expect(saved.image).toBe("");
    });

    test("accepts multiple image attachments and stores them all", async () => {
        const alice = await createUser({ email: "a2@example.com" });

        const res = await baseFields(
            request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${alice.token}`)
        )
            .attach("images", fakeFile(), { filename: "photo1.jpg", contentType: "image/jpeg" })
            .attach("images", fakeFile(), { filename: "photo2.png", contentType: "image/png" });

        expect(res.status).toBe(201);

        const saved = await Complaint.findOne({});
        expect(saved.attachments).toHaveLength(2);
        expect(saved.attachments[0].originalName).toBe("photo1.jpg");
        expect(saved.attachments[1].originalName).toBe("photo2.png");
        expect(saved.attachments[0].url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
        expect(saved.attachments[0].publicId).toBeTruthy();

        // legacy `image` field mirrors the first attachment's URL for backward compat
        expect(saved.image).toBe(saved.attachments[0].url);
    });

    test("accepts a PDF attachment alongside images", async () => {
        const alice = await createUser({ email: "a3@example.com" });

        const res = await baseFields(
            request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${alice.token}`)
        )
            .attach("images", fakeFile(), { filename: "photo.jpg", contentType: "image/jpeg" })
            .attach("images", fakeFile(), { filename: "proof.pdf", contentType: "application/pdf" });

        expect(res.status).toBe(201);

        const saved = await Complaint.findOne({});
        expect(saved.attachments).toHaveLength(2);
        expect(saved.attachments.some(a => a.mimetype === "application/pdf")).toBe(true);
    });

    test("rejects a disallowed file type", async () => {
        const alice = await createUser({ email: "a4@example.com" });

        const res = await baseFields(
            request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${alice.token}`)
        ).attach("images", fakeFile(), { filename: "malware.exe", contentType: "application/x-msdownload" });

        expect(res.status).toBe(400);
    });

    test("rejects more than the max allowed files", async () => {
        const alice = await createUser({ email: "a5@example.com" });

        let req = baseFields(
            request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${alice.token}`)
        );

        for (let i = 0; i < 6; i++) {
            req = req.attach("images", fakeFile(), { filename: `photo${i}.jpg`, contentType: "image/jpeg" });
        }

        const res = await req;

        expect(res.status).toBe(400);
    });

    test("returns 502 (not a generic 500) when Cloudinary itself fails, and does not save a partial complaint", async () => {
        const alice = await createUser({ email: "a6@example.com" });

        uploadBufferToCloudinary.mockImplementationOnce(() =>
            Promise.reject(new Error("Cloudinary credentials invalid"))
        );

        const res = await baseFields(
            request(app)
                .post("/api/complaints/add")
                .set("Authorization", `Bearer ${alice.token}`)
        ).attach("images", fakeFile(), { filename: "photo.jpg", contentType: "image/jpeg" });

        expect(res.status).toBe(502);

        const saved = await Complaint.findOne({});
        expect(saved).toBeNull(); // nothing should be committed if the upload failed
    });

});