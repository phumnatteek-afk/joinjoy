const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── Middleware ตรวจสอบ login ──────────────────────────────────
function requireLogin(req, res, next) {
    if (req.isAuthenticated() || req.session?.userId) return next();
    return res.status(401).json({ success: false, error: 'กรุณา login ก่อน' });
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/trips/:tripId/leave  — ยกเลิกการเข้าร่วมทริป
// ─────────────────────────────────────────────────────────────
router.delete('/trips/:tripId/leave', requireLogin, async (req, res) => {
    const userId = req.user?.user_id || req.session.userId;
    const { tripId } = req.params;

    try {
        // 1) ตรวจสอบว่า user เป็นสมาชิกของทริปนี้จริงๆ
        const [[member]] = await db.query(
            `SELECT * FROM Trip_member WHERE trip_id = ? AND user_id = ?`,
            [tripId, userId]
        );

        if (!member) {
            return res.status(404).json({ success: false, error: 'ไม่พบข้อมูลการเข้าร่วม' });
        }

        // 2) ดึงข้อมูลทริป — ตรวจสอบ host และ limit_date_accept
        const [[trip]] = await db.query(
            `SELECT creator_id, limit_date_accept FROM Trip WHERE trip_id = ?`,
            [tripId]
        );

        if (!trip) {
            return res.status(404).json({ success: false, error: 'ไม่พบทริปนี้' });
        }

        // ห้าม host ออก
        if (Number(trip.creator_id) === Number(userId)) {
            return res.status(403).json({ success: false, error: 'เจ้าของทริปไม่สามารถออกจากทริปได้' });
        }

        // ตรวจสอบ limit_date_accept — ถ้าเลยกำหนดแล้วยกเลิกไม่ได้
        if (trip.limit_date_accept) {
            const limitDate = new Date(trip.limit_date_accept);
            const now       = new Date();
            if (now > limitDate) {
                const fmt = limitDate.toLocaleDateString('th-TH', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });
                return res.status(403).json({
                    success: false,
                    error: `หมดเวลายกเลิกแล้ว (กำหนดรับสมาชิกสิ้นสุด ${fmt})`
                });
            }
        }

        // 3) ลบออกจาก Trip_member
        await db.query(
            `DELETE FROM Trip_member WHERE trip_id = ? AND user_id = ?`,
            [tripId, userId]
        );

        // 4) ลด current_member (เฉพาะถ้าสถานะเป็น Joined)
        if (member.status === 'Joined') {
            await db.query(
                `UPDATE Trip SET current_member = GREATEST(current_member - 1, 0) WHERE trip_id = ?`,
                [tripId]
            );
        }

        res.json({ success: true, message: 'ยกเลิกการเข้าร่วมทริปแล้ว' });

    } catch (err) {
        console.error('DELETE /trips/:tripId/leave error:', err);
        res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาด: ' + err.message });
    }
});

module.exports = router;