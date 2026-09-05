const { escapeRegex, buildComplaintQuery } = require("../utils/complaintQuery");

describe("escapeRegex", () => {

    test("escapes regex special characters", () => {
        expect(escapeRegex("a.b*c(d)[e]")).toBe("a\\.b\\*c\\(d\\)\\[e\\]");
    });

    test("leaves plain text untouched", () => {
        expect(escapeRegex("pothole")).toBe("pothole");
    });

});

describe("buildComplaintQuery", () => {

    test("returns an empty query when nothing is provided", () => {
        expect(buildComplaintQuery({})).toEqual({});
    });

    test("scopes to a specific owner", () => {
        expect(buildComplaintQuery({ createdBy: "user1" })).toEqual({
            createdBy: "user1"
        });
    });

    test("combines status/category/priority filters", () => {
        const query = buildComplaintQuery({
            status: "Pending",
            category: "Roads",
            priority: "High"
        });

        expect(query).toEqual({
            status: "Pending",
            category: "Roads",
            priority: "High"
        });
    });

    test("builds a case-insensitive $or search across four fields", () => {
        const query = buildComplaintQuery({ search: "pothole" });

        expect(query.$or).toHaveLength(4);
        expect(query.$or.map(clause => Object.keys(clause)[0])).toEqual([
            "title", "category", "description", "complaintId"
        ]);

        for (const clause of query.$or) {
            const regex = Object.values(clause)[0];
            expect(regex).toBeInstanceOf(RegExp);
            expect(regex.flags).toBe("i");
            expect(regex.test("A Pothole Somewhere")).toBe(true);
        }
    });

    test("escapes regex special characters in search so they can't break the query", () => {
        // A search containing unescaped regex metacharacters should not
        // throw, and should be treated as a literal string.
        const query = buildComplaintQuery({ search: "a.*b(c)[" });

        const regex = query.$or[0].title;
        expect(regex.test("a.*b(c)[")).toBe(true);
        expect(regex.test("aXYb(c)Q")).toBe(false); // '.' and '*' are NOT wildcards here
    });

    test("ignores whitespace-only search", () => {
        const query = buildComplaintQuery({ search: "   " });
        expect(query.$or).toBeUndefined();
    });

});