/* =========================================================
   LUDOVERSE FIREBASE CONFIGURATION
   AUTHENTICATION + REALTIME DATABASE
========================================================= */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";


/* =========================================================
   FIREBASE AUTHENTICATION
========================================================= */

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


/* =========================================================
   FIREBASE REALTIME DATABASE
========================================================= */

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  remove,
  onValue,
  push
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

  apiKey:
    "AIzaSyAEgDLew-aJibSqERi_RbccsdR69Ogtb7U",

  authDomain:
    "ludoverse-d4338.firebaseapp.com",

  projectId:
    "ludoverse-d4338",

  databaseURL:
    "https://ludoverse-d4338-default-rtdb.firebaseio.com",

  storageBucket:
    "ludoverse-d4338.firebasestorage.app",

  messagingSenderId:
    "235676552405",

  appId:
    "1:235676552405:web:2f0164ea815abe5e11e65c"

};


/* =========================================================
   INITIALIZE FIREBASE
========================================================= */

const app =
  initializeApp(firebaseConfig);


/* =========================================================
   INITIALIZE AUTHENTICATION
========================================================= */

const auth =
  getAuth(app);


/* =========================================================
   INITIALIZE DATABASE
========================================================= */

const database =
  getDatabase(app);


/* =========================================================
   EXPORT FIREBASE SERVICES
========================================================= */

export {

  /* Authentication */

  auth,

  RecaptchaVerifier,

  signInWithPhoneNumber,

  onAuthStateChanged,

  signOut,


  /* Database */

  database,

  ref,

  set,

  get,

  update,

  remove,

  onValue,

  push

};