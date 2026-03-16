const express = require('express')
const router = express.Router()
const pool = require('../db') // ← เปลี่ยนกลับมาใช้ DB จริง
const SQL_NOW_TH = "CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')"
const SQL_TODAY_TH = "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00'))"

let ensureNotificationSeenTablePromise = null

function ensureNotificationSeenTable() {
    if (!ensureNotificationSeenTablePromise) {
        ensureNotificationSeenTablePromise = pool.query(`
            CREATE TABLE IF NOT EXISTS Notification_seen (
                notification_id INT NOT NULL,
                user_id INT NOT NULL,
                seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notification_id, user_id),
                INDEX idx_notification_seen_user (user_id),
                CONSTRAINT fk_notification_seen_notification
                    FOREIGN KEY (notification_id) REFERENCES Notification(notification_id)
                    ON DELETE CASCADE
            )
        `).catch((err) => {
            ensureNotificationSeenTablePromise = null
            throw err
        })
    }

    return ensureNotificationSeenTablePromise
}

function getActorUserId(req) {
    const sessionUserId = (req.session && req.session.userId) ? Number(req.session.userId) : null
    const passportUserId = (req.user && req.user.user_id) ? Number(req.user.user_id) : null
    const queryUserId = (req.query && req.query.user_id) ? Number(req.query.user_id) : null
    return sessionUserId || passportUserId || queryUserId || null
}

let ensureNotificationFromUserIdColumnPromise = null

function ensureNotificationFromUserIdColumn() {
    if (!ensureNotificationFromUserIdColumnPromise) {
        ensureNotificationFromUserIdColumnPromise = (async () => {
            const [cols] = await pool.query(
                "SHOW COLUMNS FROM Notification LIKE 'from_user_id'"
            )
            if (!cols.length) {
                await pool.query(
                    'ALTER TABLE Notification ADD COLUMN from_user_id INT NULL'
                )
            }
        })().catch((err) => {
            ensureNotificationFromUserIdColumnPromise = null
            throw err
        })
    }

    return ensureNotificationFromUserIdColumnPromise
}

