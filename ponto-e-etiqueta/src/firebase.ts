import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGe87Cd63VfSsy_n1EC4ZesrS3DeV7yD4",
  authDomain: "ponto-etiqueta.firebaseapp.com",
  projectId: "ponto-etiqueta",
  storageBucket: "ponto-etiqueta.firebasestorage.app",
  messagingSenderId: "1066790760822",
  appId: "1:1066790760822:web:8888f7cfe756a5c5498a57",
  measurementId: "G-06H7H9GGH9"
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : undefined;
export const db = getFirestore(app);