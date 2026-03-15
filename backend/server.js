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
    origin: ['http://localhost:3000', 'http://127.0.0.1:5501', 'http://localhost:5501'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/userprofile', express.static(path.join(__dirname, 'userprofile')));

// ── Session (must come BEFORE passport) ────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'joinjoy_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
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
app.use('/api/trips', homepageRoute); // GET /api/trips/upcoming ฯลฯ
app.use('/api/reviews', homepageRoute); // GET /api/reviews/recent
app.use('/api/auth', loginRoute); // POST /api/auth/login, /api/auth/register
app.use('/auth', googleAuth); // GET /auth/google, /auth/google/callback
app.use('/api', createTripRouter); // สำหรับ /api/trip และ /api/create-trip
app.use('/api', detailRouter); // สำหรับ /api/trip-detail/:id
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