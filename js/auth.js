// ─────────────────────────────────────────────
// Screen helpers
// ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });

  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('active');
  }
}

// ─────────────────────────────────────────────
// Global state
// ─────────────────────────────────────────────
let currentUserData = null;
let selectedRole = null;

// ─────────────────────────────────────────────
// LOGIN BUTTON
// ─────────────────────────────────────────────
const loginBtn = document.getElementById('loginButton');
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    if (errorEl) errorEl.textContent = '';

    if (!email || !password) {
      if (errorEl) errorEl.textContent = 'Please fill in both fields';
      return;
    }

    try {
      loginBtn.disabled = true;
      loginBtn.textContent = 'Logging in...';
      await auth.signInWithEmailAndPassword(email, password);
      // onAuthStateChanged will take over
    } catch (err) {
      console.error(err);
      if (errorEl) errorEl.textContent = friendlyError(err);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login ♡';
    }
  });
}

// ─────────────────────────────────────────────
// CREATE ACCOUNT BUTTON
// ─────────────────────────────────────────────
const createBtn = document.getElementById('createAccountButton');
if (createBtn) {
  createBtn.addEventListener('click', () => {
    showScreen('registerScreen');
  });
}

// ─────────────────────────────────────────────
// ROLE SELECTION
// ─────────────────────────────────────────────
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRole = btn.dataset.role;
  });
});

// ─────────────────────────────────────────────
// FINISH REGISTER
// ─────────────────────────────────────────────
const finishBtn = document.getElementById('finishRegister');
if (finishBtn) {
  finishBtn.addEventListener('click', async () => {
    const email = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('registerError');

    if (errorEl) errorEl.textContent = '';

    if (!email || !password || !confirm) {
      if (errorEl) errorEl.textContent = 'Please fill in all fields';
      return;
    }
    if (password !== confirm) {
      if (errorEl) errorEl.textContent = 'Passwords do not match';
      return;
    }
    if (!selectedRole) {
      if (errorEl) errorEl.textContent = 'Please choose Owner or Puppy';
      return;
    }
    if (password.length < 6) {
      if (errorEl) errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    try {
      finishBtn.disabled = true;
      finishBtn.textContent = 'Creating...';

      const cred = await auth.createUserWithEmailAndPassword(email, password);

      await db.collection('users').doc(cred.user.uid).set({
        role: selectedRole,
        displayName: email.split('@')[0],
        points: 0,
        linkedUid: null,
        inviteCode: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // onAuthStateChanged will continue
    } catch (err) {
      console.error(err);
      if (errorEl) errorEl.textContent = friendlyError(err);
    } finally {
      finishBtn.disabled = false;
      finishBtn.textContent = 'Continue ♡';
    }
  });
}

// ─────────────────────────────────────────────
// BACK BUTTONS
// ─────────────────────────────────────────────
document.getElementById('backFromRegister')?.addEventListener('click', () => {
  showScreen('loginScreen');
});

document.getElementById('backFromInvite')?.addEventListener('click', () => {
  if (auth.currentUser) {
    showScreen('dashboard');
  } else {
    showScreen('loginScreen');
  }
});

// ─────────────────────────────────────────────
// INVITE CODE SYSTEM
// ─────────────────────────────────────────────
document.getElementById('generateCode')?.addEventListener('click', async () => {
  if (!auth.currentUser) return;

  const code = generateInviteCode();
  await db.collection('users').doc(auth.currentUser.uid).update({
    inviteCode: code
  });

  const codeEl = document.getElementById('inviteCode');
  if (codeEl) codeEl.textContent = code;
});

document.getElementById('linkButton')?.addEventListener('click', async () => {
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  const errorEl = document.getElementById('linkError');
  if (errorEl) errorEl.textContent = '';

  if (!code) {
    if (errorEl) errorEl.textContent = 'Please enter a code';
    return;
  }

  try {
    const snap = await db.collection('users')
      .where('inviteCode', '==', code)
      .where('role', '==', 'puppy')
      .limit(1)
      .get();

    if (snap.empty) {
      if (errorEl) errorEl.textContent = 'Invalid or expired code';
      return;
    }

    const puppyUid = snap.docs[0].id;

    await db.collection('users').doc(auth.currentUser.uid).update({
      linkedUid: puppyUid
    });

    await db.collection('users').doc(puppyUid).update({
      inviteCode: null
    });

    alert('Successfully linked! ♡');
    showScreen('dashboard');
    loadUserUI();
  } catch (err) {
    console.error(err);
    if (errorEl) errorEl.textContent = err.message;
  }
});

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3) code += '-';
  }
  return code;
}

// ─────────────────────────────────────────────
// AUTH STATE
// ─────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    currentUserData = null;
    document.body.classList.remove('is-owner');
    showScreen('loginScreen');
    return;
  }

  try {
    const docRef = db.collection('users').doc(user.uid);
    let doc = await docRef.get();

    if (!doc.exists) {
      await docRef.set({
        role: 'puppy',
        displayName: user.email ? user.email.split('@')[0] : 'puppy',
        points: 0,
        linkedUid: null,
        inviteCode: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      doc = await docRef.get();
    }

    currentUserData = doc.data();

    if (currentUserData.role === 'owner') {
      document.body.classList.add('is-owner');
    } else {
      document.body.classList.remove('is-owner');
    }

    // Decide screen
    if (!currentUserData.linkedUid) {
      showScreen('inviteScreen');
    } else {
      showScreen('dashboard');
    }

    loadUserUI();
  } catch (err) {
    console.error('Auth state error:', err);
    showScreen('loginScreen');
  }
});

// ─────────────────────────────────────────────
// Load UI after login
// ─────────────────────────────────────────────
async function loadUserUI() {
  if (!currentUserData || !auth.currentUser) return;

  const welcome = document.getElementById('welcomeText');
  const rel = document.getElementById('relationshipName');

  if (welcome) {
    const name = currentUserData.displayName || 'there';
    welcome.textContent = currentUserData.role === 'owner'
      ? 'Hello, Owner'
      : `Good girl, ${name}`;
  }

  if (rel) {
    rel.textContent = currentUserData.linkedUid ? '♡ Linked' : 'Not linked yet';
  }

  // Start points listener (defined in app.js)
  if (typeof startPointsListener === 'function') {
    startPointsListener();
  }
}

// ─────────────────────────────────────────────
// Logout + Settings
// ─────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  auth.signOut();
});

document.getElementById('settingsButton')?.addEventListener('click', () => {
  if (typeof switchPanel === 'function') {
    switchPanel('settingsPanel');
  }
});

document.getElementById('goToLink')?.addEventListener('click', () => {
  showScreen('inviteScreen');
});

// ─────────────────────────────────────────────
// Friendly errors
// ─────────────────────────────────────────────
function friendlyError(err) {
  const msg = (err.code || err.message || '').toLowerCase();
  if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
    return 'Wrong email or password';
  }
  if (msg.includes('email-already-in-use')) {
    return 'That email is already registered';
  }
  if (msg.includes('weak-password')) {
    return 'Password is too weak (min 6 characters)';
  }
  if (msg.includes('invalid-email')) {
    return 'Please enter a valid email address';
  }
  return err.message || 'Something went wrong';
}
