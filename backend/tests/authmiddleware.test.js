process.env.JWT_SECRET = "test-jwt-secret";

const jwt = require("jsonwebtoken");
const { verifyToken, isAdmin, isStaffOrAdmin } = require("../middleware/auth");

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe("verifyToken middleware", () => {

    test("rejects a request with no Authorization header", () => {
        const req = { headers: {} };
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects a header that isn't in 'Bearer <token>' form", () => {
        const req = { headers: { authorization: "sometoken" } };
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects an invalid/garbage token", () => {
        const req = { headers: { authorization: "Bearer not-a-real-token" } };
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("rejects an expired token", () => {
        const expired = jwt.sign(
            { id: "user1", role: "user" },
            process.env.JWT_SECRET,
            { expiresIn: -10 } // already expired
        );

        const req = { headers: { authorization: `Bearer ${expired}` } };
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("accepts a valid token and attaches req.user", () => {
        const token = jwt.sign(
            { id: "user1", role: "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe("user1");
        expect(req.user.role).toBe("user");
    });

});

describe("isAdmin middleware", () => {

    test("blocks a non-admin user", () => {
        const req = { user: { role: "user" } };
        const res = mockRes();
        const next = jest.fn();

        isAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("allows an admin user through", () => {
        const req = { user: { role: "admin" } };
        const res = mockRes();
        const next = jest.fn();

        isAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

});

describe("isStaffOrAdmin middleware", () => {

    test("blocks a plain user", () => {
        const req = { user: { role: "user" } };
        const res = mockRes();
        const next = jest.fn();

        isStaffOrAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("allows a staff user through", () => {
        const req = { user: { role: "staff" } };
        const res = mockRes();
        const next = jest.fn();

        isStaffOrAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test("allows an admin user through", () => {
        const req = { user: { role: "admin" } };
        const res = mockRes();
        const next = jest.fn();

        isStaffOrAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

});