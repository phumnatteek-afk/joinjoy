// Profile.js — Full Version (Profile Edit + Avatar Upload + Your Trips)

// ── 1. GLOBAL HELPERS ────────────────────────────────────────

function showToast(msg, ok = true) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = ok ? '#2ecc71' : '#e74c3c';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── 2. RENDER FUNCTIONS ───────────────────────────────────────

function renderProfile(p) {
    const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ');

    if (document.getElementById('profileName')) document.getElementById('profileName').textContent = fullName || p.user_name || '—';
    if (document.getElementById('profileBio')) document.getElementById('profileBio').textContent = p.bio || '';
    if (document.getElementById('firstName')) document.getElementById('firstName').textContent = p.first_name || '—';
    if (document.getElementById('lastName')) document.getElementById('lastName').textContent = p.last_name || '—';
    if (document.getElementById('gender')) document.getElementById('gender').textContent = p.gender || '—';
    if (document.getElementById('faculty')) document.getElementById('faculty').textContent = p.faculty || '—';
    if (document.getElementById('social')) document.getElementById('social').textContent = p.social_media || '—';

    const bday = document.getElementById('birthday');
    if (bday && p.birth_date) {
        const [y, m, d] = p.birth_date.split('T')[0].split('-');
        bday.textContent = `${d}/${m}/${y}`;
    }

    const avatar = document.getElementById('profileAvatar');
    if (avatar && p.profile_img) {
        avatar.src = p.profile_img;
        avatar.style.display = 'block';
    }

    const tagList = document.getElementById('tagList');
    if (tagList) {
        tagList.innerHTML = '';
        const tags = Array.isArray(p.tags) ? p.tags : [];
        tags.forEach(tag => {
            const chip = document.createElement('span');
            chip.className = 'profile-tag-chip';
            chip.textContent = tag.startsWith('#') ? tag : '#' + tag;
            tagList.appendChild(chip);
        });
    }
}

async function loadMyTrips() {
    const container = document.getElementById('myTripsContainer');
    if (!container) return;

    try {
        const res = await fetch('/api/profile/my-trips', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.trips) {
            container.innerHTML = data.trips.map(trip => `
        <div class="trip-item-card">
          <div class="trip-info">
            <div class="trip-icon-circle">
              <img src="${trip.cover_image ? '/' + trip.cover_image : '../img/joinjoylogo.png'}" 
                   onerror="this.src='../img/joinjoylogo.png'">
            </div>
            <div class="trip-details">
              <h4>${trip.trip_name}</h4>
              <p>${trip.location_name || 'No location'}</p>
            </div>
          </div>
          <button class="btn-edit-trip" onclick="goToEditTrip(${trip.trip_id})">Edit</button>
        </div>
      `).join('');
        }
    } catch (err) {
        console.error('Load trips error:', err);
    }
}

async function loadProfile() {
    const cached = localStorage.getItem('joinjoy_user');
    if (cached) renderProfile(JSON.parse(cached));

    try {
        const res = await fetch('/api/profile/me', { credentials: 'include' });
        const data = await res.json();
        if (data.success) {
            renderProfile(data.profile);
            localStorage.setItem('joinjoy_user', JSON.stringify(data.profile));
            await loadMyTrips();
        }
    } catch (err) {
        console.error('Profile load error:', err);
        await loadMyTrips();
    }
}

// ── 3. EDIT TRIP MODAL (iFrame Hover) ────────────────────────

// ── ฟังก์ชันเปิด Popup แก้ไข Trip (SweetAlert2 Version) ──────────────

