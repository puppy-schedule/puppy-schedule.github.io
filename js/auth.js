// ─────────────────────────────────────────────
// Screen helpers
// ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('active');
  }
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('active');
  });
}

// ─────────────────────────────────────────────
// Current user data (cached)
// ─────────────────────────────────────────────
let currentUserData = null;
let selectedRole = null; // "owner" | "puppy"

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
document.getElementById('loginButton').addEventListener('click', async () => {
  const email    = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('loginError');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Please fill in both fields';
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged will handle the rest
  } catch (err) {
    errorEl.textContent = friendlyError(err);
  }
});

// Go to register
document.getElementById('createAccountButton').addEventListener('click', () => {
  showScreen('registerScreen');
});

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────
document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRole = btn.dataset.role;
  });
});

document.getElementById('finishRegister').addEventListener('click', async () => {
  const email    = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const confirm  = document.getElementById('confirmPassword').value;
  const errorEl  = document.getElementById('registerError');
  errorEl.textContent = '';

  if (!email || !password || !confirm) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match';
    return;
  }
  if (!selectedRole) {
    errorEl.textContent = 'Please choose Owner or Puppy';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // Create user document
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
    errorEl.textContent = friendlyError(err);
  }
});

// Back buttons
document.getElementById('backFromRegister').addEventListener('click', () => {
  showScreen('loginScreen');
});
document.getElementById('backFromInvite').addEventListener('click', () => {
  // If already logged in, go to dashboard, otherwise login
  if (auth.currentUser) {
    showScreen('dashboard');
  } else {
    showScreen('loginScreen');
  }
});

// ─────────────────────────────────────────────
// INVITE / LINK SYSTEM
// ─────────────────────────────────────────────
document.getElementById('generateCode').addEventListener('click', async () => {
  if (!auth.currentUser) return;

  const code = generateInviteCode();
  await db.collection('users').doc(auth.currentUser.uid).update({
    inviteCode: code
  });

  document.getElementById('inviteCode').textContent = code;
});

document.getElementById('linkButton').addEventListener('click', async () => {
  const code = document.getElementById('codeInput').value.trim().toUpperCase();
  const errorEl = document.getElementById('linkError');
  errorEl.textContent = '';

  if (!code) {
    errorEl.textContent = 'Please enter a code';
    return;
  }

  try {
    // Find the puppy who has this invite code
    const snap = await db.collection('users')
      .where('inviteCode', '==', code)
      .where('role', '==', 'puppy')
      .limit(1)
      .get();

    if (snap.empty) {
      errorEl.textContent = 'Invalid or expired code';
      return;
    }

    const puppyDoc = snap.docs[0];
    const puppyUid = puppyDoc.id;

    // Link: owner stores the puppy's uid
    await db.collection('users').doc(auth.currentUser.uid).update({
      linkedUid: puppyUid
    });

    // Optional: clear the invite code so it can't be reused
    await db.collection('users').doc(puppyUid).update({
      inviteCode: null
    });

    errorEl.textContent = '';
    alert('Successfully linked! ♡');
    showScreen('dashboard');
    loadUserUI(); // refresh
  } catch (err) {
    errorEl.textContent = err.message;
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
// AUTH STATE LISTENER
// ─────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    currentUserData = null;
    document.body.classList.remove('is-owner');
    showScreen('loginScreen');
    return;
  }

  // Load user document
  const doc = await db.collection('users').doc(user.uid).get();

  if (!doc.exists) {
    // Shouldn't happen, but just in case
    await db.collection('users').doc(user.uid).set({
      role: 'puppy',
      displayName: user.email.split('@')[0],
      points: 0,
      linkedUid: null,
      inviteCode: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    currentUserData = (await db.collection('users').doc(user.uid).get()).data();
  } else {
    currentUserData = doc.data();
  }

  // Set body class for owner-only CSS
  if (currentUserData.role === 'owner') {
    document.body.classList.add('is-owner');
  } else {
    document.body.classList.remove('is-owner');
  }

  // Decide which screen to show
  if (currentUserData.role === 'owner' && !currentUserData.linkedUid) {
    // Owner not linked yet → show invite screen
    showScreen('inviteScreen');
  } else if (currentUserData.role === 'puppy' && !currentUserData.linkedUid) {
    // Puppy not linked → also show invite (so they can generate code)
    showScreen('inviteScreen');
  } else {
    showScreen('dashboard');
  }

  loadUserUI();
});

// ─────────────────────────────────────────────
// UI helpers after login
// ─────────────────────────────────────────────
async function loadUserUI() {
  if (!currentUserData || !auth.currentUser) return;

  const welcome = document.getElementById('welcomeText');
  const rel     = document.getElementById('relationshipName');

  const name = currentUserData.displayName || 'there';
  welcome.textContent = currentUserData.role === 'owner'
    ? `Hello, Owner`
    : `Good girl, ${name}`;

  if (currentUserData.linkedUid) {
    rel.textContent = '♡ Linked';
  } else {
    rel.textContent = 'Not linked yet';
  }

  // Start real-time points listener
  startPointsListener();
}

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  auth.signOut();
});

document.getElementById('settingsButton')?.addEventListener('click', () => {
  // simple: switch to settings panel
  switchPanel('settingsPanel');
});

document.getElementById('goToLink')?.addEventListener('click', () => {
  showScreen('inviteScreen');
});

// ─────────────────────────────────────────────
// Friendly error messages
// ─────────────────────────────────────────────
function friendlyError(err) {
  const msg = err.code || err.message || '';
  if (msg.includes('user-not-found') || msg.includes('wrong-password')) {
    return 'Wrong email or password';
  }
  if (msg.includes('email-already-in-use')) {
    return 'That email is already registered';
  }
  if (msg.includes('weak-password')) {
    return 'Password is too weak';
  }
  if (msg.includes('invalid-email')) {
    return 'Please enter a valid email';
  }
  return err.message || 'Something went wrong';
}
