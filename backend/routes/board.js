const express = require('express');
const router = express.Router();
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
        t.trip_status,
        u.user_name,
        NULL AS user_avatar, -- ใส่ NULL ไว้ก่อนถ้ายังหาชื่อคอลัมน์รูปไม่เจอ
        (SELECT COUNT(*) FROM Trip_member tm WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS current_member
    FROM Trip t
    JOIN User u ON t.creator_id = u.user_id
    WHERE t.trip_status = 'Open'
    ORDER BY t.created_at DESC
`);

        // ถ้าไม่มีข้อมูล ส่ง Array ว่างกลับไป (ถูกต้องแล้ว)
        if (rows.length === 0) {
            return res.status(200).json([]);
        }

        // เพิ่มเติม: ตรวจสอบข้อมูลก่อนส่ง (เช่น ถ้าไม่มีรูปให้ใส่ null หรือ default)
        const formattedRows = rows.map(trip => ({
            ...trip,
            // ถ้าอยากให้ Backend ต่อ Path รูปภาพให้เลย สามารถทำได้ที่นี่
            // cover_image: trip.cover_image ? `/uploads/trips/${trip.cover_image}` : null
        }));

        res.status(200).json(formattedRows);

    } catch (err) {
        console.error("Board Error Details:", err);

        // จัดการ Error ตามเดิม (ดีมากอยู่แล้ว)
        if (err.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({
                error: "Database configuration error",
                message: "ไม่พบตาราง Trip หรือ User ในฐานข้อมูล"
            });
        }

        if (err.code === 'ER_BAD_FIELD_ERROR') {
            return res.status(500).json({
                error: "SQL Syntax Error",
                message: "มีชื่อ Column ผิด (ลองเช็ค user_avatar หรือ profile_image)"
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