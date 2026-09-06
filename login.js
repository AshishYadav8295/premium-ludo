"use strict";

/* =========================================================
   LUDOVERSE GOOGLE LOGIN
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
   DOM ELEMENTS
========================================================= */

const googleLoginBtn =
  document.getElementById("googleLoginBtn");


/* =========================================================
   LOGIN STATE
========================================================= */

let isProcessing = false;


/* =========================================================
   CREATE STATUS MESSAGE
========================================================= */

const statusMessage =
  document.createElement("div");

statusMessage.className =
  "login-status";

const loginCard =
  document.querySelector(".login-card");

if (loginCard) {
  loginCard.appendChild(statusMessage);
}


/* =========================================================
   SHOW STATUS
========================================================= */

function showStatus(
  message,
  type = "info"
) {
  statusMessage.textContent =
    message;

  statusMessage.className =
    "login-status";

  statusMessage.classList.add(type);
  statusMessage.classList.add("show");

  setTimeout(() => {
    statusMessage.classList.remove("show");
  }, 5000);
}


/* =========================================================
   SAVE USER TO FIREBASE DATABASE
========================================================= */

async function saveUserToDatabase(user) {

  const userReference =
    ref(
      database,
      `users/${user.uid}`
    );

  const snapshot =
    await get(userReference);


  /* =============================================
     EXISTING USER
  ============================================= */

  if (snapshot.exists()) {

    const existingUser =
      snapshot.val();

    await set(
      userReference,
      {
        ...existingUser,

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

        lastLogin:
          new Date().toISOString(),

        loggedIn:
          true
      }
    );

    return;
  }


  /* =============================================
     NEW USER
  ============================================= */

  const newUser = {

    uid:
      user.uid,

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
      new Date().toISOString(),

    lastLogin:
      new Date().toISOString(),

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
      "Google login button not found!"
    );
    return;
  }


  isProcessing = true;

  googleLoginBtn.disabled =
    true;

  googleLoginBtn.innerHTML =
    `
      <span class="google-icon">G</span>
      Connecting to Google...
    `;


  try {

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );


    const user =
      result.user;


    console.log(
      "Google login successful:",
      user
    );


    /* Save user to database */

    await saveUserToDatabase(
      user
    );


    /* =============================================
       SAVE LOCAL LOGIN STATE
    ============================================= */

    const userData = {

      uid:
        user.uid,

      displayName:
        user.displayName,

      email:
        user.email,

      photoURL:
        user.photoURL,

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


    /* =============================================
       SUCCESS
    ============================================= */

    googleLoginBtn.innerHTML =
      `
        <span class="google-icon">✓</span>
        Login Successful!
      `;


    showStatus(
      `Welcome, ${
        user.displayName || "Player"
      }!`,
      "success"
    );


    /* Redirect to main website */

    setTimeout(() => {

      window.location.href =
        "index.html";

    }, 1200);


  }
  catch (error) {

    console.error(
      "Google Login Error:",
      error
    );


    let message =
      "Google login failed. Please try again.";


    /* =============================================
       ERROR HANDLING
    ============================================= */

    if (
      error.code ===
      "auth/popup-closed-by-user"
    ) {

      message =
        "Google login was cancelled.";

    }

    else if (
      error.code ===
      "auth/popup-blocked"
    ) {

      message =
        "Popup was blocked. Please allow popups and try again.";

    }

    else if (
      error.code ===
      "auth/unauthorized-domain"
    ) {

      message =
        "This website domain is not authorized in Firebase.";

    }

    else if (
      error.code ===
      "auth/network-request-failed"
    ) {

      message =
        "Network error. Please check your internet connection.";

    }


    showStatus(
      message,
      "error"
    );


    console.log(
      "Error code:",
      error.code
    );

    console.log(
      "Error message:",
      error.message
    );


    googleLoginBtn.disabled =
      false;


    googleLoginBtn.innerHTML =
      `
        <span class="google-icon">G</span>
        Continue with Google
      `;

  }

  finally {

    isProcessing =
      false;

  }

}


/* =========================================================
   GOOGLE LOGIN BUTTON EVENT
========================================================= */

googleLoginBtn?.addEventListener(
  "click",
  loginWithGoogle
);


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "LUDOVERSE Google Login Ready"
    );

  }
);