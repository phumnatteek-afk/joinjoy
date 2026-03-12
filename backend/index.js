const express = require('express');
const cors = require('cors');
const db = require('./db'); // เรียกไฟล์ที่เราเพิ่งแก้ตะกี้

const app = express();
app.use(cors());
app.use(express.json());

// API: ดึงข้อมูลทริปทั้งหมดจาก Database
// API สำหรับดึงข้อมูลทริปทั้งหมดจากตาราง create_trip
app.get('/api/create-trip', async(req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM create_trip');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
    }
});
// ตรงส่วนดึงข้อมูล
app.get('/api/review', async(req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Reviews'); // แก้เป็น R ใหญ่
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลรีวิวไม่สำเร็จ' });
    }
});
app.get('/api/trip-detail/:id', async(req, res) => {
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
        res.status(500).json({ error: "ดึงข้อมูลล้มเหลว ตรวจสอบ SQL ใน Terminal" });
    }
});
// เพิ่มบรรทัดนี้เพื่อรองรับการดึงข้อมูลจากหน้าแอป (JSON Body)
app.post('/api/trip', async(req, res) => {
    // รับค่า category_id เพิ่มเข้ามาด้วย
    const { group_name, location, budget_range, max_members, description, category_id } = req.body;

    try {
        const sql = `INSERT INTO create_trip (group_name, location, budget_range, max_members, description, category_id) 
                     VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [group_name, location, budget_range, max_members, description, category_id]);

        res.status(201).json({
            success: true,
            message: 'บันทึกข้อมูลลงใน create_trip เรียบร้อย!',
            insertedId: result.insertId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'บันทึกข้อมูลไม่สำเร็จ' });
    }
});

const multer = require('multer');
const path = require('path');

// 1. ตั้งค่าการเก็บไฟล์รูป
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // เก็บที่โฟลเดอร์ uploads
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // ตั้งชื่อไฟล์ตามเวลา + นามสกุลเดิม
    }
});
const upload = multer({ storage: storage });

// 2. ให้ Server รู้จักโฟลเดอร์ uploads (เพื่อให้เราเปิดดูรูปผ่าน Browser ได้)
app.use('/uploads', express.static('uploads'));

// 3. API สำหรับบันทึกรีวิวพร้อมรูปภาพ
app.post('/api/review', upload.single('image'), async(req, res) => {
    const { trip_id, rating, comment } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null; // เก็บ Path รูป

    try {
        const sql = `INSERT INTO Reviews (trip_id, rating, comment, image_url) 
                     VALUES (?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [trip_id, rating, comment, image_url]);

        res.status(201).json({
            success: true,
            message: "รีวิวสำเร็จ!",
            reviewId: result.insertId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "บันทึกรีวิวไม่สำเร็จ" });
    }
});

// แก้จาก 3000 เป็นแบบนี้
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});