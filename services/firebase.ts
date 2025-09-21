// Fix: Use Firebase v8 compat imports
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// This configuration is taken from the project specification.
// In a real-world application, these should be stored in environment variables.
const firebaseConfig = {
    apiKey: "AIzaSyAafqJS5e15s8H6DE_HSu2-pEljIdI3jok",
    authDomain: "examsidemann-login-4ec4f.firebaseapp.com",
    projectId: "examsidemann-login-4ec4f",
    storageBucket: "examsidemann-login-4ec4f.appspot.com",
    messagingSenderId: "1018299593624",
    appId: "1:1018299593624:web:a960de0806ee36f6d471ed"
};

// Initialize Firebase
// Fix: Use firebase.initializeApp and check for existing apps for v8 compat
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Export Firebase services
// Fix: Export services from the namespaced firebase object for v8 compat
export const auth = firebase.auth();
export const db = firebase.firestore();
export const googleProvider = new firebase.auth.GoogleAuthProvider();