window.goToEditTrip = async function(tripId) {
        try {
            // 1. ดึงข้อมูล Trip เดิมมาเติมในฟอร์ม
            const res = await fetch(`/api/trips/${tripId}`);
            const trip = await res.json();
            if (!res.ok) throw new Error(trip.error || 'Failed to fetch');

            const allCategories = ["1-Day Trip", "Chill & Relaxed", "Travel Group", "Beach Trips", "Café Hopping", "Nightlife / Party", "Short Getaway", "Food", "Events", "Concert", "Healing", "Backpacking", "Camping"];
            const savedCats = trip.category ? trip.category.split(',') : [];

            const { value: formValues } = await Swal.fire({
                        title: 'Edit Trip Details',
                        width: '90%',
                        maxWidth: '430px',
                        html: `
        <div class="swal-jj-form">
          <div class="swal-avatar-wrap">
  <div class="swal-trip-cover-preview" id="trip-cover-area" style="background-image: url('${trip.cover_image ? '/' + trip.cover_image : '../img/joinjoylogo.png'}')">
    <div class="sw-cam-btn" onclick="document.getElementById('sw-trip-file').click()">
      <iconify-icon icon="famicons:camera" style="font-size: 20px; color: #fff;"></iconify-icon>
    </div>
  </div>
  <input type="file" id="sw-trip-file" hidden accept="image/*">
</div>

          <div class="swal-jj-field">
            <label>Trip Title <span style="color:red">*</span></label>
            <input id="sw-trip-name" class="jj-input" value="${trip.trip_name || ''}">
          </div>

          <div class="swal-jj-tags-section">
            <label class="tags-title">Category</label>
            <div class="swal-jj-tags-grid" id="cat-grid">
              ${allCategories.map(cat => `
                <div class="swal-tag-chip ${savedCats.includes(cat) ? 'selected' : ''}" data-cat="${cat}">${cat}</div>
              `).join('')}
            </div>
          </div>

          <div class="swal-jj-field">
            <label>Location <span style="color:red">*</span></label>
            <input id="sw-location" class="jj-input" value="${trip.location_name || ''}">
          </div>

          <div class="swal-jj-field-row">
            <div class="swal-jj-field"><label>Budget Range</label><input id="sw-budget" class="jj-input" value="${(trip.budget_min && trip.budget_max) ? trip.budget_min + '-' + trip.budget_max : (trip.budget_min || '')}"></div>
            <div class="swal-jj-field">
              <label>Budget Type</label>
              <select id="sw-budget-type" class="jj-input">
                <option value="Person" ${trip.budget_type === 'Person' ? 'selected' : ''}>Per Person</option>
                <option value="Trip" ${trip.budget_type === 'Trip' ? 'selected' : ''}>Per Trip</option>
              </select>
            </div>
          </div>

          <div class="swal-jj-field"><label>Max Member</label><input id="sw-member" type="number" class="jj-input" value="${trip.max_member || ''}"></div>

          <div class="swal-jj-field">
            <label>Start Time</label>
            <input id="sw-start" type="datetime-local" class="jj-input" value="${trip.start_time ? trip.start_time.substring(0, 16) : ''}">
          </div>
          <div class="swal-jj-field">
            <label>End Time</label>
            <input id="sw-end" type="datetime-local" class="jj-input" value="${trip.end_time ? trip.end_time.substring(0, 16) : ''}">
          </div>

          <div class="swal-jj-field"><label>Last day to join</label><input id="sw-limit" type="datetime-local" class="jj-input" value="${trip.limit_date_accept ? trip.limit_date_accept.substring(0, 16) : ''}"></div>
          <div class="swal-jj-field"><label>Social Media (Contact)</label><input id="sw-detail" class="jj-input" value="${trip.trip_detail || ''}"></div>
          <div class="swal-jj-field"><label>Group Chat (Link)</label><input id="group_link" class="jj-input" value="${trip.group_link || ''}" placeholder="Enter YourGroup Chat Link">
        <button type="button" 
                onclick="window.open(document.getElementById('group_link').value, '_blank')">
        </button>
    </div>
</div>
          <div class="swal-jj-field"><label>Description</label><textarea id="sw-desc" class="jj-input jj-area">${trip.description || ''}</textarea></div>
        </div>
      `,
      confirmButtonText: 'Save Changes',
      showCancelButton: true,
      customClass: { popup: 'swal-jj-popup', confirmButton: 'swal-jj-confirm', cancelButton: 'swal-jj-cancel' },

      didOpen: () => {
        // Toggle Category
        document.getElementById('cat-grid').addEventListener('click', (e) => {
          if (e.target.classList.contains('swal-tag-chip')) e.target.classList.toggle('selected');
        });
        // Preview Cover Image
        document.getElementById('sw-trip-file').addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => document.getElementById('trip-cover-area').style.backgroundImage = `url(${ev.target.result})`;
            reader.readAsDataURL(file);
          }
        });
      },
      preConfirm: () => {
        const budgetRaw = document.getElementById('sw-budget').value;
        const parts = budgetRaw.split('-');
        return {
          trip_name: document.getElementById('sw-trip-name').value,
          location_name: document.getElementById('sw-location').value,
          budget_min: parts[0] || null,
          budget_max: parts[1] || null,
          budget_type: document.getElementById('sw-budget-type').value,
          max_member: document.getElementById('sw-member').value,
          start_time: document.getElementById('sw-start').value,
          end_time: document.getElementById('sw-end').value,
          limit_date_accept: document.getElementById('sw-limit').value,
          trip_detail: document.getElementById('sw-detail').value,
          group_link: document.getElementById('group_link').value,
          description: document.getElementById('sw-desc').value,
          category: Array.from(document.querySelectorAll('#cat-grid .swal-tag-chip.selected')).map(c => c.dataset.cat).join(',')
        }
      }
    });

    if (formValues) {
      const formData = new FormData();
      for (let key in formValues) formData.append(key, formValues[key]);
      const file = document.getElementById('sw-trip-file').files[0];
      if (file) formData.append('cover_image', file);

      const updateRes = await fetch(`/api/trips/${tripId}`, {
    method: 'PUT',
    body: formData,
    credentials: 'include'
});
      const data = await updateRes.json();
      if (data.success) {
        showToast('Trip updated! ✅');
        loadMyTrips();
      } else {
        showToast(data.error, false);
      }
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to load trip', false);
  }
};

