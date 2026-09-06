"use strict";

/* =========================================
   LUDOVERSE FIREBASE DEMO WALLET
   ========================================= */

import {
  auth,
  database,
  ref,
  set,
  get,
  onAuthStateChanged
} from "./firebase.js";


/* =========================================
   DOM READY
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {


  /* =========================================
     DOM ELEMENTS
     ========================================= */

  const walletBalanceElement =
    document.getElementById("walletBalance");

  const addMoneyBtn =
    document.getElementById("addMoneyBtn");

  const withdrawBtn =
    document.getElementById("withdrawBtn");

  const addMoneyModal =
    document.getElementById("addMoneyModal");

  const closeModalBtn =
    document.getElementById("closeModalBtn");

  const customAmount =
    document.getElementById("customAmount");

  const confirmAddBtn =
    document.getElementById("confirmAddBtn");

  const transactionList =
    document.getElementById("transactionList");

  const createBattleBtn =
    document.getElementById("createBattleBtn");

  const quickAmountButtons =
    document.querySelectorAll(".amount-btn");

  const modalAmountButtons =
    document.querySelectorAll(
      "[data-modal-amount]"
    );


  /* =========================================
     WALLET STATE
     ========================================= */

  let currentUser = null;

  let walletBalance = 0;

  let transactions = [];

  let walletLoaded = false;


  /* =========================================
     GET WALLET DATABASE REFERENCE
     ========================================= */

  function getWalletRef() {

    if (!currentUser) {
      return null;
    }

    return ref(
      database,
      `users/${currentUser.uid}/wallet`
    );

  }


  /* =========================================
     UPDATE BALANCE ON SCREEN
     ========================================= */

  function updateBalanceUI() {

    if (!walletBalanceElement) {
      return;
    }

    walletBalanceElement.textContent =
      Number(walletBalance).toFixed(0);

  }


  /* =========================================
     SAVE WALLET TO FIREBASE
     ========================================= */

  async function saveWallet() {

    const walletRef =
      getWalletRef();

    if (!walletRef) {
      return;
    }

    try {

      await set(
        walletRef,
        {
          balance: walletBalance,

          transactions: transactions,

          updatedAt:
            new Date().toISOString()
        }
      );

      console.log(
        "Wallet saved to Firebase"
      );

    } catch (error) {

      console.error(
        "Wallet save error:",
        error
      );

      alert(
        "Could not save wallet data."
      );

    }

  }


  /* =========================================
     LOAD WALLET FROM FIREBASE
     ========================================= */

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

        transactions =
          Array.isArray(
            walletData.transactions
          )
            ? walletData.transactions
            : [];

      } else {

        /* NEW USER WALLET */

        walletBalance = 0;

        transactions = [];

        await saveWallet();

      }

      walletLoaded = true;

      updateBalanceUI();

      renderTransactions();

      console.log(
        "Firebase wallet loaded"
      );

    } catch (error) {

      console.error(
        "Wallet load error:",
        error
      );

      alert(
        "Could not load wallet data."
      );

    }

  }


  /* =========================================
     ADD TRANSACTION
     ========================================= */

  async function addTransaction(
    type,
    amount,
    description
  ) {

    const transaction = {

      id:
        Date.now(),

      type:
        type,

      amount:
        Number(amount),

      description:
        description,

      date:
        new Date().toLocaleString(),

      createdAt:
        new Date().toISOString()

    };

    transactions.unshift(
      transaction
    );

    /* Keep only latest 50 transactions */

    if (
      transactions.length > 50
    ) {

      transactions =
        transactions.slice(0, 50);

    }

    renderTransactions();

    await saveWallet();

  }


  /* =========================================
     RENDER TRANSACTIONS
     ========================================= */

  function renderTransactions() {

    if (!transactionList) {
      return;
    }

    transactionList.innerHTML = "";


    if (
      transactions.length === 0
    ) {

      transactionList.innerHTML = `
        <div class="empty-history">
          <div class="empty-icon">
            🎮
          </div>

          <h3>
            No transactions yet
          </h3>

          <p>
            Your demo wallet activity
            will appear here.
          </p>
        </div>
      `;

      return;

    }


    transactions.forEach(
      transaction => {

        const item =
          document.createElement("div");

        item.className =
          "transaction-item";


        const isCredit =
          transaction.type ===
          "credit";


        item.innerHTML = `

          <div class="transaction-left">

            <div
              class="transaction-icon
              ${isCredit
                ? "credit"
                : "debit"}"
            >
              ${isCredit
                ? "↓"
                : "↑"}
            </div>

            <div>

              <h4>
                ${transaction.description}
              </h4>

              <p>
                ${transaction.date}
              </p>

            </div>

          </div>


          <div
            class="transaction-amount
            ${isCredit
              ? "positive"
              : "negative"}"
          >

            ${isCredit
              ? "+"
              : "-"}

            ₹${transaction.amount}

          </div>

        `;

        transactionList.appendChild(
          item
        );

      }
    );

  }


  /* =========================================
     OPEN ADD MONEY MODAL
     ========================================= */

  function openAddMoneyModal() {

    if (!addMoneyModal) {
      return;
    }

    addMoneyModal.classList.add(
      "active"
    );


    if (customAmount) {

      customAmount.value = "";

      setTimeout(
        () => {

          customAmount.focus();

        },
        200
      );

    }

  }


  /* =========================================
     CLOSE MODAL
     ========================================= */

  function closeAddMoneyModal() {

    if (!addMoneyModal) {
      return;
    }

    addMoneyModal.classList.remove(
      "active"
    );

  }


  /* =========================================
     ADD DEMO BALANCE
     ========================================= */

  async function addDemoBalance(
    amount
  ) {

    if (!walletLoaded) {

      alert(
        "Wallet is still loading. Please wait."
      );

      return;

    }


    amount =
      Number(amount);


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      alert(
        "Please enter a valid amount."
      );

      return;

    }


    if (
      amount > 50000
    ) {

      alert(
        "Demo limit is ₹50,000."
      );

      return;

    }


    /* UPDATE BALANCE */

    walletBalance += amount;


    updateBalanceUI();


    /* ADD FIREBASE TRANSACTION */

    await addTransaction(
      "credit",
      amount,
      "Demo Balance Added"
    );


    closeAddMoneyModal();


    if (customAmount) {

      customAmount.value = "";

    }


    alert(
      `🎉 Demo Balance Added Successfully!

₹${amount} added to your wallet.`
    );

  }


  /* =========================================
     ADD MONEY BUTTON
     ========================================= */

  addMoneyBtn?.addEventListener(
    "click",
    event => {

      event.preventDefault();

      openAddMoneyModal();

    }
  );


  /* =========================================
     CLOSE MODAL BUTTON
     ========================================= */

  closeModalBtn?.addEventListener(
    "click",
    closeAddMoneyModal
  );


  /* =========================================
     CONFIRM ADD BUTTON
     ========================================= */

  confirmAddBtn?.addEventListener(
    "click",
    async event => {

      event.preventDefault();


      if (!customAmount) {

        alert(
          "Amount input not found."
        );

        return;

      }


      await addDemoBalance(
        customAmount.value
      );

    }
  );


  /* =========================================
     MODAL QUICK AMOUNTS
     ========================================= */

  modalAmountButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const amount =
            Number(
              button.dataset.modalAmount
            );


          if (customAmount) {

            customAmount.value =
              amount;

          }

        }
      );

    }
  );


  /* =========================================
     MAIN QUICK AMOUNT BUTTONS
     ========================================= */

  quickAmountButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const amount =
            Number(
              button.dataset.amount
            );


          openAddMoneyModal();


          setTimeout(
            () => {

              if (customAmount) {

                customAmount.value =
                  amount;

              }

            },
            100
          );

        }
      );

    }
  );


  /* =========================================
     ENTER KEY
     ========================================= */

  customAmount?.addEventListener(
    "keydown",
    async event => {

      if (
        event.key === "Enter"
      ) {

        await addDemoBalance(
          customAmount.value
        );

      }

    }
  );


  /* =========================================
     CLOSE MODAL ON BACKGROUND CLICK
     ========================================= */

  addMoneyModal?.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        addMoneyModal
      ) {

        closeAddMoneyModal();

      }

    }
  );


  /* =========================================
     WITHDRAW BUTTON
     ========================================= */

  withdrawBtn?.addEventListener(
    "click",
    () => {

      alert(
        "🎮 Demo Wallet Mode\n\nThis wallet contains virtual demo balance only. Real withdrawals are not available."
      );

    }
  );


  /* =========================================
     CREATE BATTLE
     ========================================= */

  createBattleBtn?.addEventListener(
    "click",
    () => {

      if (!walletLoaded) {

        alert(
          "Wallet is loading. Please wait."
        );

        return;

      }


      if (
        walletBalance <= 0
      ) {

        alert(
          "Please add demo balance first."
        );

        return;

      }


      window.location.href =
        "battle.html";

    }
  );


  /* =========================================
     FIREBASE LOGIN CHECK
     ========================================= */

  onAuthStateChanged(
    auth,
    async user => {

      if (!user) {

        console.log(
          "User not logged in"
        );

        window.location.href =
          "login.html";

        return;

      }


      currentUser = user;


      console.log(
        "Wallet user:",
        user.email
      );


      await loadWallet();

    }
  );


  console.log(
    "🎮 LUDOVERSE Firebase Wallet Ready!"
  );

});