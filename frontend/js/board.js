let allTrips = [];

async function fetchTrips() {
    const postContainer = document.getElementById('postContainer');

    try {
        const response = await fetch('http://localhost:3000/api/board/trips');
        const trips = await response.json();

        postContainer.innerHTML = '';
        allTrips = trips;

        renderTrips(allTrips);

    } catch (error) {
        console.error('Error:', error);
        postContainer.innerHTML = '<p>ขออภัย เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

function renderTrips(trips) {
    const postContainer = document.getElementById('postContainer');
    postContainer.innerHTML = '';

    if (trips.length === 0) {
        postContainer.innerHTML = '<p style="text-align:center; margin-top:50px;">ไม่พบทริปที่ค้นหา</p>';
        return;
    }

    trips.forEach(trip => {

        const coverImg = trip.cover_image 
            ? `http://localhost:3000/${trip.cover_image}` 
            : '../img/default-trip.jpg';

        const userAvatar = trip.user_avatar 
            ? `http://localhost:3000/${trip.user_avatar}` 
            : '../img/default-avatar.png';

        const startTime = trip.start_time
            ? new Date(trip.start_time).toLocaleString('th-TH')
            : 'ไม่ระบุ';

        const endTime = trip.end_time
            ? new Date(trip.end_time).toLocaleString('th-TH')
            : 'ไม่ระบุ';

        const budgetDisplay = (trip.budget_min && trip.budget_max)
            ? `${Number(trip.budget_min).toLocaleString()} - ${Number(trip.budget_max).toLocaleString()}`
            : 'ไม่ระบุ';

        const postHTML = `
        <div class="post-card">
            <div class="post-header">
                <img class="avatar" src="${userAvatar}" alt="avatar">

                <div class="post-info">
                    <div class="name-wrapper">
                        <span class="name">${trip.user_name}</span>
                        <span class="time">${calculateTime(trip.created_at)}</span>
                    </div>

                    <div class="caption">
                        ${trip.description || 'ทริปนี้น่าสนใจมาก!'}
                    </div>
                </div>

                <div class="dots">
                    <iconify-icon icon="mdi:dots-horizontal"></iconify-icon>
                </div>
            </div>

            <div class="trip-bg"
                 style="background-image:url('${coverImg}');
                 background-size:cover;
                 background-position:center;
                 height:180px;
                 border-radius:15px;
                 margin:0 15px;">
            </div>

            <div class="trip-body-content">
                <div class="trip-header-title">
                     <h2>${trip.trip_name}</h2>
                </div>

                <div class="trip-info-pills">
                   <span>
    <iconify-icon icon="mdi:map-marker"></iconify-icon>
    ${trip.location_name || 'ไม่ระบุสถานที่'}  </span>
                    <span>
                        <iconify-icon icon="mdi:account-group"></iconify-icon>
                        ${trip.current_member}/${trip.max_member}
                    </span>
                </div>

                <div class="trip-extra-box">
                    <div class="trip-time-row">
                        <iconify-icon icon="mdi:clock-outline"></iconify-icon>
                        <span>${startTime} - ${endTime}</span>
                    </div>
                    <div class="trip-budget-row">
                        <iconify-icon icon="mdi:cash"></iconify-icon>
                        <span>${budgetDisplay} ฿</span>
                    </div>
                </div>

                <button class="joy-btn" onclick="joinTrip(${trip.trip_id})">
                    Join
                </button>
            </div>
        </div>
        `;

        postContainer.insertAdjacentHTML('beforeend', postHTML);

    });
}

function searchTrips(query) {

    const keyword = query.toLowerCase().trim();

    if (!keyword) {
        renderTrips(allTrips);
        return;
    }

    const filtered = allTrips.filter(trip =>
        trip.trip_name?.toLowerCase().includes(keyword) ||
        trip.category?.toLowerCase().includes(keyword) ||
        trip.description?.toLowerCase().includes(keyword)
    );

    renderTrips(filtered);
}

function calculateTime(dateString) {

    const diff = new Date() - new Date(dateString);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return days + 'd';

    const hours = Math.floor(diff / (1000 * 60 * 60));

    return hours + 'h';
}

document.addEventListener('DOMContentLoaded', () => {

    fetchTrips();

    document.getElementById('searchInput')
        .addEventListener('input', (e) => {
            searchTrips(e.target.value);
        });

});
