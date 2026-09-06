"use strict";

/* =========================================================
   LUDOVERSE - FIREBASE REALTIME JOIN ROOM SYSTEM
   DEMO VERSION
   ========================================================= */

import {
  auth,
  database,
  ref,
  get,
  update,
  runTransaction,
  onAuthStateChanged
} from "./firebase.js";


document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     DOM ELEMENTS
     ========================================================= */

  const walletBalanceElement =
    document.getElementById("walletBalance");

  const roomCodeInput =
    document.getElementById("roomCodeInput");

  const joinBattleBtn =
    document.getElementById("joinBattleBtn");

  const battlePreview =
    document.getElementById("battlePreview");

  const battleEntry =
    document.getElementById("battleEntry");

  const battlePrize =
    document.getElementById("battlePrize");

  const openGameBtn =
    document.getElementById("openGameBtn");

  const backBtn =
    document.getElementById("backBtn");

  const toast =
    document.getElementById("toast");

  const toastMessage =
    document.getElementById("toastMessage");


  /* =========================================================
     APP STATE
     ========================================================= */

  let currentUser = null;

  let walletBalance = 0;

  let walletLoaded = false;

  let currentBattle = null;

  let isJoining = false;


  /* =========================================================
     SHOW TOAST
     ========================================================= */

  function showToast(
    message,
    type = "success"
  ) {

    if (!toast || !toastMessage) {
      alert(message);
      return;
    }

    toastMessage.textContent =
      message;

    toast.classList.remove(
      "success",
      "error",
      "show"
    );

    toast.classList.add(type);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {

      toast.classList.remove(
        "show"
      );

    }, 3500);

  }


  /* =========================================================
     FORMAT AMOUNT
     ========================================================= */

  function formatAmount(amount) {

    return Number(
      amount || 0
    ).toLocaleString("en-IN");

  }


  /* =========================================================
     UPDATE WALLET DISPLAY
     ========================================================= */

  function updateWalletDisplay() {

    if (!walletBalanceElement) {
      return;
    }

    walletBalanceElement.textContent =
      formatAmount(walletBalance);

  }


  /* =========================================================
     GET WALLET REFERENCE
     ========================================================= */

  function getWalletRef() {

    if (!currentUser) {
      return null;
    }

    return ref(
      database,
      `users/${currentUser.uid}/wallet`
    );

  }


  /* =========================================================
     GET BATTLE REFERENCE
     ========================================================= */

  function getBattleRef(roomCode) {

    return ref(
      database,
      `battles/${roomCode}`
    );

  }


  /* =========================================================
     LOAD WALLET
     ========================================================= */

  async function loadWallet() {

    const walletRef =
      getWalletRef();

    if (!walletRef) {
      return;
    }

    try {

      const snapshot =
        await get(walletRef);

      if (snapshot.exists()) {

        const walletData =
          snapshot.val();

        walletBalance =
          Number(walletData.balance) || 0;

      } else {

        walletBalance = 0;

      }

      walletLoaded = true;

      updateWalletDisplay();

      console.log(
        "Firebase wallet loaded:",
        walletBalance
      );

    } catch (error) {

      console.error(
        "Wallet load error:",
        error
      );

      showToast(
        "Could not load wallet.",
        "error"
      );

    }

  }


  /* =========================================================
     VALIDATE ROOM CODE
     ========================================================= */

  function validateRoomCode(code) {

    if (!code) {

      showToast(
        "Please enter a room code.",
        "error"
      );

      return false;

    }

    if (!/^\d{6}$/.test(code)) {

      showToast(
        "Please enter a valid 6-digit room code.",
        "error"
      );

      return false;

    }

    return true;

  }


  /* =========================================================
     GET BATTLE FROM FIREBASE
     ========================================================= */

  async function getBattle(roomCode) {

    try {

      const snapshot =
        await get(
          getBattleRef(roomCode)
        );

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.val();

    } catch (error) {

      console.error(
        "Battle load error:",
        error
      );

      throw error;

    }

  }


  /* =========================================================
     GET PLAYER COUNT
     ========================================================= */

  function getPlayerCount(battle) {

    if (
      !battle ||
      !battle.players
    ) {
      return 0;
    }

    return Object.keys(
      battle.players
    ).length;

  }


  /* =========================================================
     SHOW BATTLE PREVIEW
     ========================================================= */

  function showBattlePreview(battle) {

    if (!battle) {
      return;
    }

    currentBattle = battle;

    if (battleEntry) {

      battleEntry.textContent =
        formatAmount(
          battle.entry
        );

    }

    if (battlePrize) {

      battlePrize.textContent =
        formatAmount(
          battle.prize
        );

    }

    if (battlePreview) {

      battlePreview.classList.remove(
        "hidden"
      );

    }

  }


  /* =========================================================
     HIDE BATTLE PREVIEW
     ========================================================= */

  function hideBattlePreview() {

    if (battlePreview) {

      battlePreview.classList.add(
        "hidden"
      );

    }

    currentBattle = null;

  }


  /* =========================================================
     PREVIEW ROOM
     ========================================================= */

  async function previewBattle() {

    if (!roomCodeInput) {
      return;
    }

    const roomCode =
      roomCodeInput.value
        .replace(/\D/g, "")
        .slice(0, 6);

    roomCodeInput.value =
      roomCode;

    if (roomCode.length !== 6) {

      hideBattlePreview();

      return;

    }

    try {

      const battle =
        await getBattle(roomCode);

      if (!battle) {

        hideBattlePreview();

        return;

      }

      if (
        battle.status === "completed"
      ) {

        hideBattlePreview();

        showToast(
          "This battle has already been completed.",
          "error"
        );

        return;

      }

      showBattlePreview(battle);

    } catch (error) {

      hideBattlePreview();

      showToast(
        "Could not load battle.",
        "error"
      );

    }

  }


  /* =========================================================
     CREATE TRANSACTION
     ========================================================= */

  function createTransaction(
    roomCode,
    entryAmount
  ) {

    return {

      id:
        `${Date.now()}-${currentUser.uid.slice(0, 6)}`,

      type:
        "debit",

      amount:
        Number(entryAmount),

      description:
        "Joined Demo Battle - Room " +
        roomCode,

      date:
        new Date().toLocaleString(),

      createdAt:
        new Date().toISOString()

    };

  }


  /* =========================================================
     JOIN BATTLE
     ========================================================= */

  async function joinBattle() {

    if (isJoining) {
      return;
    }


    /* -----------------------------------------
       AUTH CHECK
       ----------------------------------------- */

    if (!currentUser) {

      showToast(
        "Please login first.",
        "error"
      );

      return;

    }


    /* -----------------------------------------
       WALLET CHECK
       ----------------------------------------- */

    if (!walletLoaded) {

      showToast(
        "Wallet is still loading.",
        "error"
      );

      return;

    }


    /* -----------------------------------------
       ROOM CODE CHECK
       ----------------------------------------- */

    if (!roomCodeInput) {

      showToast(
        "Room code input not found.",
        "error"
      );

      return;

    }


    const roomCode =
      roomCodeInput.value
        .trim()
        .replace(/\D/g, "")
        .slice(0, 6);


    if (!validateRoomCode(roomCode)) {
      return;
    }


    isJoining = true;


    /* -----------------------------------------
       BUTTON LOADING
       ----------------------------------------- */

    const originalButtonHTML =
      joinBattleBtn
        ? joinBattleBtn.innerHTML
        : "";

    if (joinBattleBtn) {

      joinBattleBtn.disabled = true;

      joinBattleBtn.innerHTML =
        "Joining Battle...";

    }


    try {

      /* =========================================
         STEP 1: LOAD BATTLE
         ========================================= */

      const battle =
        await getBattle(roomCode);


      if (!battle) {

        showToast(
          "No battle found with this room code.",
          "error"
        );

        hideBattlePreview();

        return;

      }


      /* =========================================
         CREATOR CHECK
         ========================================= */

      if (
        battle.creatorUid ===
        currentUser.uid
      ) {

        showToast(
          "You created this battle already.",
          "error"
        );

        return;

      }


      /* =========================================
         STATUS CHECK
         ========================================= */

      if (
        battle.status === "completed"
      ) {

        showToast(
          "This battle has already been completed.",
          "error"
        );

        return;

      }


      /* =========================================
         ALREADY JOINED CHECK
         ========================================= */

      if (
        battle.players &&
        battle.players[currentUser.uid]
      ) {

        showToast(
          "You have already joined this battle.",
          "error"
        );

        return;

      }


      /* =========================================
         PLAYER COUNT CHECK
         ========================================= */

      const playerCount =
        getPlayerCount(battle);

      const maxPlayers =
        Number(
          battle.maxPlayers
        ) || 2;


      if (
        playerCount >= maxPlayers
      ) {

        showToast(
          "This battle room is already full.",
          "error"
        );

        return;

      }


      /* =========================================
         ENTRY AMOUNT
         ========================================= */

      const entryAmount =
        Number(battle.entry) || 0;


      if (entryAmount <= 0) {

        showToast(
          "Invalid battle entry amount.",
          "error"
        );

        return;

      }


      /* =========================================
         LOAD LATEST WALLET
         ========================================= */

      const walletRef =
        getWalletRef();

      const walletSnapshot =
        await get(walletRef);

      const walletData =
        walletSnapshot.exists()
          ? walletSnapshot.val()
          : {
              balance: 0,
              transactions: []
            };


      const latestBalance =
        Number(
          walletData.balance
        ) || 0;


      /* =========================================
         BALANCE CHECK
         ========================================= */

      if (
        latestBalance < entryAmount
      ) {

        showToast(
          `Insufficient demo balance. You need ₹${formatAmount(entryAmount)}.`,
          "error"
        );

        return;

      }


      /* =========================================
         PLAYER DATA
         ========================================= */

      const playerData = {

        uid:
          currentUser.uid,

        name:
          currentUser.displayName ||
          "Player",

        photo:
          currentUser.photoURL ||
          "",

        joinedAt:
          new Date().toISOString()

      };


      /* =========================================
         STEP 2: SECURELY CLAIM PLAYER SLOT

         Firebase transaction prevents
         two phones from filling the
         same last slot simultaneously.
         ========================================= */

      const battleTransaction =
        await runTransaction(
          getBattleRef(roomCode),

          currentData => {

            if (!currentData) {
              return;
            }


            if (
              currentData.status ===
              "completed"
            ) {
              return;
            }


            if (
              currentData.creatorUid ===
              currentUser.uid
            ) {
              return;
            }


            if (
              currentData.players &&
              currentData.players[
                currentUser.uid
              ]
            ) {
              return;
            }


            const players =
              currentData.players || {};

            const count =
              Object.keys(players).length;

            const maximum =
              Number(
                currentData.maxPlayers
              ) || 2;


            if (count >= maximum) {
              return;
            }


            players[
              currentUser.uid
            ] = playerData;


            currentData.players =
              players;

            currentData.status =
              "ready";

            currentData.joinedAt =
              new Date().toISOString();

            currentData.updatedAt =
              new Date().toISOString();


            return currentData;

          }

        );


      /* =========================================
         TRANSACTION FAILED / ROOM FULL
         ========================================= */

      if (
        !battleTransaction.committed
      ) {

        showToast(
          "This battle is no longer available or is already full.",
          "error"
        );

        return;

      }


      const updatedBattle =
        battleTransaction.snapshot.val();


      /* =========================================
         STEP 3: DEDUCT WALLET
         ========================================= */

      let transactions =
        Array.isArray(
          walletData.transactions
        )
          ? walletData.transactions
          : [];


      transactions.unshift(
        createTransaction(
          roomCode,
          entryAmount
        )
      );


      transactions =
        transactions.slice(
          0,
          50
        );


      const newBalance =
        latestBalance -
        entryAmount;


      await update(
        walletRef,
        {

          balance:
            newBalance,

          transactions:
            transactions,

          updatedAt:
            new Date().toISOString()

        }
      );


      /* =========================================
         UPDATE LOCAL WALLET
         ========================================= */

      walletBalance =
        newBalance;

      updateWalletDisplay();


      /* =========================================
         SAVE CURRENT BATTLE
         ========================================= */

      currentBattle =
        updatedBattle;


      localStorage.setItem(
        "ludoverseCurrentBattle",
        JSON.stringify(
          updatedBattle
        )
      );


      /* =========================================
         SHOW SUCCESS
         ========================================= */

      showBattlePreview(
        updatedBattle
      );


      showToast(
        "🎉 Battle joined successfully!",
        "success"
      );


      console.log(
        "Firebase battle joined:",
        roomCode
      );


    } catch (error) {

      console.error(
        "Join battle error:",
        error
      );

      showToast(
        "Could not join the battle.",
        "error"
      );

    } finally {

      isJoining = false;

      if (joinBattleBtn) {

        joinBattleBtn.disabled =
          false;

        joinBattleBtn.innerHTML =
          originalButtonHTML;

      }

    }

  }


  /* =========================================================
     ROOM CODE INPUT
     ========================================================= */

  roomCodeInput?.addEventListener(
    "input",

    () => {

      roomCodeInput.value =
        roomCodeInput.value
          .replace(/\D/g, "")
          .slice(0, 6);


      if (
        roomCodeInput.value.length === 6
      ) {

        previewBattle();

      } else {

        hideBattlePreview();

      }

    }

  );


  /* =========================================================
     ENTER KEY
     ========================================================= */

  roomCodeInput?.addEventListener(
    "keydown",

    event => {

      if (
        event.key === "Enter"
      ) {

        event.preventDefault();

        joinBattle();

      }

    }

  );


  /* =========================================================
     JOIN BUTTON
     ========================================================= */

  joinBattleBtn?.addEventListener(
    "click",

    event => {

      event.preventDefault();

      joinBattle();

    }

  );


  /* =========================================================
     OPEN GAME
     ========================================================= */

  openGameBtn?.addEventListener(
    "click",

    () => {

      if (!currentBattle) {

        showToast(
          "Please join a battle first.",
          "error"
        );

        return;

      }


      const roomCode =
        currentBattle.roomCode;


      if (!roomCode) {

        showToast(
          "Battle room code not found.",
          "error"
        );

        return;

      }


      window.location.href =
        `game.html?room=${roomCode}`;

    }

  );


  /* =========================================================
     BACK BUTTON
     ========================================================= */

  backBtn?.addEventListener(
    "click",

    () => {

      hideBattlePreview();

      if (roomCodeInput) {

        roomCodeInput.value = "";

      }

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    }

  );


  /* =========================================================
     AUTH STATE
     ========================================================= */

  onAuthStateChanged(
    auth,

    async user => {

      if (!user) {

        window.location.href =
          "login.html";

        return;

      }


      currentUser =
        user;


      await loadWallet();

    }

  );


  /* =========================================================
     INITIALIZE
     ========================================================= */

  updateWalletDisplay();

  console.log(
    "🎲 LUDOVERSE Firebase Join Room System Ready!"
  );

});