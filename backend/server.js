require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const passport = require('passport');
const session  = require('express-session');

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads',     express.static(path.join(__dirname, 'uploads')));
app.use('/userprofile', express.static(path.join(__dirname, 'userprofile')));

// ── Session (must come BEFORE passport) ────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'joinjoy_session_secret',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Routes ──────────────────────────────────────────────────
const boardRoute         = require('./routes/board');
const adminRoutes        = require('./routes/admin');
const notificationRoutes = require('./routes/notification');
const homepageRoute      = require('./routes/homepage');
const loginRoute         = require('./routes/login');       // ✅ register + login
const googleAuth         = require('./routes/googleAuth');  // ✅ Google OAuth

app.use('/api/board',        boardRoute);
app.use('/api/admin',        adminRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/user',         homepageRoute);
app.use('/api/trips',        homepageRoute);
app.use('/api/reviews',      homepageRoute);
app.use('/api/auth',         loginRoute);   // POST /api/auth/register  &  POST /api/auth/login
app.use('/auth',             googleAuth);   // GET  /auth/google  &  GET /auth/google/callback


app.get("/", (req, res) => {
    res.redirect("/html/home.html");
});

app.use(passport.initialize());
app.use(passport.session());

app.use("/auth", googleAuth);  // ← this line MUST exist

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});