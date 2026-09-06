"use strict";

/* ==========================================
   LUDOVERSE HOME SYSTEM
========================================== */

import {
  auth,
  signOut
} from "./firebase.js";


const profileBtn =
  document.getElementById("profileBtn");

const profileMenu =
  document.getElementById("profileMenu");


/* ==========================================
   LOGIN CHECK + PROFILE DATA
========================================== */

function checkUserLogin() {

  const loggedIn =
    localStorage.getItem(
      "ludoverseLoggedIn"
    );

  const userData =
    localStorage.getItem(
      "ludoverseUser"
    );


  /* Redirect if not logged in */

  if (
    loggedIn !== "true" ||
    !userData
  ) {

    window.location.href =
      "login.html";

    return;
  }


  try {

    const user =
      JSON.parse(userData);


    /* ======================================
       FIND PROFILE ELEMENTS
    ====================================== */

    const profileName =
      document.getElementById("profileName");

    const profileEmail =
      document.getElementById("profileEmail");

    const profileImage =
      document.getElementById("profileImage");


    /* ======================================
       SET GOOGLE NAME
    ====================================== */

    if (profileName) {

      profileName.textContent =
        user.displayName ||
        "Player";

    }


    /* ======================================
       SET GOOGLE EMAIL
    ====================================== */

    if (profileEmail) {

      profileEmail.textContent =
        user.email ||
        "Premium Player";

    }


    /* ======================================
       SET GOOGLE PROFILE PHOTO
    ====================================== */

    if (
      profileImage &&
      user.photoURL
    ) {

      profileImage.src =
        user.photoURL;

      profileImage.style.display =
        "block";

    }


    console.log(
      "Logged in user:",
      user
    );


  }
  catch (error) {

    console.error(
      "User data error:",
      error
    );

  }

}


/* ==========================================
   PROFILE MENU
========================================== */

profileBtn?.addEventListener(
  "click",
  (event) => {

    event.stopPropagation();

    profileMenu?.classList.toggle(
      "active"
    );

  }
);


document.addEventListener(
  "click",
  (event) => {

    if (
      profileMenu &&
      profileBtn &&
      !profileMenu.contains(
        event.target
      ) &&
      !profileBtn.contains(
        event.target
      )
    ) {

      profileMenu.classList.remove(
        "active"
      );

    }

  }
);


/* ==========================================
   PLAY VS AI
========================================== */

function playNow() {

  window.location.href =
    "game.html";

}


/* ==========================================
   PLAY WITH FRIENDS
========================================== */

function createRoom() {

  window.location.href =
    "wallet.html";

}


/* ==========================================
   WALLET
========================================== */

function openWallet() {

  window.location.href =
    "wallet.html";

}


/* ==========================================
   MY GAMES
========================================== */

function openBattles() {

  alert(
    "🎮 My Games feature is coming next!"
  );

}


/* ==========================================
   LOGOUT
========================================== */

async function logout() {

  const confirmLogout =
    confirm(
      "Are you sure you want to logout?"
    );


  if (!confirmLogout) {

    return;

  }


  try {

    /* Firebase Google logout */

    await signOut(auth);

  }
  catch (error) {

    console.error(
      "Firebase logout error:",
      error
    );

  }


  /* Remove local login data */

  localStorage.removeItem(
    "ludoverseLoggedIn"
  );

  localStorage.removeItem(
    "ludoverseUser"
  );


  /* Redirect */

  window.location.href =
    "login.html";

}


/* ==========================================
   MAKE FUNCTIONS AVAILABLE TO HTML
========================================== */

window.playNow =
  playNow;

window.createRoom =
  createRoom;

window.openWallet =
  openWallet;

window.openBattles =
  openBattles;

window.logout =
  logout;


/* ==========================================
   START WEBSITE
========================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    checkUserLogin();

    console.log(
      "🎲 LUDOVERSE Home System Ready"
    );

  }
);