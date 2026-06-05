import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDaLv501qUPP_1yX7m0IXW_d4CzKMtcTs",
  authDomain: "tripscalculator.firebaseapp.com",
  projectId: "tripscalculator",
  storageBucket: "tripscalculator.firebasestorage.app",
  messagingSenderId: "534829513057",
  appId: "1:534829513057:web:ac0bb067d15a9898272d20",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
