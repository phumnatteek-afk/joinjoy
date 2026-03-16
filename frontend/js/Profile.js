// Profile.js — frontend logic for Profile.html

const toast = document.getElementById('toast');
const editModal = document.getElementById('editModal');

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.style.background = ok ? '#2ecc71' : '#e74c3c';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Render data onto the page ─────────────────────────────────
function renderProfile(p) {
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ');
  document.getElementById('profileName').textContent = fullName || p.user_name || '—';
  document.getElementById('profileBio').textContent = p.bio || '';
  document.getElementById('firstName').textContent = p.first_name || '—';
  document.getElementById('lastName').textContent = p.last_name || '—';
  document.getElementById('gender').textContent = p.gender || '—';
  document.getElementById('faculty').textContent = p.faculty || '—';
  document.getElementById('social').textContent = p.social_media || '—';

  // Birthday: YYYY-MM-DD → DD/MM/YYYY
  if (p.birth_date) {
    const [y, m, d] = p.birth_date.split('T')[0].split('-');
    document.getElementById('birthday').textContent = `${d}/${m}/${y}`;
  } else {
    document.getElementById('birthday').textContent = '—';
  }

  // Avatar (หน้าหลัก)
  const avatarEl = document.getElementById('profileAvatar');
  if (p.profile_img) {
    avatarEl.src = p.profile_img;
    avatarEl.style.display = 'block';
  }

  // Tags
  const tagList = document.getElementById('tagList');
  tagList.innerHTML = '';
  const tags = Array.isArray(p.tags) ? p.tags : [];
  if (tags.length === 0) {
    tagList.innerHTML = '<span style="color:#bbb;font-size:13px;">No tags yet</span>';
  } else {
    tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'profile-tag-chip';
      chip.textContent = tag.startsWith('#') ? tag : '#' + tag;
      tagList.appendChild(chip);
    });
  }
}

// ── Load Trips ───────────────────────────────────────────────
async function loadMyTrips() {
    const container = document.getElementById('myTripsContainer');
    if (!container) return;

    container.innerHTML = '<p style="color:#bbb; text-align:center; padding: 20px;">Loading your trips...</p>';

    try {
        const res = await fetch('/api/profile/my-trips', { credentials: 'include' });
        const data = await res.json();

        if (data.success && data.trips && data.trips.length > 0) {
            container.innerHTML = data.trips.map(trip => {
                // ตรวจสอบและจัดการ Path ของรูปภาพ
                let imageUrl = '../img/joinjoylogo.png'; // รูป Default
                if (trip.cover_image) {
                    // ถ้าใน DB เก็บแค่ชื่อไฟล์ เช่น "123.jpg" ให้ใช้แบบนี้:
                    // imageUrl = `/uploads/${trip.cover_image}`;
                    
                    // แต่ถ้าใน DB เก็บเป็น "uploads/123.jpg" อยู่แล้ว ให้ใช้แบบนี้:
                    imageUrl = `/${trip.cover_image}`;
                }

                return `
                <div class="trip-item-card">
                  <div class="trip-info">
                    <div class="trip-icon-circle">
                      <img src="${imageUrl}" 
                           alt="trip" 
                           style="width: 100%; height: 100%; object-fit: cover;"
                           onerror="this.src='../img/joinjoylogo.png'">
                    </div>
                    <div class="trip-details">
                      <h4>${trip.trip_name}</h4>
                      <p>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e88fa1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${trip.location_name || 'No location specified'}
                      </p>
                    </div>
                  </div>
                  <button class="btn-edit-trip" onclick="goToEditTrip(${trip.trip_id})">Edit</button>
                </div>
              `;
            }).join('');
        } else {
            container.innerHTML = '<p style="color:#bbb; text-align:center; padding: 20px;">You haven\'t created any trips yet.</p>';
        }
    } catch (err) {
        console.error('Load trips error:', err);
        container.innerHTML = '<p style="color:#e74c3c; text-align:center;">Failed to load trips.</p>';
    }
}

// ── Load profile from API ─────────────────────────────────────
async function loadProfile() {
  // 1. ลองดึงจาก Cache มาแสดงก่อนเพื่อให้ UI ไม่ว่างเปล่า
  const cached = localStorage.getItem('joinjoy_user');
  if (cached) renderProfile(JSON.parse(cached));

  try {
    const res = await fetch('/api/profile/me', { credentials: 'include' });

    if (res.status === 401) {
      window.location.href = '/html/homelogin.html';
      return;
    }

    const data = await res.json();
    if (data.success) {
      renderProfile(data.profile);
      localStorage.setItem('joinjoy_user', JSON.stringify(data.profile));

      // 2. โหลดโปรไฟล์สำเร็จ ค่อยสั่งโหลดทริป
      await loadMyTrips();
    }
  } catch (err) {
    console.error('Profile load error:', err);
    // กรณีดึงโปรไฟล์ไม่สำเร็จ ก็ยังพยายามดึงทริปเผื่อไว้
    await loadMyTrips();
  }
}

