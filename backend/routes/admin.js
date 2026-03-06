const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/login', async (req, res) => {
    const { gmail, password } = req.body;

    try {
        // แก้ตรง AND role = 'admin' ให้ใช้ single quotes ครับ
        const [rows] = await db.query(
            "SELECT * FROM User WHERE university_email = ? AND user_password = ? AND role = 'admin'", 
            [gmail, password]
        );

        if (rows.length > 0) {
            res.status(200).json({ 
                message: "Login Successful", 
                admin: rows[0],
                token: 'mock-admin-token' 
            });
        } else {
            res.status(401).json({ message: "ข้อมูลไม่ถูกต้อง หรือคุณไม่มีสิทธิ์เข้าถึงส่วนนี้" });
        }
    } catch (err) {
        console.error("Login Error:", err); // พิมพ์ Error ออก Terminal
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์", error: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        // 1. นับผู้ใช้ที่เข้ามาใช้งานในวันนี้ (อิงตาม last_login)
        // DATE(last_login) จะดึงเฉพาะส่วนวันที่มาเทียบกับวันที่ปัจจุบัน
        const [activeUsers] = await db.query(`
            SELECT COUNT(*) as total 
            FROM User 
            WHERE role = 'user' 
            AND DATE(last_login) = CURDATE()
        `);
        
        // 2. นับทริปแยกตามสถานะ (เหมือนเดิม)
        const [trips] = await db.query(`
            SELECT 
                COUNT(CASE WHEN trip_status = 'Open' THEN 1 END) as open_count,
                COUNT(CASE WHEN trip_status = 'Full' THEN 1 END) as full_count,
                COUNT(CASE WHEN trip_status = 'Closed' THEN 1 END) as closed_count
            FROM Trip
        `);

        res.status(200).json({
            activeUsers: activeUsers[0].total || 0,
            open: trips[0].open_count || 0,
            full: trips[0].full_count || 0,
            closed: trips[0].closed_count || 0
        });
    } catch (err) {
        console.error("Dashboard Stats Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

router.get('/user-growth', async (req, res) => {
    try {
        // ปรับ GROUP BY ให้ตรงกับสิ่งที่ SELECT ออกมาเป๊ะๆ
        const [rows] = await db.query(`
            SELECT 
                DATE_FORMAT(created_at, '%b %Y') as month_label,
                COUNT(*) as monthly_count
            FROM User 
            WHERE role = 'user'
            GROUP BY DATE_FORMAT(created_at, '%b %Y'), YEAR(created_at), MONTH(created_at)
            ORDER BY YEAR(created_at) ASC, MONTH(created_at) ASC
            LIMIT 6
        `);

        let cumulativeTotal = 0;
        const cumulativeData = rows.map(item => {
            cumulativeTotal += item.monthly_count;
            return {
                month_label: item.month_label,
                cumulative_count: cumulativeTotal
            };
        });
        
        res.status(200).json(cumulativeData);
    } catch (err) {
        // พิมพ์ Error ออกมาดูแบบละเอียดใน Terminal
        console.error("User Growth Detailed Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/review-stats', async (req, res) => {
    try {
        // 1. นับทริปที่จบแล้ว (Closed) ทั้งหมด
        const [totalClosed] = await db.query("SELECT COUNT(*) as count FROM Trip WHERE trip_status = 'Closed'");
        
        // 2. นับทริปที่มีการรีวิวแล้ว (แก้ชื่อตารางเป็น Reviews)
        const [reviewedTrips] = await db.query(`
            SELECT COUNT(DISTINCT trip_id) as count 
            FROM Reviews 
            WHERE trip_id IN (SELECT trip_id FROM Trip WHERE trip_status = 'Closed')
        `);

        const reviewed = reviewedTrips[0].count || 0;
        const total = totalClosed[0].count || 0;
        const notReviewed = total - reviewed;

        res.status(200).json({
            reviewed: reviewed,
            notReviewed: notReviewed > 0 ? notReviewed : 0
        });
    } catch (err) {
        console.error("Review Stats Error:", err.message);
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;