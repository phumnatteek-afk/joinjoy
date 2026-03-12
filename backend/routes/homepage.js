const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

function getUserId(req) {
  return req.session?.userId || req.user?.user_id || null;
}

// ── GET /api/user/me ──────────────────────────────────────────
router.get('/me', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  try {
    const [[user]] = await db.query(`
      SELECT u.user_id, u.user_name, u.university_email,
             up.frist_name AS first_name,
             up.last_name, up.faculty, up.tags, up.profile_img
      FROM User u
      LEFT JOIN User_profile up ON up.user_id = u.user_id
      WHERE u.user_id = ?
    `, [userId]);
    if (!user) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, user });
  } catch (err) {
    console.error('GET /api/user/me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/trips/upcoming ───────────────────────────────────
router.get('/upcoming', async (req, res) => {
  try {
    const [trips] = await db.query(`
      SELECT t.*, u.user_name AS creator_name, up.faculty AS creator_faculty,
             (SELECT COUNT(*) FROM Trip_member tm
              WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS joined_count
      FROM Trip t
      JOIN User u ON t.creator_id = u.user_id
      LEFT JOIN User_profile up ON up.user_id = u.user_id
      WHERE t.trip_status = 'Open' AND t.start_time >= NOW()
      ORDER BY t.start_time ASC LIMIT 6
    `);
    res.json({ success: true, trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/trips/recommended ────────────────────────────────
router.get('/recommended', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.json({ success: true, trips: [], personalized: false });
  try {
    const [[profile]] = await db.query(
      `SELECT tags FROM User_profile WHERE user_id = ?`, [userId]
    );
    let userTags = [];
    if (profile?.tags) {
      userTags = profile.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }
    if (!userTags.length) return res.json({ success: true, trips: [], personalized: false });

    const conditions = userTags.map(() => `LOWER(TRIM(t.category)) LIKE ?`).join(' OR ');
    const likeParams = userTags.map(tag => `%${tag}%`);
    const [trips] = await db.query(`
      SELECT t.*, u.user_name AS creator_name,
        (SELECT COUNT(*) FROM Trip_member tm
         WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS joined_count,
        1 AS is_matched
      FROM Trip t JOIN User u ON t.creator_id = u.user_id
      WHERE t.trip_status = 'Open' AND (${conditions})
      ORDER BY joined_count DESC, t.created_at DESC LIMIT 6
    `, likeParams);
    res.json({ success: true, trips, personalized: true });
  } catch (err) {
    console.error('GET /api/trips/recommended error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/trips/my-schedule ────────────────────────────────
router.get('/my-schedule', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.json({ success: true, trips: [] });
  try {
    const [trips] = await db.query(`
      SELECT t.*, tm.joined_at,
             (SELECT COUNT(*) FROM Trip_member t2
              WHERE t2.trip_id = t.trip_id AND t2.status = 'Joined') AS joined_count,
             DATEDIFF(t.start_time, NOW()) AS days_until
      FROM Trip t JOIN Trip_member tm ON t.trip_id = tm.trip_id
      WHERE tm.user_id = ? AND tm.status = 'Joined' AND t.start_time >= NOW()
      ORDER BY t.start_time ASC
    `, [userId]);
    res.json({ success: true, trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/trips?category=...&search=... ────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT t.*, u.user_name AS creator_name,
        (SELECT COUNT(*) FROM Trip_member tm WHERE tm.trip_id = t.trip_id AND tm.status = 'Joined') AS joined_count
      FROM Trip t JOIN User u ON t.creator_id = u.user_id
      WHERE t.trip_status = 'Open'
    `;
    const params = [];
    if (category) { query += ' AND t.category = ?'; params.push(category); }
    if (search)   { query += ' AND (t.trip_name LIKE ? OR t.location_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY t.created_at DESC LIMIT 20';
    const [trips] = await db.query(query, params);
    res.json({ success: true, trips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/reviews/recent ───────────────────────────────────
router.get('/recent', async (req, res) => {
  try {
    const [reviews] = await db.query(`
      SELECT r.*, u.user_name, up.profile_img AS reviewer_image,
             t.trip_name, t.cover_image, t.category, t.location_name
      FROM Reviews r
      JOIN User u ON r.user_id = u.user_id
      LEFT JOIN User_profile up ON up.user_id = u.user_id
      JOIN Trip t ON r.trip_id = t.trip_id
      ORDER BY r.created_at DESC
    `);
    for (const review of reviews) {
      const [members] = await db.query(`
        SELECT u.user_name, up.profile_img
        FROM Trip_member tm
        JOIN User u ON tm.user_id = u.user_id
        LEFT JOIN User_profile up ON up.user_id = u.user_id
        WHERE tm.trip_id = ? AND tm.status = 'Joined'
        ORDER BY tm.joined_at ASC
      `, [review.trip_id]);
      review.members = members;
    }
    res.json({ success: true, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;