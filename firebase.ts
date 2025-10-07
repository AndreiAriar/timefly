// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// ✅ Firebase config for TimeFly project
const firebaseConfig = {
  apiKey: "AIzaSyCx1JZ4vGCi2WKKTZg-gCHgkR5kPPCftIE",
  authDomain: "timefly-dcd26.firebaseapp.com",
  projectId: "timefly-dcd26",
  storageBucket: "timefly-dcd26.appspot.com",
  messagingSenderId: "995263345459",
  appId: "1:995263345459:web:0a407e5fa1719a3fb4c446",
  measurementId: "G-JMBRFTN12V",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// ✅ Firestore Database
export const db = getFirestore(app);

// ✅ Firebase Storage
export const storage = getStorage(app);

// ✅ Firebase Cloud Functions
export const functions = getFunctions(app);

export default app;
