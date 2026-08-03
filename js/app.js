// ─────────────────────────────────────────────
// Panels: Home → Rewards → More
// ─────────────────────────────────────────────
const PANELS = ['homePanel', 'rewardPanel', 'morePanel'];
let currentPanelIndex = 0;

function switchPanel(panelId) {
  const idx = PANELS.indexOf(panelId);
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  if (idx !== -1) {
    currentPanelIndex = idx;
    updateDots();
  }
  if (panelId === 'rewardPanel') loadRewards();
  if (panelId === 'morePanel') renderMorePanel();
  if (panelId === 'homePanel') updateDailyButton();
}

function updateDots() {
  document.querySelectorAll('.nav-dots .dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentPanelIndex);
  });
}

document.getElementById('homeBtn')?.addEventListener('click', () => {
  switchPanel('homePanel');
  playSound('tap');
});

// Swipe
(function setupSwipe() {
  const dash = document.getElementById('dashboard');
  if (!dash) return;
  let startX = 0, startY = 0, tracking = false;

  dash.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  dash.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

    if (dx < 0) {
      switchPanel(PANELS[Math.min(currentPanelIndex + 1, PANELS.length - 1)]);
    } else {
      switchPanel(PANELS[Math.max(currentPanelIndex - 1, 0)]);
    }
    playSound('tap');
  }, { passive: true });
})();

// ─────────────────────────────────────────────
// Sounds
// ─────────────────────────────────────────────
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  return audioCtx;
}

function playSound(type) {
  if (localStorage.getItem('soundsEnabled') === 'false') return;
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'point') {
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } else if (type === 'redeem') {
    osc.frequency.value = 523;
    gain.gain.value = 0.1;
    osc.start();
    setTimeout(() => { osc.frequency.value = 659; }, 80);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.stop(ctx.currentTime + 0.25);
  } else {
    osc.frequency.value = 640;
    gain.gain.value = 0.05;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.stop(ctx.currentTime + 0.08);
  }
}

// ─────────────────────────────────────────────
// Owner: manual points
// ─────────────────────────────────────────────
document.querySelectorAll('.quickActions button[data-points]').forEach(btn => {
  btn.addEventListener('click', () => givePoints(parseInt(btn.dataset.points, 10)));
});

document.getElementById('customPointsBtn')?.addEventListener('click', async () => {
  const amount = prompt('How many points?');
  if (!amount) return;
  const num = parseInt(amount, 10);
  if (isNaN(num) || num === 0) return alert('Enter a valid number');
  await givePoints(num);
});

async function givePoints(amount) {
  if (!currentUserData || currentUserData.role !== 'owner') return;
  const puppyUid = currentUserData.linkedUid;
  if (!puppyUid) return alert('Link a puppy first');

  try {
    await db.collection('users').doc(puppyUid).update({
      points: firebase.firestore.FieldValue.increment(amount)
    });
    playSound('point');
    if (typeof sendDiscord === 'function') {
      sendDiscord(WEBHOOK_GENERAL, `⭐ Owner gave **${amount > 0 ? '+' : ''}${amount}** points`);
    }
  } catch (err) {
    console.error(err);
    alert('Could not update points');
  }
}

// ─────────────────────────────────────────────
// Daily treat – PUPPY only, once per 24h
// Weighted: 1–5 = 50%, 6–8 = 35%, 9–10 = 15%
// ─────────────────────────────────────────────
function rollDailyPoints() {
  const r = Math.random() * 100;
  if (r < 50) return 1 + Math.floor(Math.random() * 5); // 1-5
  if (r < 85) return 6 + Math.floor(Math.random() * 3); // 6-8
  return 9 + Math.floor(Math.random() * 2);             // 9-10
}

