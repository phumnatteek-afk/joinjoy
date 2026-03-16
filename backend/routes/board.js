const express = require('express');
const router = express.Router();
const db = require('../db');

function getCurrentUserId(req) {
    const sessionUserId = (req.session && req.session.userId) ? Number(req.session.userId) : null;
    const authUserId = (req.user && req.user.user_id) ? Number(req.user.user_id) : null;
    const queryUserId = (req.query && req.query.user_id) ? Number(req.query.user_id) : null;
    return sessionUserId || authUserId || queryUserId || 0;
}

router.get('/trips', async(req, res) => {
    const currentUserId = getCurrentUserId(req);
    try {
        // ส่วนของ SQL Query ในไฟล์ backend
        const [rows] = await db.query(`
            SELECT 
                t.trip_id, 
                t.trip_name, 
                t.description, 
                t.category, 
                t.location_name,
                t.cover_image, 
                t.max_member,
                t.start_time,      
                t.end_time,       
                t.limit_date_accept,
                t.budget_min,      
                t.budget_max,     
                t.created_at,
                t.trip_status,
                t.creator_id,
                ? AS me_user_id,
                u.user_name,
                NULL AS user_avatar,
                (SELECT COUNT(*) FROM Trip_member tm WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS current_member,
                CASE WHEN t.creator_id = ? THEN 1 ELSE 0 END AS is_host,
                (SELECT tm2.status FROM Trip_member tm2 WHERE tm2.trip_id = t.trip_id AND tm2.user_id = ? LIMIT 1) AS my_join_status
            FROM Trip t
            JOIN User u ON t.creator_id = u.user_id
            WHERE t.trip_status = 'Open'
            ORDER BY t.created_at DESC
        `, [currentUserId, currentUserId, currentUserId]);

        // ถ้าไม่มีข้อมูล ส่ง Array ว่างกลับไป (ถูกต้องแล้ว)
        if (rows.length === 0) {
            return res.status(200).json([]);
        }

        const formattedRows = rows.map(trip => {
            // ตรวจสอบว่าเลยวันปิดรับหรือยัง (Expired)
            const now = new Date();
            const limitDate = trip.limit_date_accept ? new Date(trip.limit_date_accept) : null;
            const isExpired = limitDate && now > limitDate;

            return {
                ...trip,
                is_expired: isExpired, // ส่งค่า boolean นี้ไปให้ frontend เช็คได้ง่ายขึ้น
                // cover_image: trip.cover_image ? `/uploads/trips/${trip.cover_image}` : null
            };
        });

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