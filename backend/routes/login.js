const express = require("express");
const bcrypt  = require("bcrypt");
const db      = require("../config/db"); // your existing db.js

const router = express.Router();

// ═══════════════════════════════════════════════════════════
//  POST /api/auth/register  — Create a new account
// ═══════════════════════════════════════════════════════════
router.post("/api/auth/register", async (req, res) => {
  const { fullname, email, password } = req.body;
  if (!fullname || !email || !password) {
    return res.status(400).json({ success: false, message: "Please fill in all fields." });
  }

  if (!email.endsWith("@silpakorn.edu")) {
    return res.status(400).json({ success: false, message: "Only @silpakorn.edu university emails are accepted." });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
  }

  try {
    // ── Check if email already exists ──
    const [existing] = await db.query(
      "SELECT user_id FROM User WHERE university_email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    // ── Hash password ──
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Split fullname into first / last ──
    const parts     = fullname.trim().split(" ");
    const firstName = parts[0] || "";
    const lastName  = parts.slice(1).join(" ") || "";
    const userName  = email.split("@")[0];

    // ── Insert into User table ──
    const [result] = await db.query(
      `INSERT INTO User (user_name, university_email, user_password, role, status, created_at)
       VALUES (?, ?, ?, 'user', 'active', NOW())`,
      [userName, email, hashedPassword]
    );

    const userId = result.insertId;

    // ── Insert into User_profile table ──
    await db.query(
      `INSERT INTO User_profile (user_id, first_name, last_name)
       VALUES (?, ?, ?)`,
      [userId, firstName, lastName]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully! Please log in.",
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/auth/login  — Log in with email + password
// ═══════════════════════════════════════════════════════════
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Please enter your email and password." });
  }

  try {
    // ── Find user ──
    const [rows] = await db.query(
      "SELECT * FROM User WHERE university_email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Email or password is incorrect." });
    }

    const user = rows[0];

    // ── Check if banned ──
    if (user.status === "banned") {
      return res.status(403).json({ success: false, message: "Your account has been suspended." });
    }

    // ── Verify password ──
    const match = await bcrypt.compare(password, user.user_password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Email or password is incorrect." });
    }

    // ── Update last login ──
    await db.query(
      "UPDATE User SET last_login = NOW() WHERE user_id = ?",
      [user.user_id]
    );

    // ── Save session ──
    req.session.userId   = user.user_id;
    req.session.userRole = user.role;
    req.session.email    = user.university_email;

    return res.json({
      success: true,
      message: "Login successful!",
      role:    user.role,
      redirect: user.role === "admin" ? "/html/admin.html" : "/frontend/html/homepage.html",
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
});

module.exports = router;