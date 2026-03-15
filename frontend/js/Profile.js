// Profile.js — frontend logic for Profile.html

const toast     = document.getElementById('toast');
const editModal = document.getElementById('editModal');

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, ok = true) {
  toast.textContent      = msg;
  toast.style.background = ok ? '#2ecc71' : '#e74c3c';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Render data onto the page ─────────────────────────────────
function renderProfile(p) {
  const fullName = [p.first_name, p.last_name].filter(Boolean).join(' ');
  document.getElementById('profileName').textContent = fullName || p.user_name || '—';
  document.getElementById('profileBio').textContent  = p.bio          || '';
  document.getElementById('firstName').textContent   = p.first_name   || '—';
  document.getElementById('lastName').textContent    = p.last_name    || '—';
  document.getElementById('gender').textContent      = p.gender       || '—';
  document.getElementById('faculty').textContent     = p.faculty      || '—';
  document.getElementById('social').textContent      = p.social_media || '—';

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
    avatarEl.src           = p.profile_img;
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
      const chip       = document.createElement('span');
      chip.className   = 'profile-tag-chip';
      chip.textContent = tag.startsWith('#') ? tag : '#' + tag;
      tagList.appendChild(chip);
    });
  }
}

// ── Load profile from API ─────────────────────────────────────
async function loadProfile() {
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
    }
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

// ── Tag chip selection ────────────────────────────────────────
function getSelectedTags() {
  return [...document.querySelectorAll('.tag-chip-option.selected')]
    .map(el => el.querySelector('input').value);
}

function setSelectedTags(tags) {
  document.querySelectorAll('.tag-chip-option').forEach(el => {
    const val    = el.querySelector('input').value;
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
const avatarFileInput   = document.getElementById('avatarFileInput');
const btnPickAvatar     = document.getElementById('btnPickAvatar');
const avatarPreview     = document.getElementById('avatarPreview');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const avatarFileName    = document.getElementById('avatarFileName');

btnPickAvatar.addEventListener('click', () => avatarFileInput.click());

avatarFileInput.addEventListener('change', () => {
  const file = avatarFileInput.files[0];
  if (!file) return;

  // แสดง preview ทันที
  const reader = new FileReader();
  reader.onload = e => {
    avatarPreview.src           = e.target.result;
    avatarPreview.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  };
  reader.readAsDataURL(file);

  avatarFileName.textContent = file.name;
});

// ── Open edit modal ───────────────────────────────────────────
document.getElementById('btnOpenEdit').addEventListener('click', () => {
  const p = JSON.parse(localStorage.getItem('joinjoy_user') || '{}');

  document.getElementById('editFirstName').value   = p.first_name   || '';
  document.getElementById('editLastName').value    = p.last_name    || '';
  document.getElementById('editBio').value         = p.bio          || '';
  document.getElementById('editGender').value      = p.gender       || '';
  document.getElementById('editFaculty').value     = p.faculty      || '';
  document.getElementById('editSocialMedia').value = p.social_media || '';
  document.getElementById('editBirthDate').value   = p.birth_date
    ? p.birth_date.split('T')[0] : '';

  // แสดงรูปปัจจุบันใน modal preview
  if (p.profile_img) {
    avatarPreview.src           = p.profile_img;
    avatarPreview.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  } else {
    avatarPreview.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  }
  avatarFileName.textContent = '';
  avatarFileInput.value      = ''; // reset file input

  // Pre-select saved tags
  const savedTags = Array.isArray(p.tags)
    ? p.tags
    : (typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
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

// ── Save profile (text fields + avatar แยก request) ──────────
document.getElementById('btnSaveEdit').addEventListener('click', async () => {
  const btn       = document.getElementById('btnSaveEdit');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    // 1) อัปโหลดรูปก่อน (ถ้ามีไฟล์ใหม่)
    const file = avatarFileInput.files[0];
    let newProfileImg = null;

    if (file) {
      const formData = new FormData();
      formData.append('avatar', file);

      const avatarRes = await fetch('/api/profile/me/avatar', {
        method:      'POST',
        body:        formData,
        credentials: 'include',
      });

      if (avatarRes.status === 401) {
        window.location.href = '/html/homelogin.html';
        return;
      }

      const avatarData = await avatarRes.json();
      if (avatarData.success) {
        newProfileImg = avatarData.profile_img; // path ที่ backend return มา
        // อัปเดตรูปในหน้าหลักทันที
        const mainAvatar = document.getElementById('profileAvatar');
        mainAvatar.src           = newProfileImg;
        mainAvatar.style.display = 'block';
      } else {
        showToast(avatarData.message || 'Upload photo failed.', false);
        return;
      }
    }

    // 2) บันทึก text fields
    const payload = {
      first_name:   document.getElementById('editFirstName').value.trim()   || null,
      last_name:    document.getElementById('editLastName').value.trim()    || null,
      bio:          document.getElementById('editBio').value.trim()         || null,
      birth_date:   document.getElementById('editBirthDate').value          || null,
      gender:       document.getElementById('editGender').value             || null,
      faculty:      document.getElementById('editFaculty').value.trim()     || null,
      social_media: document.getElementById('editSocialMedia').value.trim() || null,
      tags:         getSelectedTags(),
    };

    const res  = await fetch('/api/profile/me', {
      method:      'PUT',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify(payload),
    });

    if (res.status === 401) {
      window.location.href = '/html/homelogin.html';
      return;
    }

    const data = await res.json();

    if (data.success) {
      // อัปเดต localStorage
      const cached  = JSON.parse(localStorage.getItem('joinjoy_user') || '{}');
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
    showToast('Network error. Please try again.', false);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Save Changes';
  }
});

// ── Init ──────────────────────────────────────────────────────
loadProfile();