const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaint");
const upload = require("./middleware/upload");

const app = express();

// New attachments are served directly from Cloudinary — this /uploads
// route is kept only so complaints created before the Cloudinary
// migration (whose files are still on local disk, if this server has
// persistent storage) continue to resolve. crossOriginResourcePolicy is
// relaxed to "cross-origin" so the React app (port 3000) can still load
// from it — helmet's default would otherwise block that.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

app.get("/", (req, res) => {
    res.send("Backend is running!");
});

app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);

// Turns Multer's upload errors (file too large, too many files, wrong
// file type from our fileFilter) into clean 400 responses instead of
// letting them fall through to Express's default 500 error page.
// Must be registered after the routes — Express only calls
// error-handling middleware (4 args) when something calls next(err).
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                message: "Each file must be 5MB or smaller"
            });
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                message: `You can attach at most ${upload.MAX_FILES} files`
            });
        }
        return res.status(400).json({ message: err.message });
    }

    if (err && err.message && err.message.includes("Only image")) {
        // thrown by our custom fileFilter in middleware/upload.js
        return res.status(400).json({ message: err.message });
    }

    next(err);
});

module.exports = app;