const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");
const express = require("express");
const User = require("../models/User");
const { verifyToken, isAdmin } = require("../middleware/auth");
const {
    loginLimiter,
    registerLimiter,
    otpRequestLimiter,
    otpVerifyLimiter
} = require("../middleware/rateLimit");
const {
    handleValidationErrors,
    registerRules,
    loginRules,
    emailOnlyRules,
    verifyOtpRules,
    resetPasswordRules,
    updateProfileRules,
    changePasswordRules,
    updateRoleRules
} = require("../middleware/validate");

const router = express.Router();

// Register User
router.post("/register", registerLimiter, registerRules, handleValidationErrors, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({
            message: "Registration Successful"
        });

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});

// Login User
router.post("/login", loginLimiter, loginRules, handleValidationErrors, async (req, res) => {
    try {

        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid Password"
            });
        }

       const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
);

res.status(200).json({
    message: "Login Successful",
    token,
    user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
    }
});

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});

router.post("/forgot-password", otpRequestLimiter, emailOnlyRules, handleValidationErrors, async (req, res) => {
    try {

        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {

            return res.status(404).json({
                message: "Email not found"
            });

        }

        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        user.otp = otp;

        user.otpExpiry = Date.now() + 5 * 60 * 1000;

        user.otpAttempts = 0;

        await user.save();
        await sendEmail(

            user.email,

            "Complaint Management System OTP",

            `Your OTP is ${otp}. It is valid for 5 minutes.`

        );

        res.json({

            message: "OTP sent successfully"

        });

    } catch (err) {

    console.error("Forgot Password Error:", err);

    res.status(500).json({
        message: err.message
    });

}

});

router.post("/verify-otp", otpVerifyLimiter, verifyOtpRules, handleValidationErrors, async (req, res) => {

    try {

        const { email, otp } = req.body;

        const user = await User.findOne({ email });

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        if (user.otpAttempts >= 5) {

            return res.status(429).json({
                message: "Too many attempts. Please request a new OTP."
            });

        }

        if (
            user.otp !== otp ||
            user.otpExpiry < Date.now()
        ) {

            user.otpAttempts += 1;
            await user.save();

            return res.status(400).json({
                message: "Invalid or Expired OTP"
            });

        }

        user.otpAttempts = 0;
        await user.save();

        res.json({
            message: "OTP Verified"
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

router.post("/reset-password", resetPasswordRules, handleValidationErrors, async (req, res) => {

    try {

        const {
            email,
            otp,
            password
        } = req.body;

        const user = await User.findOne({ email });

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        if (
            user.otp !== otp ||
            user.otpExpiry < Date.now()
        ) {

            return res.status(400).json({
                message: "Invalid or Expired OTP"
            });

        }

        const hashedPassword =
            await bcrypt.hash(password, 10);

        user.password = hashedPassword;

        user.otp = "";

        user.otpExpiry = null;

        await user.save();

        res.json({

            message: "Password Reset Successfully"

        });

    } catch (err) {

        res.status(500).json({

            message: err.message

        });

    }

});

router.get("/test", (req, res) => {
    res.send("Auth Route Working");
});

// ======================
// Update Profile
// ======================
router.put("/update-profile/:id", verifyToken, updateProfileRules, handleValidationErrors, async (req, res) => {

    try {

        // SECURITY: this route was previously unauthenticated — anyone
        // could edit anyone's name/email by guessing an id. Now a valid
        // token is required, and it must belong to the profile being edited.
        if (req.user.id !== req.params.id) {
            return res.status(403).json({
                message: "You are not allowed to edit this profile"
            });
        }

        const { name, email } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        user.name = name;
        user.email = email;

        await user.save();

        res.json({
            message: "Profile Updated Successfully",
            user
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

// ======================
// Change Password
// ======================
router.put("/change-password/:id", verifyToken, changePasswordRules, handleValidationErrors, async (req, res) => {

    try {

        // SECURITY: this route was previously unauthenticated — anyone
        // could change any user's password by guessing an id. Now a valid
        // token is required, and it must belong to the account being changed.
        if (req.user.id !== req.params.id) {
            return res.status(403).json({
                message: "You are not allowed to change this password"
            });
        }

        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {

            return res.status(404).json({
                message: "User not found"
            });

        }
        if (currentPassword === newPassword) {

    return res.status(400).json({
        message: "New password must be different from the current password"
    });

}

        const isMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!isMatch) {

            return res.status(400).json({
                message: "Current Password is incorrect"
            });

        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        user.password = hashedPassword;

        await user.save();

        res.json({
            message: "Password Changed Successfully"
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

// ======================
// Admin — List Users
// Supports ?role=staff to power the "assign complaint to staff" picker,
// or no filter to list everyone for a user-management screen.
// ======================
router.get("/users", verifyToken, isAdmin, async (req, res) => {

    try {

        const { role } = req.query;

        const filter = {};

        if (role) {
            filter.role = role;
        }

        const users = await User.find(filter)
            .select("name email role createdAt")
            .sort({ name: 1 });

        res.json(users);

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

// ======================
// Admin — Change a User's Role
// Promotes/demotes between user, staff, and admin.
// ======================
router.put("/users/:id/role", verifyToken, isAdmin, updateRoleRules, handleValidationErrors, async (req, res) => {

    try {

        // Prevent an admin from accidentally locking themselves out by
        // demoting their own account — role changes to yourself must go
        // through another admin.
        if (req.user.id === req.params.id) {
            return res.status(400).json({
                message: "You cannot change your own role"
            });
        }

        const { role } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { returnDocument: "after" }
        ).select("name email role");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "Role updated successfully",
            user
        });

    } catch (err) {

        res.status(500).json({
            message: err.message
        });

    }

});

module.exports = router;