const express = require('express');
const router = express.Router();
const db = require('../db');
const notificationRouter = require('./notification');

// API: ดูรายละเอียดทริปตาม ID
router.get('/trip-detail/:id', async(req, res) => {
    const tripId = req.params.id;
    try {
        const sql = `
            SELECT 
                t.*, 
                u.user_name AS host_name, 
                (SELECT COUNT(*) FROM Trip_member WHERE trip_id = t.trip_id AND status = 'Joined') AS current_members
            FROM Trip t
            LEFT JOIN User u ON t.creator_id = u.user_id
            WHERE t.trip_id = ?
        `;
        const [rows] = await db.query(sql, [tripId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูลทริป" });
        }

        const trip = rows[0];

        // ถ้าทริปจบแล้ว (end_time < now) แต่สถานะยังไม่ได้ถูกตั้งเป็น Closed ให้เปลี่ยนสถานะและแจ้งเตือนรีวิว
        const endTime = new Date(trip.end_time);
        const now = new Date();
        if (trip.trip_status !== 'Closed' && !Number.isNaN(endTime.getTime()) && endTime <= now) {
            try {
                await db.query("UPDATE Trip SET trip_status = 'Closed' WHERE trip_id = ?", [tripId]);
                trip.trip_status = 'Closed';
                await notificationRouter.createReviewNotificationsForTrip(tripId, req.app.get('io'));
            } catch (err) {
                console.error('Error creating review notifications:', err);
            }
        }

        res.json(trip);
    } catch (err) {
        console.error("Database Error:", err.sqlMessage);
        res.status(500).json({ error: "ดึงข้อมูลล้มเหลว" });
    }
});



// GET สมาชิกในทริป
router.get('/:id/members', async (req, res) => {
    const tripId = req.params.id;
    try {
        const [members] = await db.query(`
            SELECT tm.user_id, tm.status, 
                   u.user_name, u.profile_image
            FROM Trip_member tm
            JOIN User u ON u.user_id = tm.user_id
            WHERE tm.trip_id = ? 
            AND tm.status IN ('Joined', 'Pending')
        `, [tripId]);
        res.json(members);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;