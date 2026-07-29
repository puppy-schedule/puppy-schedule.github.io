// Paste your real config here
const firebaseConfig = {
  apiKey: "AIzaSyCmARe2I08IYzYiI1YOEIPDkwPTv-fRKKk",
  authDomain: "authentication-25a53.firebaseapp.com",
  projectId: "authentication-25a53",
  storageBucket: "authentication-25a53.firebasestorage.app",
  messagingSenderId: "450621220369",
  appId: "1:450621220369:web:bc2349892461a68ec273b0"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
