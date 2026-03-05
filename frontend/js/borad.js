async function fetchTrips() {
    try {
        const response = await fetch('http://localhost:3000/api/board/trips');
        const trips = await response.json();

        const boardContainer = document.getElementById('board-container'); // อย่าลืมใส่ id นี้ใน HTML
        boardContainer.innerHTML = ''; 

        trips.forEach(trip => {
            const tripCard = `
                <div class="trip-card">
                    <img src="${trip.cover_image}" alt="Trip Image">
                    <h3>${trip.trip_name}</h3>
                    <p>${trip.description}</p> <p>Host: ${trip.user_name}</p>
                    <p>สมาชิก: ${trip.current_member} / ${trip.max_member}</p>
                    <button onclick="joinTrip(${trip.trip_id})">Join</button>
                </div>
            `;
            boardContainer.innerHTML += tripCard;
        });
    } catch (error) {
        console.error('Error fetching trips:', error);
    }
}

fetchTrips();