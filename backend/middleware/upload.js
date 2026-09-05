const multer = require("multer");

// Files are held in memory as buffers, then streamed straight to
// Cloudinary (see routes/complaint.js) — nothing touches local disk.
// This is what makes uploads survive on hosting platforms like Render,
// Vercel, or Heroku, where the filesystem is wiped on every deploy/restart.
const storage = multer.memoryStorage();

const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf"
];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    },
    fileFilter: (req, file, cb) => {
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image (jpg/png/webp) or PDF files are allowed"));
        }
    }
});

module.exports = upload;
module.exports.MAX_FILES = MAX_FILES;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;