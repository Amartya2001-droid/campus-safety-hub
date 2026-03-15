import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCWAsVViGm0Gj2TA2fbubJirEMmPb329DM",
  authDomain: "acadia-safety.firebaseapp.com",
  projectId: "acadia-safety",
  storageBucket: "acadia-safety.firebasestorage.app",
  messagingSenderId: "363313777049",
  appId: "1:363313777049:web:16fc80022096768fb9eb08"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
