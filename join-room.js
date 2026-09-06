"use strict";

/* =========================================================
   LUDOVERSE - FIREBASE JOIN ROOM SYSTEM
   PROFESSIONAL REALTIME VERSION
   ========================================================= */

import {
  auth,
  database,
  ref,
  get,
  update,
  onValue,
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

  let joiningBattle = false;


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
      toast.classList.remove("show");
    }, 4000);

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
     REALTIME WALLET SYNC
     ========================================================= */

  function startWalletListener() {

    const walletRef =
      getWalletRef();

    if (!walletRef) {
      return;
    }

    console.log(
      "Starting realtime wallet sync..."
    );

    onValue(
      walletRef,
      snapshot => {

        if (snapshot.exists()) {

          const walletData =
            snapshot.val();

          walletBalance =
            Number(
              walletData.balance
            ) || 0;

        } else {

          walletBalance = 0;

        }

        walletLoaded = true;

        updateWalletDisplay();

        console.log(
          "Realtime wallet balance:",
          walletBalance
        );

      },
      error => {

        console.error(
          "Wallet realtime error:",
          error
        );

        walletLoaded = false;

        showToast(
          "Could not load wallet. Check Firebase connection.",
          "error"
        );

      }
    );

  }


  /* =========================================================
     LOAD WALLET ONCE
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
          Number(
            walletData.balance
          ) || 0;

      } else {

        walletBalance = 0;

      }

      walletLoaded = true;

      updateWalletDisplay();

      console.log(
        "Wallet loaded:",
        walletBalance
      );

    } catch (error) {

      console.error(
        "Wallet load error:",
        error
      );

      walletLoaded = false;

      showToast(
        `Wallet error: ${error.message}`,
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
     GET BATTLE FROM FIREBASE
     ========================================================= */

  async function getBattle(roomCode) {

    try {

      const battleRef =
        getBattleRef(roomCode);

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

      throw error;

    }

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

      setTimeout(() => {

        battlePreview.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });

      }, 100);

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
     PREVIEW BATTLE
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

      if (
        battle.status === "cancelled"
      ) {

        hideBattlePreview();

        showToast(
          "This battle is no longer available.",
          "error"
        );

        return;

      }

      showBattlePreview(battle);

      showToast(
        "Battle found! Ready to join.",
        "success"
      );

      console.log(
        "Battle found:",
        roomCode
      );

    } catch (error) {

      console.error(
        "Preview battle error:",
        error
      );

      hideBattlePreview();

      showToast(
        `Firebase error: ${error.message}`,
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
     SET JOIN BUTTON LOADING STATE
     ========================================================= */

  function setJoinButtonLoading(isLoading) {

    if (!joinBattleBtn) {
      return;
    }

    joinBattleBtn.disabled =
      isLoading;

    joinBattleBtn.innerHTML =
      isLoading
        ? "<span>⏳</span> Joining..."
        : "<span>🚀</span> Join Battle";

  }


  /* =========================================================
     JOIN BATTLE
     ========================================================= */

  async function joinBattle() {

    if (joiningBattle) {
      return;
    }


    /* =========================================
       AUTH CHECK
       ========================================= */

    if (!currentUser) {

      showToast(
        "Please login first.",
        "error"
      );

      return;

    }


    /* =========================================
       WALLET CHECK
       ========================================= */

    if (!walletLoaded) {

      showToast(
        "Wallet is still loading. Please wait.",
        "error"
      );

      return;

    }


    /* =========================================
       INPUT CHECK
       ========================================= */

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


    joiningBattle = true;

    setJoinButtonLoading(true);


    try {

      /* =========================================
         GET LATEST BATTLE
         ========================================= */

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


      /* =========================================
         CREATOR CHECK
         ========================================= */

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


      if (
        battle.status === "cancelled"
      ) {

        showToast(
          "This battle is no longer available.",
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

        currentBattle = battle;

        localStorage.setItem(
          "ludoverseCurrentBattle",
          JSON.stringify(battle)
        );

        showBattlePreview(battle);

        showToast(
          "You already joined this battle.",
          "success"
        );

        return;

      }


      /* =========================================
         PLAYER COUNT CHECK
         ========================================= */

      const playersJoined =
        getPlayerCount(battle);

      const maxPlayers =
        Number(
          battle.maxPlayers
        ) || 2;


      if (
        playersJoined >= maxPlayers
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
        Number(
          battle.entry
        ) || 0;


      if (entryAmount <= 0) {

        showToast(
          "Invalid battle entry amount.",
          "error"
        );

        return;

      }


      /* =========================================
         LATEST WALLET LOAD
         ========================================= */

      const walletRef =
        getWalletRef();


      const walletSnapshot =
        await get(walletRef);


      const walletData =
        walletSnapshot.exists()
          ? walletSnapshot.val()
          : null;


      const latestBalance =
        walletData
          ? Number(walletData.balance) || 0
          : 0;


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
         PREPARE PLAYER DATA
         ========================================= */

      const playerData = {

        uid:
          currentUser.uid,

        name:
          currentUser.displayName ||
          currentUser.email ||
          "Player",

        photo:
          currentUser.photoURL ||
          "",

        joinedAt:
          new Date().toISOString()

      };


      /* =========================================
         RECHECK + RESERVE BATTLE SLOT
         ========================================= */

      const battleRef =
        getBattleRef(roomCode);


      const battleTransaction =
        await runTransaction(
          battleRef,
          currentData => {

            if (!currentData) {
              return;
            }


            if (
              currentData.creatorUid ===
              currentUser.uid
            ) {
              return;
            }


            if (
              currentData.status ===
              "completed"
            ) {
              return;
            }


            if (
              currentData.status ===
              "cancelled"
            ) {
              return;
            }


            const players =
              currentData.players || {};


            if (
              players[currentUser.uid]
            ) {

              return currentData;

            }


            const currentPlayerCount =
              Object.keys(players).length;


            const maximumPlayers =
              Number(
                currentData.maxPlayers
              ) || 2;


            if (
              currentPlayerCount >=
              maximumPlayers
            ) {

              return;
            }


            players[currentUser.uid] =
              playerData;


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


      if (
        !battleTransaction.committed
      ) {

        showToast(
          "This battle could not be joined. It may already be full.",
          "error"
        );

        return;

      }


      /* =========================================
         DEDUCT WALLET SAFELY
         ========================================= */

      const walletTransaction =
        await runTransaction(
          walletRef,
          currentWallet => {

            if (!currentWallet) {
              return;
            }


            const currentBalance =
              Number(
                currentWallet.balance
              ) || 0;


            if (
              currentBalance < entryAmount
            ) {

              return;
            }


            const transactions =
              Array.isArray(
                currentWallet.transactions
              )
                ? currentWallet.transactions
                : [];


            transactions.unshift(
              createTransaction(
                roomCode,
                entryAmount
              )
            );


            currentWallet.balance =
              currentBalance -
              entryAmount;


            currentWallet.transactions =
              transactions.slice(
                0,
                50
              );


            currentWallet.updatedAt =
              new Date().toISOString();


            return currentWallet;

          }
        );


      /* =========================================
         WALLET TRANSACTION FAILED
         ========================================= */

      if (
        !walletTransaction.committed
      ) {

        /*
          Remove player if wallet payment failed.
        */

        try {

          const latestBattle =
            battleTransaction.snapshot.val();


          if (
            latestBattle &&
            latestBattle.players
          ) {

            delete latestBattle.players[
              currentUser.uid
            ];


            const remainingPlayers =
              Object.keys(
                latestBattle.players
              ).length;


            latestBattle.status =
              remainingPlayers >= 2
                ? "ready"
                : "waiting";


            latestBattle.updatedAt =
              new Date().toISOString();


            await update(
              battleRef,
              latestBattle
            );

          }

        } catch (rollbackError) {

          console.error(
            "Battle rollback error:",
            rollbackError
          );

        }


        showToast(
          "Insufficient demo balance.",
          "error"
        );

        return;

      }


      /* =========================================
         UPDATE LOCAL BALANCE
         ========================================= */

      const updatedWallet =
        walletTransaction.snapshot.val();


      walletBalance =
        Number(
          updatedWallet.balance
        ) || 0;


      walletLoaded = true;

      updateWalletDisplay();


      /* =========================================
         GET FINAL BATTLE
         ========================================= */

      const finalBattle =
        battleTransaction.snapshot.val();


      currentBattle =
        finalBattle;


      /* =========================================
         SAVE CURRENT BATTLE
         ========================================= */

      localStorage.setItem(
        "ludoverseCurrentBattle",
        JSON.stringify(finalBattle)
      );


      /* =========================================
         SHOW BATTLE PREVIEW
         ========================================= */

      showBattlePreview(
        finalBattle
      );


      showToast(
        "🎉 Battle joined successfully!",
        "success"
      );


      console.log(
        "Battle joined successfully:",
        roomCode
      );


    } catch (error) {

      console.error(
        "Join battle error:",
        error
      );


      showToast(
        `Could not join battle: ${error.message}`,
        "error"
      );

    } finally {

      joiningBattle = false;

      setJoinButtonLoading(false);

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


      localStorage.setItem(
        "ludoverseCurrentBattle",
        JSON.stringify(currentBattle)
      );


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


      console.log(
        "Join Room User:",
        currentUser.uid
      );


      await loadWallet();


      startWalletListener();


      console.log(
        "🎲 LUDOVERSE Join Room Ready!"
      );

    }
  );


  /* =========================================================
     INITIALIZE
     ========================================================= */

  updateWalletDisplay();

});