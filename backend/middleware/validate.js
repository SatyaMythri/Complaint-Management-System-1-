const { body, validationResult } = require("express-validator");

// Runs after any array of express-validator checks. If any check failed,
// responds with 400 and a list of messages instead of letting the request
// reach the route handler.
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: errors.array()[0].msg,
            errors: errors.array().map(e => e.msg)
        });
    }

    next();
}

// ---- Auth rules ----

const registerRules = [
    body("name")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters"),

    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Enter a valid email address")
        .normalizeEmail(),

    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
        .matches(/\d/).withMessage("Password must contain at least one number")
];

const loginRules = [
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Enter a valid email address")
        .normalizeEmail(),

    body("password")
        .notEmpty().withMessage("Password is required")
];

const emailOnlyRules = [
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Enter a valid email address")
        .normalizeEmail()
];

const verifyOtpRules = [
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Enter a valid email address")
        .normalizeEmail(),

    body("otp")
        .trim()
        .notEmpty().withMessage("OTP is required")
        .isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits")
        .isNumeric().withMessage("OTP must be numeric")
];

const resetPasswordRules = [
    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Enter a valid email address")
        .normalizeEmail(),

    body("otp")
        .trim()
        .notEmpty().withMessage("OTP is required")
        .isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),

    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 8 }).withMessage("Password must be at least 8 characters")
        .matches(/\d/).withMessage("Password must contain at least one number")
];

const updateProfileRules = [
    body("name")
        .trim()
        .notEmpty().withMessage("Name is required")
        .isLength({ min: 2, max: 50 }).withMessage("Name must be 2-50 characters"),

    body("email")
        .trim()
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Enter a valid email address")
        .normalizeEmail()
];

const changePasswordRules = [
    body("currentPassword")
        .notEmpty().withMessage("Current password is required"),

    body("newPassword")
        .notEmpty().withMessage("New password is required")
        .isLength({ min: 8 }).withMessage("New password must be at least 8 characters")
        .matches(/\d/).withMessage("New password must contain at least one number")
];

// ---- Complaint rules ----

const addComplaintRules = [
    body("title")
        .trim()
        .notEmpty().withMessage("Location is required")
        .isLength({ max: 100 }).withMessage("Location must be under 100 characters"),

    body("category")
        .trim()
        .notEmpty().withMessage("Category is required")
        .isLength({ max: 50 }).withMessage("Category must be under 50 characters"),

    body("description")
        .trim()
        .notEmpty().withMessage("Description is required")
        .isLength({ min: 10, max: 300 }).withMessage("Description must be 10-300 characters"),

    body("priority")
        .optional()
        .isIn(["High", "Medium", "Low"]).withMessage("Priority must be High, Medium, or Low")
];

const updateComplaintRules = [
    body("status")
        .trim()
        .notEmpty().withMessage("Status is required")
        .isIn(["Pending", "In Progress", "Resolved"]).withMessage("Invalid status value"),

    body("remarks")
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 }).withMessage("Remarks must be under 500 characters")
];

// ---- Role & assignment rules ----

const updateRoleRules = [
    body("role")
        .trim()
        .notEmpty().withMessage("Role is required")
        .isIn(["user", "staff", "admin"]).withMessage("Role must be user, staff, or admin")
];

const assignComplaintRules = [
    body("staffId")
        .notEmpty().withMessage("staffId is required")
        .isMongoId().withMessage("staffId must be a valid user id")
];

module.exports = {
    handleValidationErrors,
    registerRules,
    loginRules,
    emailOnlyRules,
    verifyOtpRules,
    resetPasswordRules,
    updateProfileRules,
    changePasswordRules,
    addComplaintRules,
    updateComplaintRules,
    updateRoleRules,
    assignComplaintRules
};