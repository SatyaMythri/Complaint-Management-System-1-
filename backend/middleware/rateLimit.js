const rateLimit = require("express-rate-limit");

// Rate limits exist to slow down real attackers, not to throttle the
// test suite (which legitimately registers/logs in many users back to
// back). Jest sets NODE_ENV=test automatically, so limiters are skipped
// in that environment only — production and normal dev usage are
// unaffected.
const skipInTests = () => process.env.NODE_ENV === "test";

// Login: slows down credential-stuffing / brute-force attempts.
// 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skip: skipInTests,
    message: {
        message: "Too many login attempts. Please try again in 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Register: stops mass fake-account creation from a single IP.
// 5 accounts per hour per IP.
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    skip: skipInTests,
    message: {
        message: "Too many accounts created from this IP. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Forgot password / OTP request: stops an attacker from spamming a
// victim's inbox with OTP emails, and slows automated OTP requests.
// 5 requests per 15 minutes per IP.
const otpRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skip: skipInTests,
    message: {
        message: "Too many OTP requests. Please try again in 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Verify OTP: the User model already tracks otpAttempts per-account, but
// this adds a per-IP backstop so an attacker can't just cycle through
// many different emails to dodge the per-account limit.
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skip: skipInTests,
    message: {
        message: "Too many OTP verification attempts. Please try again in 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    loginLimiter,
    registerLimiter,
    otpRequestLimiter,
    otpVerifyLimiter
};