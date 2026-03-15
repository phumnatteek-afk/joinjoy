let allTrips = [];

async function fetchTrips() {
    const postContainer = document.getElementById('postContainer');
    
    try {
        const response = await fetch('http://localhost:3000/api/board/trips');
        allTrips = await response.json();
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
        const coverImg = trip.cover_image ? `http://localhost:3000/${trip.cover_image}` : '../img/default-trip.jpg';
        const userAvatar = trip.user_avatar ? `http://localhost:3000/${trip.user_avatar}` : '../img/default-avatar.png';
        
        const postHTML = `
            <div class="post">
                <div class="post-header">
                    <img class="avatar" src="${userAvatar}" alt="avatar">
                    <div class="post-info">
                        <div class="name">
                            ${trip.user_name} <span class="time">${calculateTime(trip.created_at)}</span>
                        </div>
                        <div class="caption">
                            ${trip.description || 'สนใจมาจอยทริปด้วยกันไหม?'}
                        </div>
                    </div>
                    <iconify-icon icon="mdi:dots-horizontal" class="dots"></iconify-icon>
                </div>
                
                <div class="trip-card">
                    <div class="trip-bg" style="background-image: url('${coverImg}'); background-size: cover; background-position: center; height: 180px; border-radius: 15px;"></div>
                    
                    <div class="trip-header">
                        <h2>${trip.trip_name}</h2>
                    </div>
                    
                    <div class="trip-info">
                        <span>
                            <iconify-icon icon="mdi:map-marker"></iconify-icon>
                            ${trip.category}
                        </span>
                        <span>
                            <iconify-icon icon="mdi:account-group"></iconify-icon>
                            ${trip.current_member} / ${trip.max_member} members
                        </span>
                    </div>

                    <div class="trip-extra">
                        <span class="trip-time">
                            <iconify-icon icon="mdi:clock-outline"></iconify-icon>
                            ${trip.start_time} - ${trip.end_time}
                        </span>
                        <span class="trip-budget">
                            <iconify-icon icon="mdi:cash"></iconify-icon>
                            ${trip.budget} ฿
                        </span>
                    </div>
                    
                    <button class="joy-btn" onclick="joinTrip(${trip.trip_id})">ขอไปด้วย</button>
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
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchTrips(e.target.value);
    });
});