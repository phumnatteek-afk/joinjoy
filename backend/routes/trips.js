const express = require('express');
const router = express.Router();
const db = require('../db'); // เช็ค Path ให้ถูกว่าชี้ไปไฟล์ต่อ Database
const multer = require('multer');
const path = require('path');

// ── 1. เพิ่มฟังก์ชันนี้เข้าไป ──────────────────────
function requireLogin(req, res, next) {
    // เช็คทั้ง Passport (req.user) หรือ Session ปกติ (req.session.userId)
    if (req.isAuthenticated && req.isAuthenticated()) return next();
    if (req.session && req.session.userId) return next();
    
    return res.status(401).json({ success: false, error: 'กรุณา Login ก่อนดำเนินการ' });
}

// ── 2. ตั้งค่า Multer (ถ้ายังไม่มีในไฟล์นี้) ─────────────
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


router.put('/trips/:id', requireLogin, upload.single('cover_image'), async (req, res) => {
    const tripId = req.params.id;
    const userId = (req.user && req.user.user_id) || req.session.userId;

    const {
        trip_name, category, location_name, budget_min, budget_max,
        budget_type, max_member, start_time, end_time,
        limit_date_accept, description, trip_detail
    } = req.body;

    try {
        // 1. เช็คว่าทริปนี้มีจริงไหม และคนแก้เป็นเจ้าของ (creator_id) หรือเปล่า
        const [rows] = await db.query('SELECT creator_id, cover_image FROM Trip WHERE trip_id = ?', [tripId]);
        if (rows.length === 0) return res.status(404).json({ success: false, error: 'ไม่พบทริป' });
        
        if (rows[0].creator_id !== userId) {
            return res.status(403).json({ success: false, error: 'คุณไม่มีสิทธิ์แก้ไขทริปนี้' });
        }

        // 2. จัดการรูปภาพ: ถ้ามีรูปใหม่มา ให้ใช้รูปใหม่ ถ้าไม่มีให้ใช้รูปเดิม (rows[0].cover_image)
        const cover_image = req.file ? `uploads/${req.file.filename}` : rows[0].cover_image;

        const sql = `
            UPDATE Trip SET 
                trip_name=?, category=?, location_name=?, budget_min=?, budget_max=?, 
                budget_type=?, max_member=?, start_time=?, end_time=?, 
                limit_date_accept=?, description=?, trip_detail=?, cover_image=?
            WHERE trip_id = ?
        `;

        await db.execute(sql, [
            trip_name, category || null, location_name, budget_min || null, budget_max || null,
            budget_type, max_member, start_time, end_time,
            limit_date_accept, description || null, trip_detail || null, cover_image,
            tripId
        ]);

        res.json({ success: true, message: 'อัปเดตทริปสำเร็จ!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error: ' + err.message });
    }
});


// ── สมาชิกกดยกเลิกเข้าร่วมทริป ──
router.delete('/trips/:id/leave', requireLogin, async (req, res) => {
  const tripId = req.params.id;
  const userId = (req.user && req.user.user_id) || req.session.userId;
  try {
    // ดึง creator_id และชื่อทริป
    const [trips] = await db.query('SELECT creator_id, trip_name FROM Trip WHERE trip_id = ?', [tripId]);
    if (!trips || trips.length === 0) return res.status(404).json({ success: false, error: 'ไม่พบทริป' });

    // ลบสมาชิกออกจาก Trip_member
    await db.query('DELETE FROM Trip_member WHERE trip_id = ? AND user_id = ?', [tripId, userId]);

    // แจ้งเตือนโฮส
    const title = '❌ สมาชิกยกเลิกเข้าร่วมทริป';
    const detail = `สมาชิก user_id ${userId} ได้ยกเลิกเข้าร่วมทริป "${trips[0].trip_name}"`;
    await db.query(
      `INSERT INTO Notification (trip_id, user_id, notification_title, notification_detail, from_user_id, create_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [tripId, trips[0].creator_id, title, detail, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server error: ' + err.message });
  }
});

module.exports = router;