window.goToEditTrip = function (tripId) {
  window.location.href = `../html/EditTrip.html?id=${tripId}`;
};

// ── Tag chip selection ────────────────────────────────────────
function getSelectedTags() {
  return [...document.querySelectorAll('.tag-chip-option.selected')]
    .map(el => el.querySelector('input').value);
}

function setSelectedTags(tags) {
  document.querySelectorAll('.tag-chip-option').forEach(el => {
    const val = el.querySelector('input').value;
    const active = tags.some(t => t.toLowerCase() === val.toLowerCase());
    el.classList.toggle('selected', active);
  });
}

document.querySelectorAll('.tag-chip-option').forEach(chip => {
  chip.addEventListener('click', e => {
    e.preventDefault();
    chip.classList.toggle('selected');
  });
});

// ── Avatar file picker ────────────────────────────────────────
const avatarFileInput = document.getElementById('avatarFileInput');
const btnPickAvatar = document.getElementById('btnPickAvatar');
const avatarPreview = document.getElementById('avatarPreview');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const avatarFileName = document.getElementById('avatarFileName');

if (btnPickAvatar) {
  btnPickAvatar.addEventListener('click', () => avatarFileInput.click());
}

if (avatarFileInput) {
  avatarFileInput.addEventListener('change', () => {
    const file = avatarFileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      avatarPreview.src = e.target.result;
      avatarPreview.style.display = 'block';
      avatarPlaceholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
    avatarFileName.textContent = file.name;
  });
}

// ── Open edit modal ───────────────────────────────────────────
document.getElementById('btnOpenEdit').addEventListener('click', () => {
  const p = JSON.parse(localStorage.getItem('joinjoy_user') || '{}');

  document.getElementById('editFirstName').value = p.first_name || '';
  document.getElementById('editLastName').value = p.last_name || '';
  document.getElementById('editBio').value = p.bio || '';
  document.getElementById('editGender').value = p.gender || '';
  document.getElementById('editFaculty').value = p.faculty || '';
  document.getElementById('editSocialMedia').value = p.social_media || '';
  document.getElementById('editBirthDate').value = p.birth_date ?
    p.birth_date.split('T')[0] : '';

  if (p.profile_img) {
    avatarPreview.src = p.profile_img;
    avatarPreview.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  } else {
    avatarPreview.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  }
  avatarFileName.textContent = '';
  avatarFileInput.value = '';

  const savedTags = Array.isArray(p.tags) ?
    p.tags :
    (typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
  setSelectedTags(savedTags);

  editModal.classList.add('open');
  const scrollArea = editModal.querySelector('.modal-scroll-area');
  if (scrollArea) scrollArea.scrollTop = 0;
});

// ── Close modal ───────────────────────────────────────────────
document.getElementById('btnCancelEdit').addEventListener('click', () => {
  editModal.classList.remove('open');
});
editModal.addEventListener('click', e => {
  if (e.target === editModal) editModal.classList.remove('open');
});

// ── Save profile ─────────────────────────────────────────────
document.getElementById('btnSaveEdit').addEventListener('click', async () => {
  const btn = document.getElementById('btnSaveEdit');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const file = avatarFileInput.files[0];
    let newProfileImg = null;

    if (file) {
      const formData = new FormData();
      formData.append('avatar', file);
      const avatarRes = await fetch('/api/profile/me/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const avatarData = await avatarRes.json();
      if (avatarData.success) {
        newProfileImg = avatarData.profile_img;
        document.getElementById('profileAvatar').src = newProfileImg;
      }
    }

    const payload = {
      first_name: document.getElementById('editFirstName').value.trim() || null,
      last_name: document.getElementById('editLastName').value.trim() || null,
      bio: document.getElementById('editBio').value.trim() || null,
      birth_date: document.getElementById('editBirthDate').value || null,
      gender: document.getElementById('editGender').value || null,
      faculty: document.getElementById('editFaculty').value.trim() || null,
      social_media: document.getElementById('editSocialMedia').value.trim() || null,
      tags: getSelectedTags(),
    };

    const res = await fetch('/api/profile/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      const cached = JSON.parse(localStorage.getItem('joinjoy_user') || '{}');
      const updated = {
        ...cached,
        ...payload,
        ...(newProfileImg ? { profile_img: newProfileImg } : {}),
      };
      localStorage.setItem('joinjoy_user', JSON.stringify(updated));
      renderProfile(updated);
      editModal.classList.remove('open');
      showToast('Profile saved! ✅');
    } else {
      showToast(data.message || 'Save failed.', false);
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Network error.', false);
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
});

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadProfile();
});