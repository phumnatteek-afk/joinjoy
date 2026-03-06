const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/login', async (req, res) => {
    const { gmail, password } = req.body;

    try {
        const [admin] = await db.query(
            'SELECT * FROM User WHERE gmail = ? AND password = ? AND role = "admin"', 
            [gmail, password]
        );

        if (admin.length > 0) {
            res.status(200).json({ 
                message: "Login successful", 
                adminId: admin[0].user_id 
            });
        } else {
            res.status(401).json({ message: "Gmail หรือ Password แอดมินไม่ถูกต้อง" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;