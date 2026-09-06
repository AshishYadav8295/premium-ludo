"use strict";

import {
  auth,
  database,
  ref,
  set,
  get
} from "./firebase.js";

/* =========================================================
   LUDOVERSE - BATTLE SYSTEM
   DEMO BATTLE CREATION
   ========================================================= */

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

  let selectedMode = "private";

  let selectedEntry = 50;

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
     CALCULATE DEMO PRIZE
     
     Example:
     
     Entry = ₹20 per player
     Total Pot = ₹40
     
     Demo Platform Fee = 10%
     Fee = ₹4
     
     Demo Prize = ₹36
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

        if (selectedMode === "quick") {

          showToast(
            "⚡ Quick Match selected!"
          );

        } else {

          showToast(
            "🔒 Private Battle selected!"
          );

        }

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
          Number(
            button.dataset.amount
          );

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

  if (customEntry) {

    customEntry.addEventListener(
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

  }


  /* =========================================================
     GENERATE 6 DIGIT ROOM CODE
     ========================================================= */

  function generateRoomCode() {

    let code = "";

    for (
      let i = 0;
      i < 6;
      i++
    ) {

      code += Math.floor(
        Math.random() * 10
      );

    }

    return code;

  }


  /* =========================================================
     SAVE TRANSACTION
     ========================================================= */

  function saveTransaction(
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

      amount: amount,

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
     CREATE BATTLE
     ========================================================= */

  if (createBattleBtn) {

    createBattleBtn.addEventListener(
  "click",
  async () => {

        /* -----------------------------------------
           VALIDATE ENTRY
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
           DEMO BALANCE CHECK
           ----------------------------------------- */

        if (
          walletBalance < selectedEntry
        ) {

          showToast(
            "❌ Insufficient demo balance. Please add demo balance first."
          );

          return;

        }


        /* -----------------------------------------
           GENERATE BATTLE DATA
           ----------------------------------------- */

        const generatedRoomCode =
          generateRoomCode();

        const prize =
          calculatePrize(
            selectedEntry
          );

        const totalPot =
          selectedEntry * 2;

        const commission =
          totalPot - prize;


        /* -----------------------------------------
           DEDUCT DEMO ENTRY
           ----------------------------------------- */

        walletBalance -=
          selectedEntry;

        localStorage.setItem(
          "ludoverseBalance",
          walletBalance.toString()
        );

        updateWalletDisplay();


        /* -----------------------------------------
           CREATE BATTLE OBJECT
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

          players:
            1,

          maxPlayers:
            2,

          status:
            "waiting",

          createdAt:
            new Date().toLocaleString()

        };


        /* -----------------------------------------
   SAVE BATTLE TO FIREBASE
   ----------------------------------------- */

const currentUser = auth.currentUser;

if (!currentUser) {
  showToast(
    "Please login again."
  );
  return;
}

battle.hostUid = currentUser.uid;

battle.hostName =
  currentUser.displayName || "Player";

battle.hostEmail =
  currentUser.email || "";

battle.hostPhoto =
  currentUser.photoURL || "";

try {

  await set(
    ref(
      database,
      "battles/" + generatedRoomCode
    ),
    battle
  );

} catch (error) {

  console.error(
    "Firebase battle error:",
    error
  );

  showToast(
    "❌ Failed to create battle. Please try again."
  );

  return;
}


        /* -----------------------------------------
           SAVE BATTLE HISTORY
           ----------------------------------------- */

        let battles = [];

        try {

          battles =
            JSON.parse(
              localStorage.getItem(
                "ludoverseBattles"
              )
            ) || [];

        } catch (error) {

          battles = [];

        }

        battles.unshift(battle);

        localStorage.setItem(
          "ludoverseBattles",
          JSON.stringify(battles)
        );


        /* -----------------------------------------
           SAVE WALLET TRANSACTION
           ----------------------------------------- */

        saveTransaction(

          "debit",

          selectedEntry,

          "Demo Battle Entry - Room " +
            generatedRoomCode

        );


        /* -----------------------------------------
           UPDATE SUCCESS MODAL
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


        /* -----------------------------------------
           OPEN SUCCESS MODAL
           ----------------------------------------- */

        if (battleCreatedModal) {

          battleCreatedModal.classList.add(
            "active"
          );

        }


        showToast(
          "🎉 Demo battle created successfully!"
        );

      }
    );

  }


  /* =========================================================
     COPY ROOM CODE
     ========================================================= */

  if (copyRoomCodeBtn) {

    copyRoomCodeBtn.addEventListener(
      "click",
      async () => {

        if (!roomCode) return;

        const code =
          roomCode.textContent.trim();

        try {

          await navigator.clipboard.writeText(
            code
          );

          copyRoomCodeBtn.textContent =
            "✓";

          showToast(
            "Room code copied!"
          );

          setTimeout(() => {

            copyRoomCodeBtn.textContent =
              "📋";

          }, 2000);

        } catch (error) {

          /* FALLBACK */

          const textarea =
            document.createElement(
              "textarea"
            );

          textarea.value =
            code;

          document.body.appendChild(
            textarea
          );

          textarea.select();

          document.execCommand(
            "copy"
          );

          textarea.remove();

          showToast(
            "Room code copied!"
          );

        }

      }
    );

  }


  /* =========================================================
     BACK TO WALLET
     ========================================================= */

  if (backToWalletBtn) {

    backToWalletBtn.addEventListener(
      "click",
      () => {

        window.location.href =
          "wallet.html";

      }
    );

  }


  /* =========================================================
     OPEN DEMO JOIN ROOM PAGE
     ========================================================= */

  if (goToGameBtn) {

    goToGameBtn.addEventListener(
      "click",
      () => {

        window.location.href =
          "join-room.html";

      }
    );

  }


  /* =========================================================
     CLOSE MODAL ON BACKGROUND CLICK
     ========================================================= */

  if (battleCreatedModal) {

    battleCreatedModal.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          battleCreatedModal
        ) {

          battleCreatedModal.classList.remove(
            "active"
          );

        }

      }
    );

  }


  /* =========================================================
     ESC KEY CLOSE MODAL
     ========================================================= */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        battleCreatedModal
      ) {

        battleCreatedModal.classList.remove(
          "active"
        );

      }

    }
  );


  /* =========================================================
     INITIALIZE PAGE
     ========================================================= */

  updateWalletDisplay();

  updatePreview();


  console.log(
    "🎲 LUDOVERSE Battle System Ready!"
  );

});