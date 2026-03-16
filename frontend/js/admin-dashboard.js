document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');

    if (!token) {
        alert('กรุณาเข้าสู่ระบบก่อน');
        window.location.href = 'admin-login.html';
        return;
    }

    // ─── FETCH STATS ───────────────────────────────────────────
    async function fetchDashboardData() {
        try {
            const response = await fetch('http://localhost:3000/api/admin/stats');
            const data = await response.json();

            if (response.ok) {
                animateCount('active-users-val', data.activeUsers);
                animateCount('open-trips-val',   data.open);
                animateCount('full-trips-val',   data.full);
                animateCount('closed-trips-val', data.closed);
            }
        } catch (error) {
            console.error("ไม่สามารถโหลดข้อมูลสถิติได้:", error);
        }
    }

    // ─── COUNT ANIMATION ───────────────────────────────────────
    function animateCount(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        let current = 0;
        const step = Math.ceil(target / 30);
        const timer = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current;
            if (current >= target) clearInterval(timer);
        }, 30);
    }

    // ─── USER GROWTH CHART ─────────────────────────────────────
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
            const maxVal = counts.length > 0 ? Math.max(...counts) + 2 : 10;

            const ctx = document.getElementById('userGrowthChart').getContext('2d');

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'ยอดผู้ใช้สะสม',
                        data: counts,
                        borderColor: '#F28695',
                        backgroundColor: (context) => {
                            const chart = context.chart;
                            const { ctx: c, chartArea } = chart;
                            if (!chartArea) return 'rgba(242,134,149,0.15)';
                            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(242,134,149,0.30)');
                            gradient.addColorStop(1, 'rgba(242,134,149,0.00)');
                            return gradient;
                        },
                        borderWidth: 3,
                        tension: 0.45,
                        fill: true,
                        pointBackgroundColor: '#F28695',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            suggestedMax: maxVal,
                            ticks: { stepSize: 1, font: { family: 'DM Sans', size: 12 }, color: '#b8a8ac' },
                            grid: { color: 'rgba(45,35,40,0.05)' },
                            border: { display: false }
                        },
                        x: {
                            ticks: { font: { family: 'DM Sans', size: 12 }, color: '#b8a8ac' },
                            grid: { display: false },
                            border: { display: false }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#2D2328',
                            titleFont: { family: 'Playfair Display', size: 14 },
                            bodyFont: { family: 'DM Sans', size: 13 },
                            padding: 12,
                            cornerRadius: 10,
                            callbacks: {
                                label: ctx => ` ยอดรวมทั้งหมด: ${ctx.raw} คน`
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error("Error loading user growth chart:", error);
        }
    }
    async function initTripGrowthChart() {

    try {

        const response = await fetch('http://localhost:3000/api/admin/trip-growth');
        const data = await response.json();

        if (!data || data.length === 0) return;

        const labels = data.map(item =>
            new Date(item.trip_date).toLocaleDateString('th-TH',{
                day:'numeric',
                month:'short'
            })
        );

        const counts = data.map(item => item.trip_count);

        const ctx = document.getElementById('tripGrowthChart').getContext('2d');

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'จำนวนทริปที่ถูกสร้าง',
                    data: counts,
                    backgroundColor: '#F28695',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins:{
                    legend:{display:false}
                },
                scales:{
                    y:{beginAtZero:true}
                }
            }
        });

    } catch (error) {
        console.error("Trip Chart Error:", error);
    }

}


    // ─── INIT ──────────────────────────────────────────────────
    fetchDashboardData();
    initUserGrowthChart();
    initTripGrowthChart();
   
});