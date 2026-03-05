async function fetchTrips() {
    try {
        const response = await fetch('http://localhost:3000/api/board/trips');
        const trips = await response.json();

        const boardContainer = document.getElementById('board-container');

        // ล้างข้อมูลเก่าออกก่อน 
        boardContainer.innerHTML = '';

        // เช็คว่าถ้าไม่มีข้อมูล ให้โชว์ข้อความแจ้งเตือน
        if (trips.length === 0) {
            boardContainer.innerHTML = '<p class="no-data">ยังไม่มีทริปในขณะนี้ มาสร้างทริปแรกกันเถอะ!</p>';
            return;
        }

        // ถ้ามีข้อมูล ก็ทำการวนลูปสร้าง Card ตามปกติ
        trips.forEach(trip => {
            const imageUrl = `http://localhost:3000/${trip.cover_image}`;

            const tripCard = `
                <div class="trip-card">
                    <img src="${imageUrl}" alt="${trip.trip_name}" style="width:100%; height:200px; object-fit:cover;">
                    <h3>${trip.trip_name}</h3>
                    <p>${trip.description}</p> 
                    <p>Host: ${trip.user_name}</p>
                    <p>สมาชิก: ${trip.current_member} / ${trip.max_member}</p>
                    <button onclick="joinTrip(${trip.trip_id})">Join</button>
                </div>
            `;
            boardContainer.innerHTML += tripCard;
        });
    } catch (error) {
        console.error('Error fetching trips:', error);
        const boardContainer = document.getElementById('board-container');
        boardContainer.innerHTML = '<p class="error">ขออภัย เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}