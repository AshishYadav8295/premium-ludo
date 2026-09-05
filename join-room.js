"use strict";

/* =========================================================
   LUDOVERSE - JOIN ROOM SYSTEM
   PROFESSIONAL DEMO VERSION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =========================================================
     DOM ELEMENTS
     ========================================================= */

  const walletBalanceElement =
    document.getElementById("walletBalance");

  const roomCodeInput =
    document.getElementById("roomCodeInput") ||
    document.getElementById("roomCode");

  const joinBattleBtn =
    document.getElementById("joinBattleBtn");

  const createBattleBtn =
    document.getElementById("createBattleBtn");

  const roomPreview =
    document.getElementById("roomPreview");

  const statusText =
    document.getElementById("statusText");

  const previewRoomCode =
    document.getElementById("previewRoomCode");

  const previewEntry =
    document.getElementById("previewEntry");

  const previewPrize =
    document.getElementById("previewPrize");

  const previewPlayers =
    document.getElementById("previewPlayers");

  const toast =
    document.getElementById("toast");

  const toastMessage =
    document.getElementById("toastMessage");

  const successModal =
    document.getElementById("successModal");

  const successRoomCode =
    document.getElementById("successRoomCode");

  const successEntry =
    document.getElementById("successEntry");

  const successPrize =
    document.getElementById("successPrize");

  const openGameBtn =
    document.getElementById("openGameBtn");

  const backBtn =
    document.getElementById("backBtn");

  const profileBtn =
    document.getElementById("profileBtn");


  /* =========================================================
     WALLET DATA
     ========================================================= */

  let walletBalance =
    Number(
      localStorage.getItem("ludoverseBalance")
    ) || 0;


  /* =========================================================
     UPDATE WALLET DISPLAY
     ========================================================= */

  function updateWalletDisplay() {

    if (!walletBalanceElement) return;

    walletBalanceElement.textContent =
      walletBalance.toFixed(0);

  }


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
     GET ALL BATTLES
     ========================================================= */

  function getBattles() {

    try {

      const battles =
        JSON.parse(
          localStorage.getItem(
            "ludoverseBattles"
          )
        );

      return Array.isArray(battles)
        ? battles
        : [];

    } catch (error) {

      console.error(
        "Battle data error:",
        error
      );

      return [];

    }

  }


  /* =========================================================
     SAVE ALL BATTLES
     ========================================================= */

  function saveBattles(battles) {

    localStorage.setItem(
      "ludoverseBattles",
      JSON.stringify(battles)
    );

  }


  /* =========================================================
     FIND BATTLE BY ROOM CODE
     ========================================================= */

  function findBattle(roomCode) {

    const battles =
      getBattles();

    return battles.find(
      battle =>
        String(battle.roomCode) ===
        String(roomCode)
    );

  }


  /* =========================================================
     VALIDATE ROOM CODE
     ========================================================= */

  function validateRoomCode(code) {

    const cleanCode =
      String(code)
        .trim()
        .replace(/\s/g, "");

    if (!cleanCode) {

      showToast(
        "Please enter a room code.",
        "error"
      );

      return false;

    }

    if (!/^\d{6}$/.test(cleanCode)) {

      showToast(
        "Please enter a valid 6-digit room code.",
        "error"
      );

      return false;

    }

    return true;

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
     GET ENTRY AMOUNT
     
     Supports old and new battle formats.
     ========================================================= */

  function getEntryAmount(battle) {

    return Number(
      battle.entry ||
      battle.entryAmount ||
      0
    );

  }


  /* =========================================================
     GET PRIZE AMOUNT
     
     Supports old and new battle formats.
     ========================================================= */

  function getPrizeAmount(battle) {

    return Number(
      battle.prize ||
      battle.prizeAmount ||
      0
    );

  }


  /* =========================================================
     GET PLAYER COUNT
     ========================================================= */

  function getPlayersJoined(battle) {

    return Number(
      battle.playersJoined ||
      battle.players ||
      1
    );

  }


  /* =========================================================
     GET MAX PLAYERS
     ========================================================= */

  function getMaxPlayers(battle) {

    return Number(
      battle.maxPlayers ||
      2
    );

  }


  /* =========================================================
     SHOW BATTLE PREVIEW
     ========================================================= */

  function showBattlePreview(battle) {

    if (!battle) return;

    const entry =
      getEntryAmount(battle);

    const prize =
      getPrizeAmount(battle);

    const playersJoined =
      getPlayersJoined(battle);

    const maxPlayers =
      getMaxPlayers(battle);


    if (roomPreview) {

      roomPreview.classList.add(
        "active"
      );

    }


    if (previewRoomCode) {

      previewRoomCode.textContent =
        battle.roomCode;

    }


    if (previewEntry) {

      previewEntry.textContent =
        formatAmount(entry);

    }


    if (previewPrize) {

      previewPrize.textContent =
        formatAmount(prize);

    }


    if (previewPlayers) {

      previewPlayers.textContent =
        `${playersJoined} / ${maxPlayers}`;

    }


    if (statusText) {

      if (battle.status === "ready") {

        statusText.textContent =
          "Battle Ready";

      } else {

        statusText.textContent =
          "Battle Found";

      }

    }

  }


  /* =========================================================
     ADD TRANSACTION
     ========================================================= */

  function addTransaction(
    type,
    amount,
    description
  ) {

    let transactions = [];

    try {

      transactions =
        JSON.parse(
          localStorage.getItem(
            "ludoverseTransactions"
          )
        ) || [];

    } catch (error) {

      transactions = [];

    }


    const transaction = {

      id: Date.now(),

      type: type,

      amount: Number(amount),

      description: description,

      date:
        new Date().toLocaleString()

    };


    transactions.unshift(
      transaction
    );


    localStorage.setItem(
      "ludoverseTransactions",
      JSON.stringify(transactions)
    );

  }


  /* =========================================================
     JOIN BATTLE
     ========================================================= */

  function joinBattle() {

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


    /* Validate */

    if (!validateRoomCode(roomCode)) {

      return;

    }


    /* Find Battle */

    const battle =
      findBattle(roomCode);


    /* Battle Not Found */

    if (!battle) {

      if (roomPreview) {

        roomPreview.classList.remove(
          "active"
        );

      }

      showToast(
        "No battle found with this room code.",
        "error"
      );

      return;

    }


    /* Check Status */

    if (
      battle.status === "completed"
    ) {

      showToast(
        "This battle has already been completed.",
        "error"
      );

      return;

    }


    /* Get battle values */

    const entryAmount =
      getEntryAmount(battle);

    const maxPlayers =
      getMaxPlayers(battle);


    /* Get current joined players */

    let playersJoined =
      Number(
        battle.playersJoined || 1
      );


    /* Room Full */

    if (
      playersJoined >= maxPlayers
    ) {

      showToast(
        "This battle room is already full.",
        "error"
      );

      return;

    }


    /* Wallet Check */

    if (
      walletBalance < entryAmount
    ) {

      showToast(
        `Insufficient demo balance. You need ₹${formatAmount(entryAmount)} to join.`,
        "error"
      );

      return;

    }


    /* Prevent double click */

    if (joinBattleBtn) {

      joinBattleBtn.disabled = true;

      joinBattleBtn.textContent =
        "Joining Battle...";

    }


    /* Deduct Entry */

    walletBalance -=
      entryAmount;


    localStorage.setItem(
      "ludoverseBalance",
      walletBalance.toString()
    );


    /* Update Battle Data */

    const battles =
      getBattles();


    const battleIndex =
      battles.findIndex(
        item =>
          String(item.roomCode) ===
          String(roomCode)
      );


    if (battleIndex !== -1) {

      battles[battleIndex].playersJoined =
        2;

      battles[battleIndex].status =
        "ready";

      battles[battleIndex].joinedAt =
        new Date().toLocaleString();

      saveBattles(battles);

    }


    /* Updated Battle */

    const joinedBattle = {

      ...battle,

      playersJoined: 2,

      maxPlayers: maxPlayers,

      entry: entryAmount,

      prize:
        getPrizeAmount(battle),

      status: "ready",

      joinedAt:
        new Date().toLocaleString()

    };


    /* Save Current Battle */

    localStorage.setItem(
      "ludoverseCurrentBattle",
      JSON.stringify(joinedBattle)
    );


    /* Add Transaction */

    addTransaction(

      "debit",

      entryAmount,

      "Joined Demo Battle - Room " +
        roomCode

    );


    /* Update Display */

    updateWalletDisplay();


    /* Update Preview */

    showBattlePreview(
      joinedBattle
    );


    /* Show Success */

    showJoinSuccess(
      joinedBattle
    );


    /* Restore Button */

    setTimeout(() => {

      if (joinBattleBtn) {

        joinBattleBtn.disabled = false;

        joinBattleBtn.textContent =
          "Join Battle";

      }

    }, 1000);

  }


  /* =========================================================
     SHOW JOIN SUCCESS
     ========================================================= */

  function showJoinSuccess(battle) {

  if (successRoomCode) {
    successRoomCode.textContent = battle.roomCode;
  }

  if (successEntry) {
    successEntry.textContent =
      formatAmount(battle.entryAmount);
  }

  if (successPrize) {
    successPrize.textContent =
      formatAmount(battle.prizeAmount);
  }

  if (successModal) {

    successModal.classList.add("active");

  } else {

    showToast(
      "Battle joined successfully! Opening game...",
      "success"
    );

    setTimeout(() => {

      window.location.href = "game.html";

    }, 1500);
  }
}


  /* =========================================================
     LIVE ROOM CODE PREVIEW
     ========================================================= */

  if (roomCodeInput) {

    roomCodeInput.addEventListener(
      "input",
      () => {

        let value =
          roomCodeInput.value
            .replace(/\D/g, "")
            .slice(0, 6);

        roomCodeInput.value =
          value;


        if (
          value.length === 6
        ) {

          const battle =
            findBattle(value);


          if (battle) {

            showBattlePreview(
              battle
            );

          } else {

            if (roomPreview) {

              roomPreview.classList.remove(
                "active"
              );

            }

          }

        }

      }
    );


    /* Enter Key */

    roomCodeInput.addEventListener(
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

  }


  /* =========================================================
     JOIN BUTTON
     ========================================================= */

  if (joinBattleBtn) {

    joinBattleBtn.addEventListener(
      "click",
      event => {

        event.preventDefault();

        joinBattle();

      }
    );

  }


  /* =========================================================
     CREATE YOUR OWN BATTLE
     ========================================================= */

  if (createBattleBtn) {

    createBattleBtn.addEventListener(
      "click",
      () => {

        window.location.href =
          "battle.html";

      }
    );

  }


  /* =========================================================
     OPEN LUDO GAME
     
     Currently opens local demo game.
     ========================================================= */

  if (openGameBtn) {

    openGameBtn.addEventListener(
      "click",
      () => {

        window.location.href =
          "game.html";

      }
    );

  }


  /* =========================================================
     BACK BUTTON
     ========================================================= */

  if (backBtn) {

    backBtn.addEventListener(
      "click",
      () => {

        window.location.href =
          "index.html";

      }
    );

  }


  /* =========================================================
     PROFILE BUTTON
     ========================================================= */

  if (profileBtn) {

    profileBtn.addEventListener(
      "click",
      () => {

        showToast(
          "Profile section coming soon."
        );

      }
    );

  }


  /* =========================================================
     CLOSE SUCCESS MODAL
     ========================================================= */

  if (successModal) {

    successModal.addEventListener(
      "click",
      event => {

        if (
          event.target === successModal
        ) {

          successModal.classList.remove(
            "active"
          );

        }

      }
    );

  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  updateWalletDisplay();


  console.log(
    "LUDOVERSE Join Room System Ready!"
  );

});