async function updateDailyButton() {
  const btn = document.getElementById('dailyBtn');
  const hint = document.querySelector('.daily-hint');
  const wrap = document.querySelector('.dailyWrap');
  if (!btn || !currentUserData) return;

  // Only show for puppy
  if (currentUserData.role !== 'puppy') {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  if (wrap) wrap.style.display = 'block';

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  try {
    const doc = await db.collection('users').doc(uid).get();
    const last = doc.data()?.lastDailyClaim || 0;
    const now = Date.now();
    const remaining = 24 * 60 * 60 * 1000 - (now - last);

    if (remaining > 0) {
      const hours = Math.ceil(remaining / (60 * 60 * 1000));
      btn.disabled = true;
      btn.textContent = `Come back in ~${hours}h`;
      if (hint) hint.textContent = 'Daily treat already claimed';
    } else {
      btn.disabled = false;
      btn.textContent = 'Daily treat';
      if (hint) hint.textContent = 'Random 1–10 points (low numbers more common)';
    }
  } catch (e) {
    console.warn(e);
  }
}

document.getElementById('dailyBtn')?.addEventListener('click', async () => {
  if (!currentUserData || currentUserData.role !== 'puppy') return;
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const btn = document.getElementById('dailyBtn');
  if (btn?.disabled) return;

  try {
    const doc = await db.collection('users').doc(uid).get();
    const last = doc.data()?.lastDailyClaim || 0;
    if (Date.now() - last < 24 * 60 * 60 * 1000) {
      alert('You already claimed your daily treat. Come back later!');
      updateDailyButton();
      return;
    }

    const amount = rollDailyPoints();

    await db.collection('users').doc(uid).update({
      points: firebase.firestore.FieldValue.increment(amount),
      lastDailyClaim: Date.now()
    });

    playSound('point');
    alert(`Daily treat: +${amount} points! Good girl`);
    if (typeof sendDiscord === 'function') {
      sendDiscord(WEBHOOK_GENERAL, `🎁 Puppy claimed daily treat: **+${amount}** points`);
    }
    updateDailyButton();
  } catch (err) {
    console.error(err);
    alert('Could not claim daily treat: ' + (err.message || ''));
  }
});

// Refresh daily button when UI loads
const _origLoad = window.loadUserUI;
// call after auth loads
setTimeout(() => updateDailyButton(), 1500);

// ─────────────────────────────────────────────
// Add praise (Owner → saves on puppy doc)
// ─────────────────────────────────────────────
document.getElementById('sendNoteBtn')?.addEventListener('click', async () => {
  if (!currentUserData || currentUserData.role !== 'owner') return;
  const puppyUid = currentUserData.linkedUid;
  if (!puppyUid) return alert('Link a puppy first');

  const text = document.getElementById('pendingNoteInput')?.value.trim();
  if (!text) return alert('Write something first');

  const btn = document.getElementById('sendNoteBtn');
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    await db.collection('users').doc(puppyUid).update({
      praise: firebase.firestore.FieldValue.arrayUnion(text)
    });

    document.getElementById('pendingNoteInput').value = '';
    playSound('tap');
    if (typeof sendDiscord === 'function') {
      sendDiscord(WEBHOOK_GENERAL, `💌 New praise: ${text.slice(0, 80)}`);
    }
  } catch (err) {
    console.error(err);
    alert('Could not save praise: ' + (err.message || 'permission error – update Firestore rules'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Add to Recent Praise'; }
  }
});

// ─────────────────────────────────────────────
// REWARDS
// ─────────────────────────────────────────────
document.getElementById('addRewardBtn')?.addEventListener('click', openAddRewardModal);

function openAddRewardModal() {
  if (!currentUserData || currentUserData.role !== 'owner') {
    alert('Only the Owner can add rewards');
    return;
  }
  document.getElementById('rewardModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'rewardModal';
  modal.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-card">
        <h3>Add Reward</h3>
        <input id="modalTitle" placeholder="Title" maxlength="40">
        <input id="modalInfo" placeholder="Info / description" maxlength="120">
        <input id="modalPrice" type="number" placeholder="Price (points)" min="1">
        <input id="modalAmount" type="number" placeholder="Amount (0 = unlimited)" min="0">
        <div class="modal-actions">
          <button type="button" id="modalCancel" class="secondary">Cancel</button>
          <button type="button" id="modalSave">Save</button>
        </div>
        <p id="modalError" class="error"></p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('modalTitle')?.focus();
  document.getElementById('modalCancel').onclick = () => modal.remove();

  document.getElementById('modalSave').onclick = async () => {
    const title = document.getElementById('modalTitle').value.trim();
    const info = document.getElementById('modalInfo').value.trim();
    const price = parseInt(document.getElementById('modalPrice').value, 10);
    const amountRaw = document.getElementById('modalAmount').value;
    const amount = amountRaw === '' ? 0 : parseInt(amountRaw, 10);
    const errorEl = document.getElementById('modalError');
    errorEl.textContent = '';

    if (!title) { errorEl.textContent = 'Please enter a title'; return; }
    if (isNaN(price) || price < 1) { errorEl.textContent = 'Enter a valid price'; return; }
    if (isNaN(amount) || amount < 0) { errorEl.textContent = 'Amount must be 0 or higher'; return; }

    const saveBtn = document.getElementById('modalSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await db.collection('rewards').add({
        title, description: info, cost: price, amount,
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      modal.remove();
      loadRewards();
      playSound('tap');
      if (typeof sendDiscord === 'function') {
        sendDiscord(WEBHOOK_GENERAL, `🎁 New reward: **${title}** (${price} pts)`);
      }
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || 'Could not save';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  };
}

async function loadRewards() {
  const list = document.getElementById('rewardList');
  if (!list) return;
  list.innerHTML = `<p class="empty">Loading…</p>`;

  try {
    const snap = await db.collection('rewards')
      .where('active', '==', true)
      .orderBy('cost')
      .get();

    if (snap.empty) {
      list.innerHTML = `<p class="empty">No rewards yet<br><small>Tap + to add one</small></p>`;
      return;
    }

    list.innerHTML = '';
    snap.forEach(doc => {
      const r = doc.data();
      const amountText = (r.amount === 0 || r.amount == null) ? 'Unlimited' : `${r.amount} left`;

      const card = document.createElement('div');
      card.className = 'reward-card';
      card.innerHTML = `
        <div class="reward-info">
          <strong>${escapeHtml(r.title)}</strong>
          ${r.description ? `<div class="reward-desc">${escapeHtml(r.description)}</div>` : ''}
          <div class="reward-meta">${amountText}</div>
        </div>
        <div class="reward-actions">
          <span class="cost-badge">${r.cost} pts</span>
          ${currentUserData?.role === 'owner'
            ? `<button class="delete-reward" data-id="${doc.id}">×</button>`
            : `<button class="redeem-btn" data-id="${doc.id}" data-cost="${r.cost}" data-amount="${r.amount || 0}">Redeem</button>`
          }
        </div>
      `;
      list.appendChild(card);
    });

    list.querySelectorAll('.delete-reward').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete this reward?')) return;
        await db.collection('rewards').doc(btn.dataset.id).update({ active: false });
        loadRewards();
      };
    });

    list.querySelectorAll('.redeem-btn').forEach(btn => {
      btn.onclick = async () => {
        const cost = parseInt(btn.dataset.cost, 10);
        const rewardId = btn.dataset.id;
        const currentAmount = parseInt(btn.dataset.amount, 10);
        const uid = auth.currentUser.uid;

        const userDoc = await db.collection('users').doc(uid).get();
        const points = userDoc.data()?.points || 0;

        if (points < cost) {
          alert('Not enough points yet… keep being a good girl');
          return;
        }
        if (!confirm(`Redeem for ${cost} points?`)) return;

        try {
          await db.collection('users').doc(uid).update({
            points: firebase.firestore.FieldValue.increment(-cost)
          });

          if (currentAmount > 0) {
            const newAmount = currentAmount - 1;
            if (newAmount <= 0) {
              await db.collection('rewards').doc(rewardId).update({ active: false });
            } else {
              await db.collection('rewards').doc(rewardId).update({ amount: newAmount });
            }
          }

          playSound('redeem');
          alert('Redeemed! Tell your Owner');
          if (typeof sendDiscord === 'function') {
            const title = btn.closest('.reward-card')?.querySelector('strong')?.textContent || 'a reward';
            sendDiscord(WEBHOOK_GENERAL, `🎁 Puppy redeemed: **${title}** (−${cost} pts)`);
          }
          loadRewards();
        } catch (err) {
          console.error(err);
          alert('Redeem failed: ' + (err.message || 'unknown error'));
        }
      };
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = `<p class="empty">Could not load rewards<br><small>${err.message}</small></p>`;
  }
}

// ─────────────────────────────────────────────
// MORE – About us (May 24, 2025) + Sounds + Link
// ─────────────────────────────────────────────
function daysSinceAnniversary() {
  const start = new Date(2025, 4, 24); // May 24, 2025
  const now = new Date();
  const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowUTC - startUTC) / 86400000);
}

function renderMorePanel() {
  const target = document.getElementById('moreContentArea');
  if (!target) return;

  const days = daysSinceAnniversary();
  const soundsOn = localStorage.getItem('soundsEnabled') !== 'false';

  target.innerHTML = `
    <div class="about-card">
      <h3>About us</h3>
      <p class="about-line">Together since <strong>May 24, 2025</strong></p>
      <p class="about-days"><span id="dayCount">${days}</span> days</p>
      <p class="about-sub">and counting</p>
    </div>

    <div class="more-list" style="margin-top:14px">
      <button class="more-btn" id="btnSounds">Sounds: ${soundsOn ? 'On' : 'Off'}</button>
      <button class="more-btn" id="btnLinkMore">Link / Relationship</button>
      <button class="more-btn" id="btnLogoutMore">Log out</button>
    </div>
  `;

  document.getElementById('btnSounds').onclick = () => {
    const next = localStorage.getItem('soundsEnabled') === 'false';
    localStorage.setItem('soundsEnabled', next ? 'true' : 'false');
    if (next) playSound('tap');
    renderMorePanel();
  };

  document.getElementById('btnLinkMore').onclick = () => showScreen('inviteScreen');
  document.getElementById('btnLogoutMore').onclick = () => auth.signOut();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
