"use strict";

/* =========================================
   LUDOVERSE WALLET
   DEMO BALANCE SYSTEM
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
    document.querySelectorAll("[data-modal-amount]");


  /* =========================================
     WALLET DATA
     ========================================= */

  let walletBalance =
    Number(
      localStorage.getItem("ludoverseBalance")
    ) || 0;


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


  /* =========================================
     UPDATE BALANCE
     ========================================= */

  function updateBalance() {

    if (!walletBalanceElement) return;

    walletBalanceElement.textContent =
      walletBalance.toFixed(0);

    localStorage.setItem(
      "ludoverseBalance",
      walletBalance.toString()
    );

  }


  /* =========================================
     SAVE TRANSACTIONS
     ========================================= */

  function saveTransactions() {

    localStorage.setItem(
      "ludoverseTransactions",
      JSON.stringify(transactions)
    );

  }


  /* =========================================
     ADD TRANSACTION
     ========================================= */

  function addTransaction(
    type,
    amount,
    description
  ) {

    const transaction = {

      id: Date.now(),

      type: type,

      amount: amount,

      description: description,

      date: new Date().toLocaleString()

    };


    transactions.unshift(transaction);

    saveTransactions();

    renderTransactions();

  }


  /* =========================================
     RENDER TRANSACTIONS
     ========================================= */

  function renderTransactions() {

    if (!transactionList) return;

    transactionList.innerHTML = "";


    if (transactions.length === 0) {

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


    transactions.forEach(transaction => {

      const item =
        document.createElement("div");

      item.className =
        "transaction-item";


      const isCredit =
        transaction.type === "credit";


      item.innerHTML = `

        <div class="transaction-left">

          <div class="transaction-icon
            ${isCredit ? "credit" : "debit"}">

            ${isCredit ? "↓" : "↑"}

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


        <div class="
          transaction-amount
          ${isCredit ? "positive" : "negative"}
        ">

          ${isCredit ? "+" : "-"}

          ₹${transaction.amount}

        </div>

      `;


      transactionList.appendChild(item);

    });

  }


  /* =========================================
     OPEN ADD MONEY MODAL
     ========================================= */

  function openAddMoneyModal() {

    if (!addMoneyModal) return;

    addMoneyModal.classList.add("active");

    if (customAmount) {

      customAmount.value = "";

      setTimeout(() => {

        customAmount.focus();

      }, 200);

    }

  }


  /* =========================================
     CLOSE ADD MONEY MODAL
     ========================================= */

  function closeAddMoneyModal() {

    if (!addMoneyModal) return;

    addMoneyModal.classList.remove("active");

  }


  /* =========================================
     ADD DEMO BALANCE
     ========================================= */

  function addDemoBalance(amount) {

    amount = Number(amount);


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {

      alert(
        "Please enter a valid amount."
      );

      return;

    }


    if (amount > 50000) {

      alert(
        "Demo limit is ₹50,000."
      );

      return;

    }


    walletBalance += amount;


    updateBalance();


    addTransaction(

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

  if (addMoneyBtn) {

    addMoneyBtn.addEventListener(
      "click",
      event => {

        event.preventDefault();

        openAddMoneyModal();

      }
    );

  }


  /* =========================================
     CLOSE MODAL BUTTON
     ========================================= */

  if (closeModalBtn) {

    closeModalBtn.addEventListener(
      "click",
      closeAddMoneyModal
    );

  }


  /* =========================================
     CONFIRM ADD BUTTON
     ========================================= */

  if (confirmAddBtn) {

    confirmAddBtn.addEventListener(
      "click",
      event => {

        event.preventDefault();

        if (!customAmount) {

          alert(
            "Amount input not found."
          );

          return;

        }


        const amount =
          customAmount.value;


        addDemoBalance(amount);

      }
    );

  }


  /* =========================================
     MODAL QUICK AMOUNTS
     ========================================= */

  modalAmountButtons.forEach(button => {

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

  });


  /* =========================================
     MAIN QUICK AMOUNT BUTTONS
     ========================================= */

  quickAmountButtons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const amount =
          Number(
            button.dataset.amount
          );


        openAddMoneyModal();


        setTimeout(() => {

          if (customAmount) {

            customAmount.value =
              amount;

          }

        }, 100);

      }
    );

  });


  /* =========================================
     ENTER KEY SUPPORT
     ========================================= */

  if (customAmount) {

    customAmount.addEventListener(
      "keydown",
      event => {

        if (event.key === "Enter") {

          const amount =
            customAmount.value;

          addDemoBalance(amount);

        }

      }
    );

  }


  /* =========================================
     CLOSE MODAL ON BACKGROUND CLICK
     ========================================= */

  if (addMoneyModal) {

    addMoneyModal.addEventListener(
      "click",
      event => {

        if (
          event.target === addMoneyModal
        ) {

          closeAddMoneyModal();

        }

      }
    );

  }


  /* =========================================
     WITHDRAW BUTTON
     ========================================= */

  if (withdrawBtn) {

    withdrawBtn.addEventListener(
      "click",
      () => {

        alert(
          "Demo wallet mode is active. Real withdrawals are not available."
        );

      }
    );

  }


/* =========================================
   CREATE BATTLE BUTTON
   ========================================= */
if (createBattleBtn) {
  createBattleBtn.addEventListener(
    "click",
    () => {

      if (walletBalance <= 0) {
        alert(
          "Please add demo balance first."
        );
        return;
      }

      window.location.href = "battle.html";

    }
  );
}


  /* =========================================
     INITIALIZE WALLET
     ========================================= */

  updateBalance();

  renderTransactions();


  console.log(
    "🎮 LUDOVERSE Demo Wallet Ready!"
  );

});