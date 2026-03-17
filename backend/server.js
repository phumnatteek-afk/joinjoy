require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const session = require('express-session');
// ── Routes ที่ลี่สร้างเพิ่ม ─────────────────────────────────
const createTripRouter = require('./routes/create-trip');
const detailRouter = require('./routes/trip-detail');
const reviewRouter = require('./routes/review');

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
    origin: function(origin, callback) {
        callback(null, true);
    },
    credentials: true
}))
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/userprofile', express.static(path.join(__dirname, 'userprofile')));


// ── Session (must come BEFORE passport) ────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'joinjoy_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax', // ← เพิ่มบรรทัดนี้
        secure: false // ← false เพราะยังเป็น http (dev)
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Routes ──────────────────────────────────────────────────
const boardRoute = require('./routes/board');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notification');
const homepageRoute = require('./routes/homepage');
const loginRoute = require('./routes/login');
const googleAuth = require('./routes/googleAuth');

app.use('/api/board', boardRoute);
app.use('/api/admin', adminRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/user', homepageRoute); // GET /api/user/me

// ── GET /api/user/:user_id — member profile (must be after /api/user/me) ──
app.get('/api/user/:user_id', async(req, res) => {
    const userId = req.params.user_id;
    if (userId === 'me') return res.status(400).json({ error: 'use /api/user/me' });
    try {
        const [userRows] = await db.query(
            'SELECT user_id, user_name FROM User WHERE user_id = ?', [userId]
        );
        if (userRows.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

        let first_name = '',
            last_name = '',
            faculty = '',
            gender = '',
            bio = '',
            social_media = '',
            tags = '',
            profile_img = '';
        try {
            const [profileRows] = await db.query(
                'SELECT frist_name, last_name, faculty, gender, bio, social_media, tags, profile_img FROM User_profile WHERE user_id = ?', [userId]
            );
            if (profileRows.length > 0) {
                first_name = profileRows[0].frist_name || '';
                last_name = profileRows[0].last_name || '';
                faculty = profileRows[0].faculty || '';
                gender = profileRows[0].gender || '';
                bio = profileRows[0].bio || '';
                social_media = profileRows[0].social_media || '';
                tags = profileRows[0].tags || '';
                profile_img = profileRows[0].profile_img || '';
            }
        } catch (e) { /* no profile */ }

        res.json({
            user_id: userRows[0].user_id,
            user_name: userRows[0].user_name,
            first_name,
            last_name,
            faculty,
            gender,
            bio,
            social_media,
            tags,
            profile_img
        });
    } catch (err) {
        console.error('GET /api/user/:user_id error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.use('/api', detailRouter); // สำหรับ /api/trip-detail/:id
app.use('/api/trips', homepageRoute); // GET /api/trips/upcoming ฯลฯ
app.use('/api/reviews', homepageRoute); // GET /api/reviews/recent
app.use('/api/auth', loginRoute); // POST /api/auth/login, /api/auth/register
app.use('/auth', googleAuth); // GET /auth/google, /auth/google/callback
app.use('/api', createTripRouter); // สำหรับ /api/trip และ /api/create-trip

// ── GET /api/trip-members/:id ────────────────────────────────
const db = require('./db');
app.get('/api/trip-members/:id', async(req, res) => {
    const tripId = req.params.id;
    try {
        // Step 1: get only JOINED (approved) members
        const [members] = await db.query(
            "SELECT * FROM Trip_member WHERE trip_id = ? AND status = 'Joined'", [tripId]
        );

        if (members.length === 0) return res.json([]);

        // Step 2: get user info for each member one by one
        const result = [];
        for (const m of members) {
            try {
                const [userRows] = await db.query(
                    'SELECT user_id, user_name FROM User WHERE user_id = ?', [m.user_id]
                );
                if (userRows.length === 0) continue;

                let profile_img = '',
                    first_name = '',
                    last_name = '';
                try {
                    const [profileRows] = await db.query(
                        'SELECT frist_name, last_name, profile_img FROM User_profile WHERE user_id = ?', [m.user_id]
                    );
                    if (profileRows.length > 0) {
                        first_name = profileRows[0].frist_name || '';
                        last_name = profileRows[0].last_name || '';
                        profile_img = profileRows[0].profile_img || '';
                    }
                } catch (e) { /* skip if no profile */ }

                result.push({
                    user_id: userRows[0].user_id,
                    user_name: userRows[0].user_name,
                    profile_img,
                    first_name,
                    last_name,
                    status: m.status || null
                });
            } catch (e) { /* skip bad user */ }
        }

        res.json(result);
    } catch (err) {
        console.error('GET /api/trip-members error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/trip-member-detail/:user_id ─────────────────────
app.get('/api/trip-member-detail/:user_id', async(req, res) => {
    const userId = req.params.user_id;
    try {
        const [rows] = await db.query(`
            SELECT
                u.user_id,
                u.user_name,
                COALESCE(up.frist_name, '')    AS first_name,
                COALESCE(up.last_name, '')     AS last_name,
                COALESCE(up.faculty, '')       AS faculty,
                COALESCE(up.gender, '')        AS gender,
                COALESCE(up.bio, '')           AS bio,
                COALESCE(up.social_media, '')  AS social_media,
                COALESCE(up.tags, '')          AS tags,
                COALESCE(up.profile_img, '')   AS profile_img
            FROM User u
            LEFT JOIN User_profile up ON up.user_id = u.user_id
            WHERE u.user_id = ?
        `, [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        res.json(rows[0]);
    } catch (err) {
        console.error('GET /api/trip-member-detail error:', err);
        res.status(500).json({ error: 'ดึงข้อมูลผู้ใช้ไม่สำเร็จ' });
    }
});

// ── POST /api/join-trip ──────────────────────────────────────
app.post('/api/join-trip', async(req, res) => {
    const { trip_id, user_id } = req.body;
    if (!trip_id || !user_id) return res.status(400).json({ error: 'ต้องระบุ trip_id และ user_id' });
    try {
        const [existing] = await db.query(
            'SELECT * FROM Trip_member WHERE trip_id = ? AND user_id = ?', [trip_id, user_id]
        );
        if (existing.length > 0) return res.status(409).json({ error: 'คุณได้เข้าร่วมทริปนี้แล้ว' });

        const [tripRows] = await db.query(
            `SELECT max_member,
                    (SELECT COUNT(*) FROM Trip_member WHERE trip_id = ?) AS current_count
             FROM Trip WHERE trip_id = ?`, [trip_id, trip_id]
        );
        if (tripRows.length === 0) return res.status(404).json({ error: 'ไม่พบทริป' });
        if (tripRows[0].current_count >= tripRows[0].max_member)
            return res.status(400).json({ error: 'ทริปเต็มแล้ว' });

        await db.execute(
            `INSERT INTO Trip_member (trip_id, user_id) VALUES (?, ?)`, [trip_id, user_id]
        );
        res.status(201).json({ success: true, message: 'เข้าร่วมทริปสำเร็จ' });
    } catch (err) {
        console.error('POST /api/join-trip error:', err);
        res.status(500).json({ error: 'เข้าร่วมทริปไม่สำเร็จ' });
    }
});

app.use('/api', reviewRouter); // สำหรับ /api/review

const profileRouter = require('./routes/Profile');
app.use('/api/profile', profileRouter); // GET/PUT /api/profile/me, POST /api/profile/me/avatar

app.get('/', (req, res) => {
    res.redirect('/html/homepage.html'); // ✅ frontend serve จาก /frontend → path คือ /html/...
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});