const express = require('express');
const router = express.Router();
// สร้างไฟล์เชื่อมต่อ DB ไว้ใน config/db
const db = require('../config/db'); 

// API สำหรับดึงข้อมูลไปแสดงหน้า Board
router.get('/trips', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                t.*, 
                u.user_name,
                (SELECT COUNT(*) FROM Trip_member tm WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS current_member
            FROM Trip t
            JOIN User u ON t.creator_id = u.user_id
            WHERE t.trip_status = 'Open'
            ORDER BY t.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;