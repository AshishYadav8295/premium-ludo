"use strict";

/* =========================================================
   LUDOVERSE — GOOGLE LOGIN
   Firebase Authentication + User Profile Sync
========================================================= */

import {
  auth,
  database,
  ref,
  set,
  get,
  googleProvider,
  signInWithPopup
} from "./firebase.js";


/* =========================================================
   DOM ELEMENT
========================================================= */

const googleLoginBtn =
  document.getElementById("googleLoginBtn");


/* =========================================================
   LOGIN STATE
========================================================= */

let isProcessing = false;


/* =========================================================
   STATUS MESSAGE
========================================================= */

const statusMessage =
  document.createElement("div");

statusMessage.className = "login-status";


const loginCard =
  document.querySelector(".login-card");


if (loginCard) {
  loginCard.appendChild(statusMessage);
}


/* =========================================================
   SHOW STATUS
========================================================= */

function showStatus(message, type = "info") {

  statusMessage.textContent = message;

  statusMessage.className = "login-status";

  statusMessage.classList.add(type);
  statusMessage.classList.add("show");

  window.clearTimeout(showStatus.timer);

  showStatus.timer = window.setTimeout(() => {
    statusMessage.classList.remove("show");
  }, 5000);
}


/* =========================================================
   SAVE / UPDATE USER PROFILE
========================================================= */

async function saveUserToDatabase(user) {

  if (!user?.uid) {
    throw new Error("Firebase user information is missing.");
  }


  const userReference =
    ref(database, `users/${user.uid}`);


  const snapshot =
    await get(userReference);


  const now =
    new Date().toISOString();


  /* =======================================================
     EXISTING USER
  ======================================================= */

  if (snapshot.exists()) {

    const existingUser =
      snapshot.val() || {};


    const updatedUser = {
      ...existingUser,

      uid: user.uid,

      displayName:
        user.displayName || existingUser.displayName || null,

      email:
        user.email || existingUser.email || null,

      photoURL:
        user.photoURL || existingUser.photoURL || null,

      provider: "google",

      lastLogin: now,

      loggedIn: true
    };


    await set(
      userReference,
      updatedUser
    );


    return updatedUser;
  }


  /* =======================================================
     NEW USER
  ======================================================= */

  const newUser = {

    uid: user.uid,

    displayName:
      user.displayName || "LUDOVERSE Player",

    email:
      user.email || null,

    photoURL:
      user.photoURL || null,

    provider:
      "google",

    username:
      null,

    accountStatus:
      "active",

    blocked:
      false,

    createdAt:
      now,

    lastLogin:
      now,

    loggedIn:
      true,

    totalBattles:
      0,

    wins:
      0,

    losses:
      0,

    cancelledBattles:
      0,

    xp:
      0
  };


  await set(
    userReference,
    newUser
  );


  return newUser;
}


/* =========================================================
   SAVE LOCAL LOGIN STATE
========================================================= */

function saveLocalLoginState(user) {

  const userData = {

    uid:
      user.uid,

    displayName:
      user.displayName || null,

    email:
      user.email || null,

    photoURL:
      user.photoURL || null,

    provider:
      "google",

    loggedIn:
      true,

    loginTime:
      new Date().toISOString()
  };


  localStorage.setItem(
    "ludoverseUser",
    JSON.stringify(userData)
  );


  localStorage.setItem(
    "ludoverseLoggedIn",
    "true"
  );
}


/* =========================================================
   SAVE FIREBASE ID TOKEN
========================================================= */

async function saveFirebaseToken(user) {

  const idToken =
    await user.getIdToken(true);


  localStorage.setItem(
    "ludoverse_token",
    idToken
  );
}


/* =========================================================
   RESET LOGIN BUTTON
========================================================= */

function resetLoginButton() {

  if (!googleLoginBtn) {
    return;
  }


  googleLoginBtn.disabled = false;


  googleLoginBtn.innerHTML = `
    <span class="google-icon">G</span>
    Continue with Google
  `;
}


/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function loginWithGoogle() {

  if (isProcessing) {
    return;
  }


  if (!googleLoginBtn) {

    console.error(
      "Google login button not found."
    );

    return;
  }


  isProcessing = true;


  googleLoginBtn.disabled = true;


  googleLoginBtn.innerHTML = `
    <span class="google-icon">G</span>
    Connecting to Google...
  `;


  try {

    /* =====================================================
       FIREBASE GOOGLE SIGN-IN
    ===================================================== */

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );


    const user =
      result?.user;


    if (!user?.uid) {
      throw new Error(
        "Google authentication did not return a valid user."
      );
    }


    /* =====================================================
       SAVE FIREBASE TOKEN
    ===================================================== */

    await saveFirebaseToken(user);


    /* =====================================================
       SAVE USER PROFILE
    ===================================================== */

    await saveUserToDatabase(user);


    /* =====================================================
       SAVE LOCAL LOGIN STATE
    ===================================================== */

    saveLocalLoginState(user);


    /* =====================================================
       SUCCESS
    ===================================================== */

    googleLoginBtn.innerHTML = `
      <span class="google-icon">✓</span>
      Login Successful!
    `;


    showStatus(
      `Welcome, ${user.displayName || "Player"}!`,
      "success"
    );


    /* =====================================================
       REDIRECT
    ===================================================== */

    window.setTimeout(() => {

      window.location.href =
        "index.html";

    }, 1200);

  }


  /* =======================================================
     ERROR HANDLING
  ======================================================= */

  catch (error) {

    console.error(
      "Google Login Error:",
      error
    );


    let message =
      "Google login failed. Please try again.";


    switch (error?.code) {

      case "auth/popup-closed-by-user":

        message =
          "Google login was cancelled.";

        break;


      case "auth/popup-blocked":

        message =
          "Popup was blocked. Please allow popups and try again.";

        break;


      case "auth/unauthorized-domain":

        message =
          "This website domain is not authorized in Firebase.";

        break;


      case "auth/network-request-failed":

        message =
          "Network error. Please check your internet connection.";

        break;


      case "auth/account-exists-with-different-credential":

        message =
          "An account already exists with a different sign-in method.";

        break;


      default:

        if (error?.message) {
          console.error(
            "Firebase error:",
            error.message
          );
        }

        break;
    }


    showStatus(
      message,
      "error"
    );


    resetLoginButton();
  }


  finally {

    isProcessing = false;
  }
}


/* =========================================================
   GOOGLE LOGIN BUTTON
========================================================= */

if (googleLoginBtn) {

  googleLoginBtn.addEventListener(
    "click",
    loginWithGoogle
  );

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "LUDOVERSE Google Login Ready"
    );

  }
);