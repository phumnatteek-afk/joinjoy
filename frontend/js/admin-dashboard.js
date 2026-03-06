document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');

    if (!token) {
        // ถ้าไม่มี Token ให้เด้งกลับไปหน้า Login ทันที
        alert('กรุณาเข้าสู่ระบบก่อน');
        window.location.href = 'admin-login.html';
        return;
    }

    async function fetchDashboardData() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/stats');
            const data = await response.json();

            if (response.ok) {
                document.getElementById('active-users-val').innerText = data.activeUsers;
                document.getElementById('open-trips-val').innerText = data.open;
                document.getElementById('full-trips-val').innerText = data.full;
                document.getElementById('closed-trips-val').innerText = data.closed;
            }
        } catch (error) {
            console.error("ไม่สามารถโหลดข้อมูลสถิติได้:", error);
        }
    }

    async function initUserGrowthChart() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/user-growth');
            const data = await response.json();

            if (!data || data.length === 0) {
                console.warn("No data for chart");
                return;
            }

            const labels = data.map(item => item.month_label);
            const counts = data.map(item => item.cumulative_count);

            const ctx = document.getElementById('userGrowthChart').getContext('2d');

            // เช็คเผื่อ counts ไม่มีข้อมูล
            const maxVal = counts.length > 0 ? Math.max(...counts) + 2 : 10;

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'New Users',
                        data: counts,
                        borderColor: '#F28695',
                        backgroundColor: 'rgba(242, 134, 149, 0.2)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#F28695',
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: maxVal,
                            ticks: { stepSize: 1 }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return ` ยอดรวมทั้งหมด: ${context.raw} คน`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Error loading chart:", error);
        }
    }

    async function initReviewChart() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/review-stats');
            const data = await response.json();

            const ctx = document.getElementById('tripReviewsChart').getContext('2d');

            new Chart(ctx, {
                type: 'doughnut', // ใช้ doughnut จะดูสวยกว่า pie ปกติครับ
                data: {
                    labels: ['รีวิวแล้ว', 'ยังไม่รีวิว'],
                    datasets: [{
                        data: [data.reviewed, data.notReviewed],
                        backgroundColor: ['#F28695', '#F2E6B8'], // สีชมพู และ สีเหลืองนวล
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Inter', size: 14 }
                            }
                        }
                    },
                    cutout: '70%' // ทำให้วงกลมดูเป็นวงแหวนบางๆ สวยงาม
                }
            });
        } catch (error) {
            console.error("Error loading review chart:", error);
        }
    }

    fetchDashboardData();
    initUserGrowthChart();
    initReviewChart();

// ค้นหาปุ่ม Logout
const logoutBtn = document.querySelector('.logout-btn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault(); // ป้องกันการเปลี่ยนหน้าทันที

        // สร้างหน้าต่างยืนยัน
        const isConfirmed = confirm("คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?");

        if (isConfirmed) {
            // ถ้าตกลง (OK) ให้ล้างข้อมูลและเด้งไปหน้า Login
            localStorage.removeItem('adminToken');
            alert('ออกจากระบบสำเร็จ');
            window.location.href = 'admin-login.html';
        } else {
            // ถ้ากดยกเลิก (Cancel) ไม่ต้องทำอะไร อยู่หน้าเดิมต่อ
            console.log("ยกเลิกการออกจากระบบ");
        }
    });
}

});