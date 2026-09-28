"use strict";

import {
  auth,
  onAuthStateChanged
} from "./firebase.js";


// ================================================================
// LUDOVERSE BATTLE CREATION
// SERVER AUTHORITATIVE VERSION
// ================================================================


// IMPORTANT:
// If frontend and backend are on the same server,
// empty string is correct.
//
// If frontend is hosted separately,
// replace this with your backend URL.
//
// Example:
// const API_BASE = "https://premium-ludo.onrender.com";

const API_BASE =
  window.LUDOVERSE_API_BASE || "";


document.addEventListener(
  "DOMContentLoaded",
  () => {


    // ============================================================
    // DOM
    // ============================================================

    const walletBalanceElement =
      document.getElementById(
        "walletBalance"
      );

    const modeCards =
      document.querySelectorAll(
        ".mode-card"
      );

    const entryButtons =
      document.querySelectorAll(
        ".entry-btn"
      );

    const customEntry =
      document.getElementById(
        "customEntry"
      );

    const previewEntry =
      document.getElementById(
        "previewEntry"
      );

    const previewPrize =
      document.getElementById(
        "previewPrize"
      );

    const createBattleBtn =
      document.getElementById(
        "createBattleBtn"
      );

    const battleCreatedModal =
      document.getElementById(
        "battleCreatedModal"
      );

    const roomCode =
      document.getElementById(
        "roomCode"
      );

    const successEntry =
      document.getElementById(
        "successEntry"
      );

    const successPrize =
      document.getElementById(
        "successPrize"
      );

    const copyRoomCodeBtn =
      document.getElementById(
        "copyRoomCodeBtn"
      );

    const backToWalletBtn =
      document.getElementById(
        "backToWalletBtn"
      );

    const goToGameBtn =
      document.getElementById(
        "goToGameBtn"
      );

    const toast =
      document.getElementById(
        "toast"
      );

    const toastMessage =
      document.getElementById(
        "toastMessage"
      );


    // ============================================================
    // STATE
    // ============================================================

    let currentUser =
      null;

    let walletBalance =
      0;

    let walletLoaded =
      false;

    let selectedMode =
      "private";

    let selectedEntry =
      50;


    // ============================================================
    // TOAST
    // ============================================================

    function showToast(message) {

      if (
        !toast ||
        !toastMessage
      ) {

        alert(message);

        return;
      }


      toastMessage.textContent =
        message;


      toast.classList.add(
        "show"
      );


      clearTimeout(
        showToast.timer
      );


      showToast.timer =
        setTimeout(
          () => {

            toast.classList.remove(
              "show"
            );

          },
          3200
        );
    }


    // ============================================================
    // FORMAT MONEY
    // ============================================================

    function formatMoney(value) {

      return Number(value || 0)
        .toLocaleString(
          "en-IN"
        );
    }


    // ============================================================
    // UPDATE WALLET DISPLAY
    // ============================================================

    function updateWalletDisplay() {

      if (
        walletBalanceElement
      ) {

        walletBalanceElement.textContent =
          formatMoney(
            walletBalance
          );
      }
    }


    // ============================================================
    // CALCULATE PREVIEW
    // ============================================================

    function calculatePrize(
      entry
    ) {

      const totalPot =
        Number(entry) * 2;


      const platformFee =
        Math.floor(
          totalPot * 0.10
        );


      return (
        totalPot -
        platformFee
      );
    }


    // ============================================================
    // UPDATE PREVIEW
    // ============================================================

    function updatePreview() {

      const prize =
        calculatePrize(
          selectedEntry
        );


      if (
        previewEntry
      ) {

        previewEntry.textContent =
          formatMoney(
            selectedEntry
          );
      }


      if (
        previewPrize
      ) {

        previewPrize.textContent =
          formatMoney(
            prize
          );
      }
    }


    // ============================================================
    // API REQUEST
    // ============================================================

    async function apiRequest(
      endpoint,
      options = {}
    ) {

      if (!API_BASE) {

        throw new Error(
          "Backend API is not configured."
        );
      }


      if (!auth.currentUser) {

        throw new Error(
          "Authentication required."
        );
      }


      const token =
        await auth.currentUser
          .getIdToken(true);


      const headers = {

        "Content-Type":
          "application/json",

        ...(options.headers || {}),

        "Authorization":
          `Bearer ${token}`
      };


      const response =
        await fetch(
          `${API_BASE}${endpoint}`,
          {
            ...options,
            headers
          }
        );


      const payload =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok ||
        payload.ok === false
      ) {

        throw new Error(
          payload.error ||
          `Request failed (${response.status}).`
        );
      }


      return payload;
    }


    // ============================================================
    // LOAD AUTHORITATIVE WALLET
    // ============================================================

    async function loadWallet() {

      const payload =
        await apiRequest(
          "/api/economy"
        );


      const economy =
        payload.economy || {};


      walletBalance =
        Number(
          economy.cashBalance
        ) || 0;


      walletLoaded =
        true;


      updateWalletDisplay();
    }


    // ============================================================
    // MODE
    // ============================================================

    modeCards.forEach(
      card => {

        card.addEventListener(
          "click",
          () => {

            modeCards.forEach(
              item => {

                item.classList.remove(
                  "active"
                );
              }
            );


            card.classList.add(
              "active"
            );


            selectedMode =
              card.dataset.mode ||
              "private";


            showToast(
              selectedMode === "quick"
                ? "Quick Match selected."
                : "Private Battle selected."
            );
          }
        );
      }
    );


    // ============================================================
    // ENTRY BUTTONS
    // ============================================================

    entryButtons.forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            entryButtons.forEach(
              item => {

                item.classList.remove(
                  "active"
                );
              }
            );


            button.classList.add(
              "active"
            );


            const amount =
              Number(
                button.dataset.amount
              );


            if (
              !Number.isSafeInteger(
                amount
              ) ||
              amount <= 0
            ) {

              return;
            }


            selectedEntry =
              amount;


            if (
              customEntry
            ) {

              customEntry.value =
                "";
            }


            updatePreview();
          }
        );
      }
    );


    // ============================================================
    // CUSTOM ENTRY
    // ============================================================

    customEntry?.addEventListener(
      "input",
      () => {

        const amount =
          Number(
            customEntry.value
          );


        if (
          Number.isSafeInteger(
            amount
          ) &&
          amount > 0
        ) {

          selectedEntry =
            amount;


          entryButtons.forEach(
            item => {

              item.classList.remove(
                "active"
              );
            }
          );


          updatePreview();
        }
      }
    );


    // ============================================================
    // CREATE BATTLE
    // ============================================================

    createBattleBtn?.addEventListener(
      "click",
      async () => {

        if (
          !currentUser
        ) {

          showToast(
            "Please login first."
          );

          return;
        }


        if (
          !walletLoaded
        ) {

          showToast(
            "Wallet is still loading."
          );

          return;
        }


        if (
          !Number.isSafeInteger(
            selectedEntry
          ) ||
          selectedEntry <= 0
        ) {

          showToast(
            "Please select a valid entry."
          );

          return;
        }


        if (
          walletBalance <
          selectedEntry
        ) {

          showToast(
            "Insufficient wallet balance."
          );

          return;
        }


        // --------------------------------------------------------
        // UI LOCK
        // --------------------------------------------------------

        createBattleBtn.disabled =
          true;


        const originalText =
          createBattleBtn.innerHTML;


        createBattleBtn.innerHTML =
          "Creating Battle...";


        try {

          // ------------------------------------------------------
          // UNIQUE CLIENT REQUEST ID
          //
          // Prevents accidental double charge when request
          // is retried.
          // ------------------------------------------------------

          const requestId =
            crypto.randomUUID();


          const payload =
            await apiRequest(
              "/api/battles/create",
              {
                method: "POST",

                body:
                  JSON.stringify({

                    entry:
                      selectedEntry,

                    mode:
                      selectedMode,

                    requestId,

                    playerName:
                      currentUser
                        .displayName ||
                      "Player",

                    playerPhoto:
                      currentUser
                        .photoURL ||
                      ""
                  })
              }
            );


          const battle =
            payload.battle;


          // ------------------------------------------------------
          // UPDATE LOCAL DISPLAY
          //
          // Server is authoritative.
          // ------------------------------------------------------

          walletBalance -=
            selectedEntry;


          updateWalletDisplay();


          if (
            roomCode
          ) {

            roomCode.textContent =
              battle.roomCode;
          }


          if (
            successEntry
          ) {

            successEntry.textContent =
              formatMoney(
                battle.entry
              );
          }


          if (
            successPrize
          ) {

            successPrize.textContent =
              formatMoney(
                battle.winnerPrize
              );
          }


          battleCreatedModal?.classList.add(
            "active"
          );


          showToast(
            "Battle created successfully."
          );


          console.log(
            "LUDOVERSE Battle:",
            battle
          );


        } catch (error) {

          console.error(
            "Create battle error:",
            error
          );


          showToast(
            error?.message ||
            "Could not create battle."
          );


          // Re-sync wallet because server
          // is authoritative.

          try {

            await loadWallet();

          } catch (
            walletError
          ) {

            console.error(
              "Wallet resync failed:",
              walletError
            );
          }


        } finally {

          createBattleBtn.disabled =
            false;


          createBattleBtn.innerHTML =
            originalText;
        }
      }
    );


    // ============================================================
    // COPY ROOM
    // ============================================================

    copyRoomCodeBtn?.addEventListener(
      "click",
      async () => {

        const code =
          roomCode?.textContent
            ?.trim();


        if (!code) {
          return;
        }


        try {

          await navigator
            .clipboard
            .writeText(
              code
            );


          showToast(
            "Room code copied."
          );


        } catch (error) {

          console.error(
            "Clipboard error:",
            error
          );


          showToast(
            "Please copy the room code manually."
          );
        }
      }
    );


    // ============================================================
    // BACK TO WALLET
    // ============================================================

    backToWalletBtn?.addEventListener(
      "click",
      () => {

        window.location.href =
          "wallet.html";
      }
    );


    // ============================================================
    // GO TO JOIN ROOM
    // ============================================================

    goToGameBtn?.addEventListener(
      "click",
      () => {

        window.location.href =
          "join-room.html";
      }
    );


    // ============================================================
    // AUTH
    // ============================================================

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


        try {

          await loadWallet();

        } catch (error) {

          console.error(
            "Battle wallet load error:",
            error
          );


          showToast(
            error?.message ||
            "Could not load wallet."
          );
        }
      }
    );


    // ============================================================
    // INITIALIZE
    // ============================================================

    updatePreview();


    console.log(
      "LUDOVERSE secure battle creation ready."
    );

  }
);