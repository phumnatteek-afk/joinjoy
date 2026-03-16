/**
 * ──────────────────────────────────────────────────────────────
 *  BACKEND ADDITIONS  –  paste these routes into index.js
 *  (inside the Express app, before app.listen)
 * ──────────────────────────────────────────────────────────────
 */

// ── 1. Get all joined members of a trip ──────────────────────
// GET /api/trip-members/:id
// Returns: [{user_id, user_name, profile_img, status}]
app.get('/api/trip-members/:id', async (req, res) => {  // ✅ CORRECT
    const tripId = req.params.id;
    try {
        const sql = `
            SELECT
                u.user_id,
                u.user_name,
                u.profile_img,
                tm.status
            FROM Trip_member tm
            JOIN User u ON tm.user_id = u.user_id
            WHERE tm.trip_id = ? AND tm.status = 'Joined'
            ORDER BY tm.joined_at ASC
        `;
        const [rows] = await db.query(sql, [tripId]);
        res.json(rows);
    } catch (err) {
        console.error('GET /api/trip-members error:', err);
        res.status(500).json({ error: 'ดึงข้อมูลสมาชิกไม่สำเร็จ' });
    }
});

// ── 2. Get detailed profile of a single user ─────────────────
// GET /api/user/:user_id
// Returns: {user_id, user_name, first_name, last_name, faculty,
//           gender, instagram, facebook, line_id, tiktok, twitter, profile_img}
app.get('/api/user/:user_id', async (req, res) => {
    const userId = req.params.user_id;
    try {
        // Adjust column names to match your actual User table schema
        const sql = `
            SELECT
                user_id,
                user_name,
                first_name,
                last_name,
                faculty,
                gender,
                instagram,
                facebook,
                line_id,
                tiktok,
                twitter,
                profile_img
            FROM User
            WHERE user_id = ?
        `;
        const [rows] = await db.query(sql, [userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('GET /api/user error:', err);
        res.status(500).json({ error: 'ดึงข้อมูลผู้ใช้ไม่สำเร็จ' });
    }
});

// ── 3. Join a trip ───────────────────────────────────────────
// POST /api/join-trip
// Body: { trip_id, user_id }
app.post('/api/join-trip', async (req, res) => {
    const { trip_id, user_id } = req.body;

    if (!trip_id || !user_id) {
        return res.status(400).json({ error: 'ต้องระบุ trip_id และ user_id' });
    }

    try {
        // Check if already joined
        const [existing] = await db.query(
            'SELECT * FROM Trip_member WHERE trip_id = ? AND user_id = ?',
            [trip_id, user_id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'คุณได้เข้าร่วมทริปนี้แล้ว' });
        }

        // Check capacity
        const [tripRows] = await db.query(
            `SELECT max_members,
                    (SELECT COUNT(*) FROM Trip_member WHERE trip_id = ? AND status = 'Joined') AS current_members
             FROM Trip WHERE trip_id = ?`,
            [trip_id, trip_id]
        );
        if (tripRows.length === 0) {
            return res.status(404).json({ error: 'ไม่พบทริป' });
        }
        const { max_members, current_members } = tripRows[0];
        if (current_members >= max_members) {
            return res.status(400).json({ error: 'ทริปเต็มแล้ว' });
        }

        // Insert member
        await db.execute(
            `INSERT INTO Trip_member (trip_id, user_id, status, joined_at)
             VALUES (?, ?, 'Joined', NOW())`,
            [trip_id, user_id]
        );

        res.status(201).json({ success: true, message: 'เข้าร่วมทริปสำเร็จ' });
    } catch (err) {
        console.error('POST /api/join-trip error:', err);
        res.status(500).json({ error: 'เข้าร่วมทริปไม่สำเร็จ' });
    }
});