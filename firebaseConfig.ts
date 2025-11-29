import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA2VdGCwrIT_z_hkrFJZe1-O0lRxMBGBJ4",
  authDomain: "school-attendance-b8592.firebaseapp.com",
  projectId: "school-attendance-b8592",
  storageBucket: "school-attendance-b8592.firebasestorage.app",
  messagingSenderId: "155764122686",
  appId: "1:155764122686:web:262d23e7436c2833f8dd6f",
  measurementId: "G-S5Y06RE6W2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);