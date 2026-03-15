const express = require('express');
const router = express.Router();
const db = require('../db');

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
        res.json(rows[0]);
    } catch (err) {
        console.error("Database Error:", err.sqlMessage);
        res.status(500).json({ error: "ดึงข้อมูลล้มเหลว" });
    }
});

module.exports = router;