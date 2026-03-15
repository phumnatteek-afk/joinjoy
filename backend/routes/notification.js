const express = require('express')
const router = express.Router()
const pool = require('../db') // ← เปลี่ยนกลับมาใช้ DB จริง

function getActorUserId(req) {
    const sessionUserId = (req.session && req.session.userId) ? Number(req.session.userId) : null
    const passportUserId = (req.user && req.user.user_id) ? Number(req.user.user_id) : null
    const queryUserId = (req.query && req.query.user_id) ? Number(req.query.user_id) : null
    return sessionUserId || passportUserId || queryUserId || null
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
          VALUES (?, ?, 'Pending', NOW())`, [trip_id, requesterId]
        )

        const joinRequestDetail = `${user.user_name} ขอเข้าร่วมทริป "${trip.trip_name}" [REQ_USER_ID:${user.user_id}]`

        // INSERT Notification ให้ Host แจ้งว่ามีคนขอเข้าร่วมทริป
        await pool.query(
            `INSERT INTO Notification 
       (trip_id, user_id, notification_title, notification_detail, create_at)
       VALUES (?, ?, ?, ?, NOW())`, [
                trip_id,
                trip.creator_id,
                'มีคนขอเข้าร่วมทริป',
                joinRequestDetail
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

    if (!['Joined', 'Rejected'].includes(String(status || ''))) {
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

        const title = isAccepted ?
            '🎉 ได้รับการตอบรับแล้ว!' :
            '❌ ไม่ได้รับการตอบรับ'

        const detail = isAccepted ?
            `ได้รับการตอบรับเข้าร่วมทริป "${trip.trip_name}" ติดต่อ Host: ${trip.host_contact}` :
            `คำขอเข้าร่วมทริป "${trip.trip_name}" ไม่ได้รับการตอบรับ กลับไป Join ใหม่ได้เลย`

        // INSERT Notification ให้ User แจ้งผลการตอบรับ
        await pool.query(
            `INSERT INTO Notification
       (trip_id, user_id, notification_title, notification_detail, create_at)
       VALUES (?, ?, ?, ?, NOW())`, [trip_id, user_id, title, detail]
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

router.get('/:user_id', async(req, res) => {
    const { user_id } = req.params

    try {
        const [rows] = await pool.query(
            `SELECT 
         notification_id,
         trip_id,
         user_id,
         notification_title,
         notification_detail,
         create_at,
         CASE
           WHEN DATE(create_at) = CURDATE() 
             THEN 'Today'
           WHEN DATE(create_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
             THEN 'Yesterday'
           ELSE 'This week'
         END AS date_group
       FROM Notification
       WHERE user_id = ?
       ORDER BY create_at DESC`, [user_id]
        )

        const enrichedRows = []

        for (const row of rows) {
            const detail = String(row.notification_detail || '')
            const markerMatch = detail.match(/\[REQ_USER_ID:(\d+)\]/i)
            let fromUserId = markerMatch ? Number(markerMatch[1]) : null
            const cleanedDetail = detail.replace(/\s*\[REQ_USER_ID:\d+\]/gi, '').trim()

            if (!fromUserId && String(row.notification_title || '').includes('มีคนขอเข้าร่วมทริป')) {
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
            if (fromUserId && Number(row.trip_id) > 0 &&
                String(row.notification_title || '').includes('มีคนขอเข้าร่วมทริป')) {
                const [memberRows] = await pool.query(
                    'SELECT status FROM Trip_member WHERE trip_id = ? AND user_id = ? LIMIT 1',
                    [row.trip_id, fromUserId]
                )
                memberStatus = memberRows.length ? memberRows[0].status : null
            }

            enrichedRows.push({
                ...row,
                notification_detail: cleanedDetail,
                from_user_id: fromUserId,
                member_status: memberStatus
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
         VALUES (?, ?, ?, ?, NOW())`, [
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
        await pool.query(
            `INSERT INTO Notification
       (trip_id, user_id, notification_title, notification_detail, create_at)
       VALUES (?, ?, ?, ?, NOW())`, [
                trip_id,
                trip.creator_id,
                '⭐ มีคนรีวิวทริปของคุณ',
                `${trip.user_name} ได้รีวิวทริป "${trip.trip_name}"`
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