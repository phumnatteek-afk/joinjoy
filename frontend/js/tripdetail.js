/**
 * tripdetail.js  –  JoinJoy Trip Detail Page
 * - Contact info in member dropdown
 * - Join → Pending flow (notifies host)
 * - Button uses CSS classes (join-btn)
 */

const API_BASE = 'http://localhost:3000';

const $ = id => document.getElementById(id);

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}


const AVATAR_COLORS = ['av-pink', 'av-mint', 'av-peach', 'av-lav'];
function avatarColor(index) { return AVATAR_COLORS[index % AVATAR_COLORS.length]; }

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

/* ── Member element ───────────────────────────────────────── */
function createMemberElement(member, idx, isYou) {
  const item = document.createElement('div');
  item.className = 'td-member-item';
  item.dataset.userId = member.user_id;

  const colClass = avatarColor(idx);
  const displayName = (member.frist_name || member.first_name)
    ? `${member.frist_name || member.first_name} ${member.last_name || ''}`.trim()
    : (member.user_name || 'Unknown');

  const avatarContent = member.profile_img
    ? `<img src="${member.profile_img}" alt="${displayName}" />`
    : `<span style="color:#fff;font-weight:700;font-size:15px">${initials(displayName)}</span>`;

  item.innerHTML = `
    <div class="td-member-row" role="button" tabindex="0" aria-expanded="false">
      <div class="td-member-avatar ${colClass}">${avatarContent}</div>
      <div class="td-member-info">
        <div class="td-member-name">
          ${displayName}
          ${isYou ? '<span class="td-you-badge">you</span>' : ''}
        </div>
        <div class="td-member-sub">View profile</div>
      </div>
      <svg class="td-member-chevron" width="8" height="14" viewBox="0 0 8 14" fill="none">
        <path d="M1 1L7 7L1 13" stroke="#CBA5B5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="td-profile-drop" aria-hidden="true">
      <div class="td-profile-inner">
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
          <div class="spinner" style="width:22px;height:22px;border-width:2.5px"></div>
          <span style="font-size:13px;color:var(--text-muted)">Loading…</span>
        </div>
      </div>
    </div>
  `;

  const row      = item.querySelector('.td-member-row');
  const dropdown = item.querySelector('.td-profile-drop');
  let   loaded   = false;

  function toggle() {
    const isOpen = item.classList.toggle('open');
    dropdown.classList.toggle('open', isOpen);
    row.setAttribute('aria-expanded', isOpen);
    dropdown.setAttribute('aria-hidden', !isOpen);
    if (isOpen && !loaded) {
      loaded = true;
      loadUserProfile(member.user_id, item.querySelector('.td-profile-inner'));
    }
  }

  row.addEventListener('click', toggle);
  row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggle(); });
  return item;
}

async function loadUserProfile(userId, container) {
  try {
    const res  = await fetch(`${API_BASE}/api/trip-member-detail/${userId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const user = await res.json();
    renderUserProfile(user, container);
  } catch (err) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:8px 0">Could not load profile.</p>`;
  }
}

function renderUserProfile(user, container) {
  const fields = [
    { label: 'First name', value: user.frist_name || user.first_name || '—' },
    { label: 'Last name',  value: user.last_name  || '—' },
    { label: 'Faculty',    value: user.faculty    || '—' },
    { label: 'Gender',     value: user.gender     || '—' },
  ];

  const bioHtml = user.bio
    ? `<div class="td-pf-row"><span class="td-pf-label">Bio</span><span class="td-pf-value">${user.bio}</span></div>`
    : '';

  const contactHtml = user.social_media
    ? `<div class="td-pf-row td-pf-contact">
         <span class="td-pf-label">Contact</span>
         <span class="td-contact-chip">
           ${user.social_media}
         </span>
       </div>`
    : '';

  const tagsHtml = user.tags
    ? `<div class="td-pf-row">
         <span class="td-pf-label">Tags</span>
         <div class="td-pf-tags">${
           user.tags.split(',').map(t =>
             `<span class="td-tag" style="font-size:10px;padding:2px 8px">${t.trim()}</span>`
           ).join('')
         }</div>
       </div>`
    : '';

  container.innerHTML = `
    ${fields.map(f => `
      <div class="td-pf-row">
        <span class="td-pf-label">${f.label}</span>
        <span class="td-pf-value">${f.value}</span>
      </div>
    `).join('')}
    ${bioHtml}
    ${contactHtml}
    ${tagsHtml}
  `;
}

/* ── Main render ──────────────────────────────────────────── */
function renderTrip(trip) {
  $('tripTitle').textContent = trip.trip_name || '—';
  $('tripHost').textContent  = trip.host_name || '—';

  // Cover image in hero avatar
  const heroAvatar = document.getElementById('heroAvatar');
  if (heroAvatar && trip.cover_image) {
    heroAvatar.innerHTML = `<img src="${API_BASE}/${trip.cover_image}" alt="${trip.trip_name || 'Trip cover'}" />`;
  }

  const tagsWrap = $('tripTags');
  tagsWrap.innerHTML = '';
  if (trip.category) {
    trip.category.split(',').forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'td-tag';
      chip.textContent = t.trim();
      tagsWrap.appendChild(chip);
    });
  }

  $('startDate').textContent    = formatDate(trip.start_time);
  $('endDate').textContent      = formatDate(trip.end_time);
  $('tripLocation').textContent = trip.location_name || '—';

  if (trip.budget_min != null && trip.budget_max != null) {
    $('tripBudget').textContent = `${Number(trip.budget_min).toLocaleString()} – ${Number(trip.budget_max).toLocaleString()} BATH`;
  } else if (trip.budget_min != null) {
    $('tripBudget').textContent = `${Number(trip.budget_min).toLocaleString()} BATH`;
  } else {
    $('tripBudget').textContent = '—';
  }

  const current = trip.current_members ?? trip.current_member ?? 0;
  const max     = trip.max_member ?? '?';
  $('tripMembers').textContent = `${current} / ${max} Members`;
  $('tripDescription').innerHTML = (trip.description || trip.trip_detail || '—').replace(/\n/g, '<br>');

  // Last day to join (limit_date_accept)
  const deadlineRow = document.getElementById('deadlineRow');
  const limitDateEl = document.getElementById('limitDate');
  if (deadlineRow && limitDateEl) {
    const deadlineVal = trip.limit_date_accept;
    if (deadlineVal) {
      limitDateEl.textContent = formatDate(deadlineVal);
      deadlineRow.style.display = 'flex';
    } else {
      deadlineRow.style.display = 'none';
    }
  }
}

