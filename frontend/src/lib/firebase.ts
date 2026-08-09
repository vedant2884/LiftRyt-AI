import { type FirebaseApp, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  // Lazy: initializeApp() itself tolerates an empty config, but getAuth()
  // below validates the API key eagerly and throws on an empty/placeholder
  // one. Deferring both until a caller actually needs Firebase (a Google
  // sign-in click, an avatar upload) means the rest of the app — which
  // imports this module transitively via LoginPage/SignupPage/ProfilePage —
  // still renders normally when Firebase hasn't been configured yet.
  app ??= initializeApp(firebaseConfig);
  return app;
}

/** Opens the Google account picker and returns a verified Firebase ID
 * token — the backend re-verifies it against Google's public keys, so the
 * frontend never has to be trusted with identity decisions itself. */
export async function signInWithGoogle(): Promise<string> {
  const auth = getAuth(getFirebaseApp());
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user.getIdToken();
}
