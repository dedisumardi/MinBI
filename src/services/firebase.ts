import { initializeApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let db: Database | null = null;

try {
  // Only initialize if we have at least a database URL or project ID
  if (firebaseConfig.databaseURL && firebaseConfig.projectId) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  } else {
    console.warn("Firebase configuration missing. Online features will be disabled. Please set VITE_FIREBASE_DATABASE_URL and VITE_FIREBASE_PROJECT_ID in your .env file.");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
}

export { db };
