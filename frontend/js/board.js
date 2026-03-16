let allTrips = [];
let currentUserId = null;
let currentUserName = null;
let pendingJoinData = null;

function getStoredUser() {
    try {
        const raw = localStorage.getItem('joinjoy_user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
}

function getStoredUserId() {
    const direct = localStorage.getItem('userId') ||
        localStorage.getItem('user_id') ||
        localStorage.getItem('currentUserId');
    if (direct) return direct;

    const user = getStoredUser();
    const fallbackId = user && (user.user_id || user.id);
    return fallbackId ? String(fallbackId) : null;
}

function setStoredUserId(userId) {
    if (!userId) return;
    localStorage.setItem('userId', String(userId));
    localStorage.setItem('user_id', String(userId));
    localStorage.setItem('currentUserId', String(userId));
}

async function loadCurrentUser() {
    const storedId = getStoredUserId();
    const storedUser = getStoredUser();
    if (storedId) {
        currentUserId = storedId;
    }
    if (storedUser && storedUser.user_name) {
        currentUserName = storedUser.user_name;
    }

    try {
        const meUrl = storedId
            ? `/api/user/me?user_id=${encodeURIComponent(storedId)}`
            : '/api/user/me';
        const response = await fetch(meUrl, { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        const apiUserId = data && data.user ? data.user.user_id : null;
        const apiUserName = data && data.user ? data.user.user_name : null;
        if (apiUserId) {
            currentUserId = String(apiUserId);
            setStoredUserId(apiUserId);
        }
        if (apiUserName) {
            currentUserName = apiUserName;
        }
    } catch (error) {
        console.warn('loadCurrentUser failed:', error);
    }
}

async function fetchTrips() {
    const postContainer = document.getElementById('postContainer');
    try {
        const uid = currentUserId || getStoredUserId();
        const url = uid
            ? `/api/board/trips?user_id=${encodeURIComponent(uid)}`
            : '/api/board/trips';
        const response = await fetch(url, { credentials: 'include' });
        const trips = await response.json();

        postContainer.innerHTML = '';
        allTrips = trips;
        if (Array.isArray(trips) && trips.length) {
            console.table(trips.slice(0, 8).map(t => ({
                trip_id: t.trip_id,
                creator_id: t.creator_id,
                user_name: t.user_name,
                is_host: t.is_host,
                me_user_id: t.me_user_id,
                currentUserId,
                currentUserName
            })));
        }
        renderTrips(allTrips);
    } catch (error) {
        console.error('Error:', error);
        postContainer.innerHTML = '<p>ขออภัย เกิดข้อผิดพลาดในการโหลดข้อมู</p>';
    }
}

function goToTrip(event, tripId) {
    // Don't navigate if clicking the Join button
    if (event.target.closest('.joy-btn')) return;
    window.location.href = `../html/tripdetail.html?trip_id=${tripId}`;
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
            ? `/${trip.cover_image}`
            : '../img/default-trip.jpg';

        const hasAvatar = trip.user_avatar && trip.user_avatar !== 'null';
        const imgSrc = hasAvatar
            ? (trip.user_avatar.startsWith('http')
                ? trip.user_avatar
                : `${trip.user_avatar}`)
            : null;

        const avatarHtml = imgSrc
            ? `<img class="avatar" src="${imgSrc}" alt="avatar" 
         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
       <div class="avatar" style="display:none;background:#F28695;align-items:center;justify-content:center;color:#fff;font-weight:500;font-size:16px;">
         ${(trip.user_name || '?')[0].toUpperCase()}
       </div>`
            : `<div class="avatar" style="background:#F28695;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:500;font-size:16px;">
         ${(trip.user_name || '?')[0].toUpperCase()}
       </div>`;

        const startTime = trip.start_time
            ? new Date(trip.start_time).toLocaleString('th-TH')
            : 'ไม่ระบุ';

        const endTime = trip.end_time
            ? new Date(trip.end_time).toLocaleString('th-TH')
            : 'ไม่ระบุ';

        const budgetDisplay = (trip.budget_min && trip.budget_max)
            ? `${Number(trip.budget_min).toLocaleString()} - ${Number(trip.budget_max).toLocaleString()} ฿`
            : 'ไม่ระบุ';

        const budgetType = trip.budget_type === 'Person'
            ? ' / person'
            : trip.budget_type === 'Trip'
            ? ' / trip'
            : '';
        const isFull = Number(trip.current_member || 0) >= Number(trip.max_member || 0);
        const now = new Date();
        const limitDate = trip.limit_date_accept ? new Date(trip.limit_date_accept) : null;
        const isExpired = limitDate && now > limitDate;

        const effectiveUserId = currentUserId || getStoredUserId() || trip.me_user_id || null;
        const effectiveUserName = currentUserName || (getStoredUser() && getStoredUser().user_name) || null;
        const isHostById = Number(trip.is_host) === 1 || (effectiveUserId && Number(trip.creator_id) === Number(effectiveUserId));
        const isHostByName = effectiveUserName && normalizeName(trip.user_name) === normalizeName(effectiveUserName);
        const isHost = isHostById || isHostByName;
        let joinButtonHtml = `<button class="joy-btn"onclick="openJoinModal(${trip.trip_id}, this, ${trip.creator_id}, ${trip.me_user_id || 'null'})">Join</button>`;

        if (isHost) {
            joinButtonHtml = `<button class="joy-btn" disabled>Host</button>`;
        } else if (trip.my_join_status === 'Pending') {
            joinButtonHtml = `<button class="joy-btn" disabled>⏳ Pending</button>`;
        } else if (trip.my_join_status === 'Joined') {
            joinButtonHtml = `<button class="joy-btn" disabled>✅ Joined</button>`;
        } else if (isExpired) {
            joinButtonHtml = `<button class="joy-btn" disabled style="background:#ccc;">Entry Closed</button>`;
        } else if (isFull) {
            joinButtonHtml = `<button class="joy-btn" disabled>Full</button>`;
        }

        const limitDisplay = limitDate
            ? limitDate.toLocaleString('th-TH')
            : 'ไม่ระบุ';

        const postHTML = `
        <div class="post-card" onclick="goToTrip(event, ${trip.trip_id})" style="cursor:pointer;">
            <div class="post-header">
               ${avatarHtml}

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
                        <span>${budgetDisplay}<span style="font-size: 0.85em; color: #7f8c8d; font-weight: 400;">${budgetType}</span></span>
                    </div>
                </div>

                <div class="trip-limit-box">
                    <span class="limit-label">Last day to join</span>
                    <div class="limit-time-row">
                        <iconify-icon icon="solar:clock-circle-outline"></iconify-icon>
                        <span>${limitDisplay}</span>
                    </div>
                </div>

                ${joinButtonHtml}
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

async function joinTrip(tripId, btn, creatorId, meUserIdFromTrip) {
    const uid = currentUserId || getStoredUserId() || meUserIdFromTrip;
    const trip = allTrips.find(item => Number(item.trip_id) === Number(tripId));
    // ตรวจสอบ Expired อีกครั้งก่อนส่ง Request
    if (trip && trip.limit_date_accept) {
        if (new Date() > new Date(trip.limit_date_accept)) {
            alert('ขออภัย ทริปนี้ปิดรับสมาชิกแล้ว');
            return;
        }
    }

    const isHostByName = currentUserName && trip && normalizeName(trip.user_name) === normalizeName(currentUserName);
    if (!uid) {
        alert('กรุณาล็อกอินก่อน');
        return;
    }
    if (Number(uid) === Number(creatorId) || isHostByName) {
        btn.disabled = true;
        btn.textContent = 'Host';
        return;
    }
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const res = await fetch('/api/notification/join-request', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trip_id: tripId, user_id: uid })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            btn.textContent = '⏳ Pending';
            btn.style.opacity = '0.7';
        } else {
            btn.disabled = false;
            btn.textContent = 'Join';
            alert(data.error || data.message || 'เกิดข้อผิดพลาด!');
        }
    } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Join';
        console.error(err);
    }
}

function calculateTime(dateString) {

    const diff = new Date() - new Date(dateString);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return days + 'd';

    const hours = Math.floor(diff / (1000 * 60 * 60));

    return hours + 'h';
}

document.addEventListener('DOMContentLoaded', () => {

    loadCurrentUser().then(() => fetchTrips());

    document.getElementById('searchInput')
        .addEventListener('input', (e) => {
            searchTrips(e.target.value);
        });

});
