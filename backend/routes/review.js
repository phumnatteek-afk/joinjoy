const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// ตั้งค่า Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// API: ดึงข้อมูลรีวิว
router.get('/review', async(req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Reviews');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลรีวิวไม่สำเร็จ' });
    }
});

// API: บันทึกรีวิวพร้อมรูปภาพ
router.post('/review', upload.single('image'), async(req, res) => {
    const { trip_id, rating, comment } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const sql = `INSERT INTO Reviews (trip_id, rating, comment, image_url) VALUES (?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [trip_id, rating, comment, image_url]);
        res.status(201).json({ success: true, message: "รีวิวสำเร็จ!", reviewId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "บันทึกรีวิวไม่สำเร็จ" });
    }
});

module.exports = router;