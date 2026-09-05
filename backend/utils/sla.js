// Target time-to-resolution per priority, in hours. Adjust these to match
// your organization's actual service-level commitments.
const SLA_HOURS_BY_PRIORITY = {
    High: 24,
    Medium: 72,
    Low: 168 // 1 week
};

const DEFAULT_SLA_HOURS = SLA_HOURS_BY_PRIORITY.Medium;

function getSlaHours(priority) {
    return SLA_HOURS_BY_PRIORITY[priority] || DEFAULT_SLA_HOURS;
}

// Finds when a complaint was actually resolved by reading the last
// "Resolved" entry in its history timeline. A complaint can in theory be
// reopened (moved back to Pending/In Progress after being resolved) and
// resolved again, so we want the *latest* resolution, not the first.
function findResolvedAt(complaint) {
    const history = complaint.history || [];

    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].status === "Resolved") {
            return history[i].changedAt;
        }
    }

    // Fallback for complaints resolved before history tracking existed:
    // if the current status is Resolved but there's no matching history
    // entry, treat updatedAt/createdAt as a best-effort estimate rather
    // than crashing or reporting nonsense.
    return complaint.status === "Resolved" ? complaint.createdAt : null;
}

// Computes SLA info for a single complaint. Returns null if the
// complaint has no createdAt/priority to work from (shouldn't happen in
// practice, but keeps this defensive rather than throwing).
function computeSla(complaint) {

    if (!complaint || !complaint.createdAt) {
        return null;
    }

    const slaHours = getSlaHours(complaint.priority);
    const createdAt = new Date(complaint.createdAt);
    const dueAt = new Date(createdAt.getTime() + slaHours * 60 * 60 * 1000);

    if (complaint.status === "Resolved") {

        const resolvedAt = findResolvedAt(complaint);

        if (!resolvedAt) {
            return { slaHours, dueAt, resolvedAt: null, slaState: "Unknown" };
        }

        const resolvedDate = new Date(resolvedAt);
        const met = resolvedDate <= dueAt;

        return {
            slaHours,
            dueAt,
            resolvedAt: resolvedDate,
            slaState: met ? "Met" : "Breached",
            isOverdue: !met
        };

    }

    // Still open (Pending / In Progress) — compare against now.
    const now = new Date();
    const msRemaining = dueAt.getTime() - now.getTime();
    const hoursRemaining = msRemaining / (60 * 60 * 1000);

    let slaState;

    if (hoursRemaining < 0) {
        slaState = "Overdue";
    } else if (hoursRemaining <= slaHours * 0.2) {
        // Within the last 20% of the allotted window — flag as "Due
        // Soon" so staff can prioritize before it actually breaches.
        slaState = "Due Soon";
    } else {
        slaState = "On Track";
    }

    return {
        slaHours,
        dueAt,
        resolvedAt: null,
        slaState,
        isOverdue: slaState === "Overdue",
        hoursRemaining: Math.round(hoursRemaining * 10) / 10
    };

}

// Attaches computed `sla` info to a Mongoose complaint document without
// mutating the database — call .toObject() first (or pass a lean/plain
// object) so this is a pure, side-effect-free enrichment step.
function withSla(complaintObj) {
    return {
        ...complaintObj,
        sla: computeSla(complaintObj)
    };
}

module.exports = {
    SLA_HOURS_BY_PRIORITY,
    getSlaHours,
    computeSla,
    withSla
};