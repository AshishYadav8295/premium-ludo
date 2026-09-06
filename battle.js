"use strict";

/* =========================================================
   LUDOVERSE - FIREBASE BATTLE SYSTEM
   DEMO BATTLE CREATION
   ========================================================= */

import {
  auth,
  database,
  ref,
  set,
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

  const modeCards =
    document.querySelectorAll(".mode-card");

  const entryButtons =
    document.querySelectorAll(".entry-btn");

  const customEntry =
    document.getElementById("customEntry");

  const previewEntry =
    document.getElementById("previewEntry");

  const previewPrize =
    document.getElementById("previewPrize");

  const createBattleBtn =
    document.getElementById("createBattleBtn");

  const battleCreatedModal =
    document.getElementById("battleCreatedModal");

  const roomCode =
    document.getElementById("roomCode");

  const successEntry =
    document.getElementById("successEntry");

  const successPrize =
    document.getElementById("successPrize");

  const copyRoomCodeBtn =
    document.getElementById("copyRoomCodeBtn");

  const backToWalletBtn =
    document.getElementById("backToWalletBtn");

  const goToGameBtn =
    document.getElementById("goToGameBtn");

  const toast =
    document.getElementById("toast");

  const toastMessage =
    document.getElementById("toastMessage");


  /* =========================================================
     BATTLE STATE
     ========================================================= */

  let currentUser = null;
  let walletBalance = 0;

  let selectedMode = "private";
  let selectedEntry = 50;

  let walletLoaded = false;


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
     UPDATE WALLET DISPLAY
     ========================================================= */

  function updateWalletDisplay() {

    if (!walletBalanceElement) {
      return;
    }

    walletBalanceElement.textContent =
      Number(walletBalance).toFixed(0);
  }


  /* =========================================================
     LOAD WALLET FROM FIREBASE
     ========================================================= */

  async function loadWallet() {

    const walletRef = getWalletRef();

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
        "Firebase battle wallet loaded:",
        walletBalance
      );

    } catch (error) {

      console.error(
        "Battle wallet load error:",
        error
      );

      showToast(
        "❌ Could not load wallet."
      );
    }
  }


  /* =========================================================
     CALCULATE DEMO PRIZE
     ========================================================= */

  function calculatePrize(entryAmount) {

    const totalPot =
      entryAmount * 2;

    const commission =
      totalPot * 0.10;

    const prize =
      totalPot - commission;

    return Math.round(prize);
  }


  /* =========================================================
     UPDATE BATTLE PREVIEW
     ========================================================= */

  function updatePreview() {

    const prize =
      calculatePrize(selectedEntry);

    if (previewEntry) {

      previewEntry.textContent =
        selectedEntry;
    }

    if (previewPrize) {

      previewPrize.textContent =
        prize;
    }
  }


  /* =========================================================
     SHOW TOAST
     ========================================================= */

  function showToast(message) {

    if (!toast || !toastMessage) {

      alert(message);
      return;
    }

    toastMessage.textContent =
      message;

    toast.classList.add("show");

    setTimeout(() => {

      toast.classList.remove("show");

    }, 3000);
  }


  /* =========================================================
     SELECT GAME MODE
     ========================================================= */

  modeCards.forEach(card => {

    card.addEventListener(
      "click",
      () => {

        modeCards.forEach(item => {

          item.classList.remove("active");

        });

        card.classList.add("active");

        selectedMode =
          card.dataset.mode;

        showToast(
          selectedMode === "quick"
            ? "⚡ Quick Match selected!"
            : "🔒 Private Battle selected!"
        );

      }
    );

  });


  /* =========================================================
     SELECT ENTRY AMOUNT
     ========================================================= */

  entryButtons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        entryButtons.forEach(item => {

          item.classList.remove("active");

        });

        button.classList.add("active");

        selectedEntry =
          Number(button.dataset.amount);

        if (customEntry) {

          customEntry.value = "";
        }

        updatePreview();

      }
    );

  });


  /* =========================================================
     CUSTOM ENTRY AMOUNT
     ========================================================= */

  customEntry?.addEventListener(
    "input",
    () => {

      const amount =
        Number(customEntry.value);

      if (
        Number.isFinite(amount) &&
        amount > 0
      ) {

        selectedEntry =
          Math.floor(amount);

        entryButtons.forEach(item => {

          item.classList.remove("active");

        });

        updatePreview();

      }

    }
  );


  /* =========================================================
     GENERATE ROOM CODE
     ========================================================= */

  async function generateUniqueRoomCode() {

    let code;
    let exists = true;

    while (exists) {

      code = String(
        Math.floor(
          100000 +
          Math.random() * 900000
        )
      );

      const roomRef =
        ref(
          database,
          `battles/${code}`
        );

      const snapshot =
        await get(roomRef);

      exists =
        snapshot.exists();

    }

    return code;
  }


  /* =========================================================
     CREATE BATTLE
     ========================================================= */

  createBattleBtn?.addEventListener(
    "click",
    async () => {

      /* -----------------------------------------
         AUTH CHECK
         ----------------------------------------- */

      if (!currentUser) {

        showToast(
          "Please login first."
        );

        return;
      }


      /* -----------------------------------------
         WALLET CHECK
         ----------------------------------------- */

      if (!walletLoaded) {

        showToast(
          "Wallet is loading..."
        );

        return;
      }


      /* -----------------------------------------
         ENTRY VALIDATION
         ----------------------------------------- */

      if (
        !selectedEntry ||
        selectedEntry <= 0
      ) {

        showToast(
          "Please select a valid demo entry."
        );

        return;
      }


      /* -----------------------------------------
         BALANCE CHECK
         ----------------------------------------- */

      if (
        walletBalance < selectedEntry
      ) {

        showToast(
          "❌ Insufficient demo balance."
        );

        return;
      }


      /* -----------------------------------------
         DISABLE BUTTON
         ----------------------------------------- */

      createBattleBtn.disabled = true;

      const originalText =
        createBattleBtn.innerHTML;

      createBattleBtn.innerHTML =
        "Creating Battle...";


      try {

        /* -----------------------------------------
           GENERATE ROOM CODE
           ----------------------------------------- */

        const generatedRoomCode =
          await generateUniqueRoomCode();


        /* -----------------------------------------
           CALCULATE PRIZE
           ----------------------------------------- */

        const prize =
          calculatePrize(selectedEntry);

        const totalPot =
          selectedEntry * 2;

        const commission =
          totalPot - prize;


        /* -----------------------------------------
           CREATE BATTLE DATA
           ----------------------------------------- */

        const battle = {

          battleId:
            "BATTLE-" + Date.now(),

          roomCode:
            generatedRoomCode,

          mode:
            selectedMode,

          game:
            "Classic Ludo",

          entry:
            selectedEntry,

          totalPot:
            totalPot,

          commission:
            commission,

          prize:
            prize,

          creatorUid:
            currentUser.uid,

          creatorName:
            currentUser.displayName ||
            "Player",

          creatorPhoto:
            currentUser.photoURL ||
            "",

          players: {
            [currentUser.uid]: {
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
            }
          },

          maxPlayers:
            2,

          status:
            "waiting",

          createdAt:
            new Date().toISOString()

        };


        /* -----------------------------------------
           DEDUCT WALLET BALANCE
           ----------------------------------------- */

        walletBalance -=
          selectedEntry;


        /* -----------------------------------------
           GET CURRENT WALLET DATA
           ----------------------------------------- */

        const walletRef =
          getWalletRef();

        const walletSnapshot =
          await get(walletRef);

        let walletData =
          walletSnapshot.exists()
            ? walletSnapshot.val()
            : {
                balance: 0,
                transactions: []
              };


        let firebaseTransactions =
          Array.isArray(
            walletData.transactions
          )
            ? walletData.transactions
            : [];


        /* -----------------------------------------
           ADD TRANSACTION
           ----------------------------------------- */

        const transaction = {

          id:
            Date.now(),

          type:
            "debit",

          amount:
            selectedEntry,

          description:
            "Demo Battle Entry - Room " +
            generatedRoomCode,

          date:
            new Date().toLocaleString(),

          createdAt:
            new Date().toISOString()

        };


        firebaseTransactions.unshift(
          transaction
        );


        /* KEEP ONLY 50 TRANSACTIONS */

        firebaseTransactions =
          firebaseTransactions.slice(
            0,
            50
          );


        /* -----------------------------------------
           SAVE WALLET
           ----------------------------------------- */

        await update(
          walletRef,
          {

            balance:
              walletBalance,

            transactions:
              firebaseTransactions,

            updatedAt:
              new Date().toISOString()

          }
        );


        /* -----------------------------------------
           SAVE BATTLE TO FIREBASE
           ----------------------------------------- */

        await set(
          ref(
            database,
            `battles/${generatedRoomCode}`
          ),
          battle
        );


        updateWalletDisplay();


        /* -----------------------------------------
           SUCCESS MODAL
           ----------------------------------------- */

        if (roomCode) {

          roomCode.textContent =
            generatedRoomCode;
        }

        if (successEntry) {

          successEntry.textContent =
            selectedEntry;
        }

        if (successPrize) {

          successPrize.textContent =
            prize;
        }

        battleCreatedModal?.classList.add(
          "active"
        );


        showToast(
          "🎉 Battle created successfully!"
        );


        console.log(
          "Firebase battle created:",
          generatedRoomCode
        );


      } catch (error) {

        console.error(
          "Battle creation error:",
          error
        );

        showToast(
          "❌ Could not create battle."
        );

      } finally {

        createBattleBtn.disabled =
          false;

        createBattleBtn.innerHTML =
          originalText;

      }

    }
  );


  /* =========================================================
     COPY ROOM CODE
     ========================================================= */

  copyRoomCodeBtn?.addEventListener(
    "click",
    async () => {

      const code =
        roomCode?.textContent.trim();

      if (!code) {
        return;
      }

      try {

        await navigator.clipboard.writeText(
          code
        );

        showToast(
          "Room code copied!"
        );

      } catch (error) {

        showToast(
          "Please copy the room code manually."
        );

      }

    }
  );


  /* =========================================================
     BACK TO WALLET
     ========================================================= */

  backToWalletBtn?.addEventListener(
    "click",
    () => {

      window.location.href =
        "wallet.html";

    }
  );


  /* =========================================================
     GO TO JOIN ROOM
     ========================================================= */

  goToGameBtn?.addEventListener(
    "click",
    () => {

      window.location.href =
        "join-room.html";

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

      currentUser = user;

      await loadWallet();

    }
  );


  /* =========================================================
     INITIALIZE
     ========================================================= */

  updatePreview();

  console.log(
    "🎲 LUDOVERSE Firebase Battle System Ready!"
  );

});