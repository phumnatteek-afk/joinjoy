const express = require('express');
const cors    = require('cors');
const db      = require('./db');
const multer  = require('multer');
const path    = require('path');

const app = express();
app.use(cors());
app.use(express.json());

/* ── Static uploads ──────────────────────────────────────── */
app.use('/uploads', express.static('uploads'));

/* ── Multer config ───────────────────────────────────────── */
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename:    (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });

/* ════════════════════════════════════════════════════════════
   TRIP ROUTES
════════════════════════════════════════════════════════════ */

// GET /api/trip-detail/:id
app.get('/api/trip-detail/:id', async (req, res) => {
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
        if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลทริป' });
        res.json(rows[0]);
    } catch (err) {
        console.error('GET /api/trip-detail error:', err);
        res.status(500).json({ error: 'ดึงข้อมูลล้มเหลว' });
    }
});

// GET /api/trip-members/:id
app.get('/api/trip-members/:id', async (req, res) => {
    const tripId = req.params.id;
    try {
        const sql = `
            SELECT
                u.user_id,
                u.user_name,
                COALESCE(up.profile_img, '') AS profile_img,
                COALESCE(up.frist_name, '') AS first_name,
                COALESCE(up.last_name, '')  AS last_name,
                tm.status
            FROM Trip_member tm
            JOIN User u ON tm.user_id = u.user_id
            LEFT JOIN User_profile up ON up.user_id = u.user_id
            WHERE tm.trip_id = ?
        `;
        const [rows] = await db.query(sql, [tripId]);
        res.json(rows);
    } catch (err) {
        console.error('GET /api/trip-members error:', err);
        res.status(500).json({ error: 'ดึงข้อมูลสมาชิกไม่สำเร็จ' });
    }
});

// POST /api/join-trip
app.post('/api/join-trip', async (req, res) => {
    const { trip_id, user_id } = req.body;
    if (!trip_id || !user_id) return res.status(400).json({ error: 'ต้องระบุ trip_id และ user_id' });
    try {
        const [existing] = await db.query(
            'SELECT * FROM Trip_member WHERE trip_id = ? AND user_id = ?',
            [trip_id, user_id]
        );
        if (existing.length > 0) return res.status(409).json({ error: 'คุณได้เข้าร่วมทริปนี้แล้ว' });

        const [tripRows] = await db.query(
            `SELECT max_member,
                    (SELECT COUNT(*) FROM Trip_member WHERE trip_id = ? AND status = 'Joined') AS current_count
             FROM Trip WHERE trip_id = ?`,
            [trip_id, trip_id]
        );
        if (tripRows.length === 0) return res.status(404).json({ error: 'ไม่พบทริป' });
        const { max_member, current_count } = tripRows[0];
        if (current_count >= max_member) return res.status(400).json({ error: 'ทริปเต็มแล้ว' });

        await db.execute(
            `INSERT INTO Trip_member (trip_id, user_id, status, joined_at) VALUES (?, ?, 'Joined', NOW())`,
            [trip_id, user_id]
        );
        res.status(201).json({ success: true, message: 'เข้าร่วมทริปสำเร็จ' });
    } catch (err) {
        console.error('POST /api/join-trip error:', err);
        res.status(500).json({ error: 'เข้าร่วมทริปไม่สำเร็จ' });
    }
});

/* ════════════════════════════════════════════════════════════
   USER ROUTES
════════════════════════════════════════════════════════════ */

// GET /api/user/:user_id
// User_profile columns: frist_name, last_name, bio, gender, faculty, social_media, tags, profile_img
app.get('/api/user/:user_id', async (req, res) => {
    const userId = req.params.user_id;
    try {
        const sql = `
            SELECT
                u.user_id,
                u.user_name,
                up.frist_name,
                up.last_name,
                up.bio,
                up.gender,
                up.faculty,
                up.social_media,
                up.tags,
                up.profile_img
            FROM User u
            LEFT JOIN User_profile up ON up.user_id = u.user_id
            WHERE u.user_id = ?
        `;
        const [rows] = await db.query(sql, [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        res.json(rows[0]);
    } catch (err) {
        console.error('GET /api/user error:', err);
        res.status(500).json({ error: 'ดึงข้อมูลผู้ใช้ไม่สำเร็จ' });
    }
});

/* ════════════════════════════════════════════════════════════
   OTHER ROUTES
════════════════════════════════════════════════════════════ */

app.get('/api/create-trip', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM create_trip');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ' });
    }
});

app.get('/api/review', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM Reviews');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ดึงข้อมูลรีวิวไม่สำเร็จ' });
    }
});

app.post('/api/trip', async (req, res) => {
    const { group_name, location, budget_range, max_members, description, category_id } = req.body;
    try {
        const sql = `INSERT INTO create_trip (group_name, location, budget_range, max_members, description, category_id)
                     VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [group_name, location, budget_range, max_members, description, category_id]);
        res.status(201).json({ success: true, message: 'บันทึกข้อมูลสำเร็จ', insertedId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'บันทึกข้อมูลไม่สำเร็จ' });
    }
});

app.post('/api/review', upload.single('image'), async (req, res) => {
    const { trip_id, rating, comment } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    try {
        const sql = `INSERT INTO Reviews (trip_id, rating, comment, image_url) VALUES (?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [trip_id, rating, comment, image_url]);
        res.status(201).json({ success: true, message: 'รีวิวสำเร็จ!', reviewId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'บันทึกรีวิวไม่สำเร็จ' });
    }
});

/* ── Start server ────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});