async function renderMembers(tripId, maxMembers) {
  const list = $('membersList');
  list.innerHTML = `<div style="display:flex;justify-content:center;padding:20px 0"><div class="spinner"></div></div>`;
  const currentUserId = parseInt(localStorage.getItem('user_id')) || null;

  try {
    const res = await fetch(`${API_BASE}/api/trip-members/${tripId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const members = await res.json();

    // members array is already Joined-only, so length matches top count
    $('memberCount').textContent = `${members.length}/${maxMembers || '?'}`;
    list.innerHTML = '';

    if (members.length === 0) {
      list.innerHTML = `<p style="padding:20px 16px;color:var(--text-muted);font-size:13px">No members yet — be the first! 🎉</p>`;
      return;
    }

    members.forEach((m, idx) => {
      const isYou = currentUserId !== null && m.user_id === currentUserId;
      list.appendChild(createMemberElement(m, idx, isYou));
    });

  } catch (err) {
    list.innerHTML = `<div style="padding:24px 16px"><p style="font-size:13px;color:var(--text-muted)">Could not load members list.<br><small style="color:#e57373">${err.message}</small></p></div>`;
  }
}

/* ── Join button state helper ─────────────────────────────── */
function setJoinState(btn, state) {
  btn.classList.remove('join-btn--default', 'join-btn--loading', 'join-btn--pending', 'join-btn--joined');
  switch (state) {
    case 'default':
      btn.textContent = 'Join Trip';
      btn.classList.add('join-btn--default');
      btn.disabled = false;
      break;
    case 'loading':
      btn.textContent = 'Sending…';
      btn.classList.add('join-btn--loading');
      btn.disabled = true;
      break;
    case 'pending':
      btn.textContent = '⏳ Pending';
      btn.classList.add('join-btn--pending');
      btn.disabled = true;
      break;
    case 'joined':
      btn.textContent = '✅ Joined';
      btn.classList.add('join-btn--joined');
      btn.disabled = true;
      break;
  }
}

/* ── Join Confirm Modal ───────────────────────────────────── */
function openJoinModal() {
  const modal = $('joinModal');
  if (modal) modal.classList.add('active');
}

function closeJoinModal() {
  const modal = $('joinModal');
  if (modal) modal.classList.remove('active');
}

async function confirmJoin() {
  closeJoinModal();
  const tripId = getQueryParam('trip_id');
  const btn = $('joinBtn');
  if (!btn || !tripId) return;

  const pendingKey = `pending_${tripId}`;
  const userId = localStorage.getItem('user_id');
  if (!userId) { alert('Please log in to join a trip.'); return; }

  setJoinState(btn, 'loading');

  try {
    const res = await fetch(`${API_BASE}/api/notification/join-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trip_id: parseInt(tripId), user_id: parseInt(userId) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    localStorage.setItem(pendingKey, '1');
    setJoinState(btn, 'pending');
  } catch (err) {
    setJoinState(btn, 'default');
    alert(`Could not join: ${err.message}`);
  }
}

// Close modal when clicking the backdrop
document.addEventListener('DOMContentLoaded', () => {
  const modal = $('joinModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeJoinModal();
    });
  }
});

