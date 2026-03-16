const express = require("express");
const router = express.Router();
const db = require("../db"); // หรือไฟล์เชื่อม mysql ของคุณ

router.get("/check-trip-budget", async (req, res) => {
  try {

    const [trips] = await db.query(`
      SELECT trip_id, trip_name, current_member, max_member
      FROM Trip
      WHERE DATE(limit_date_accept) = DATE(NOW() + INTERVAL 1 DAY)
    `);

    for (const trip of trips) {

      const status = trip.current_member >= trip.max_member
        ? "สมาชิกครบแล้ว"
        : "สมาชิกยังไม่ครบ งบประมาณอาจเปลี่ยน";

      await db.query(`
        INSERT INTO Notification
        (trip_id, notification_title, notification_detail)
        VALUES (?, ?, ?)
      `, [
        trip.trip_id,
        "ยืนยันการไปทริป",
        `${trip.trip_name} ${status}`
      ]);

    }

    res.json({ message: "checked" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "server error" });
  }
});

module.exports = router;