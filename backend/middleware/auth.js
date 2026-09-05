const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

function isAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
}

function isStaffOrAdmin(req, res, next) {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
        return res.status(403).json({ message: "Staff or admin access required" });
    }
    next();
}

module.exports = { verifyToken, isAdmin, isStaffOrAdmin };