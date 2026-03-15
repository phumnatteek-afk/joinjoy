const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Multer: save profile images to backend/userprofile/ ────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../userprofile');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.session.userId}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed.'));
    }
  },
});

// ── Helper: get userId from session or passport ─────────────────
function getUserId(req) {
  return (req.session && req.session.userId)
    ? req.session.userId
    : (req.user && req.user.user_id ? req.user.user_id : null);
}

// ══════════════════════════════════════════════════════════════
//  GET /api/profile/me
//  Returns the logged-in user's full profile
// ══════════════════════════════════════════════════════════════
router.get('/me', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const [[profile]] = await db.query(
      `SELECT
         u.user_id,
         u.user_name,
         u.university_email,
         up.profile_id,
         up.frist_name  AS first_name,
         up.last_name,
         up.bio,
         up.brith_date  AS birth_date,
         up.gender,
         up.faculty,
         up.social_media,
         up.tags,
         up.profile_img
       FROM User u
       LEFT JOIN User_profile up ON up.user_id = u.user_id
       WHERE u.user_id = ?`,
      [userId]
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Parse tags: stored as comma-separated string → return as array
    if (profile.tags) {
      profile.tags = profile.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      profile.tags = [];
    }

    return res.json({ success: true, profile });
  } catch (err) {
    console.error('GET /api/profile/me error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════
//  GET /api/profile/:userId
//  Returns any user's public profile (for viewing others)
// ══════════════════════════════════════════════════════════════
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!Number.isInteger(Number(userId))) {
    return res.status(400).json({ success: false, message: 'Invalid user ID' });
  }

  try {
    const [[profile]] = await db.query(
      `SELECT
         u.user_id,
         u.user_name,
         up.frist_name  AS first_name,
         up.last_name,
         up.bio,
         up.brith_date  AS birth_date,
         up.gender,
         up.faculty,
         up.social_media,
         up.tags,
         up.profile_img
       FROM User u
       LEFT JOIN User_profile up ON up.user_id = u.user_id
       WHERE u.user_id = ? AND u.status = 'active'`,
      [userId]
    );

    if (!profile) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (profile.tags) {
      profile.tags = profile.tags.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      profile.tags = [];
    }

    return res.json({ success: true, profile });
  } catch (err) {
    console.error(`GET /api/profile/${userId} error:`, err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════
//  PUT /api/profile/me
//  Update the logged-in user's profile (text fields)
//  Body (JSON): { first_name, last_name, bio, birth_date,
//                 gender, faculty, social_media, tags }
// ══════════════════════════════════════════════════════════════
router.put('/me', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const {
    first_name,
    last_name,
    bio,
    birth_date,
    gender,
    faculty,
    social_media,
    tags,           // can be array or comma-separated string
  } = req.body;

  // Validate gender value
  const allowedGenders = ['Male', 'Female', 'Other', null, ''];
  if (gender !== undefined && !allowedGenders.includes(gender)) {
    return res
      .status(400)
      .json({ success: false, message: "Gender must be 'Male', 'Female', or 'Other'." });
  }

  // Normalise tags to comma-separated string
  let tagsStr = '';
  if (Array.isArray(tags)) {
    tagsStr = tags.map((t) => t.trim()).filter(Boolean).join(',');
  } else if (typeof tags === 'string') {
    tagsStr = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .join(',');
  }

  try {
    // Check if User_profile row already exists
    const [[existing]] = await db.query(
      'SELECT profile_id FROM User_profile WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      await db.query(
        `UPDATE User_profile
         SET frist_name   = ?,
             last_name    = ?,
             bio          = ?,
             brith_date   = ?,
             gender       = ?,
             faculty      = ?,
             social_media = ?,
             tags         = ?
         WHERE user_id = ?`,
        [
          first_name  || null,
          last_name   || null,
          bio         || null,
          birth_date  || null,
          gender      || null,
          faculty     || null,
          social_media|| null,
          tagsStr     || null,
          userId,
        ]
      );
    } else {
      // Create profile row if it doesn't exist yet
      await db.query(
        `INSERT INTO User_profile
           (user_id, frist_name, last_name, bio, brith_date, gender, faculty, social_media, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          first_name  || null,
          last_name   || null,
          bio         || null,
          birth_date  || null,
          gender      || null,
          faculty     || null,
          social_media|| null,
          tagsStr     || null,
        ]
      );
    }

    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('PUT /api/profile/me error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════
//  POST /api/profile/me/avatar
//  Upload / replace profile picture
//  multipart/form-data  field: "avatar"
// ══════════════════════════════════════════════════════════════
router.post('/me/avatar', upload.single('avatar'), async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  // Build the public URL path that the frontend can use
  const imgPath = `/userprofile/${req.file.filename}`;

  try {
    const [[existing]] = await db.query(
      'SELECT profile_id FROM User_profile WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      await db.query(
        'UPDATE User_profile SET profile_img = ? WHERE user_id = ?',
        [imgPath, userId]
      );
    } else {
      await db.query(
        'INSERT INTO User_profile (user_id, profile_img) VALUES (?, ?)',
        [userId, imgPath]
      );
    }

    return res.json({
      success: true,
      message: 'Avatar updated.',
      profile_img: imgPath,
    });
  } catch (err) {
    console.error('POST /api/profile/me/avatar error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/profile/me/avatar
//  Remove profile picture (reset to default)
// ══════════════════════════════════════════════════════════════
router.delete('/me/avatar', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    await db.query(
      'UPDATE User_profile SET profile_img = NULL WHERE user_id = ?',
      [userId]
    );
    return res.json({ success: true, message: 'Avatar removed.' });
  } catch (err) {
    console.error('DELETE /api/profile/me/avatar error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;