/* ── Skeleton ─────────────────────────────────────────────── */
function showSkeleton() {
  const sk = (w) => `<span style="display:inline-block;width:${w};height:14px;background:#f5d5de;border-radius:6px"></span>`;
  $('tripTitle').innerHTML       = sk('70%');
  $('tripHost').innerHTML        = sk('40%');
  $('startDate').innerHTML       = sk('80px');
  $('endDate').innerHTML         = sk('80px');
  $('tripLocation').innerHTML    = sk('60%');
  $('tripBudget').innerHTML      = sk('60%');
  $('tripMembers').innerHTML     = sk('60%');
  $('tripDescription').innerHTML = `<span style="display:block;width:100%;height:60px;background:#f5d5de;border-radius:6px"></span>`;
}

/* ── ฟังก์ชันอัปเดตสถานะปุ่ม Join (เพิ่มการเช็ค Last day to join) ── */
function updateJoinButtonUI(trip) {
  const btn = $('joinBtn');
  if (!btn) return;

  const joinedCount = trip.current_members ?? 0;
  const maxMember = trip.max_member ?? 0;
  const isFull = joinedCount >= maxMember;

  // 🚩 1. เช็คสถานะ Closed จาก Database
  const isStatusClosed = trip.trip_status && (trip.trip_status.toLowerCase() === 'closed');

  // 🚩 2. เช็คจาก Last day to join (limit_date_accept)
  let isTimeOver = false;
  if (trip.limit_date_accept) {
    const limitDate = new Date(trip.limit_date_accept);
    const now = new Date();
    if (now > limitDate) {
      isTimeOver = true; // เลยกำหนดเวลาแล้ว
    }
  }

  // ล้าง class เดิมและตั้งค่าเริ่มต้นเป็นกดไม่ได้
  btn.className = 'join-btn'; 
  btn.disabled = true;
  btn.onclick = null; 

  if (trip.is_host) {
    // สถานะ Host
    btn.innerHTML = `<i class="fas fa-user"></i> Host`;
    btn.classList.add('btn-host');
  } else if (trip.my_join_status === 'Joined') {
    // สถานะเข้าร่วมแล้ว
    btn.innerHTML = `<i class="fas fa-check"></i> Joined`;
    btn.classList.add('btn-joined');
  } else if (trip.my_join_status === 'Pending') {
    // สถานะรอการตอบรับ
    btn.innerHTML = `<i class="far fa-clock"></i> Pending`;
    btn.classList.add('btn-pending');
  } else if (isStatusClosed || isTimeOver) {
    // 🚩 สถานะปิดรับสมัคร (เพราะตั้งใจปิด หรือ เพราะเลยวัน Last day to join)
    btn.innerHTML = `<i class="fas fa-times-circle"></i> Entry Closed`;
    btn.classList.add('btn-closed');
    btn.disabled = true; 
    // เพิ่ม CSS pointer-events: none ในคลาส btn-closed ด้วยจะชัวร์ที่สุด
  } else if (isFull) {
    // สถานะคนเต็ม
    btn.innerHTML = `<i class="fas fa-user-friends"></i> Full`;
    btn.classList.add('btn-full');
  } else {
    // สถานะปกติที่ Join ได้ (สีชมพู)
    btn.textContent = 'Join Trip';
    btn.disabled = false;
    btn.classList.add('btn-join'); 
    btn.onclick = openJoinModal;
  }
}

/* ── ฟังก์ชัน init (ลบการเรียก setupJoinButton ออก) ── */
async function init() {
  const tripId = getQueryParam('trip_id');
  if (!tripId) {
    // ... จัดการกรณีไม่มี ID ...
    return;
  }

  $('loadingState').style.display = 'none';
  $('pageContent').classList.remove('td-hidden');
  showSkeleton();

  try {
    const res = await fetch(`${API_BASE}/api/trip-detail/${tripId}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const trip = await res.json();

    window.__currentTrip = trip;
    renderTrip(trip);
    await renderMembers(tripId, trip.max_member);
    
    // 🚩 ใช้ฟังก์ชันนี้ควบคุมปุ่มแทน setupJoinButton เดิม
    updateJoinButtonUI(trip);

  } catch (err) {
    console.error(err);
    $('heroCard').innerHTML = `<div style="padding:32px;text-align:center">⚠️ Error loading trip</div>`;
  }
}

document.addEventListener('DOMContentLoaded', init);