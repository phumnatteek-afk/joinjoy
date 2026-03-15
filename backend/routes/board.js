const express = require('express');
const router = express.Router();
// สร้างไฟล์เชื่อมต่อ DB ไว้ใน config/db
const db = require('../db');

router.get('/trips', async(req, res) => {
    try {
        const [rows] = await db.query(`
    SELECT 
        t.trip_id, 
        t.trip_name, 
        t.description, 
        t.category, 
        t.cover_image, 
        t.max_member,
        t.created_at,
        u.user_name,
        (SELECT COUNT(*) FROM Trip_member tm WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS current_member
    FROM Trip t
    JOIN User u ON t.creator_id = u.user_id
    WHERE t.trip_status = 'Open'
    ORDER BY t.created_at DESC
`);

        // จัดการกรณีไม่มีทริป
        if (rows.length === 0) {
            // เพื่อให้ Frontend ไปเช็ค trips.length === 0 แล้วโชว์ข้อความ "ยังไม่มีทริป"
            return res.status(200).json([]);
        }

        res.status(200).json(rows);

    } catch (err) {
        // แยกประเภท Error
        console.error("Board Error:", err);

        if (err.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({
                error: "Database configuration error",
                message: "ไม่พบตารางที่ระบุในฐานข้อมูล"
            });
        }

        if (err.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(500).json({
                error: "SQL Syntax Error",
                message: "ชื่อ Column ใน SQL ไม่ถูกต้อง"
            });
        }

        res.status(500).json({
            error: "Internal Server Error",
            message: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล",
            details: err.message
        });
    }
});

module.exports = router;