const express = require("express");
const passport = require("passport");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");

// ⚠️  Adjust this path to match where your db.js actually lives.
// If db.js is in the same folder as googleAuth.js → require("./db")
// If db.js is one level up                        → require("../db")  (most common)
const db = require("../db");

const router = express.Router();

// ── Serialize / Deserialize (store user_id in session) ─────────────────────
passport.serializeUser((user, done) => {
    done(null, user.user_id);
});

passport.deserializeUser(async(id, done) => {
    try {
        const [rows] = await db.query("SELECT * FROM User WHERE user_id = ?", [id]);
        done(null, rows[0] || null);
    } catch (err) {
        done(err);
    }
});

// ── Google OAuth Strategy ───────────────────────────────────────────────────
passport.use(
    new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "/auth/google/callback",
        },
        async(accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails ? .[0] ? .value || "";
                const name = profile.displayName || "";
                const picture = profile.photos ? .[0] ? .value || "";

                console.log("[Google OAuth] email received:", email);

                const emailLower = email.toLowerCase();

                // ✅ Block non @su emails
                if (!emailLower.endsWith("@silpakorn.edu")) {
                    console.log("[Google OAuth] Rejected — not a university email:", email);
                    return done(null, false, { message: "invalid_email" });
                }

                // ── Check if user already exists ──
                const [rows] = await db.query(
                    "SELECT * FROM User WHERE university_email = ?", [email]
                );

                let user;

                if (rows.length === 0) {
                    // ── NEW USER: save to User + User_profile ──
                    const nameParts = name.split(" ");
                    const firstName = nameParts[0] || "";
                    const lastName = nameParts.slice(1).join(" ") || "";
                    const userName = email.split("@")[0];

                    console.log("[Google OAuth] Creating new user:", email);

                    const [result] = await db.query(
                        `INSERT INTO User
               (user_name, university_email, role, status, created_at, last_login)
             VALUES (?, ?, 'user', 'active', NOW(), NOW())`, [userName, email]
                    );

                    const userId = result.insertId;

                    await db.query(
                        `INSERT INTO User_profile
               (user_id, frist_name, last_name, profile_img)
             VALUES (?, ?, ?, ?)`, [userId, firstName, lastName, picture]
                    );

                    const [newRows] = await db.query(
                        "SELECT * FROM User WHERE user_id = ?", [userId]
                    );
                    user = newRows[0];
                    console.log("[Google OAuth] New user saved, user_id:", userId);

                } else {
                    // ── EXISTING USER ──
                    user = rows[0];

                    if (user.status === "banned") {
                        console.log("[Google OAuth] Rejected — banned user:", email);
                        return done(null, false, { message: "banned" });
                    }

                    // Update last login timestamp + refresh profile picture
                    await db.query(
                        `UPDATE User
                SET last_login = NOW()
              WHERE user_id = ?`, [user.user_id]
                    );

                    // Also update profile_img in case they changed their Google photo
                    await db.query(
                        `UPDATE User_profile
                SET profile_img = ?
              WHERE user_id = ?`, [picture, user.user_id]
                    );

                    console.log("[Google OAuth] Existing user logged in:", email);
                }

                return done(null, user);

            } catch (err) {
                console.error("[Google OAuth] Strategy error:", err);
                return done(err);
            }
        }
    )
);

// ── Routes ──────────────────────────────────────────────────────────────────

// Step 1: Send user to Google sign-in page
router.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
        prompt: "select_account",
    })
);

// Step 2: Google redirects back here
router.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/html/homelogin.html",
        failureMessage: true,
    }),
    (req, res) => {
        // Save handy fields directly on the session
        req.session.userId = req.user.user_id;
        req.session.userRole = req.user.role;
        req.session.email = req.user.university_email;

        console.log("[Google OAuth] Login success, redirecting user_id:", req.user.user_id);

        if (req.user.role === "admin") {
            return res.redirect("/html/admin-dashboard.html");
        }
        res.redirect("/html/homepage.html");
    }
);

// Logout
router.get("/logout", (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect("/html/homelogin.html");
        });
    });
});

module.exports = router;