"use strict";

/* ==========================================
   LUDOVERSE HOME SYSTEM
   ========================================== */

const profileBtn = document.getElementById("profileBtn");
const profileMenu = document.getElementById("profileMenu");
const userPhone = document.getElementById("userPhone");

/* ==========================================
   LOGIN CHECK
   ========================================== */

function checkUserLogin() {
  const loggedIn = localStorage.getItem("ludoverseLoggedIn");
  const userData = localStorage.getItem("ludoverseUser");

  if (loggedIn !== "true" || !userData) {
    window.location.href = "login.html";
    return;
  }

  try {
    const user = JSON.parse(userData);

    if (user.phone) {
      userPhone.textContent = "+91 " + user.phone;
    }
  } catch (error) {
    console.error("User data error:", error);
  }
}

/* ==========================================
   PROFILE MENU
   ========================================== */

profileBtn.addEventListener("click", (event) => {
  event.stopPropagation();

  profileMenu.classList.toggle("active");
});

document.addEventListener("click", (event) => {
  if (
    !profileMenu.contains(event.target) &&
    !profileBtn.contains(event.target)
  ) {
    profileMenu.classList.remove("active");
  }
});

/* ==========================================
   PLAY VS AI
   ========================================== */

function playNow() {
  window.location.href = "game.html";
}

/* ==========================================
   PLAY WITH FRIENDS
   Safe free-play room system
   ========================================== */

function createRoom() {
  window.location.href = "wallet.html";
}

/* ==========================================
   WALLET / VIRTUAL COINS
   ========================================== */

function openWallet() {
  window.location.href = "wallet.html";
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

function logout() {
  const confirmLogout = confirm(
    "Are you sure you want to logout?"
  );

  if (!confirmLogout) {
    return;
  }

  localStorage.removeItem("ludoverseLoggedIn");
  localStorage.removeItem("ludoverseUser");

  window.location.href = "login.html";
}

/* ==========================================
   START WEBSITE
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {
  checkUserLogin();

  console.log(
    "🎲 LUDOVERSE Home System Ready"
  );
});