// FLOW 1: User กด JOIN
router.post('/join-request', async(req, res) => {
    const { trip_id, user_id } = req.body
    const actorUserId = getActorUserId(req)
    const requestBodyUserId = user_id ? Number(user_id) : null
    const requesterId = actorUserId || requestBodyUserId

    if (!requesterId) {
        return res.status(401).json({ error: 'กรุณาล็อกอินก่อนส่งคำขอเข้าร่วม' })
    }

    if (actorUserId && requestBodyUserId && actorUserId !== requestBodyUserId) {
        return res.status(403).json({ error: 'ไม่สามารถส่งคำขอแทนผู้ใช้อื่นได้' })
    }

    try {
        // ดึงข้อมูล User + Trip จาก Database จริง
        const [users] = await pool.query(
            'SELECT user_id, user_name FROM User WHERE user_id = ?', [requesterId]
        )
        const [trips] = await pool.query(
            'SELECT trip_id, trip_name, creator_id FROM Trip WHERE trip_id = ?', [trip_id]
        )

        if (!users.length || !trips.length) {
            return res.status(404).json({ error: 'ไม่พบข้อมูล' })
        }

        const user = users[0]
        const trip = trips[0]

        // ป้องกัน Host join ทริปตัวเอง
        if (Number(requesterId) === Number(trip.creator_id)) {
            return res.status(400).json({ error: 'เจ้าของโพสไม่สามารถ join ทริปตัวเองได้' })
        }

        // ป้องกัน join ซ้ำ
        const [existing] = await pool.query(
            'SELECT status FROM Trip_member WHERE trip_id = ? AND user_id = ?',
            [trip_id, requesterId]
        )
        if (existing.length) {
            return res.status(409).json({ error: `คุณได้ส่งคำขอนี้แล้ว (สถานะ: ${existing[0].status})` })
        }

        // INSERT Trip_member สถานะ Pending
        await pool.query(
            `INSERT INTO Trip_member (trip_id, user_id, status, joined_at)
                    VALUES (?, ?, 'Pending', ${SQL_NOW_TH})`, [trip_id, requesterId]
        )

        const joinRequestDetail = `${user.user_name} ขอเข้าร่วมทริป "${trip.trip_name}" [REQ_USER_ID:${user.user_id}]`

        // INSERT Notification ให้ Host แจ้งว่ามีคนขอเข้าร่วมทริป
        await ensureNotificationFromUserIdColumn()
        await pool.query(
            `INSERT INTO Notification 
       (trip_id, user_id, notification_title, notification_detail, from_user_id, create_at)
       VALUES (?, ?, ?, ?, ?, ${SQL_NOW_TH})`, [
                trip_id,
                trip.creator_id,
                'มีคนขอเข้าร่วมทริป',
                joinRequestDetail,
                requesterId
            ]
        )

        // Socket emit ไปหา Host ทันที ส่งข้อมูล User + Trip ไปด้วย
        const io = req.app.get('io')
        if (io) {
            io.to(`room:${trip.creator_id}`).emit('new_notification', {
                type: 'join_request',
                title: 'มีคนขอเข้าร่วมทริป',
                detail: joinRequestDetail,
                trip_id,
                from_user_id: requesterId
            })
        }

        res.json({ success: true, message: 'ส่งคำขอแล้ว' })

    } catch (err) {
        console.error('❌ Error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// FLOW 2: Host ดูโปรไฟล์ User ที่ขอเข้าร่วม ก่อนตัดสินใจ
// ดึง User + User_profile มาแสดง Popup (ดึงข้อมูลจาก Database จริง)
router.get('/user-profile/:user_id', async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.user_id, 
              u.user_name, 
              u.university_email,
              up.frist_name, 
              up.last_name, 
              up.bio,
              up.gender,
              up.faculty, 
              up.social_media, 
              up.profile_img, 
              up.tags
       FROM User u
       LEFT JOIN User_profile up ON up.user_id = u.user_id
       WHERE u.user_id = ?`, [req.params.user_id]
        )

        if (!rows.length) {
            return res.status(404).json({ error: 'ไม่พบ user' })
        }

        // ส่งโปรไฟล์กลับให้ Host แสดงใน Popup
        res.json(rows[0])

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// FLOW 3: Host กด ACCEPT หรือ REJECT คำขอเข้าร่วม
// UPDATE Trip_member status
// INSERT Notification ให้ User
// Socket emit → User รับ real-time ทันที
// ถ้า Accept → ส่ง contact Host ไปด้วย
router.patch('/respond', async(req, res) => {
    const { trip_id, user_id, status } = req.body
    const actorUserId = getActorUserId(req)

    if (!actorUserId) {
        return res.status(401).json({ error: 'กรุณาล็อกอินก่อนตอบรับคำขอ' })
    }

    if (!['Joined', 'Cancelled'].includes(String(status || ''))) {
        return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' })
    }

    try {
        // ดึงข้อมูล Trip + contact Host จาก Database จริง
        const [trips] = await pool.query(
            `SELECT t.trip_name, t.creator_id, up.social_media AS host_contact
       FROM Trip t
       LEFT JOIN User_profile up ON up.user_id = t.creator_id
       WHERE t.trip_id = ?`, [trip_id]
        )

        if (!trips.length) {
            return res.status(404).json({ error: 'ไม่พบทริป' })
        }

        const trip = trips[0]

        if (Number(trip.creator_id) !== Number(actorUserId)) {
            return res.status(403).json({ error: 'เฉพาะโฮสเจ้าของทริปเท่านั้นที่ตอบรับได้' })
        }
            // กำหนดข้อความตาม status
        const isAccepted = status === 'Joined'

        // UPDATE Trip_member status เป็น Joined หรือ Rejected
        await pool.query(
            `UPDATE Trip_member SET status = ?
       WHERE trip_id = ? AND user_id = ?`, [status, trip_id, user_id]
        )

                // ดันเวลาแจ้งเตือนคำขอเดิมของโฮสต์ให้เป็นล่าสุด
                // เพื่อให้ขึ้นบนสุดตามเวลาที่โฮสต์เพิ่งตอบรับ/ปฏิเสธ
                const [requesterRows] = await pool.query(
                        'SELECT user_name FROM User WHERE user_id = ? LIMIT 1',
                        [user_id]
                )
                const requesterName = requesterRows.length ? String(requesterRows[0].user_name || '').trim() : ''
                const requesterMarker = `%[REQ_USER_ID:${Number(user_id)}]%`
                const requesterNameLike = requesterName ? `${requesterName} ขอเข้าร่วมทริป%` : ''
                await pool.query(
                        `UPDATE Notification
             SET create_at = ${SQL_NOW_TH}
             WHERE notification_id = (
                 SELECT latest.notification_id FROM (
                     SELECT notification_id
                     FROM Notification
                     WHERE trip_id = ?
                         AND user_id = ?
                         AND notification_title = 'มีคนขอเข้าร่วมทริป'
                         AND (
                             notification_detail LIKE ?
                             OR (? <> '' AND notification_detail LIKE ?)
                         )
                     ORDER BY notification_id DESC
                     LIMIT 1
                 ) AS latest
             )`, [trip_id, trip.creator_id, requesterMarker, requesterNameLike, requesterNameLike]
                )

        const title = isAccepted ?
            '🎉 ได้รับการตอบรับแล้ว!' :
            '❌ คำขอถูกปฏิเสธ'

        const detail = isAccepted ?
            `ได้รับการตอบรับเข้าร่วมทริป "${trip.trip_name}" ติดต่อ Host: ${trip.host_contact}` :
            `คำขอเข้าร่วมทริป "${trip.trip_name}" ถูกปฏิเสธ ยังมีทริปอื่นให้ร่วมจอยอยู่นะ`

        // INSERT Notification ให้ User แจ้งผลการตอบรับ
        await ensureNotificationFromUserIdColumn()
        await pool.query(
            `INSERT INTO Notification
       (trip_id, user_id, notification_title, notification_detail, from_user_id, create_at)
       VALUES (?, ?, ?, ?, ?, ${SQL_NOW_TH})`, [trip_id, user_id, title, detail, actorUserId]
        )

        // Socket emit ไปหา User ทันที ส่งข้อมูล contact Host ไปด้วยถ้า ACCEPT
        const io = req.app.get('io')
        if (io) {
            io.to(`room:${user_id}`).emit('new_notification', {
                type: status,
                title,
                detail,
                trip_id,
                // ถ้า Accept ส่ง contact Host ไปด้วยเลย ถ้า Reject ส่ง null
                host_contact: isAccepted ? trip.host_contact : null
            })
        }

        res.json({ success: true, status })

    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// FLOW 4: ดึง Notification List
// แสดงหน้า Notification (Today/Yesterday/This week)
router.get('/resolve-user', async(req, res) => {
    const username = String(req.query.username || '').trim()

    if (!username) {
        return res.status(400).json({ error: 'กรุณาระบุ username' })
    }

    try {
        const [users] = await pool.query(
            'SELECT user_id, user_name FROM User WHERE user_name = ? LIMIT 1', [username]
        )

        if (!users.length) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้' })
        }

        return res.json({ success: true, user_id: Number(users[0].user_id), user_name: users[0].user_name })
    } catch (err) {
        return res.status(500).json({ error: err.message })
    }
})

router.get('/trip-host/:trip_id', async(req, res) => {
    const tripId = Number(req.params.trip_id || 0)

    if (!tripId) {
        return res.status(400).json({ error: 'trip_id ไม่ถูกต้อง' })
    }

    try {
        const [rows] = await pool.query(
            'SELECT creator_id FROM Trip WHERE trip_id = ? LIMIT 1', [tripId]
        )

        if (!rows.length || !rows[0].creator_id) {
            return res.status(404).json({ error: 'ไม่พบโฮสต์ของทริปนี้' })
        }

        return res.json({ success: true, host_user_id: Number(rows[0].creator_id) })
    } catch (err) {
        return res.status(500).json({ error: err.message })
    }
})

router.get('/unread-count', async(req, res) => {
        const actorUserId = getActorUserId(req)

        if (!actorUserId) {
                return res.status(401).json({ error: 'กรุณาล็อกอินก่อนดูจำนวนการแจ้งเตือน' })
        }

        try {
                await ensureNotificationSeenTable()

                const [rows] = await pool.query(
                        `SELECT COUNT(*) AS unread_count
                         FROM Notification n
                         LEFT JOIN Notification_seen ns
                             ON ns.notification_id = n.notification_id
                            AND ns.user_id = n.user_id
                         WHERE n.user_id = ?
                             AND ns.notification_id IS NULL`,
                        [actorUserId]
                )

                return res.json({ count: Number(rows[0]?.unread_count || 0) })
        } catch (err) {
                console.error('❌ unread-count error:', err.message)
                return res.status(500).json({ error: err.message })
        }
})

router.put('/read-all', async(req, res) => {
        const actorUserId = getActorUserId(req)

        if (!actorUserId) {
                return res.status(401).json({ error: 'กรุณาล็อกอินก่อนอ่านการแจ้งเตือน' })
        }

        try {
                await ensureNotificationSeenTable()

                await pool.query(
                        `INSERT IGNORE INTO Notification_seen (notification_id, user_id, seen_at)
                     SELECT n.notification_id, n.user_id, ${SQL_NOW_TH}
                         FROM Notification n
                         WHERE n.user_id = ?`,
                        [actorUserId]
                )

                return res.json({ success: true })
        } catch (err) {
                console.error('❌ read-all error:', err.message)
                return res.status(500).json({ error: err.message })
        }
})

router.get('/:user_id', async(req, res) => {
    const { user_id } = req.params

    try {
                await ensureNotificationSeenTable()

        await ensureNotificationFromUserIdColumn()

        const [rows] = await pool.query(
            `SELECT 
         n.notification_id,
         n.trip_id,
         n.user_id,
         n.from_user_id,
         n.notification_title,
         n.notification_detail,
         n.create_at,
         up.profile_img AS from_user_profile_img,
                 CASE
                     WHEN ns.notification_id IS NULL THEN 1
                     ELSE 0
                 END AS is_unread,
         CASE
                 WHEN DATE(n.create_at) = ${SQL_TODAY_TH}
             THEN 'Today'
                 WHEN DATE(n.create_at) = DATE_SUB(${SQL_TODAY_TH}, INTERVAL 1 DAY)
             THEN 'Yesterday'
           ELSE 'This week'
         END AS date_group
             FROM Notification n
             LEFT JOIN User_profile up ON up.user_id = n.from_user_id
             LEFT JOIN Notification_seen ns
                 ON ns.notification_id = n.notification_id
                AND ns.user_id = n.user_id
             WHERE n.user_id = ?
             ORDER BY n.notification_id DESC`, [user_id]
        )

        const enrichedRows = []

        for (const row of rows) {
            const notificationTitle = String(row.notification_title || '')
            const detail = String(row.notification_detail || '')
            const markerMatch = detail.match(/\[REQ_USER_ID:(\d+)\]/i)
            let fromUserId = markerMatch ? Number(markerMatch[1]) : null
            let fromUserProfileImg = row.from_user_profile_img || null

            const cleanedDetail = detail
                .replace(/\s*\[REQ_USER_ID:\d+\]/gi, '')
                .replace(/\s*กลับไป Join ใหม่ได้เลย/gi, '')
                .trim()

            if (!fromUserId) {
                const markerMatch = detail.match(/\[REQ_USER_ID:(\d+)\]/i)
                fromUserId = markerMatch ? Number(markerMatch[1]) : null
            }

            if (!fromUserId && notificationTitle.includes('มีคนขอเข้าร่วมทริป')) {
                const nameMatch = cleanedDetail.match(/^(.+?)\s*ขอเข้าร่วมทริป/)
                const requesterName = nameMatch ? String(nameMatch[1] || '').trim() : ''

                if (requesterName) {
                    const [requesters] = await pool.query(
                        'SELECT user_id FROM User WHERE user_name = ? LIMIT 1', [requesterName]
                    )
                    if (requesters.length) {
                        fromUserId = Number(requesters[0].user_id)
                    }
                }
            }

            let memberStatus = null
            let hostContact = null
            let hostProfileImg = null
            let hostUserId = null
            if (fromUserId && Number(row.trip_id) > 0 &&
                notificationTitle.includes('มีคนขอเข้าร่วมทริป')) {
                const [memberRows] = await pool.query(
                    'SELECT status FROM Trip_member WHERE trip_id = ? AND user_id = ? LIMIT 1',
                    [row.trip_id, fromUserId]
                )
                memberStatus = memberRows.length ? memberRows[0].status : null
            }

            if (fromUserId) {
                const [profileRows] = await pool.query(
                    'SELECT profile_img FROM User_profile WHERE user_id = ? LIMIT 1',
                    [fromUserId]
                )
                fromUserProfileImg = profileRows.length ? profileRows[0].profile_img : null
            }

            if (Number(row.trip_id) > 0 && notificationTitle.includes('ได้รับการตอบรับแล้ว')) {
                const [hostRows] = await pool.query(
                    `SELECT t.creator_id AS host_user_id, up.social_media AS host_contact, up.profile_img AS host_profile_img
                     FROM Trip t
                     LEFT JOIN User_profile up ON up.user_id = t.creator_id
                     WHERE t.trip_id = ?
                     LIMIT 1`,
                    [row.trip_id]
                )

                if (hostRows.length) {
                    hostUserId = hostRows[0].host_user_id || null
                    hostContact = hostRows[0].host_contact || null
                    hostProfileImg = hostRows[0].host_profile_img || null
                }
            }

            enrichedRows.push({
                ...row,
                notification_detail: cleanedDetail,
                is_unread: Number(row.is_unread) === 1,
                from_user_id: fromUserId,
                from_user_profile_img: fromUserProfileImg,
                member_status: memberStatus,
                host_user_id: hostUserId,
                host_contact: hostContact,
                host_profile_img: hostProfileImg
            })
        }

        res.json(enrichedRows)

    } catch (err) {
        console.error('❌ get notifications error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// FLOW 5: หลังทริปจบ → แจ้งเตือนให้ Review
// เรียกใช้เมื่อ trip_status = 'Closed'
router.post('/review-reminder', async(req, res) => {
    const { trip_id } = req.body

    try {
        // ดึง members ทุกคนที่ status = Joined
        const [members] = await pool.query(
            `SELECT tm.user_id, t.trip_name
       FROM Trip_member tm
       JOIN Trip t ON t.trip_id = tm.trip_id
       WHERE tm.trip_id = ? AND tm.status = 'Joined'`, [trip_id]
        )

        const io = req.app.get('io')

        // แจ้งเตือนทุกคนพร้อมกัน
        for (const member of members) {
            // INSERT Notification ให้ทุกคน
            await pool.query(
                `INSERT INTO Notification
         (trip_id, user_id, notification_title, notification_detail, create_at)
         VALUES (?, ?, ?, ?, ${SQL_NOW_TH})`, [
                    trip_id,
                    member.user_id,
                    '⭐ รีวิวทริปของคุณ',
                    `ทริป "${member.trip_name}" จบแล้ว! มาแชร์ความรู้สึกกันเถอะ`
                ]
            )

            // Socket emit ทุกคนพร้อมกัน
            if (io) {
                io.to(`room:${member.user_id}`).emit('new_notification', {
                    type: 'review_reminder',
                    title: '⭐ รีวิวทริปของคุณ',
                    detail: `ทริป "${member.trip_name}" จบแล้ว! มาแชร์ความรู้สึกกันเถอะ`,
                    trip_id
                })
            }
        }

        res.json({ success: true, notified: members.length })

    } catch (err) {
        console.error('❌ review-reminder error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

// FLOW 6: User ส่ง Review หลังทริปจบ
// POST /api/notifications/review
router.post('/review', async(req, res) => {
    const { trip_id, user_id, review_text, rating } = req.body

    try {
        // INSERT ลง Reviews table
        await pool.query(
            `INSERT INTO Reviews 
       (trip_id, user_id, review_text, rating, created_at)
       VALUES (?, ?, ?, ?, NOW())`, [trip_id, user_id, review_text, rating]
        )

        // ดึงข้อมูล Trip + Host
        const [trips] = await pool.query(
            `SELECT t.trip_name, t.creator_id, u.user_name
       FROM Trip t
       JOIN User u ON u.user_id = ?
       WHERE t.trip_id = ?`, [user_id, trip_id]
        )
        const trip = trips[0]

        // INSERT Notification ให้ Host รู้ว่ามีคนรีวิว
        await ensureNotificationFromUserIdColumn()
        await pool.query(
            `INSERT INTO Notification
       (trip_id, user_id, notification_title, notification_detail, from_user_id, create_at)
       VALUES (?, ?, ?, ?, ?, ${SQL_NOW_TH})`, [
                trip_id,
                trip.creator_id,
                '⭐ มีคนรีวิวทริปของคุณ',
                `${trip.user_name} ได้รีวิวทริป "${trip.trip_name}"`,
                user_id
            ]
        )

        // Socket emit ไปหา Host ทันที
        const io = req.app.get('io')
        io.to(`room:${trip.creator_id}`).emit('new_notification', {
            type: 'new_review',
            title: '⭐ มีคนรีวิวทริปของคุณ',
            detail: `${trip.user_name} ได้รีวิวทริป "${trip.trip_name}"`,
            trip_id
        })

        res.json({ success: true, message: 'ส่ง Review แล้ว' })

    } catch (err) {
        console.error('❌ review error:', err.message)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router