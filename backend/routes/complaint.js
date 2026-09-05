const express = require("express");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const router = express.Router();
const { verifyToken, isAdmin, isStaffOrAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");
const Counter = require("../models/Counter");
const {
    handleValidationErrors,
    addComplaintRules,
    updateComplaintRules,
    assignComplaintRules
} = require("../middleware/validate");
const { buildComplaintQuery } = require("../utils/complaintQuery");
const { withSla, computeSla } = require("../utils/sla");
const { uploadBufferToCloudinary } = require("../config/cloudinary");
// ======================
// Submit Complaint
// ======================
router.post("/add", verifyToken, upload.array("images", upload.MAX_FILES), addComplaintRules, handleValidationErrors, async (req, res) => {
    try {

       const {
    title,
    category,
    description,
    priority
} = req.body;

        // SECURITY: always take the owner from the verified JWT (req.user),
        // never from the request body — otherwise a user could submit a
        // complaint "as" someone else just by editing the form data.
        const createdBy = req.user.id;

        const files = req.files || [];

        // Upload every file to Cloudinary in parallel. Multer already
        // validated type/size/count before this handler runs (see
        // middleware/upload.js), so anything here is a real network/
        // credentials failure, not a bad file from the user — that's why
        // it gets a distinct 502 rather than being folded into the
        // generic catch-all below.
        let uploadResults;

        try {

            uploadResults = await Promise.all(
                files.map(file =>
                    uploadBufferToCloudinary(file.buffer, {
                        // Keep the extension so Cloudinary serves the
                        // right content-type for PDFs in particular.
                        public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`
                    })
                )
            );

        } catch (uploadErr) {

            console.error("Cloudinary upload failed:", uploadErr.message);

            return res.status(502).json({
                message: "Failed to upload attachment(s). Please try again."
            });

        }

        const attachments = uploadResults.map((result, i) => ({
            url: result.secure_url,
            publicId: result.public_id,
            originalName: files[i].originalname,
            mimetype: files[i].mimetype
        }));

        // `image` is kept as the first attachment's URL so any code (or
        // old frontend build) still reading the legacy single-image
        // field keeps working.
        const image = attachments.length > 0 ? attachments[0].url : "";

        const user = await User.findById(createdBy);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (user.role === "admin" || user.role === "staff") {
            return res.status(403).json({
                message: "Admins and staff cannot submit complaints"
            });
        }

        const counter = await Counter.findOneAndUpdate(
            { name: "complaintId" },
            { $inc: { value: 1 } },
            { returnDocument: "after", upsert: true }
        );

        const complaintId = "CMP" + String(counter.value).padStart(3, "0");

        const complaint = new Complaint({
    complaintId,
    title,
    category,
    description,
    createdBy,
    priority,
    image,
    attachments,
    history: [
        {
            status: "Pending",
            remarks: "Complaint submitted",
            changedBy: createdBy,
            changedAt: new Date()
        }
    ]
});

        await complaint.save();

        const saved = await Complaint.findById(complaint._id);

        res.status(201).json({
            message: "Complaint Submitted Successfully"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: err.message
        });
    }
});


// ======================
// Admin - View All Complaints (paginated, filterable, searchable)
// ======================
router.get("/", verifyToken, isStaffOrAdmin, async (req, res) => {

    try {

        const {
            page = 1,
            limit = 10,
            search = "",
            status = "",
            category = "",
            priority = "",
            assignedTo = ""
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

        // Staff can only ever see complaints assigned to them — the
        // ?assignedTo= query param is only honored for admins, who can
        // use it to filter the queue by a specific staff member.
        const effectiveAssignedTo = req.user.role === "staff"
            ? req.user.id
            : assignedTo;

        const query = buildComplaintQuery({
            search,
            status,
            category,
            priority,
            assignedTo: effectiveAssignedTo
        });

        const [complaintsRaw, totalCount] = await Promise.all([
            Complaint.find(query)
                .populate("createdBy", "name email")
                .populate("assignedTo", "name email role")
                .populate("history.changedBy", "name email role")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            Complaint.countDocuments(query)
        ]);

        const complaints = complaintsRaw.map(c => withSla(c.toObject()));

        res.json({
            complaints,
            totalCount,
            totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
            currentPage: pageNum
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});


// ======================
// Staff/Admin — Overdue Complaints Queue
// Only considers open complaints (Pending/In Progress) — a Resolved
// complaint isn't "currently overdue", it either met or breached its
// SLA at the time it was resolved (see the `sla` field on any complaint
// for that history). Scoped the same way as GET / — staff see only
// their own assigned complaints, admins see everything (optionally
// filtered by ?assignedTo=).
//
// This intentionally queries in JS rather than the database, since the
// due date depends on priority and isn't stored — the set of open
// complaints is naturally bounded (resolved ones drop out), so this
// stays cheap without needing an aggregation pipeline.
// ======================
router.get("/overdue", verifyToken, isStaffOrAdmin, async (req, res) => {

    try {

        const {
            page = 1,
            limit = 10,
            assignedTo = ""
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

        const effectiveAssignedTo = req.user.role === "staff"
            ? req.user.id
            : assignedTo;

        const query = buildComplaintQuery({
            status: "", // both Pending and In Progress are eligible
            assignedTo: effectiveAssignedTo
        });

        query.status = { $ne: "Resolved" };

        const openComplaints = await Complaint.find(query)
            .populate("createdBy", "name email")
            .populate("assignedTo", "name email role")
            .populate("history.changedBy", "name email role");

        const overdue = openComplaints
            .map(c => withSla(c.toObject()))
            .filter(c => c.sla && c.sla.isOverdue)
            .sort((a, b) => new Date(a.sla.dueAt) - new Date(b.sla.dueAt)); // most overdue first

        const totalCount = overdue.length;
        const start = (pageNum - 1) * limitNum;
        const pageItems = overdue.slice(start, start + limitNum);

        res.json({
            complaints: pageItems,
            totalCount,
            totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
            currentPage: pageNum
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});


// ======================
// User - View Own Complaints (paginated, filterable, searchable)
// ======================
router.get("/user/:id", verifyToken, async (req, res) => {

    try {

        // SECURITY: only the complaint owner or an admin may view this list.
        // Without this check, any logged-in user could read another user's
        // complaints just by changing the :id in the URL.
        if (req.user.role !== "admin" && req.user.id !== req.params.id) {
            return res.status(403).json({
                message: "You are not allowed to view these complaints"
            });
        }

        const {
            page = 1,
            limit = 10,
            search = "",
            status = "",
            category = "",
            priority = ""
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

        const query = buildComplaintQuery({
            search,
            status,
            category,
            priority,
            createdBy: req.params.id
        });

        const [complaintsRaw, totalCount] = await Promise.all([
            Complaint.find(query)
                .populate("createdBy", "name email")
                .populate("assignedTo", "name email role")
                .populate("history.changedBy", "name email role")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            Complaint.countDocuments(query)
        ]);

        const complaints = complaintsRaw.map(c => withSla(c.toObject()));

        res.json({
            complaints,
            totalCount,
            totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
            currentPage: pageNum
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

// ======================
// Distinct categories (for filter dropdowns) — scoped the same way as
// the list endpoints so a user only sees categories from their own
// complaints, staff only see categories among complaints assigned to
// them, and an admin sees categories across all complaints.
// ======================
router.get("/categories", verifyToken, async (req, res) => {

    try {

        let filter = {};

        if (req.user.role === "staff") {
            filter = { assignedTo: req.user.id };
        } else if (req.user.role !== "admin") {
            filter = { createdBy: req.user.id };
        }

        const categories = await Complaint.distinct("category", filter);

        res.json(categories.filter(Boolean).sort());

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});
// Get complaints of a specific user

// ======================
// Update Complaint Status
// ======================
router.put("/update/:id", verifyToken, isStaffOrAdmin, updateComplaintRules, handleValidationErrors, async (req, res) => {

    try {

        const { status, remarks } = req.body;

        // Staff may only update complaints assigned to them — fetch first
        // so we can check ownership before writing anything. Admins can
        // update any complaint regardless of assignment.
        if (req.user.role === "staff") {
            const existing = await Complaint.findById(req.params.id).select("assignedTo");

            if (!existing) {
                return res.status(404).json({
                    message: "Complaint not found"
                });
            }

            if (!existing.assignedTo || String(existing.assignedTo) !== req.user.id) {
                return res.status(403).json({
                    message: "This complaint is not assigned to you"
                });
            }
        }

        const complaint = await Complaint.findByIdAndUpdate(

    req.params.id,

    {
        status,
        remarks,
        // Append to the timeline rather than overwriting — this is the
        // only place status/remarks changes are recorded, so losing this
        // means losing the entire history of what happened to a complaint.
        $push: {
            history: {
                status,
                remarks: remarks || "",
                changedBy: req.user.id,
                changedAt: new Date()
            }
        }
    },

    {
        returnDocument: "after"
    }

).populate("createdBy").populate("history.changedBy", "name email role");

if (!complaint) {
    return res.status(404).json({
        message: "Complaint not found"
    });
}

// The complaint update above has already succeeded and committed to the
// database at this point. Email notification is a nice-to-have on top
// of that — if SMTP is misconfigured or Gmail rejects the credentials,
// that must NOT make this endpoint report a failure back to the staff
// member, since the actual update did succeed. Catch and log instead.
try {

    await sendEmail(

        complaint.createdBy.email,

        "Complaint Status Updated",

`Hi ${complaint.createdBy.name},

Your complaint has been updated.

Complaint ID : ${complaint.complaintId}

Location : ${complaint.title}

Issue : ${complaint.category}

Status : ${complaint.status}

Remarks :
${complaint.remarks}

Thank you,

Complaint Management System`

    );

} catch (emailErr) {

    console.error("Status-update email failed to send (complaint was still updated):", emailErr.message);

}

        res.json({

            message: "Complaint Updated Successfully",

            complaint: withSla(complaint.toObject())

        });

    } catch (err) {

        res.status(500).json({

            message: err.message

        });

    }

});


// ======================
// Assign Complaint to Staff (admin only)
// ======================
router.put("/assign/:id", verifyToken, isAdmin, assignComplaintRules, handleValidationErrors, async (req, res) => {

    try {

        const { staffId } = req.body;

        const staffUser = await User.findById(staffId);

        if (!staffUser || (staffUser.role !== "staff" && staffUser.role !== "admin")) {
            return res.status(400).json({
                message: "staffId must belong to a staff or admin user"
            });
        }

        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found"
            });
        }

        complaint.assignedTo = staffId;

        // Record the assignment on the timeline too, so there's a full
        // audit trail of who worked a complaint and when it changed hands
        // — not just the current status.
        complaint.history.push({
            status: complaint.status,
            remarks: `Assigned to ${staffUser.name}`,
            changedBy: req.user.id,
            changedAt: new Date()
        });

        await complaint.save();

        const populated = await Complaint.findById(complaint._id)
            .populate("createdBy", "name email")
            .populate("assignedTo", "name email role")
            .populate("history.changedBy", "name email role");

        res.json({
            message: "Complaint assigned successfully",
            complaint: withSla(populated.toObject())
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});


// ======================
// Delete Complaint
// ======================
router.delete("/delete/:id", verifyToken, isAdmin, async (req, res) => {

    try {

        await Complaint.findByIdAndDelete(req.params.id);

        res.json({

            message: "Complaint Deleted"

        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

// ======================
// Admin Dashboard Stats
// ======================

router.get("/stats", verifyToken, isAdmin, async (req, res) => {

    try {

        const totalUsers = await User.countDocuments({
            role: "user"
        });

        const [statusCounts, priorityCounts, totalResult, openComplaints] = await Promise.all([
            Complaint.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            Complaint.aggregate([
                { $group: { _id: "$priority", count: { $sum: 1 } } }
            ]),
            Complaint.countDocuments(),
            // Only open complaints can be "overdue" (a resolved complaint
            // either met or missed its SLA at resolution time, which is a
            // separate stat) — this set stays small as complaints resolve
            // out of it, so computing SLA state in JS here stays cheap.
            Complaint.find({ status: { $ne: "Resolved" } }).select("priority status createdAt history")
        ]);

        const overdueCount = openComplaints.filter(c => {
            const sla = computeSla(c.toObject ? c.toObject() : c);
            return sla && sla.isOverdue;
        }).length;

        const findCount = (arr, key) =>
            arr.find(item => item._id === key)?.count || 0;

        res.json({
            totalUsers,
            total: totalResult,
            pending: findCount(statusCounts, "Pending"),
            resolved: findCount(statusCounts, "Resolved"),
            high: findCount(priorityCounts, "High"),
            medium: findCount(priorityCounts, "Medium"),
            low: findCount(priorityCounts, "Low"),
            overdue: overdueCount
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

module.exports = router;