window.closeEditTripModal = function() {
    const modal = document.getElementById('editTripModal');
    if (modal) {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.style.display = 'none';
            loadMyTrips(); 
        }, 300);
    }
};

// ── 4. EDIT PROFILE POPUP (SweetAlert2 + Avatar + Tags) ──────

async function openMyModal() {
  const p = JSON.parse(localStorage.getItem('joinjoy_user') || '{}');
  const allTags = ["Beach", "Cafe", "Pet", "Concert", "1-Day Trip", "Sport", "Mall", "Market", "Restaurant", "Buffet", "Party", "Shopping", "Board game"];
  const userTags = Array.isArray(p.tags) ? p.tags : [];

  const { value: formValues } = await Swal.fire({
    title: 'Edit Profile',
    width: '90%',
    maxWidth: '400px',
    html: `
      <div class="swal-jj-form">
        <div class="swal-avatar-wrap" style="text-align:center; margin-bottom:15px;">
          <div class="swal-avatar-ring" style="width:100px; height:100px; border-radius:50%; background:#f0f0f0; margin:0 auto; overflow:hidden; position:relative; border:3px solid #ff6f8f;">
            <img id="sw-preview" src="${p.profile_img || ''}" style="${p.profile_img ? 'width:100%;height:100%;object-fit:cover;' : 'display:none;'}">
            <div id="sw-placeholder" style="${p.profile_img ? 'display:none;' : 'line-height:100px; font-size:30px;'}">📸</div>
          </div>
          <button type="button" onclick="document.getElementById('sw-file').click()" class="sw-cam-btn" style="margin-top:8px; padding:4px 12px; border-radius:15px; border:1px solid #ff6f8f; background:#fff; color:#ff6f8f; font-size:12px; cursor:pointer;">Change Photo</button>
          <input type="file" id="sw-file" hidden accept="image/*">
        </div>

        <div class="swal-jj-field-row">
          <div class="swal-jj-field"><label>First Name</label><input id="sw-fname" class="jj-input" value="${p.first_name || ''}"></div>
          <div class="swal-jj-field"><label>Last Name</label><input id="sw-lname" class="jj-input" value="${p.last_name || ''}"></div>
        </div>
        <div class="swal-jj-field full-width"><label>Bio</label><textarea id="sw-bio" class="jj-input jj-area">${p.bio || ''}</textarea></div>
        <div class="swal-jj-field-row">
          <div class="swal-jj-field"><label>Birthday</label><input id="sw-birth" type="date" class="jj-input" value="${p.birth_date ? p.birth_date.split('T')[0] : ''}"></div>
          <div class="swal-jj-field">
            <label>Gender</label>
            <select id="sw-gender" class="jj-input">
              <option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option>
              <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
              <option value="Other" ${p.gender === 'Other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
        <div class="swal-jj-field full-width"><label>Faculty</label><input id="sw-faculty" class="jj-input" value="${p.faculty || ''}"></div>
        <div class="swal-jj-field full-width"><label>Social Media</label><input id="sw-social" class="jj-input" value="${p.social_media || ''}"></div>
        <div class="swal-jj-tags-section">
          <label class="tags-title">Tags</label>
          <div class="swal-jj-tags-grid" id="sw-tags-grid">
            ${allTags.map(tag => {
              const isSelected = userTags.some(t => t.toLowerCase() === tag.toLowerCase());
              return `<div class="swal-tag-chip ${isSelected ? 'selected' : ''}" data-tag="${tag}">${tag}</div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Save Changes',
    customClass: { popup: 'swal-jj-popup', confirmButton: 'swal-jj-confirm', cancelButton: 'swal-jj-cancel' },
    didOpen: () => {
      // จัดการ Tags
      document.getElementById('sw-tags-grid').addEventListener('click', (e) => {
        const chip = e.target.closest('.swal-tag-chip');
        if (chip) chip.classList.toggle('selected');
      });

      // จัดการ Preview รูป
      document.getElementById('sw-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => {
            document.getElementById('sw-preview').src = ev.target.result;
            document.getElementById('sw-preview').style.display = 'block';
            document.getElementById('sw-placeholder').style.display = 'none';
          };
          reader.readAsDataURL(file);
        }
      });
    },
    preConfirm: async () => {
      // แสดง Loading ป้องกันการกดซ้ำ
      Swal.showLoading();
      
      try {
        const payload = {
          first_name: document.getElementById('sw-fname').value,
          last_name: document.getElementById('sw-lname').value,
          bio: document.getElementById('sw-bio').value,
          birth_date: document.getElementById('sw-birth').value,
          gender: document.getElementById('sw-gender').value,
          faculty: document.getElementById('sw-faculty').value,
          social_media: document.getElementById('sw-social').value,
          tags: Array.from(document.querySelectorAll('#sw-tags-grid .swal-tag-chip.selected')).map(c => c.getAttribute('data-tag'))
        };

        // 1. ส่งข้อมูลข้อความก่อน
        const res = await fetch('/api/profile/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'Update failed');

        // 2. ถ้ามีรูปให้ส่งรูปตามไป
        const file = document.getElementById('sw-file').files[0];
        if (file) {
          const formData = new FormData();
          formData.append('avatar', file);
          const avatarRes = await fetch('/api/profile/me/avatar', { method: 'POST', body: formData, credentials: 'include' });
          const avatarData = await avatarRes.json();
          if (avatarData.success) payload.profile_img = avatarData.profile_img;
        }

        return payload;
      } catch (err) {
        Swal.showValidationMessage(`Request failed: ${err}`);
      }
    }
  });

  if (formValues) {
    showToast('Profile updated! ✅');
    loadProfile(); // รีโหลดหน้าจอหลัก
  }
}

window.openMyModal = openMyModal;

// ── 5. INITIALIZATION ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadProfile);
// ── 6. LOGOUT ─────────────────────────────────────────────────

function handleLogout() {
  Swal.fire({
    title: 'Log out?',
    text: 'Are you sure you want to log out?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, log out',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#ff6f8f',
    customClass: {
      cancelButton: 'swal-jj-cancel',
      confirmButton: 'swal-jj-confirm',
    }
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '../html/home.html';
    }
  });
}

window.handleLogout = handleLogout;