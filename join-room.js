"use strict";

/* =========================================================
   LUDOVERSE - FIREBASE JOIN ROOM SYSTEM
   ========================================================= */

import {
  auth,
  database,
  ref,
  get,
  update,
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

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
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
     LOAD WALLET FROM FIREBASE
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
        "Firebase join wallet loaded:",
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

      const battleRef =
        ref(
          database,
          `battles/${roomCode}`
        );

      const snapshot =
        await get(battleRef);

      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.val();

    } catch (error) {

      console.error(
        "Battle load error:",
        error
      );

      return null;
    }
  }


  /* =========================================================
     GET PLAYER COUNT
     ========================================================= */

  function getPlayerCount(battle) {

    if (!battle || !battle.players) {
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
        formatAmount(battle.entry);
    }

    if (battlePrize) {

      battlePrize.textContent =
        formatAmount(battle.prize);
    }

    if (battlePreview) {

      battlePreview.classList.remove(
        "hidden"
      );

      battlePreview.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
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
     LOAD ROOM PREVIEW
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

    const battle =
      await getBattle(roomCode);

    if (!battle) {

      hideBattlePreview();

      showToast(
        "No battle found with this room code.",
        "error"
      );

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
  }


  /* =========================================================
     ADD WALLET TRANSACTION
     ========================================================= */

  function createTransaction(
    roomCode,
    entryAmount
  ) {

    return {
      id: Date.now(),
      type: "debit",
      amount: Number(entryAmount),
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

    if (!currentUser) {

      showToast(
        "Please login first.",
        "error"
      );

      return;
    }

    if (!walletLoaded) {

      showToast(
        "Wallet is still loading.",
        "error"
      );

      return;
    }

    if (!roomCodeInput) {

      showToast(
        "Room code input not found.",
        "error"
      );

      return;
    }


    /* -----------------------------------------
       GET ROOM CODE
       ----------------------------------------- */

    const roomCode =
      roomCodeInput.value
        .trim()
        .replace(/\D/g, "")
        .slice(0, 6);


    /* -----------------------------------------
       VALIDATE CODE
       ----------------------------------------- */

    if (!validateRoomCode(roomCode)) {
      return;
    }


    /* -----------------------------------------
       DISABLE BUTTON
       ----------------------------------------- */

    if (joinBattleBtn) {

      joinBattleBtn.disabled = true;

      joinBattleBtn.innerHTML =
        "Joining Battle...";
    }


    try {

      /* -----------------------------------------
         GET LATEST BATTLE DATA
         ----------------------------------------- */

      const battle =
        await getBattle(roomCode);


      /* -----------------------------------------
         BATTLE NOT FOUND
         ----------------------------------------- */

      if (!battle) {

        hideBattlePreview();

        showToast(
          "No battle found with this room code.",
          "error"
        );

        return;
      }


      /* -----------------------------------------
         CREATOR CANNOT JOIN OWN ROOM
         ----------------------------------------- */

      if (
        battle.creatorUid ===
        currentUser.uid
      ) {

        showToast(
          "You are already the creator of this battle.",
          "error"
        );

        return;
      }


      /* -----------------------------------------
         CHECK BATTLE STATUS
         ----------------------------------------- */

      if (
        battle.status === "completed"
      ) {

        showToast(
          "This battle has already been completed.",
          "error"
        );

        return;
      }


      /* -----------------------------------------
         CHECK IF ALREADY JOINED
         ----------------------------------------- */

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


      /* -----------------------------------------
         CHECK PLAYER COUNT
         ----------------------------------------- */

      const playersJoined =
        getPlayerCount(battle);

      const maxPlayers =
        Number(battle.maxPlayers) || 2;


      if (
        playersJoined >= maxPlayers
      ) {

        showToast(
          "This battle room is already full.",
          "error"
        );

        return;
      }


      /* -----------------------------------------
         GET ENTRY AMOUNT
         ----------------------------------------- */

      const entryAmount =
        Number(battle.entry) || 0;


      if (
        entryAmount <= 0
      ) {

        showToast(
          "Invalid battle entry amount.",
          "error"
        );

        return;
      }


      /* -----------------------------------------
         WALLET CHECK
         ----------------------------------------- */

      if (
        walletBalance < entryAmount
      ) {

        showToast(
          `Insufficient demo balance. You need ₹${formatAmount(entryAmount)}.`,
          "error"
        );

        return;
      }


      /* -----------------------------------------
         LOAD LATEST WALLET DATA
         ----------------------------------------- */

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
        Number(walletData.balance) || 0;


      /* -----------------------------------------
         CHECK LATEST BALANCE
         ----------------------------------------- */

      if (
        latestBalance < entryAmount
      ) {

        showToast(
          "Insufficient demo balance.",
          "error"
        );

        return;
      }


      /* -----------------------------------------
         UPDATE TRANSACTIONS
         ----------------------------------------- */

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
        transactions.slice(0, 50);


      /* -----------------------------------------
         NEW WALLET BALANCE
         ----------------------------------------- */

      const newBalance =
        latestBalance - entryAmount;


      /* -----------------------------------------
         SAVE WALLET
         ----------------------------------------- */

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


      /* -----------------------------------------
         ADD PLAYER TO BATTLE
         ----------------------------------------- */

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


      /* -----------------------------------------
         UPDATE FIREBASE BATTLE
         ----------------------------------------- */

      const battleRef =
        ref(
          database,
          `battles/${roomCode}`
        );


      await update(
        battleRef,
        {
          [`players/${currentUser.uid}`]:
            playerData,

          status:
            "ready",

          joinedAt:
            new Date().toISOString(),

          updatedAt:
            new Date().toISOString()
        }
      );


      /* -----------------------------------------
         UPDATE LOCAL STATE
         ----------------------------------------- */

      walletBalance =
        newBalance;

      updateWalletDisplay();


      /* -----------------------------------------
         SAVE CURRENT BATTLE
         ----------------------------------------- */

      const joinedBattle = {
        ...battle,

        players: {
          ...battle.players,

          [currentUser.uid]:
            playerData
        },

        status:
          "ready"
      };


      currentBattle =
        joinedBattle;


      localStorage.setItem(
        "ludoverseCurrentBattle",
        JSON.stringify(joinedBattle)
      );


      /* -----------------------------------------
         SHOW PREVIEW
         ----------------------------------------- */

      showBattlePreview(
        joinedBattle
      );


      showToast(
        "Battle joined successfully! 🎉",
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

      if (joinBattleBtn) {

        joinBattleBtn.disabled =
          false;

        joinBattleBtn.innerHTML =
          "<span>🚀</span> Join Battle";
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

      window.location.href =
        "game.html";
    }
  );


  /* =========================================================
     BACK BUTTON
     ========================================================= */

  backBtn?.addEventListener(
    "click",
    () => {

      window.location.href =
        "index.html";
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