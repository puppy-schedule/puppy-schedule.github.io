// Show/hide screens
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Login button
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    await handleUser(cred.user);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// Logout buttons
document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());
document.getElementById('logout-btn-admin')?.addEventListener('click', () => auth.signOut());

// When auth state changes
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await handleUser(user);
  } else {
    showScreen('login-screen');
  }
});

async function handleUser(user) {
  const userRef = db.collection('users').doc(user.uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    // First time this account logs in → create the user document
    // You’ll decide the role manually the first time (see step 8)
    await userRef.set({
      role: "puppy",          // change this to "admin" for your account
      displayName: user.email.split('@')[0],
      points: 0,
      linkedUid: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  const data = (await userRef.get()).data();

  if (data.role === 'admin') {
    showScreen('admin-dashboard');
    // later: loadAdminData(user.uid);
  } else {
    showScreen('puppy-dashboard');
    // later: loadPuppyData(user.uid);
  }
}
