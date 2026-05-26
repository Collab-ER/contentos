// ─── REMPLIS CES VALEURS AVEC TA CONFIG FIREBASE ───────────────────────────
// Tu les trouves dans Firebase Console > Paramètres du projet > Tes applications
// Étapes détaillées dans le README.md

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyDMT6KZf9jy-nz9blUfOpt7NEV1gAK8jqk",
  authDomain:        "estelle-et-robin-collab-rs.firebaseapp.com",
  projectId:         "estelle-et-robin-collab-rs",
  storageBucket:     "estelle-et-robin-collab-rs.firebasestorage.app",
  messagingSenderId: "31558251704",
  appId:             "1:31558251704:web:ed8ccd81fc22328226704d",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
