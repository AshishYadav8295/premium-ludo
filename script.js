"use strict";

/* ==========================================
   LUDOVERSE HOME SYSTEM
========================================== */

import {
  auth,
  onAuthStateChanged,
  signOut
} from "./firebase.js";


/* ==========================================
   DOM ELEMENTS
========================================== */

const profileBtn =
  document.getElementById("profileBtn");

const profileMenu =
  document.getElementById("profileMenu");

const userName =
  document.getElementById("userName");

const userEmail =
  document.getElementById("userEmail");

const userPhoto =
  document.getElementById("userPhoto");


/* ==========================================
   FIREBASE LOGIN CHECK
========================================== */

onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {

      console.log(
        "No user logged in"
      );

      window.location.href =
        "login.html";

      return;
    }


    console.log(
      "Logged in user:",
      user
    );


    /* ==============================
       GOOGLE REAL NAME
    ============================== */

    if (userName) {

      userName.textContent =
        user.displayName ||
        "LUDOVERSE Player";

    }


    /* ==============================
       GOOGLE REAL EMAIL
    ============================== */

    if (userEmail) {

      userEmail.textContent =
        user.email ||
        user.phoneNumber ||
        "";

    }


    /* ==============================
       GOOGLE PROFILE PHOTO
    ============================== */

    if (userPhoto) {

      if (user.photoURL) {

        userPhoto.src =
          user.photoURL;

      } else {

        userPhoto.style.display =
          "none";

      }

    }


    console.log(
      "LUDOVERSE user loaded successfully"
    );

  }
);


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


/* ==========================================
   CLOSE PROFILE MENU
========================================== */

document.addEventListener(
  "click",
  (event) => {

    if (
      profileMenu &&
      profileBtn &&
      !profileMenu.contains(event.target) &&
      !profileBtn.contains(event.target)
    ) {

      profileMenu.classList.remove(
        "active"
      );

    }

  }
);


/* ==========================================
   PLAY NOW
========================================== */

function playNow() {

  window.location.href =
    "game.html";

}


/* ==========================================
   CREATE ROOM
========================================== */

function createRoom() {

  window.location.href =
    "wallet.html";

}


/* ==========================================
   OPEN WALLET
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
    "🎮 My Games feature is coming soon!"
  );

}


/* ==========================================
   FIREBASE PROPER LOGOUT
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

    await signOut(auth);


    /* Remove old local data */

    localStorage.removeItem(
      "ludoverseLoggedIn"
    );

    localStorage.removeItem(
      "ludoverseUser"
    );


    console.log(
      "Firebase logout successful"
    );


    window.location.href =
      "login.html";


  } catch (error) {

    console.error(
      "Logout error:",
      error
    );


    alert(
      "Logout failed. Please try again."
    );

  }

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
   WEBSITE READY
========================================== */

console.log(
  "🎲 LUDOVERSE Home System Ready"
);