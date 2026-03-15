async function fetchTrips() {
    const postContainer = document.getElementById('postContainer');
    
    try {
        const response = await fetch('http://localhost:3000/api/board/trips');
        const trips = await response.json();

        postContainer.innerHTML = ''; // ล้าง Loading ออก

        if (trips.length === 0) {
            postContainer.innerHTML = '<p style="text-align:center; margin-top:50px;">ยังไม่มีทริปในขณะนี้</p>';
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
                            <span class="divider">|</span>
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

    } catch (error) {
        console.error('Error:', error);
        postContainer.innerHTML = '<p>ขออภัย เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

// ฟังก์ชันช่วยคำนวณเวลา (เช่น 2d, 5h)
function calculateTime(dateString) {
    const diff = new Date() - new Date(dateString);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return days + 'd';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours + 'h';
}

// รันฟังก์ชันเมื่อโหลดหน้า
document.addEventListener('DOMContentLoaded', fetchTrips);