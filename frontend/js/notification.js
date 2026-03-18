(async function initNotifications() {
        const listEl = document.getElementById('notif-list');
        const emptyEl = document.getElementById('empty-state');
        const sectionLabelEl = document.getElementById('section-label');

        const state = { notifications: [] };

        const getUserId = () => {
            const params = new URLSearchParams(window.location.search);
            const fromQuery = params.get('user_id');
            const fromStorage =
                localStorage.getItem('userId') ||
                localStorage.getItem('user_id') ||
                localStorage.getItem('currentUserId');
            return fromQuery || fromStorage || '1';
        };

        const escapeHtml = (text) => {
            if (text === null || text === undefined) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formatTime = (dateString) => {
            const date = new Date(dateString);
            if (Number.isNaN(date.getTime())) return '-';
            return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        };

        const iconSvg = `<svg viewBox="0 0 24 24"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V8H4v2H2v2h2v2h2v-2h2v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        const resolveProfileImage = (imagePath) => {
            const value = String(imagePath || '').trim();
            if (!value) return '';
            if (/^https?:\/\//i.test(value)) return value;
            if (value.startsWith('/')) return `${window.location.origin}${value}`;
            return `${window.location.origin}/${value}`;
        };

        const isJoinRequest = (item) =>
            String(item.notification_title || '').includes('มีคนขอเข้าร่วมทริป') &&
            Number(item.trip_id) > 0;

        const extractRequesterName = (detailText) => {
            const detail = String(detailText || '');
            const matched = detail.match(/^(.+?)\s*ขอเข้าร่วมทริป/);
            return matched ? String(matched[1] || '').trim() : '';
        };

        const enrichMissingRequesterId = async(item) => {
            let resolved = item;

            // Prefer marker-based user id (supports join-request + review notifications)
            // Marker formats supported: [REQ_USER_ID:123] or [FROM_USER_ID:123]
            const markerMatch = String(resolved.notification_detail || '').match(/\[(?:REQ_USER_ID|FROM_USER_ID):(\d+)\]/i);
            const markerUserId = markerMatch ? Number(markerMatch[1]) : 0;

            if (markerUserId > 0 && Number(resolved.from_user_id) !== markerUserId) {
                resolved = {...resolved, from_user_id: markerUserId };
            }

            // For join requests without a marker (older notifications), fall back to resolving by username
            if (!resolved.from_user_id && String(resolved.notification_title || '').includes('มีคนขอเข้าร่วมทริป')) {
                const requesterName = extractRequesterName(resolved.notification_detail);
                if (requesterName) {
                    try {
                        const response = await fetch(`/api/notification/resolve-user?username=${encodeURIComponent(requesterName)}`, {
                            credentials: 'include'
                        });
                        if (response.ok) {
                            const payload = await response.json();
                            const resolvedUserId = Number(payload.user_id || 0);
                            if (resolvedUserId) {
                                resolved = {...resolved, from_user_id: resolvedUserId };
                            }
                        }
                    } catch {
                        // ignore
                    }
                }
            }

            // If we have a user id but no profile image, fetch it from the user-profile API
            if (Number(resolved.from_user_id) > 0 && !resolved.from_user_profile_img) {
                try {
                    const response = await fetch(`/api/notification/user-profile/${encodeURIComponent(resolved.from_user_id)}`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const payload = await response.json();
                        resolved = {...resolved, from_user_profile_img: payload.profile_img || '' };
                    }
                } catch {
                    // ignore
                }
            }

            return resolved;
        };

        const extractHostContact = (item) => {
            const direct = String(item.host_contact || '').trim();
            if (direct) return direct;
            const detail = String(item.notification_detail || '');
            const matched = detail.match(/ติดต่อ\s*Host\s*:\s*(.+)$/i);
            return matched ? String(matched[1] || '').trim() : '';
        };

        const resolveRequesterIdByName = async(requesterName) => {
            const name = String(requesterName || '').trim();
            if (!name) return 0;
            try {
                const response = await fetch(`/api/notification/resolve-user?username=${encodeURIComponent(name)}`, {
                    credentials: 'include'
                });
                if (!response.ok) return 0;
                const payload = await response.json();
                return Number(payload.user_id || 0);
            } catch {
                return 0;
            }
        };

        const resolveHostIdByTrip = async(tripId) => {
            const id = Number(tripId || 0);
            if (!id) return 0;

            try {
                const response = await fetch(`/api/notification/trip-host/${encodeURIComponent(id)}`, {
                    credentials: 'include'
                });
                if (!response.ok) return 0;
                const payload = await response.json();
                return Number(payload.host_user_id || 0);
            } catch {
                return 0;
            }
        };

        const renderProfile = (profile) => {
            const firstName = profile.frist_name || '';
            const lastName = profile.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || profile.user_name || '-';
            const tags = profile.tags ?
                String(profile.tags)
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 5)
                .join(', ') :
                '-';

            return `
      <div class="notif-profile-card">
        <div><strong>Name:</strong> ${escapeHtml(fullName)}</div>
        <div><strong>Faculty:</strong> ${escapeHtml(profile.faculty || '-')}</div>
        <div><strong>Bio:</strong> ${escapeHtml(profile.bio || '-')}</div>
        <div><strong>Tags:</strong> ${escapeHtml(tags)}</div>
      </div>
    `;
        };

        const renderList = () => {
                if (!Array.isArray(state.notifications) || state.notifications.length === 0) {
                    listEl.style.display = 'none';
                    sectionLabelEl.style.display = 'none';
                    emptyEl.style.display = 'flex';
                    return;
                }
                const grouped = state.notifications.reduce((acc, item) => {
                    const key = item.date_group || 'This week';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                }, {});

                const groupOrder = ['Today', 'Yesterday', 'This week'];
                const htmlParts = [];

                groupOrder.forEach((groupName) => {
                            const items = grouped[groupName];
                            if (!items || !items.length) return;

                            htmlParts.push(`<div class="section-label">${escapeHtml(groupName)}</div>`);

                            items.forEach((item) => {
                                        const requesterName = extractRequesterName(item.notification_detail);
                                        const isRequest = isJoinRequest(item);
                                        const isAccepted = String(item.notification_title || '').includes('ได้รับการตอบรับแล้ว');
                                        const isRejected =
                                            String(item.notification_title || '').includes('ปฏิเสธ') ||
                                            String(item.notification_detail || '').includes('ปฏิเสธ');
                                        const isReminder = String(item.notification_title || '').includes('แจ้งเตือน: ทริปพรุ่งนี้');
                                        const isUnread = Boolean(item.is_unread);
                                        const memberStatus = item.member_status || null;
                                        const hostUserId = Number(item.host_user_id || 0);
                                        const profileUserId = isAccepted ? hostUserId : Number(item.from_user_id || 0);
                                        const canOpenProfile =
                                            (isRequest && (profileUserId > 0 || requesterName)) ||
                                            (isAccepted && profileUserId > 0);
                                        const profileTargetId = item.notification_id;
                                        const statusTone =
                                            isReminder ? 'reminder' :
                                            isAccepted || memberStatus === 'Joined' ?
                                            'accepted' :
                                            isRejected || memberStatus === 'Cancelled' ?
                                            'rejected' :
                                            'pending';
                                        const fallbackIcon =
                                            isReminder ? '🗓️' :
                                            statusTone === 'accepted' ?
                                            '✅' :
                                            statusTone === 'rejected' ?
                                            '❌' :
                                            '⏳';
                                        const profileImageSource = isAccepted ? (item.host_profile_img || '') : (item.from_user_profile_img || '');
                                        const profileImage = resolveProfileImage(profileImageSource);
                                        const iconToneClass = profileImage ? '' : ` tone-${statusTone}`;
                                        const iconContent = profileImage ?
                                            `<img class="notif-avatar-img" src="${escapeHtml(profileImage)}" alt="profile">` :
                                            `<span class="notif-status-emoji">${fallbackIcon}</span>`;
                                        const iconHtml = canOpenProfile ?
                                            `<button class="notif-icon notif-icon-btn${iconToneClass}" type="button" data-action="profile" data-user-id="${profileUserId || ''}" data-requester-name="${escapeHtml(isAccepted ? '' : requesterName)}" data-profile-type="${isAccepted ? 'host' : 'requester'}" data-trip-id="${item.trip_id || ''}" data-target-id="${profileTargetId}" aria-label="Open profile">${iconContent}</button>` :
                                            `<div class="notif-icon${iconToneClass}">${iconContent}</div>`;

                                        const hostContact = extractHostContact(item);
                                        const detailCleaned = isAccepted ?
                                            String(item.notification_detail || '').replace(/\s*ติดต่อ\s*Host\s*:\s*.+$/i, '').trim() :
                                            isReminder ?
                                            String(item.notification_detail || '').replace(/\s*\[GROUP_LINK:[^\]]*\]/i, '').trim() :
                                            String(item.notification_detail || '');

                                        // Extract group link from reminder detail
                                        const reminderGroupLinkMatch = isReminder ?
                                            String(item.notification_detail || '').match(/\[GROUP_LINK:([^\]]+)\]/i) : null;
                                        const reminderGroupLink = reminderGroupLinkMatch ? reminderGroupLinkMatch[1].trim() : (item.group_link || '');

                                        const reminderGroupChatHtml = isReminder && reminderGroupLink ?
                                            `<div class="notif-group-chat-btn"
                                                  onclick="window.open('${reminderGroupLink.startsWith('http') ? reminderGroupLink : 'https://' + reminderGroupLink}', '_blank')"
                                                  style="margin-top:8px;background:#FFF0F5;color:#f18da4;padding:10px;border-radius:12px;text-align:center;cursor:pointer;font-weight:bold;border:1.5px solid #f18da4;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;">
                                                  🔗 Group Chat: เข้ากลุ่มที่นี่
                                             </div>` : '';

                                        const hostContactHtml = isAccepted && hostContact ?
                                            `<div class="notif-host-contact">คอนแทค: ${escapeHtml(hostContact)}</div>` :
                                            '';
                                        const groupChatHtml = isAccepted && item.group_link ?
                                            `
    <div class="notif-group-chat-btn" 
         onclick="window.open('${item.group_link.startsWith('http') ? item.group_link : 'https://' + item.group_link}', '_blank')"
         style="margin-top: 8px; background: #FFF0F5; color: #f18da4; padding: 10px; border-radius: 12px; text-align: center; cursor: pointer; font-weight: bold; border: 1.5px solid #f18da4; font-size: 13px; display: flex; align-items: center; justify-content: center; gap: 8px;">
         <iconify-icon icon="mingcute:group-line" style="font-size: 18px;"></iconify-icon>
         Group Chat: เข้ากลุ่มที่นี่
    </div>
  ` :
                                            '';

                                        let actionHtml = '';
                                        if (isRequest) {
                                            if (!memberStatus || memberStatus === 'Pending') {
                                                actionHtml = `
              <div class="notif-actions" data-actions-for="${item.notification_id}">
                <button class="notif-btn accept" data-action="accept" data-trip-id="${item.trip_id}" data-user-id="${item.from_user_id || ''}" data-requester-name="${escapeHtml(requesterName)}">ยอมรับ</button>
                <button class="notif-btn reject" data-action="reject" data-trip-id="${item.trip_id}" data-user-id="${item.from_user_id || ''}" data-requester-name="${escapeHtml(requesterName)}">ปฏิเสธ</button>
              </div>
            `;
                                            } else if (memberStatus === 'Joined') {
                                                actionHtml = `<div class="notif-status-done accepted">✅ ตอบรับแล้ว</div>`;
                                            } else if (memberStatus === 'Cancelled') {
                                                actionHtml = `<div class="notif-status-done rejected">❌ ปฏิเสธแล้ว</div>`;
                                            } else {
                                                actionHtml = `<div class="notif-status-done">${escapeHtml(memberStatus)}</div>`;
                                            }
                                        }

                                        htmlParts.push(`
          <div class="notif-item ${isUnread ? 'is-unread' : 'is-read'}">
            <div class="dot${isUnread ? '' : ' read'}"></div>
            ${iconHtml}
            <div class="notif-body">
              <div class="notif-title">${escapeHtml(item.notification_title)}</div>
              <div class="notif-detail">${escapeHtml(detailCleaned)}</div>
              ${hostContactHtml}
              ${groupChatHtml}
              ${reminderGroupChatHtml}
              ${actionHtml}
              ${canOpenProfile ? `<div class="notif-inline-profile" id="profile-${profileTargetId}"></div>` : ''}
            </div>
            <div class="notif-time">${escapeHtml(formatTime(item.create_at))}</div>
          </div>
        `);
      });
    });

    sectionLabelEl.style.display = 'none';
    emptyEl.style.display = 'none';
    listEl.style.display = 'block';
    listEl.innerHTML = htmlParts.join('');
  };

  const loadNotifications = async () => {
    const userId = getUserId();
    const response = await fetch(`/api/notification/${encodeURIComponent(userId)}`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`โหลดแจ้งเตือนไม่สำเร็จ (${response.status})`);
    const rows = await response.json();
    state.notifications = await Promise.all((rows || []).map(enrichMissingRequesterId));
    renderList();
  };

  const markAllAsRead = async () => {
    const userId = getUserId();
    await fetch(`/api/notification/read-all?user_id=${encodeURIComponent(userId)}`, {
      method: 'PUT',
      credentials: 'include'
    });

    localStorage.setItem('joinjoy_notif_unread', '0');

    state.notifications = (state.notifications || []).map((item) => ({
      ...item,
      is_unread: false
    }));

    renderList();
  };

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('.notif-btn, .notif-icon-btn');
    if (!button) return;

    const action = button.dataset.action;
    let userId = Number(button.dataset.userId || 0);
    const requesterName = button.dataset.requesterName || '';
    const profileType = button.dataset.profileType || 'requester';
    const tripId = Number(button.dataset.tripId || 0);

    if (!userId && requesterName) {
      userId = await resolveRequesterIdByName(requesterName);
      if (userId) {
        button.dataset.userId = String(userId);
      }
    }

    if (!userId && profileType === 'host' && tripId > 0) {
      userId = await resolveHostIdByTrip(tripId);
      if (userId) {
        button.dataset.userId = String(userId);
      }
    }

    try {
      if (action === 'profile') {
        if (!userId) throw new Error('ไม่พบข้อมูลโปรไฟล์');
        const targetId = button.dataset.targetId;
        const container = document.getElementById(`profile-${targetId}`);
        if (!container) return;
        if (container.dataset.loaded === '1') {
          const isVisible = container.classList.toggle('show');
          button.classList.toggle('is-open', isVisible);
          button.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
          return;
        }

        button.disabled = true;
        button.classList.add('is-loading');

        const response = await fetch(`/api/notification/user-profile/${encodeURIComponent(userId)}`, {
          credentials: 'include'
        });
        if (!response.ok) throw new Error('โหลดโปรไฟล์ไม่สำเร็จ');

        const profile = await response.json();
        container.innerHTML = renderProfile(profile);
        container.dataset.loaded = '1';
        container.classList.add('show');

        button.classList.add('is-open');
        button.setAttribute('aria-pressed', 'true');
        button.classList.remove('is-loading');
        button.disabled = false;
        return;
      }

      if (action === 'accept' || action === 'reject') {
        if (!userId) throw new Error('ไม่พบข้อมูลผู้ขอเข้าร่วม');
        const selectedStatus = action === 'accept' ? 'Joined' : 'Cancelled';
        button.disabled = true;

        // ส่ง actor (โฮสที่ login อยู่) ผ่าน query param เพื่อให้ backend ตรวจสิทธิ์ได้
        const hostId = getUserId();
        const respondUrl = hostId
          ? `/api/notification/respond?user_id=${encodeURIComponent(hostId)}`
          : '/api/notification/respond';

        const response = await fetch(respondUrl, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: tripId,
            user_id: userId,
            status: selectedStatus
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'อัปเดตสถานะไม่สำเร็จ');

        await loadNotifications();
      }
    } catch (error) {
      console.error('Notification action error:', error);
      alert(error.message || 'เกิดข้อผิดพลาด');
      button.classList.remove('is-loading');
      button.disabled = false;
      if (action === 'profile') {
        button.classList.remove('is-open');
        button.setAttribute('aria-pressed', 'false');
      }
    }
  });

  try {
    await loadNotifications();
    await markAllAsRead();
  } catch (error) {
    console.error('Notification load error:', error);
    listEl.style.display = 'none';
    sectionLabelEl.style.display = 'none';
    emptyEl.style.display = 'flex';
  }
})();