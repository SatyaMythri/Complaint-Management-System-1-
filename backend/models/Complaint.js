const mongoose = require("mongoose");
console.log("Complaint model loaded from models/Complaint.js");
const ComplaintSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true
    },

    category: {
        type: String,
        required: true
    },

    description: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 300
},

    priority: {
        type: String,
        enum: ["High", "Medium", "Low"],
        default: "Medium"
    },

    status: {
    type: String,
    enum: ["Pending", "In Progress", "Resolved"],
    default: "Pending"
},

    remarks: {
        type: String,
        default: ""
    },

    // Full timeline of status changes — each entry is a snapshot at the
    // moment of that change, so nothing gets lost when remarks/status
    // are updated again later. The old single `remarks` field above is
    // kept in sync with the most recent entry for backward compatibility
    // with any code still reading it directly.
    history: [
        {
            status: {
                type: String,
                enum: ["Pending", "In Progress", "Resolved"]
            },
            remarks: {
                type: String,
                default: ""
            },
            changedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            changedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],

    complaintId: {
        type: String,
        unique: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // Which staff member (or admin) is currently responsible for working
    // this complaint. Left unset until an admin assigns it.
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    // Legacy single-image field — kept so old complaints (created before
    // multi-attachment support, when files lived on local disk) still
    // resolve their filename if that server/disk still exists. New
    // complaints don't rely on this; they use `attachments[].url` below.
    image: {
        type: String,
        default: ""
    },

    // Full set of files attached to the complaint (images and/or PDFs),
    // stored on Cloudinary. `url` is the direct link to the file —
    // that's what the frontend renders. `publicId` is Cloudinary's
    // identifier for the asset, kept so it can be deleted from Cloudinary
    // later if the complaint itself is ever deleted.
    attachments: [
        {
            url: { type: String, required: true },
            publicId: { type: String, default: "" },
            originalName: { type: String, default: "" },
            mimetype: { type: String, default: "" }
        }
    ],

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Complaint", ComplaintSchema);