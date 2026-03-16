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
    return (req.session && req.session.userId) ?
        req.session.userId :
        (req.user && req.user.user_id ? req.user.user_id : null);
}

// ══════════════════════════════════════════════════════════════
//  GET /api/profile/me
// ══════════════════════════════════════════════════════════════
router.get('/me', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    try {
        const [[profile]] = await db.query(
            `SELECT
                u.user_id, u.user_name, u.university_email,
                up.profile_id,
                up.frist_name  AS first_name,
                up.last_name, up.bio,
                up.brith_date  AS birth_date,
                up.gender, up.faculty, up.social_media, up.tags, up.profile_img
             FROM User u
             LEFT JOIN User_profile up ON up.user_id = u.user_id
             WHERE u.user_id = ?`,
            [userId]
        );

        if (!profile) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        profile.tags = profile.tags
            ? profile.tags.split(',').map((t) => t.trim()).filter(Boolean)
            : [];

        return res.json({ success: true, profile });
    } catch (err) {
        console.error('GET /api/profile/me error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════
//  GET /api/profile/:userId
// ══════════════════════════════════════════════════════════════
// ── 1. GET /api/profile/my-trips (ต้องอยู่อันนี้ก่อน!) ────────
router.get('/my-trips', async (req, res) => {
    const userId = getUserId(req);
    console.log("Fetching trips for User ID:", userId);

    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    try {
        // ดึงข้อมูลจากตาราง Trip ตามชื่อคอลัมน์ในรูป DB ของคุณ
        const [trips] = await db.query(
            `SELECT trip_id, trip_name, location_name, cover_image, trip_status 
             FROM Trip 
             WHERE creator_id = ? 
             ORDER BY created_at DESC`, 
            [userId]
        );

        console.log(`Found ${trips.length} trips for user 18`);
        return res.json({ success: true, trips });
    } catch (err) {
        console.error('GET /api/profile/my-trips error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ── 2. GET /api/profile/:userId (อันนี้ต้องอยู่ทีหลัง) ────────
router.get('/:userId', async (req, res) => {
    const { userId } = req.params;

    // ถ้า userId ไม่ใช่ตัวเลข (เช่น เป็นคำว่า 'my-trips') มันจะติดตรงนี้ถ้าเราวางผิดลำดับ
    if (!Number.isInteger(Number(userId))) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    try {
        const [[profile]] = await db.query(
            `SELECT u.user_id, u.user_name, up.frist_name AS first_name, up.last_name, 
                    up.bio, up.brith_date AS birth_date, up.gender, up.faculty, 
                    up.social_media, up.tags, up.profile_img
             FROM User u
             LEFT JOIN User_profile up ON up.user_id = u.user_id
             WHERE u.user_id = ? AND u.status = 'active'`,
            [userId]
        );

        if (!profile) return res.status(404).json({ success: false, message: 'User not found' });
        
        profile.tags = profile.tags ? profile.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        return res.json({ success: true, profile });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════
//  PUT /api/profile/me
// ══════════════════════════════════════════════════════════════
router.put('/me', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { first_name, last_name, bio, birth_date, gender, faculty, social_media, tags } = req.body;

    const allowedGenders = ['Male', 'Female', 'Other', null, ''];
    if (gender !== undefined && !allowedGenders.includes(gender)) {
        return res.status(400).json({ success: false, message: "Gender must be 'Male', 'Female', or 'Other'." });
    }

    let tagsStr = '';
    if (Array.isArray(tags)) {
        tagsStr = tags.map((t) => t.trim()).filter(Boolean).join(',');
    } else if (typeof tags === 'string') {
        tagsStr = tags.split(',').map((t) => t.trim()).filter(Boolean).join(',');
    }

    try {
        const [[existing]] = await db.query(
            'SELECT profile_id FROM User_profile WHERE user_id = ?', [userId]
        );

        if (existing) {
            await db.query(
                `UPDATE User_profile
                 SET frist_name=?, last_name=?, bio=?, brith_date=?,
                     gender=?, faculty=?, social_media=?, tags=?
                 WHERE user_id = ?`,
                [first_name||null, last_name||null, bio||null, birth_date||null,
                 gender||null, faculty||null, social_media||null, tagsStr||null, userId]
            );
        } else {
            await db.query(
                `INSERT INTO User_profile
                    (user_id, frist_name, last_name, bio, brith_date, gender, faculty, social_media, tags)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, first_name||null, last_name||null, bio||null, birth_date||null,
                 gender||null, faculty||null, social_media||null, tagsStr||null]
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
// ══════════════════════════════════════════════════════════════
router.post('/me/avatar', upload.single('avatar'), async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const imgPath = `/userprofile/${req.file.filename}`;

    try {
        const [[existing]] = await db.query(
            'SELECT profile_id FROM User_profile WHERE user_id = ?', [userId]
        );

        if (existing) {
            await db.query(
                'UPDATE User_profile SET profile_img = ? WHERE user_id = ?', [imgPath, userId]
            );
        } else {
            await db.query(
                'INSERT INTO User_profile (user_id, profile_img) VALUES (?, ?)', [userId, imgPath]
            );
        }

        // อัปเดต session ด้วย
        if (req.session) {
            req.session.profileImg = imgPath;
        }

        return res.json({ success: true, message: 'Avatar updated.', profile_img: imgPath });
    } catch (err) {
        console.error('POST /api/profile/me/avatar error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════
//  DELETE /api/profile/me/avatar
// ══════════════════════════════════════════════════════════════
router.delete('/me/avatar', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    try {
        await db.query(
            'UPDATE User_profile SET profile_img = NULL WHERE user_id = ?', [userId]
        );

        if (req.session) {
            req.session.profileImg = null;
        }

        return res.json({ success: true, message: 'Avatar removed.' });
    } catch (err) {
        console.error('DELETE /api/profile/me/avatar error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;