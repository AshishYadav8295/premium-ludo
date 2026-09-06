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
  set,
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

  let foundBattle = null;


  /* =========================================================
     SHOW TOAST
     ========================================================= */

  function showToast(message) {

    if (!toast || !toastMessage) {
      alert(message);
      return;
    }

    toastMessage.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

      toast.classList.remove("show");

    }, 3000);

  }


  /* =========================================================
     UPDATE WALLET UI
     ========================================================= */

  function updateWalletDisplay() {

    if (!walletBalanceElement) return;

    walletBalanceElement.textContent =
      Number(walletBalance).toFixed(0);

  }


  /* =========================================================
     LOAD USER WALLET
     ========================================================= */

  async function loadWallet() {

    if (!currentUser) return;

    try {

      const walletRef =
        ref(
          database,
          `users/${currentUser.uid}/wallet`
        );

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

      updateWalletDisplay();

    } catch (error) {

      console.error(
        "Wallet load error:",
        error
      );

      showToast(
        "Could not load wallet."
      );

    }

  }


  /* =========================================================
     SAVE USER WALLET
     ========================================================= */

  async function saveWallet() {

    if (!currentUser) return;

    try {

      const walletRef =
        ref(
          database,
          `users/${currentUser.uid}/wallet`
        );

      await update(
        walletRef,
        {
          balance: walletBalance,
          updatedAt:
            new Date().toISOString()
        }
      );

    } catch (error) {

      console.error(
        "Wallet save error:",
        error
      );

      throw error;

    }

  }


  /* =========================================================
     VALIDATE ROOM CODE
     ========================================================= */

  function validateRoomCode(code) {

    if (!/^\d{6}$/.test(code)) {

      showToast(
        "Please enter a valid 6-digit room code."
      );

      return false;

    }

    return true;

  }


  /* =========================================================
     FIND BATTLE FROM FIREBASE
     ========================================================= */

  async function findBattle(roomCode) {

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
        "Battle search error:",
        error
      );

      return null;

    }

  }


  /* =========================================================
     SHOW BATTLE PREVIEW
     ========================================================= */

  function showBattlePreview(battle) {

    foundBattle = battle;

    if (!battlePreview) return;

    battlePreview.classList.remove(
      "hidden"
    );

    if (battleEntry) {

      battleEntry.textContent =
        Number(battle.entry || 0)
          .toLocaleString("en-IN");

    }

    if (battlePrize) {

      battlePrize.textContent =
        Number(battle.prize || 0)
          .toLocaleString("en-IN");

    }

  }


  /* =========================================================
     JOIN BATTLE
     ========================================================= */

  async function joinBattle() {

    if (!currentUser) {

      showToast(
        "Please login first."
      );

      return;

    }


    const roomCode =
      roomCodeInput.value
        .replace(/\D/g, "")
        .slice(0, 6);


    roomCodeInput.value =
      roomCode;


    /* VALIDATE */

    if (!validateRoomCode(roomCode)) {

      return;

    }


    /* BUTTON LOADING */

    joinBattleBtn.disabled = true;

    joinBattleBtn.textContent =
      "Finding Battle...";


    try {

      /* FIND BATTLE */

      const battle =
        await findBattle(roomCode);


      if (!battle) {

        showToast(
          "❌ No battle found with this room code."
        );

        return;

      }


      /* CHECK CREATOR */

      if (
        battle.creatorUid ===
        currentUser.uid
      ) {

        showToast(
          "You cannot join your own battle."
        );

        return;

      }


      /* CHECK STATUS */

      if (
        battle.status === "completed"
      ) {

        showToast(
          "This battle has already ended."
        );

        return;

      }


      /* CHECK IF ROOM FULL */

      if (
        battle.playersJoined >=
        battle.maxPlayers
      ) {

        showToast(
          "This battle room is already full."
        );

        return;

      }


      /* WALLET CHECK */

      const entryAmount =
        Number(battle.entry || 0);


      if (
        walletBalance < entryAmount
      ) {

        showToast(
          `Insufficient demo balance. You need ₹${entryAmount}.`
        );

        return;

      }


      /* JOIN BUTTON */

      joinBattleBtn.textContent =
        "Joining Battle...";


      /* DEDUCT DEMO BALANCE */

      walletBalance -=
        entryAmount;


      await saveWallet();


      /* UPDATE BATTLE */

      const battleRef =
        ref(
          database,
          `battles/${roomCode}`
        );


      await update(
        battleRef,
        {
          playersJoined: 2,

          status: "ready",

          opponentUid:
            currentUser.uid,

          opponentEmail:
            currentUser.email || "Player",

          joinedAt:
            new Date().toISOString()
        }
      );


      /* SAVE USER CURRENT BATTLE */

      await set(
        ref(
          database,
          `users/${currentUser.uid}/currentBattle`
        ),
        {
          roomCode: roomCode,
          battleId:
            battle.battleId || roomCode,
          entry: entryAmount,
          prize:
            Number(battle.prize || 0),
          status: "ready"
        }
      );


      /* UPDATE LOCAL BATTLE */

      foundBattle = {
        ...battle,
        playersJoined: 2,
        status: "ready"
      };


      showBattlePreview(
        foundBattle
      );


      showToast(
        "🎉 Battle joined successfully!"
      );


      joinBattleBtn.textContent =
        "Battle Joined ✓";


      /* SAVE CURRENT ROOM */

      localStorage.setItem(
        "ludoverseCurrentRoom",
        roomCode
      );


    } catch (error) {

      console.error(
        "Join battle error:",
        error
      );

      showToast(
        "❌ Could not join battle."
      );

    } finally {

      setTimeout(() => {

        joinBattleBtn.disabled =
          false;

        if (
          joinBattleBtn.textContent !==
          "Battle Joined ✓"
        ) {

          joinBattleBtn.innerHTML =
            "<span>🚀</span> Join Battle";

        }

      }, 1000);

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

    }
  );


  /* =========================================================
     JOIN BUTTON
     ========================================================= */

  joinBattleBtn?.addEventListener(
    "click",
    joinBattle
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
     OPEN GAME
     ========================================================= */

  openGameBtn?.addEventListener(
    "click",
    () => {

      if (!foundBattle) {

        showToast(
          "Please join a battle first."
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

      if (battlePreview) {

        battlePreview.classList.add(
          "hidden"
        );

      }

      foundBattle = null;

    }
  );


  /* =========================================================
     FIREBASE AUTH CHECK
     ========================================================= */

  onAuthStateChanged(
    auth,
    async user => {

      if (!user) {

        window.location.href =
          "login.html";

        return;

      }

      currentUser = user;

      console.log(
        "Join Room User:",
        user.email
      );

      await loadWallet();

    }
  );


  console.log(
    "🎮 LUDOVERSE Firebase Join Room Ready!"
  );

});