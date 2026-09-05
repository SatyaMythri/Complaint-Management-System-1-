const { computeSla, getSlaHours, SLA_HOURS_BY_PRIORITY } = require("../utils/sla");

function hoursAgo(h) {
    return new Date(Date.now() - h * 60 * 60 * 1000);
}

function hoursFromNow(h) {
    return new Date(Date.now() + h * 60 * 60 * 1000);
}

describe("getSlaHours", () => {

    test("returns the configured hours for each known priority", () => {
        expect(getSlaHours("High")).toBe(SLA_HOURS_BY_PRIORITY.High);
        expect(getSlaHours("Medium")).toBe(SLA_HOURS_BY_PRIORITY.Medium);
        expect(getSlaHours("Low")).toBe(SLA_HOURS_BY_PRIORITY.Low);
    });

    test("falls back to Medium for an unknown priority", () => {
        expect(getSlaHours("Unknown")).toBe(SLA_HOURS_BY_PRIORITY.Medium);
    });

});

describe("computeSla — open complaints", () => {

    test("On Track when well within the SLA window", () => {
        const complaint = {
            priority: "High", // 24h window
            status: "Pending",
            createdAt: hoursAgo(1),
            history: []
        };

        const sla = computeSla(complaint);
        expect(sla.slaState).toBe("On Track");
        expect(sla.isOverdue).toBe(false);
    });

    test("Due Soon within the last 20% of the window", () => {
        const complaint = {
            priority: "High", // 24h window, last 20% = last 4.8h
            status: "In Progress",
            createdAt: hoursAgo(20), // 4h remaining
            history: []
        };

        const sla = computeSla(complaint);
        expect(sla.slaState).toBe("Due Soon");
        expect(sla.isOverdue).toBe(false);
    });

    test("Overdue once past the due time", () => {
        const complaint = {
            priority: "High", // 24h window
            status: "Pending",
            createdAt: hoursAgo(30),
            history: []
        };

        const sla = computeSla(complaint);
        expect(sla.slaState).toBe("Overdue");
        expect(sla.isOverdue).toBe(true);
    });

});

describe("computeSla — resolved complaints", () => {

    test("Met when resolved within the SLA window", () => {
        const created = hoursAgo(30);

        const complaint = {
            priority: "High", // 24h window
            status: "Resolved",
            createdAt: created,
            history: [
                { status: "Pending", changedAt: created },
                { status: "Resolved", changedAt: hoursAgo(20) } // resolved 10h after creation
            ]
        };

        const sla = computeSla(complaint);
        expect(sla.slaState).toBe("Met");
        expect(sla.isOverdue).toBe(false);
    });

    test("Breached when resolved after the SLA window", () => {
        const created = hoursAgo(50);

        const complaint = {
            priority: "High", // 24h window
            status: "Resolved",
            createdAt: created,
            history: [
                { status: "Pending", changedAt: created },
                { status: "Resolved", changedAt: hoursAgo(1) } // resolved 49h after creation
            ]
        };

        const sla = computeSla(complaint);
        expect(sla.slaState).toBe("Breached");
        expect(sla.isOverdue).toBe(true);
    });

    test("uses the latest Resolved entry if a complaint was reopened and resolved again", () => {
        const created = hoursAgo(50);

        const complaint = {
            priority: "High",
            status: "Resolved",
            createdAt: created,
            history: [
                { status: "Pending", changedAt: created },
                { status: "Resolved", changedAt: hoursAgo(40) },   // first resolution, within SLA
                { status: "Pending", changedAt: hoursAgo(30) },    // reopened
                { status: "Resolved", changedAt: hoursAgo(1) }     // resolved again, breached
            ]
        };

        const sla = computeSla(complaint);
        expect(sla.slaState).toBe("Breached"); // should use the LATEST resolution
    });

});

describe("computeSla — edge cases", () => {

    test("returns null for a complaint with no createdAt", () => {
        expect(computeSla({ priority: "High", status: "Pending" })).toBeNull();
    });

    test("returns null for a null/undefined complaint", () => {
        expect(computeSla(null)).toBeNull();
        expect(computeSla(undefined)).toBeNull();
    });

});