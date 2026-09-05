// Escapes regex special characters in user-supplied search text so it
// can't be used to build an unintended/expensive regex pattern.
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Builds the shared Mongo filter used by both the admin and user
// complaint-list endpoints, keeping search/filter behavior consistent
// between them.
function buildComplaintQuery({ search, status, category, priority, createdBy, assignedTo }) {
    const query = {};

    if (createdBy) {
        query.createdBy = createdBy;
    }

    if (assignedTo) {
        query.assignedTo = assignedTo;
    }

    if (status) {
        query.status = status;
    }

    if (category) {
        query.category = category;
    }

    if (priority) {
        query.priority = priority;
    }

    if (search && search.trim()) {
        const safe = escapeRegex(search.trim());
        const regex = new RegExp(safe, "i");

        query.$or = [
            { title: regex },
            { category: regex },
            { description: regex },
            { complaintId: regex }
        ];
    }

    return query;
}

module.exports = { escapeRegex, buildComplaintQuery };