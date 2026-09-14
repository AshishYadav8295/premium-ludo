"use strict";

import {
  auth,
  database,
  ref,
  get,
  update,
  push,
  onAuthStateChanged
} from "./firebase.js";

/*
=========================================================
 LUDOVERSE FREE ECONOMY
 LudoCoins + XP + Stats + One-Time Rewards
=========================================================

IMPORTANT:
- LudoCoins are virtual game points.
- No real-money deposits.
- No withdrawals.
- No cash prizes.
- 10% is only a non-monetary platform metric.
- Each free reward can be claimed only ONCE per account.
=========================================================
*/

document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     DOM
  ===================================================== */

  const walletBalanceElement =
    document.getElementById("walletBalance");

  const xpValueElement =
    document.getElementById("xpValue");

  const xpFillElement =
    document.getElementById("xpFill");

  const rankNameElement =
    document.getElementById("rankName");

  const xpNextElement =
    document.getElementById("xpNext");

  const gamesPlayedElement =
    document.getElementById("gamesPlayed");

  const gamesWonElement =
    document.getElementById("gamesWon");

  const statXpElement =
    document.getElementById("statXp");

  const winRateElement =
    document.getElementById("winRate");

  const activityPointsElement =
    document.getElementById("activityPoints");

  const platformPointsElement =
    document.getElementById("platformPoints");

  const transactionList =
    document.getElementById("transactionList");

  const rewardButtons =
    document.querySelectorAll(".reward-btn");

  const createBattleBtn =
    document.getElementById("createBattleBtn");

  const profileBtn =
    document.getElementById("profileBtn");

  const toast =
    document.getElementById("toast");

  const toastMessage =
    document.getElementById("toastMessage");


  /* =====================================================
     STATE
  ===================================================== */

  let currentUser = null;

  let economy = {
    ludoCoins: 0,
    xp: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    activityPoints: 0,
    platformPoints: 0
  };

  let coinTransactions = [];

  let claimedRewards = {};

  let rewardClaimInProgress = false;


  /* =====================================================
     CONSTANTS
  ===================================================== */

  const PLATFORM_PERCENT = 10;

  const STARTER_COINS = 1000;

  const MAX_HISTORY = 50;


  /* =====================================================
     FIREBASE REFERENCES
  ===================================================== */

  function getEconomyRef() {

    if (!currentUser) {
      return null;
    }

    return ref(
      database,
      `users/${currentUser.uid}/economy`
    );
  }


  function getTransactionRef() {

    if (!currentUser) {
      return null;
    }

    return ref(
      database,
      `users/${currentUser.uid}/coinTransactions`
    );
  }


  function getClaimedRewardsRef() {

    if (!currentUser) {
      return null;
    }

    return ref(
      database,
      `users/${currentUser.uid}/claimedRewards`
    );
  }


  /* =====================================================
     TOAST
  ===================================================== */

  function showToast(message) {

    if (!toast || !toastMessage) {
      alert(message);
      return;
    }

    toastMessage.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer =
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2800);
  }


  /* =====================================================
     NORMALIZE ECONOMY
  ===================================================== */

  function normalizeEconomy(data) {

    return {

      ludoCoins:
        Math.max(
          0,
          Number(data?.ludoCoins) || 0
        ),

      xp:
        Math.max(
          0,
          Number(data?.xp) || 0
        ),

      gamesPlayed:
        Math.max(
          0,
          Number(data?.gamesPlayed) || 0
        ),

      gamesWon:
        Math.max(
          0,
          Number(data?.gamesWon) || 0
        ),

      activityPoints:
        Math.max(
          0,
          Number(data?.activityPoints) || 0
        ),

      platformPoints:
        Math.max(
          0,
          Number(data?.platformPoints) || 0
        )
    };
  }


  /* =====================================================
     RANK
  ===================================================== */

  function getRank(xp) {

    if (xp >= 50000) {
      return {
        name: "Legend",
        levelStart: 50000,
        levelEnd: 50000
      };
    }

    if (xp >= 25000) {
      return {
        name: "Grandmaster",
        levelStart: 25000,
        levelEnd: 50000
      };
    }

    if (xp >= 10000) {
      return {
        name: "Master",
        levelStart: 10000,
        levelEnd: 25000
      };
    }

    if (xp >= 5000) {
      return {
        name: "Diamond",
        levelStart: 5000,
        levelEnd: 10000
      };
    }

    if (xp >= 2500) {
      return {
        name: "Platinum",
        levelStart: 2500,
        levelEnd: 5000
      };
    }

    if (xp >= 1000) {
      return {
        name: "Gold",
        levelStart: 1000,
        levelEnd: 2500
      };
    }

    if (xp >= 500) {
      return {
        name: "Silver",
        levelStart: 500,
        levelEnd: 1000
      };
    }

    return {
      name: "Rookie",
      levelStart: 0,
      levelEnd: 500
    };
  }


  /* =====================================================
     UPDATE UI
  ===================================================== */

  function updateUI() {

    if (walletBalanceElement) {
      walletBalanceElement.textContent =
        economy.ludoCoins.toLocaleString();
    }

    if (xpValueElement) {
      xpValueElement.textContent =
        `${economy.xp.toLocaleString()} XP`;
    }

    if (statXpElement) {
      statXpElement.textContent =
        economy.xp.toLocaleString();
    }

    if (gamesPlayedElement) {
      gamesPlayedElement.textContent =
        economy.gamesPlayed;
    }

    if (gamesWonElement) {
      gamesWonElement.textContent =
        economy.gamesWon;
    }


    const winRate =
      economy.gamesPlayed > 0
        ? Math.round(
            (economy.gamesWon /
              economy.gamesPlayed) * 100
          )
        : 0;


    if (winRateElement) {
      winRateElement.textContent =
        `${winRate}%`;
    }


    if (activityPointsElement) {
      activityPointsElement.textContent =
        `${economy.activityPoints.toLocaleString()} pts`;
    }


    if (platformPointsElement) {
      platformPointsElement.textContent =
        `${economy.platformPoints.toLocaleString()} pts`;
    }


    const rank =
      getRank(economy.xp);


    if (rankNameElement) {
      rankNameElement.textContent =
        rank.name;
    }


    let percentage = 0;

    if (
      rank.levelEnd > rank.levelStart
    ) {

      const currentLevelXp =
        economy.xp - rank.levelStart;

      const levelRange =
        rank.levelEnd - rank.levelStart;

      percentage =
        Math.min(
          100,
          Math.max(
            0,
            (currentLevelXp /
              levelRange) * 100
          )
        );
    } else {

      percentage = 100;
    }


    if (xpFillElement) {
      xpFillElement.style.width =
        `${percentage}%`;
    }


    const remaining =
      Math.max(
        0,
        rank.levelEnd - economy.xp
      );


    if (xpNextElement) {

      if (
        rank.name === "Legend"
      ) {

        xpNextElement.textContent =
          "Maximum rank reached";

      } else {

        xpNextElement.textContent =
          `${remaining.toLocaleString()} XP to next level`;
      }
    }
  }


  /* =====================================================
     LOAD CLAIMED REWARDS
  ===================================================== */

  async function loadClaimedRewards() {

    const claimedRef =
      getClaimedRewardsRef();

    if (!claimedRef) {
      return;
    }

    try {

      const snapshot =
        await get(claimedRef);

      if (snapshot.exists()) {

        claimedRewards =
          snapshot.val() || {};

      } else {

        claimedRewards = {};
      }

      updateRewardButtons();

    } catch (error) {

      console.error(
        "Claimed rewards load error:",
        error
      );

      claimedRewards = {};

      updateRewardButtons();
    }
  }


  /* =====================================================
     UPDATE REWARD BUTTONS
  ===================================================== */

  function updateRewardButtons() {

    rewardButtons.forEach(
      button => {

        const reward =
          Number(
            button.dataset.reward
          );

        const rewardKey =
          `reward_${reward}`;


        if (
          claimedRewards[rewardKey] === true
        ) {

          button.classList.add(
            "claimed"
          );

          button.disabled = true;


          const small =
            button.querySelector("small");


          if (small) {

            small.textContent =
              "Already claimed";
          }

        } else {

          button.classList.remove(
            "claimed"
          );

          button.disabled = false;


          const small =
            button.querySelector("small");


          if (small) {

            const xp =
              Number(
                button.dataset.xp
              ) || 0;

            small.textContent =
              `Coins + ${xp} XP`;
          }
        }
      }
    );
  }


  /* =====================================================
     LOAD ECONOMY
  ===================================================== */

  async function loadEconomy() {

    const economyRef =
      getEconomyRef();

    if (!economyRef) {
      return;
    }

    try {

      const snapshot =
        await get(economyRef);


      if (snapshot.exists()) {

        economy =
          normalizeEconomy(
            snapshot.val()
          );

      } else {

        economy = {

          ludoCoins:
            STARTER_COINS,

          xp: 0,

          gamesPlayed: 0,

          gamesWon: 0,

          activityPoints: 0,

          platformPoints: 0
        };


        await update(
          economyRef,
          {
            ...economy,
            updatedAt: Date.now()
          }
        );


        await createTransaction(
          "credit",
          STARTER_COINS,
          0,
          "Starter LudoCoins"
        );
      }


      updateUI();

      await loadTransactions();

      await loadClaimedRewards();

    } catch (error) {

      console.error(
        "Economy load error:",
        error
      );

      showToast(
        "Could not load your LudoCoin data."
      );
    }
  }


  /* =====================================================
     LOAD TRANSACTIONS
  ===================================================== */

  async function loadTransactions() {

    const transactionRef =
      getTransactionRef();

    if (!transactionRef) {
      return;
    }

    try {

      const snapshot =
        await get(transactionRef);


      if (!snapshot.exists()) {

        coinTransactions = [];

      } else {

        const data =
          snapshot.val();


        coinTransactions =
          Object.entries(data)

            .map(
              ([id, transaction]) => ({
                id,
                ...transaction
              })
            )

            .sort(
              (a, b) =>
                Number(
                  b.createdAt || 0
                ) -
                Number(
                  a.createdAt || 0
                )
            )

            .slice(
              0,
              MAX_HISTORY
            );
      }


      renderTransactions();

    } catch (error) {

      console.error(
        "Transaction load error:",
        error
      );
    }
  }


  /* =====================================================
     CREATE TRANSACTION
  ===================================================== */

  async function createTransaction(
    type,
    coins,
    xp,
    description
  ) {

    const transactionRef =
      getTransactionRef();

    if (!transactionRef) {
      return;
    }


    const createdAt =
      Date.now();


    const newTransaction =
      push(transactionRef);


    await update(
      newTransaction,
      {

        type,

        coins:
          Number(coins) || 0,

        xp:
          Number(xp) || 0,

        description,

        createdAt
      }
    );


    coinTransactions.unshift({

      id:
        newTransaction.key,

      type,

      coins:
        Number(coins) || 0,

      xp:
        Number(xp) || 0,

      description,

      createdAt
    });


    coinTransactions =
      coinTransactions.slice(
        0,
        MAX_HISTORY
      );


    renderTransactions();
  }


  /* =====================================================
     RENDER TRANSACTIONS
  ===================================================== */

  function renderTransactions() {

    if (!transactionList) {
      return;
    }


    transactionList.innerHTML = "";


    if (
      coinTransactions.length === 0
    ) {

      transactionList.innerHTML = `
        <div class="empty-history">
          <div class="empty-icon">🪙</div>
          <h3>No activity yet</h3>
          <p>Your LudoCoin activity will appear here.</p>
        </div>
      `;

      return;
    }


    coinTransactions.forEach(
      transaction => {

        const item =
          document.createElement("div");


        item.className =
          "transaction-item";


        const date =
          new Date(
            Number(
              transaction.createdAt
            )
          );


        const formattedDate =
          Number.isNaN(
            date.getTime()
          )
            ? ""
            : date.toLocaleString();


        const isXp =
          Number(transaction.xp) > 0 &&
          Number(transaction.coins) === 0;


        const coinText =
          Number(transaction.coins) > 0
            ? `+${Number(
                transaction.coins
              ).toLocaleString()}`
            : "";


        const xpText =
          Number(transaction.xp) > 0
            ? `+${Number(
                transaction.xp
              )} XP`
            : "";


        item.innerHTML = `

          <div class="transaction-left">

            <div class="transaction-icon ${
              isXp ? "xp" : "credit"
            }">

              ${
                isXp
                  ? "⭐"
                  : "🪙"
              }

            </div>

            <div>

              <h4>
                ${escapeHTML(
                  transaction.description ||
                  "LudoVerse Activity"
                )}
              </h4>

              <p>
                ${formattedDate}
              </p>

            </div>

          </div>

          <div class="transaction-amount positive">

            ${coinText}

            ${
              coinText && xpText
                ? " · "
                : ""
            }

            ${xpText}

          </div>
        `;


        transactionList.appendChild(
          item
        );
      }
    );
  }


  /* =====================================================
     ESCAPE HTML
  ===================================================== */

  function escapeHTML(value) {

    return String(value)

      .replaceAll(
        "&",
        "&amp;"
      )

      .replaceAll(
        "<",
        "&lt;"
      )

      .replaceAll(
        ">",
        "&gt;"
      )

      .replaceAll(
        '"',
        "&quot;"
      )

      .replaceAll(
        "'",
        "&#039;"
      );
  }


  /* =====================================================
     CLAIM FREE REWARD
  ===================================================== */

  async function claimReward(
    button
  ) {

    if (!currentUser) {

      showToast(
        "Please login first."
      );

      return;
    }


    if (rewardClaimInProgress) {
      return;
    }


    const coins =
      Number(
        button.dataset.reward
      );


    const xp =
      Number(
        button.dataset.xp
      );


    if (
      !Number.isFinite(coins) ||
      coins <= 0
    ) {
      return;
    }


    if (
      !Number.isFinite(xp) ||
      xp < 0
    ) {
      return;
    }


    const rewardKey =
      `reward_${coins}`;


    /* ===================================================
       PERMANENT CLAIM CHECK
    =================================================== */

    if (
      claimedRewards[rewardKey] === true
    ) {

      button.classList.add(
        "claimed"
      );

      button.disabled = true;

      const small =
        button.querySelector("small");

      if (small) {
        small.textContent =
          "Already claimed";
      }

      showToast(
        "This reward has already been claimed."
      );

      return;
    }


    rewardClaimInProgress = true;

    button.disabled = true;


    const oldEconomy = {
      ...economy
    };


    const platformBonus =
      Math.floor(
        coins *
        (PLATFORM_PERCENT / 100)
      );


    /* ===================================================
       UPDATE LOCAL ECONOMY
    =================================================== */

    economy.ludoCoins += coins;

    economy.xp += xp;

    economy.activityPoints += coins;

    economy.platformPoints +=
      platformBonus;


    try {

      /* ================================================
         SAVE ECONOMY
      ================================================ */

      await update(
        getEconomyRef(),
        {

          ludoCoins:
            economy.ludoCoins,

          xp:
            economy.xp,

          gamesPlayed:
            economy.gamesPlayed,

          gamesWon:
            economy.gamesWon,

          activityPoints:
            economy.activityPoints,

          platformPoints:
            economy.platformPoints,

          updatedAt:
            Date.now()
        }
      );


      /* ================================================
         SAVE PERMANENT CLAIM
      ================================================ */

      const claimedRef =
        getClaimedRewardsRef();


      await update(
        claimedRef,
        {
          [rewardKey]: true
        }
      );


      /* ================================================
         UPDATE LOCAL CLAIM STATE
      ================================================ */

      claimedRewards[rewardKey] =
        true;


      /* ================================================
         TRANSACTION
      ================================================ */

      await createTransaction(
        "credit",
        coins,
        xp,
        "Free Reward"
      );


      /* ================================================
         UPDATE BUTTON
      ================================================ */

      button.classList.add(
        "claimed"
      );

      button.disabled = true;


      const small =
        button.querySelector("small");


      if (small) {

        small.textContent =
          "Already claimed";
      }


      updateUI();


      showToast(
        `+${coins.toLocaleString()} LudoCoins · +${xp} XP`
      );

    } catch (error) {

      console.error(
        "Reward error:",
        error
      );


      /* ================================================
         ROLLBACK LOCAL ECONOMY
      ================================================ */

      economy =
        oldEconomy;


      updateUI();


      button.classList.remove(
        "claimed"
      );

      button.disabled = false;


      showToast(
        "Reward could not be saved. Please try again."
      );
    }


    rewardClaimInProgress = false;
  }


  /* =====================================================
     REWARD BUTTON EVENTS
  ===================================================== */

  rewardButtons.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {
          claimReward(button);
        }
      );
    }
  );


  /* =====================================================
     FIND GAME
  ===================================================== */

  createBattleBtn?.addEventListener(
    "click",
    () => {

      window.location.href =
        "battle-lobby.html";
    }
  );


  /* =====================================================
     PROFILE
  ===================================================== */

  profileBtn?.addEventListener(
    "click",
    () => {

      if (!currentUser) {
        return;
      }


      showToast(
        `${
          currentUser.displayName ||
          "LUDOVERSE Player"
        } · ${
          economy.xp.toLocaleString()
        } XP`
      );
    }
  );


  /* =====================================================
     AUTH
  ===================================================== */

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
        "LUDOVERSE Economy User:",
        user.uid
      );


      await loadEconomy();
    }
  );


  /* =====================================================
     READY
  ===================================================== */

  console.log(
    "🪙 LUDOVERSE LudoCoin + XP Economy Ready"
  );
});