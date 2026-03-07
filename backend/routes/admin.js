const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/login', async (req, res) => {
    const { gmail, password } = req.body;

    try {
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
        console.error("Login Error:", err); 
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์", error: err.message });
    }
});

router.get('/stats', async (req, res) => {
    try {
        // นับผู้ใช้ที่เข้ามาใช้งานในวันนี้ (อิงตาม last_login)
        // DATE(last_login) จะดึงเฉพาะส่วนวันที่มาเทียบกับวันที่ปัจจุบัน
        const [activeUsers] = await db.query(`
            SELECT COUNT(*) as total 
            FROM User 
            WHERE role = 'user' 
            AND DATE(last_login) = CURDATE()
        `);
        
        // นับทริปแยกตามสถานะ
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
        console.error("User Growth Detailed Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/review-stats', async (req, res) => {
    try {
        // นับทริปที่จบแล้ว (Closed) ทั้งหมด
        const [totalClosed] = await db.query("SELECT COUNT(*) as count FROM Trip WHERE trip_status = 'Closed'");
        
        // นับทริปที่มีการรีวิวแล้ว
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

// ดึงรายชื่อผู้ใช้ทั้งหมด พร้อมค้นหาและกรอง
router.get('/users', async (req, res) => {
    const { search, role, status } = req.query;
    try {
        let query = `
            SELECT user_id, user_name, university_email, role, status, created_at 
            FROM User WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (user_name LIKE ? OR university_email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        if (role && role !== 'all') {
            query += ` AND role = ?`;
            params.push(role);
        }
        if (status && status !== 'all') {
            query += ` AND status = ?`;
            params.push(status);
        }

        const [users] = await db.query(query, params);
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ฟังก์ชันแบนผู้ใช้ (บันทึกลง banned_logs และอัปเดตสถานะ User)
router.post('/ban-user', async (req, res) => {
    const { user_id, admin_id, reason } = req.body;
    
    try {
        await db.query('START TRANSACTION');

        if (reason && reason.trim() !== "") {
            // --- กรณีแบน: เปลี่ยนเป็น 'banned' ---
            await db.query("UPDATE User SET status = 'banned' WHERE user_id = ?", [user_id]);

            await db.query(
                "INSERT INTO Banned_logs (user_id, admin_id, reason, banned_at) VALUES (?, ?, ?, NOW())",
                [user_id, admin_id || 1, reason]
            );
        } else {
            // --- กรณีปลดแบน: เปลี่ยนเป็น 'active' ---
            await db.query("UPDATE User SET status = 'active' WHERE user_id = ?", [user_id]);
            
            // ลบประวัติการแบนออกเพื่อให้หน้าจอไม่โชว์เหตุผลค้างไว้
            await db.query("DELETE FROM Banned_logs WHERE user_id = ?", [user_id]);
        }

        await db.query('COMMIT');
        res.status(200).json({ message: "อัปเดตสถานะสำเร็จ" });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Update Status Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/users-list', async (req, res) => {
    const { search, status } = req.query; 

    try {
        let query = `
            SELECT 
                u.user_id, u.user_name, u.university_email, u.user_password, 
                u.role, u.status, b.reason
            FROM User u
            LEFT JOIN (
                SELECT user_id, reason FROM Banned_logs 
                WHERE ban_id IN (SELECT MAX(ban_id) FROM Banned_logs GROUP BY user_id)
            ) b ON u.user_id = b.user_id
            WHERE u.role != 'admin'
        `;
        const params = [];

        if (search) {
            query += ` AND (u.user_name LIKE ? OR u.university_email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (status && status !== '') {
            query += ` AND u.status = ?`;
            params.push(status);
        }

        const [rows] = await db.query(query, params);
        res.status(200).json(rows);
    } catch (err) {
        console.error("Users List Error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;