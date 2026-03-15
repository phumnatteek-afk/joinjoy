const express = require('express');
const router = express.Router();
const db = require('../db'); // ย้อนกลับไปหาไฟล์ db.js

// API: ดึงข้อมูลทริปทั้งหมด
router.get('/create-trip', async(req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM create_trip');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
    }
});

// API: บันทึกทริปใหม่
router.post('/trip', async(req, res) => {
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

module.exports = router;