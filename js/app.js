// ─────────────────────────────────────────────
// Side menu
// ─────────────────────────────────────────────
const menuBtn = document.getElementById('menuBtn');
const sideMenu = document.getElementById('sideMenu');
const menuOverlay = document.getElementById('menuOverlay');

function openMenu() {
  sideMenu?.classList.add('open');
  menuOverlay?.classList.remove('hidden');
}
function closeMenu() {
  sideMenu?.classList.remove('open');
  menuOverlay?.classList.add('hidden');
}

menuBtn?.addEventListener('click', openMenu);
menuOverlay?.addEventListener('click', closeMenu);

document.querySelectorAll('.side-link[data-panel]').forEach(btn => {
  btn.addEventListener('click', () => {
    const panelId = btn.dataset.panel;
    switchPanel(panelId);
    document.querySelectorAll('.side-link').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    closeMenu();
    if (panelId === 'rewardPanel') loadRewards();
    if (panelId === 'achievementPanel') renderMorePanel();
  });
});

document.getElementById('sideLogout')?.addEventListener('click', () => auth.signOut());

function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

// ─────────────────────────────────────────────
// Owner: give points
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
    addPraise(amount > 0 ? `+${amount} points! Good girl` : `Took ${Math.abs(amount)} points`);

    if (typeof sendDiscord === 'function') {
      sendDiscord(WEBHOOK_GENERAL, `⭐ Owner gave **${amount > 0 ? '+' : ''}${amount}** points`);
    }
  } catch (err) {
    console.error(err);
    alert('Could not update points');
  }
}

function addPraise(text) {
  const feed = document.getElementById('praiseFeed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'praise';
  div.textContent = text;
  feed.prepend(div);
  while (feed.children.length > 6) feed.removeChild(feed.lastChild);
}

// ─────────────────────────────────────────────
// Leave a note for next login (Owner)
// ─────────────────────────────────────────────
document.getElementById('sendNoteBtn')?.addEventListener('click', async () => {
  if (!currentUserData || currentUserData.role !== 'owner') return;
  const puppyUid = currentUserData.linkedUid;
  if (!puppyUid) return alert('Link a puppy first');

  const text = document.getElementById('pendingNoteInput')?.value.trim();
  if (!text) return alert('Write something first');

  try {
    await db.collection('users').doc(puppyUid).update({ pendingNote: text });
    document.getElementById('pendingNoteInput').value = '';
    alert('Note saved — she’ll see it next time she opens the app');
    if (typeof sendDiscord === 'function') {
      sendDiscord(WEBHOOK_GENERAL, '💌 Owner left a note for next login');
    }
  } catch (err) {
    console.error(err);
    alert('Could not save note');
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
        <input id="modalTitle" placeholder="Title (e.g. Pets)" maxlength="40">
        <input id="modalInfo" placeholder="Info / description" maxlength="100">
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
        title,
        description: info,
        cost: price,
        amount,
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      modal.remove();
      loadRewards();
      addPraise(`New reward: ${title}`);

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
          <div class="reward-desc">${amountText}</div>
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
        if (currentAmount > 0 && currentAmount <= 0) {
          alert('This reward is out of stock');
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

          addPraise(`Redeemed! (−${cost} pts)`);
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
// MORE PANEL
// ─────────────────────────────────────────────
function renderMorePanel() {
  const area = document.getElementById('moreContentArea') || document.getElementById('achievementPanel');
  if (!area) return;

  // If we're writing into achievementPanel directly, structure it cleanly
  const target = document.getElementById('moreContentArea') || area;
  target.innerHTML = `
    <div class="more-list">
      <button class="more-btn" id="btnAchievements">Achievements</button>
      <button class="more-btn" id="btnTheme">Theme</button>
      <button class="more-btn" id="btnSounds">Sounds</button>
      <button class="more-btn" id="btnLinkMore">Link / Relationship</button>
      <button class="more-btn" id="btnLogoutMore">Log out</button>
    </div>
    <div id="moreDetail" style="margin-top:16px"></div>
  `;

  document.getElementById('btnAchievements').onclick = () => {
    document.getElementById('moreDetail').innerHTML = `
      <div class="card" style="gap:10px">
        <h3 style="color:var(--hot)">Achievements</h3>
        <div class="ach">First Points</div>
        <div class="ach">Good Girl (50 pts)</div>
        <div class="ach">Spoiled (200 pts)</div>
        <p style="font-size:0.85rem;color:var(--text-light)">More later</p>
      </div>
    `;
  };

  document.getElementById('btnTheme').onclick = () => {
    document.getElementById('moreDetail').innerHTML = `
      <div class="card">
        <h3 style="color:var(--hot)">Theme</h3>
        <p style="color:var(--text-light)">More pastel themes coming soon</p>
      </div>
    `;
  };

  document.getElementById('btnSounds').onclick = () => {
    const enabled = localStorage.getItem('soundsEnabled') !== 'false';
    document.getElementById('moreDetail').innerHTML = `
      <div class="card">
        <h3 style="color:var(--hot)">Sounds</h3>
        <button id="toggleSounds" class="secondary">
          Sounds are ${enabled ? 'ON' : 'OFF'}
        </button>
      </div>
    `;
    document.getElementById('toggleSounds').onclick = () => {
      const next = localStorage.getItem('soundsEnabled') === 'false';
      localStorage.setItem('soundsEnabled', next ? 'true' : 'false');
      document.getElementById('btnSounds').click();
    };
  };

  document.getElementById('btnLinkMore').onclick = () => showScreen('inviteScreen');
  document.getElementById('btnLogoutMore').onclick = () => auth.signOut();
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
