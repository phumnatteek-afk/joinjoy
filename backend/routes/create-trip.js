const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// ตั้งค่า multer สำหรับอัปโหลดรูปภาพ
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'cover-' + unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ── Middleware ตรวจสอบว่า login แล้ว ──────────────────────
function requireLogin(req, res, next) {
    // รองรับทั้ง passport session (req.user) และ manual session (req.session.userId)
    if (req.isAuthenticated() || req.session.userId) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'กรุณา login ก่อนสร้างทริป' });
}

// ─────────────────────────────────────────
// GET /api/trips  — ดึงทริปทั้งหมด
// ─────────────────────────────────────────
router.get('/trips', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Trip ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
    }
});

// ─────────────────────────────────────────
// POST /api/trips  — สร้างทริปใหม่ (ต้อง login)
// ─────────────────────────────────────────
router.post('/trips', requireLogin, upload.single('cover_image'), async (req, res) => {

    // ดึง creator_id จาก session — รองรับทั้ง Google OAuth (req.user) และ login ปกติ (req.session.userId)
    const creator_id = req.user?.user_id || req.session.userId;

    const {
        trip_name,
        category,
        location_name,
        budget_min,
        budget_max,
        max_member,
        start_time,
        end_time,
        description,
        trip_detail
    } = req.body;

    const cover_image = req.file ? `uploads/${req.file.filename}` : null;

    // Validate field บังคับ
    if (!trip_name || !location_name || !max_member || !start_time || !end_time) {
        return res.status(400).json({
            success: false,
            error: 'กรุณากรอกข้อมูลที่จำเป็น: ชื่อทริป, สถานที่, จำนวนสมาชิก, วันเวลา'
        });
    }

    try {
        const sql = `
    INSERT INTO Trip
        (creator_id, trip_name, category, location_name,
         budget_min, budget_max, max_member, current_member,
         start_time, end_time, description, trip_detail,
         cover_image, trip_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'open', NOW())
`;

        const values = [
            creator_id,
            trip_name,
            category || null,
            location_name,
            budget_min || null,
            budget_max || null,
            max_member,
            start_time,
            end_time,
            description || null,
            trip_detail || null,
            cover_image
        ];

        const [result] = await db.execute(sql, values);

        res.status(201).json({
            success: true,
            message: 'สร้างทริปสำเร็จ!',
            trip_id: result.insertId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'บันทึกข้อมูลไม่สำเร็จ: ' + err.message });
    }
});

// ─────────────────────────────────────────
// GET /api/trips/:id  — ดึงทริปเดียว
// ─────────────────────────────────────────
router.get('/trips/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Trip WHERE trip_id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบทริปนี้' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
    }
});

module.exports = router;