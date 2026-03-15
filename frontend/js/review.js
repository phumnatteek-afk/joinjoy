document.addEventListener('DOMContentLoaded', function () {
    const submitBtn = document.getElementById('submit-btn');

    if (submitBtn) {
        submitBtn.onclick = async function (e) {
            e.preventDefault();

            const reviewTextEl = document.getElementById('review-text');
            const reviewValue = reviewTextEl ? reviewTextEl.value : "";

            if (!reviewValue.trim()) {
                alert("กรุณาพิมพ์ข้อความรีวิวก่อนครับ");
                return;
            }

            const payload = {
                trip_id: 1, // ⚠️ ต้องมั่นใจว่าในตาราง Trips มี ID นี้
                user_id: 1, // ⚠️ ต้องมั่นใจว่าในตาราง Users มี ID นี้
                review_text: reviewValue
            };

            try {
                const response = await fetch('http://localhost:3000/api/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    alert("บันทึกรีวิวเรียบร้อยแล้ว!");

                    window.location.href = '../html/homepage.html';

                } else {
                    alert("บันทึกไม่สำเร็จ: " + result.error);
                }
            } catch (err) {
                alert("ไม่สามารถติดต่อ Server ได้");
            }
        };
    }
});