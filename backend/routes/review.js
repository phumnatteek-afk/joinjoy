const express = require('express');
const router = express.Router();
const mysql = require('mysql2'); // นำเข้า mysql2 เพื่อจัดการ Database

// 1. สร้างการเชื่อมต่อกับ Database (Connection Pool)
const db = mysql.createPool({
    // ⚠️ สำคัญ: เปลี่ยน localhost เป็น Host ที่ก๊อปมาจาก DBeaver
    host: 'mysql-1066d366-silpakorn-joinjoy.j.aivencloud.com',
    user: 'avnadmin', // สำหรับ DigitalOcean มักใช้ชื่อนี้
    password: 'AVNS_udpq4sPQJKS-nsh0bpM',
    database: 'defaultdb',
    port: 16356,
    // ⚠️ สำคัญมาก: สำหรับ Cloud Database ต้องเปิด SSL ไม่งั้นจะต่อไม่ติด
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ตรวจสอบสถานะการเชื่อมต่อทันทีที่รัน Server
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database Connection Failed (Port 16356):", err.message);
    } else {
        console.log("✅ Database Connected: เชื่อมต่อผ่าน Port 16356 สำเร็จ!");
        connection.release(); // คืนการเชื่อมต่อกลับเข้า Pool
    }
});

// 2. สร้าง API สำหรับรับรีวิว (Endpoint: POST /api/review)
router.post('/review', (req, res) => {
    // รับค่าจาก Body ที่ส่งมาจาก frontend
    const { trip_id, user_id, review_text } = req.body;

    console.log("📩 ได้รับข้อมูลรีวิว:", req.body);

    // ตรวจสอบว่ากรอกข้อความมาหรือยัง
    if (!review_text || review_text.trim() === "") {
        return res.status(400).json({
            success: false,
            error: "กรุณากรอกข้อความรีวิวก่อนส่ง"
        });
    }

    // 3. เตรียมคำสั่ง SQL สำหรับบันทึกข้อมูล
    // ชื่อคอลัมน์ต้องตรงกับใน DBeaver: trip_id, user_id, review_text, created_at
    const sql = `INSERT INTO Reviews (trip_id, user_id, review_text, created_at) 
                 VALUES (?, ?, ?, NOW())`;

    const values = [
        trip_id || 1, // ถ้าไม่มีค่ามาให้ใส่ 1 เป็นค่าเริ่มต้น
        user_id || 1,
        review_text
    ];

    // 4. สั่งให้ Database ทำงาน
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("❌ SQL Query Error:", err);
            return res.status(500).json({
                success: false,
                error: "ไม่สามารถบันทึกรีวิวลงฐานข้อมูลได้: " + err.message
            });
        }

        console.log("✅ บันทึกรีวิวสำเร็จ! ID ที่ได้คือ:", result.insertId);
        res.status(200).json({
            success: true,
            message: "บันทึกรีวิวสำเร็จ",
            id: result.insertId
        });
    });
});

// 5. ส่ง Router นี้ออกไปให้ไฟล์ server.js เรียกใช้
module.exports = router;