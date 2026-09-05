"use strict";

import {
  database,
  ref,
  set,
  get,
  update,
  onValue
} from "./firebase.js";

/* =========================================================
   LUDOVERSE BATTLE LOBBY
   PROFESSIONAL DEMO SYSTEM
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     CONFIG
  ======================================================= */

  const COMMISSION_PERCENT = 10;
  const TOTAL_PLAYERS = 2;

  const STORAGE = {
  balance: "ludoverseBalance",
  battles: "ludoverseBattles",
  currentBattle: "ludoverseCurrentBattle",
  transactions: "ludoverseTransactions"
};

const firebaseTestRef = ref(
  database,
  "connectionTest"
);

set(firebaseTestRef, {
  status: "connected",
  message: "LUDOVERSE Firebase is working",
  timestamp: Date.now()
})
.then(() => {
  console.log("Firebase connected successfully!");
})
.catch((error) => {
  console.error("Firebase connection error:", error);
});

/* =========================================================
   FIREBASE REALTIME BATTLE SYSTEM
========================================================= */

const FIREBASE_BATTLES_PATH = "battles";

/* ---------------------------------------------------------
   SAVE A BATTLE TO FIREBASE
--------------------------------------------------------- */

async function saveBattleToFirebase(battle) {
  if (!battle || !battle.roomCode) {
    throw new Error("Invalid battle data.");
  }

  const battleReference = ref(
    database,
    `${FIREBASE_BATTLES_PATH}/${battle.roomCode}`
  );

  await set(
    battleReference,
    battle
  );

  console.log(
    "Firebase battle saved:",
    battle.roomCode
  );
}

/* ---------------------------------------------------------
   GET ONE BATTLE FROM FIREBASE
--------------------------------------------------------- */

async function getBattleFromFirebase(roomCode) {
  if (!roomCode) {
    return null;
  }

  const battleReference = ref(
    database,
    `${FIREBASE_BATTLES_PATH}/${roomCode}`
  );

  const snapshot = await get(
    battleReference
  );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val();
}

/* ---------------------------------------------------------
   UPDATE BATTLE IN FIREBASE
--------------------------------------------------------- */

async function updateBattleInFirebase(
  roomCode,
  updates
) {
  if (!roomCode) {
    throw new Error("Room code is missing.");
  }

  const battleReference = ref(
    database,
    `${FIREBASE_BATTLES_PATH}/${roomCode}`
  );

  await update(
    battleReference,
    updates
  );

  console.log(
    "Firebase battle updated:",
    roomCode
  );
}

/* ---------------------------------------------------------
   LISTEN FOR ALL BATTLES LIVE
--------------------------------------------------------- */

function listenToFirebaseBattles(callback) {
  const battlesReference = ref(
    database,
    FIREBASE_BATTLES_PATH
  );

  return onValue(
    battlesReference,
    snapshot => {
      const data = snapshot.val();

      if (!data) {
        callback([]);
        return;
      }

      const battles = Object.values(data);

      callback(battles);
    },
    error => {
      console.error(
        "Firebase battle listener error:",
        error
      );
    }
  );
}

/* =======================================================
   HELPERS
======================================================= */

  const $ = (id) => document.getElementById(id);


  function formatAmount(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("en-IN");

  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function generateRoomCode() {

    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const numbers = Math.floor(
      100000 + Math.random() * 900000
    );

    const letter1 =
      letters[Math.floor(Math.random() * letters.length)];

    const letter2 =
      letters[Math.floor(Math.random() * letters.length)];

    return `${letter1}${letter2}-${numbers}`;

  }


  function getQueryRoomCode() {

    const params =
      new URLSearchParams(window.location.search);

    return params.get("room");

  }


  /* =======================================================
     DOM ELEMENTS
  ======================================================= */

  const walletBalanceElement =
    $("walletBalance");

  const modalWalletBalance =
    $("modalWalletBalance");

  const availableBattleCount =
    $("availableBattleCount");

  const battleList =
    $("battleList");

  const emptyState =
    $("emptyState");

  const activeBattleContainer =
    $("activeBattleContainer");


  /* BUTTONS */

  const refreshBattlesBtn =
    $("refreshBattlesBtn");

  const createBattleBtn =
    $("createBattleBtn");

  const emptyCreateBattleBtn =
    $("emptyCreateBattleBtn");

  const profileBtn =
    $("profileBtn");


  /* CREATE MODAL */

  const createBattleModal =
    $("createBattleModal");

  const closeCreateModal =
    $("closeCreateModal");

  const entryAmountInput =
    $("entryAmountInput");

  const confirmCreateBattleBtn =
    $("confirmCreateBattleBtn");

  const amountOptions =
    document.querySelectorAll(".amount-option");


  /* CREATE SUMMARY */

  const summaryEntry =
    $("summaryEntry");

  const summaryTotalPool =
    $("summaryTotalPool");

  const summaryCommission =
    $("summaryCommission");

  const summaryPrize =
    $("summaryPrize");


  /* JOIN MODAL */

  const joinBattleModal =
    $("joinBattleModal");

  const closeJoinModal =
    $("closeJoinModal");

  const joinRoomCode =
    $("joinRoomCode");

  const joinEntryAmount =
    $("joinEntryAmount");

  const joinTotalPool =
    $("joinTotalPool");

  const joinCommission =
    $("joinCommission");

  const joinPrizeAmount =
    $("joinPrizeAmount");

  const confirmJoinBattleBtn =
    $("confirmJoinBattleBtn");


  /* TOAST */

  const toast =
    $("toast");

  const toastMessage =
    $("toastMessage");

  const toastIcon =
    $("toastIcon");


  /* =======================================================
     STATE
  ======================================================= */

  let selectedBattleToJoin = null;

/*
=======================================================
FIREBASE LIVE BATTLE STATE
=======================================================
*/

let firebaseBattles = [];
let firebaseBattlesLoaded = false;

  /* =======================================================
     WALLET
  ======================================================= */

  function getBalance() {

    const saved =
      Number(localStorage.getItem(STORAGE.balance));

    if (!Number.isFinite(saved) || saved < 0) {

      /* Default demo balance */

      const defaultBalance = 2500;

      localStorage.setItem(
        STORAGE.balance,
        String(defaultBalance)
      );

      return defaultBalance;

    }

    return saved;

  }


  function setBalance(value) {

    const balance =
      Math.max(
        0,
        Number(value) || 0
      );

    localStorage.setItem(
      STORAGE.balance,
      String(balance)
    );

    renderWallet();

  }


  function renderWallet() {

    const balance =
      getBalance();

    if (walletBalanceElement) {

      walletBalanceElement.textContent =
        formatAmount(balance);

    }

    if (modalWalletBalance) {

      modalWalletBalance.textContent =
        formatAmount(balance);

    }

  }


  /* =======================================================
     BATTLE STORAGE
  ======================================================= */

  function getRawBattles() {

    try {

      const data =
        JSON.parse(
          localStorage.getItem(STORAGE.battles)
        );

      return Array.isArray(data)
        ? data
        : [];

    }

    catch (error) {

      console.error(
        "Battle storage error:",
        error
      );

      return [];

    }

  }


  /*
     IMPORTANT:
     Old battle data may have different property names.
     This function fixes old data automatically.
  */

  function normalizeBattle(battle) {

    if (!battle || typeof battle !== "object") {
      return null;
    }


    const entryAmount =
      Number(
        battle.entryAmount ??
        battle.entry ??
        0
      );


    const safeEntry =
      Number.isFinite(entryAmount)
        ? entryAmount
        : 0;


    const playersJoined =
      Number(
        battle.playersJoined ??
        battle.players ??
        1
      );


    const safePlayersJoined =
      Math.min(
        TOTAL_PLAYERS,
        Math.max(
          1,
          Number.isFinite(playersJoined)
            ? playersJoined
            : 1
        )
      );


    const totalPool =
      safeEntry * TOTAL_PLAYERS;


    const commission =
      Math.round(
        totalPool *
        COMMISSION_PERCENT / 100
      );


    const prizeAmount =
      totalPool - commission;


    const roomCode =
      String(
        battle.roomCode ??
        battle.code ??
        generateRoomCode()
      );


    let status =
      String(
        battle.status ??
        "waiting"
      );


    if (
      safePlayersJoined >= TOTAL_PLAYERS &&
      status === "waiting"
    ) {

      status = "joined";

    }


    return {

      id:
        battle.id ??
        `battle_${Date.now()}_${Math.random()}`,

      roomCode,

      entryAmount: safeEntry,

      totalPool,

      commission,

      prizeAmount,

      winnerPrize: prizeAmount,

      players: TOTAL_PLAYERS,

      playersJoined: safePlayersJoined,

      status,

      creator:
        battle.creator ??
        "You",

      opponent:
        battle.opponent ??
        null,

      creatorReady:
        battle.creatorReady === true,

      opponentReady:
        battle.opponentReady === true,

      createdAt:
        battle.createdAt ??
        new Date().toISOString(),

      joinedAt:
        battle.joinedAt ??
        null,

      winner:
        battle.winner ??
        null

    };

  }


  function getBattles() {

    const rawBattles =
      getRawBattles();

    const cleanBattles =
      rawBattles
        .map(normalizeBattle)
        .filter(Boolean);

    /*
       Automatically save cleaned data
    */

    localStorage.setItem(
      STORAGE.battles,
      JSON.stringify(cleanBattles)
    );

    return cleanBattles;

  }


  function saveBattles(battles) {

    const cleanBattles =
      battles
        .map(normalizeBattle)
        .filter(Boolean);

    localStorage.setItem(
      STORAGE.battles,
      JSON.stringify(cleanBattles)
    );

  }


  /* =======================================================
     CURRENT BATTLE
  ======================================================= */

  function getCurrentBattle() {

    try {

      const battle =
        JSON.parse(
          localStorage.getItem(
            STORAGE.currentBattle
          )
        );

      return normalizeBattle(battle);

    }

    catch (error) {

      return null;

    }

  }


  function setCurrentBattle(battle) {

    const cleanBattle =
      normalizeBattle(battle);

    if (!cleanBattle) {
      return;
    }

    localStorage.setItem(
      STORAGE.currentBattle,
      JSON.stringify(cleanBattle)
    );

  }


  function clearCurrentBattle() {

    localStorage.removeItem(
      STORAGE.currentBattle
    );

  }


  /* =======================================================
     TRANSACTIONS
  ======================================================= */

  function getTransactions() {

    try {

      const data =
        JSON.parse(
          localStorage.getItem(
            STORAGE.transactions
          )
        );

      return Array.isArray(data)
        ? data
        : [];

    }

    catch {

      return [];

    }

  }


  function addTransaction(
    type,
    amount,
    description
  ) {

    const transactions =
      getTransactions();

    transactions.unshift({

      id:
        `${Date.now()}-${Math.random()}`,

      type,

      amount:
        Number(amount) || 0,

      description,

      date:
        new Date().toLocaleString("en-IN")

    });


    localStorage.setItem(
      STORAGE.transactions,
      JSON.stringify(transactions)
    );

  }


  /* =======================================================
     TOAST
  ======================================================= */

  let toastTimer = null;


  function showToast(
    message,
    type = "success"
  ) {

    if (!toast) {
      return;
    }


    const icons = {

      success: "✓",
      error: "⚠",
      info: "ℹ"

    };


    if (toastMessage) {

      toastMessage.textContent =
        message;

    }


    if (toastIcon) {

      toastIcon.textContent =
        icons[type] || "✓";

    }


    toast.classList.add("show");


    clearTimeout(toastTimer);


    toastTimer =
      setTimeout(() => {

        toast.classList.remove("show");

      }, 3500);

  }


  /* =======================================================
     CALCULATE BATTLE
  ======================================================= */

  function calculateBattle(entryAmount) {

    const entry =
      Math.max(
        0,
        Number(entryAmount) || 0
      );


    const totalPool =
      entry * TOTAL_PLAYERS;


    const commission =
      Math.round(
        totalPool *
        COMMISSION_PERCENT / 100
      );


    const prize =
      totalPool - commission;


    return {

      entry,
      totalPool,
      commission,
      prize

    };

  }


  /* =======================================================
     CREATE SUMMARY
  ======================================================= */

  function updateCreateSummary() {

    const amount =
      Number(
        entryAmountInput?.value
      ) || 0;


    const values =
      calculateBattle(amount);


    if (summaryEntry) {

      summaryEntry.textContent =
        formatAmount(values.entry);

    }


    if (summaryTotalPool) {

      summaryTotalPool.textContent =
        formatAmount(values.totalPool);

    }


    if (summaryCommission) {

      summaryCommission.textContent =
        formatAmount(values.commission);

    }


    if (summaryPrize) {

      summaryPrize.textContent =
        formatAmount(values.prize);

    }

  }


  /* =======================================================
     CREATE MODAL
  ======================================================= */

  function openCreateModal() {

    if (!createBattleModal) {
      return;
    }


    renderWallet();

    updateCreateSummary();


    createBattleModal.classList.add(
      "show"
    );


    document.body.style.overflow =
      "hidden";


    setTimeout(() => {

      entryAmountInput?.focus();

    }, 100);

  }


  function closeCreateBattleModal() {

    if (!createBattleModal) {
      return;
    }


    createBattleModal.classList.remove(
      "show"
    );


    document.body.style.overflow =
      "";

  }


  /* =======================================================
     JOIN MODAL
  ======================================================= */

  function openJoinBattleModal(roomCode) {

    const battles =
      getBattles();


    const battle =
      battles.find(
        item =>
          String(item.roomCode) ===
          String(roomCode)
      );


    if (!battle) {

      showToast(
        "This battle no longer exists.",
        "error"
      );

      renderBattles();

      return;

    }


    if (
      battle.status !== "waiting" ||
      battle.playersJoined >= TOTAL_PLAYERS
    ) {

      showToast(
        "This battle is no longer available.",
        "error"
      );

      renderBattles();

      return;

    }


    const currentBattle =
      getCurrentBattle();


    if (
      currentBattle &&
      currentBattle.status !== "completed" &&
      currentBattle.status !== "cancelled"
    ) {

      showToast(
        "You already have an active battle.",
        "error"
      );

      return;

    }


    selectedBattleToJoin =
      battle;


    if (joinRoomCode) {

      joinRoomCode.textContent =
        battle.roomCode;

    }


    if (joinEntryAmount) {

      joinEntryAmount.textContent =
        formatAmount(
          battle.entryAmount
        );

    }


    if (joinTotalPool) {

      joinTotalPool.textContent =
        formatAmount(
          battle.totalPool
        );

    }


    if (joinCommission) {

      joinCommission.textContent =
        formatAmount(
          battle.commission
        );

    }


    if (joinPrizeAmount) {

      joinPrizeAmount.textContent =
        formatAmount(
          battle.prizeAmount
        );

    }


    joinBattleModal?.classList.add(
      "show"
    );


    document.body.style.overflow =
      "hidden";

  }


  function closeJoinBattleModal() {

    joinBattleModal?.classList.remove(
      "show"
    );


    document.body.style.overflow =
      "";


    selectedBattleToJoin =
      null;

  }

/* =======================================================
   CREATE BATTLE
======================================================= */

async function createBattle() {
  const currentBattle = getCurrentBattle();

  /*
     Prevent creating another battle
     while one is already active
  */
  if (
    currentBattle &&
    ![
      "completed",
      "cancelled"
    ].includes(currentBattle.status)
  ) {
    showToast(
      "You already have an active battle.",
      "error"
    );
    return;
  }

  const entryAmount = Number(
    entryAmountInput?.value
  );

  /*
     Validate entry amount
  */
  if (
    !Number.isFinite(entryAmount) ||
    entryAmount < 10
  ) {
    showToast(
      "Minimum battle entry is 10 demo coins.",
      "error"
    );
    return;
  }

  const balance = getBalance();

  /*
     Check wallet balance
  */
  if (entryAmount > balance) {
    showToast(
      `Insufficient balance. You have ${formatAmount(
        balance
      )} demo coins.`,
      "error"
    );
    return;
  }

  /*
     Prevent double clicking
  */
  if (confirmCreateBattleBtn) {
    confirmCreateBattleBtn.disabled = true;
    confirmCreateBattleBtn.textContent =
      "Creating Battle...";
  }

  try {
    const values =
      calculateBattle(entryAmount);

    const roomCode =
      generateRoomCode();

    /*
       Create battle object
    */
    const battle = {
      id:
        `battle_${Date.now()}_${Math.floor(
          Math.random() * 10000
        )}`,

      roomCode,

      entryAmount:
        values.entry,

      totalPool:
        values.totalPool,

      commission:
        values.commission,

      prizeAmount:
        values.prize,

      winnerPrize:
        values.prize,

      players:
        TOTAL_PLAYERS,

      playersJoined:
        1,

      status:
        "waiting",

      creator:
        "You",

      opponent:
        null,

      creatorReady:
        false,

      opponentReady:
        false,

      createdAt:
        new Date().toISOString(),

      joinedAt:
        null,

      winner:
        null
    };

    /*
       ==========================================
       SAVE BATTLE TO FIREBASE
       ==========================================
    */

    await saveBattleToFirebase(
      battle
    );

    /*
       Keep local copy for current device
    */
    const battles =
      getBattles();

    battles.unshift(
      battle
    );

    saveBattles(
      battles
    );

    setCurrentBattle(
      battle
    );

    /*
       Deduct demo coins
    */
    setBalance(
      balance - entryAmount
    );

    /*
       Save transaction
    */
    addTransaction(
      "debit",
      entryAmount,
      `Created Battle #${roomCode}`
    );

    /*
       Close modal
    */
    closeCreateBattleModal();

    /*
       Update UI
    */
    renderBattles();
    renderActiveBattle();

    showToast(
      `Battle created! Room Code: ${roomCode}`,
      "success"
    );

    console.log(
      "Battle successfully saved to Firebase:",
      roomCode
    );

    /*
       Open battle room
    */
    setTimeout(() => {
      window.location.href =
        `battle-room.html?room=${encodeURIComponent(
          roomCode
        )}`;
    }, 900);

  }
  catch (error) {
    console.error(
      "Create battle Firebase error:",
      error
    );

    showToast(
      "Could not create battle. Please check your internet connection.",
      "error"
    );

    if (confirmCreateBattleBtn) {
      confirmCreateBattleBtn.disabled =
        false;

      confirmCreateBattleBtn.textContent =
        "🎮 Create Battle";
    }
  }
}

  /* =======================================================
     CONFIRM JOIN
  ======================================================= */

async function confirmJoinBattle() {

  if (!selectedBattleToJoin) {

    showToast(
      "Please select a battle first.",
      "error"
    );

    return;
  }

  if (confirmJoinBattleBtn) {

    confirmJoinBattleBtn.disabled = true;

    confirmJoinBattleBtn.textContent =
      "Joining Battle...";
  }

  try {

    const roomCode =
      selectedBattleToJoin.roomCode;

    /*
       Get latest battle directly
       from Firebase
    */

    const firebaseBattle =
      await getBattleFromFirebase(
        roomCode
      );

    if (!firebaseBattle) {

      showToast(
        "Battle no longer exists.",
        "error"
      );

      closeJoinBattleModal();

      renderBattles();

      return;
    }

    const battle =
      normalizeBattle(
        firebaseBattle
      );

    /*
       Check if battle is still available
    */

    if (
      battle.status !== "waiting" ||
      Number(battle.playersJoined) >=
        TOTAL_PLAYERS
    ) {

      showToast(
        "This battle was already joined by another player.",
        "error"
      );

      closeJoinBattleModal();

      renderBattles();

      return;
    }

    /*
       Check current player active battle
    */

    const currentBattle =
      getCurrentBattle();

    if (
      currentBattle &&
      ![
        "completed",
        "cancelled"
      ].includes(currentBattle.status)
    ) {

      showToast(
        "You already have an active battle.",
        "error"
      );

      return;
    }

    /*
       Check wallet balance
    */

    const balance =
      getBalance();

    if (
      balance <
      Number(battle.entryAmount)
    ) {

      showToast(
        `You need ${formatAmount(
          battle.entryAmount
        )} demo coins to join.`,
        "error"
      );

      return;
    }

    /*
       Create updated battle
    */

    const joinedAt =
      new Date().toISOString();

    const updatedBattle = {

      ...battle,

      playersJoined:
        TOTAL_PLAYERS,

      status:
        "joined",

      opponent:
        "Opponent",

      opponentReady:
        false,

      joinedAt

    };

    /*
       UPDATE FIREBASE
    */

    await updateBattleInFirebase(
      roomCode,
      {

        playersJoined:
          TOTAL_PLAYERS,

        status:
          "joined",

        opponent:
          "Opponent",

        opponentReady:
          false,

        joinedAt

      }
    );

    console.log(
      "Battle joined successfully:",
      roomCode
    );

    /*
       Keep local copy updated
    */

    const localBattles =
      getBattles();

    const existingIndex =
      localBattles.findIndex(
        item =>
          String(item.roomCode) ===
          String(roomCode)
      );

    if (existingIndex >= 0) {

      localBattles[existingIndex] =
        updatedBattle;

    } else {

      localBattles.unshift(
        updatedBattle
      );

    }

    saveBattles(
      localBattles
    );

    /*
       Set active battle
    */

    setCurrentBattle(
      updatedBattle
    );

    /*
       Deduct demo coins
    */

    setBalance(
      balance -
      Number(updatedBattle.entryAmount)
    );

    /*
       Save transaction
    */

    addTransaction(
      "debit",
      updatedBattle.entryAmount,
      `Joined Battle #${roomCode}`
    );

    /*
       Close modal
    */

    closeJoinBattleModal();

    renderBattles();

    renderActiveBattle();

    showToast(
      `Joined Battle #${roomCode}`,
      "success"
    );

    /*
       Open battle room
    */

    setTimeout(() => {

      window.location.href =
        `battle-room.html?room=${encodeURIComponent(
          roomCode
        )}`;

    }, 800);

  }

  catch (error) {

    console.error(
      "Firebase join battle error:",
      error
    );

    showToast(
      "Could not join the battle. Please check your internet connection.",
      "error"
    );

  }

  finally {

    if (confirmJoinBattleBtn) {

      confirmJoinBattleBtn.disabled =
        false;

      confirmJoinBattleBtn.textContent =
        "🎮 Join Battle";

    }

  }

}

  /* =======================================================
     VIEW BATTLE
  ======================================================= */

  function viewBattle(roomCode) {

    const battles =
      getBattles();


    const battle =
      battles.find(
        item =>
          String(item.roomCode) ===
          String(roomCode)
      );


    if (!battle) {

      showToast(
        "Battle not found.",
        "error"
      );

      renderBattles();

      return;

    }


    setCurrentBattle(battle);


    window.location.href =
      `battle-room.html?room=${encodeURIComponent(
        battle.roomCode
      )}`;

  }


  /*
     Make function available to dynamically
     generated buttons
  */

  window.viewBattle =
    viewBattle;

  window.openJoinBattleModal =
    openJoinBattleModal;


  /* =======================================================
     RENDER AVAILABLE BATTLES
  ======================================================= */

  function renderBattles() {

  const sourceBattles =
    firebaseBattlesLoaded
      ? firebaseBattles
      : getBattles();

  const battles =
    sourceBattles.filter(
      battle =>
        battle.status === "waiting" &&
        Number(battle.playersJoined) <
        TOTAL_PLAYERS
    );


    if (availableBattleCount) {

      availableBattleCount.textContent =
        String(battles.length);

    }


    if (!battleList) {
      return;
    }


    battleList.innerHTML =
      "";


    if (battles.length === 0) {

      emptyState?.classList.remove(
        "hidden"
      );

      return;

    }


    emptyState?.classList.add(
      "hidden"
    );


    battles.forEach(battle => {

      const card =
        document.createElement("div");


      card.className =
        "battle-card";


      card.innerHTML = `

        <div class="battle-room">

          <div class="room-icon">
            🎮
          </div>

          <div class="room-details">

            <span>
              WAITING FOR OPPONENT
            </span>

            <strong>
              Battle #${escapeHTML(
                battle.roomCode
              )}
            </strong>

          </div>

        </div>


        <div class="battle-value">

          <span>
            Entry Per Player
          </span>

          <strong>
            🪙 ${formatAmount(
              battle.entryAmount
            )}
          </strong>

        </div>


        <div class="battle-value prize">

          <span>
            Winner Prize
          </span>

          <strong>
            🏆 ${formatAmount(
              battle.prizeAmount
            )}
          </strong>

        </div>


        <button
          class="primary-button"
          type="button"
        >
          Join Battle
        </button>

      `;


      const joinButton =
        card.querySelector("button");


      joinButton.addEventListener(
        "click",
        () => {

          openJoinBattleModal(
            battle.roomCode
          );

        }
      );


      battleList.appendChild(
        card
      );

    });

  }


  /* =======================================================
     RENDER ACTIVE BATTLE
  ======================================================= */

  function renderActiveBattle() {

    if (!activeBattleContainer) {
      return;
    }


    const battle =
      getCurrentBattle();


    activeBattleContainer.innerHTML =
      "";


    if (
      !battle ||
      [
        "completed",
        "cancelled"
      ].includes(battle.status)
    ) {

      activeBattleContainer.innerHTML = `

        <div class="no-active-battle">

          <div class="empty-icon">
            🎯
          </div>

          <h3>
            No Active Battle
          </h3>

          <p>
            Create or join a battle to start playing.
          </p>

        </div>

      `;

      return;

    }


    const statusText = {

      waiting:
        "Waiting for Opponent",

      joined:
        "Opponent Joined",

      ready:
        "Players Ready",

      playing:
        "Game In Progress"

    };


    activeBattleContainer.innerHTML = `

      <div class="battle-card active-battle-card">

        <div class="battle-room">

          <div class="room-icon">
            🎯
          </div>

          <div class="room-details">

            <span>
              ACTIVE BATTLE
            </span>

            <strong>
              Battle #${escapeHTML(
                battle.roomCode
              )}
            </strong>

          </div>

        </div>


        <div class="battle-value">

          <span>
            Status
          </span>

          <strong>
            ${statusText[battle.status] ||
              escapeHTML(battle.status)}
          </strong>

        </div>


        <div class="battle-value prize">

          <span>
            Winner Prize
          </span>

          <strong>
            🏆 ${formatAmount(
              battle.prizeAmount
            )}
          </strong>

        </div>


        <button
          class="primary-button"
          id="activeViewBattleBtn"
          type="button"
        >
          🎮 View Battle
        </button>

      </div>

    `;


    const viewButton =
      $("activeViewBattleBtn");


    viewButton?.addEventListener(
      "click",
      () => {

        viewBattle(
          battle.roomCode
        );

      }
    );

  }


  /* =======================================================
     REFRESH
  ======================================================= */

  function refreshBattles() {

    refreshBattlesBtn?.classList.add(
      "refreshing"
    );


    renderWallet();

    renderBattles();

    renderActiveBattle();


    setTimeout(() => {

      refreshBattlesBtn?.classList.remove(
        "refreshing"
      );

    }, 500);


    showToast(
      "Battle lobby refreshed.",
      "success"
    );

  }


  /* =======================================================
     PROFILE MODAL
  ======================================================= */

  function createProfileModal() {

    if ($("profileModal")) {
      return;
    }


    const modal =
      document.createElement("div");


    modal.id =
      "profileModal";


    modal.className =
      "modal-overlay";


    modal.innerHTML = `

      <div class="battle-modal small-modal">

        <div class="modal-header">

          <div>

            <span class="section-tag purple">
              PLAYER PROFILE
            </span>

            <h2>
              LUDOVERSE Profile
            </h2>

          </div>


          <button
            class="close-modal"
            id="closeProfileModal"
            type="button"
          >
            ×
          </button>

        </div>


        <div class="join-summary">

          <div class="join-info-row">

            <span>
              Player
            </span>

            <strong>
              Demo Player
            </strong>

          </div>


          <div class="join-info-row">

            <span>
              Demo Coin Balance
            </span>

            <strong id="profileBalance">
              0
            </strong>

          </div>


          <div class="join-info-row">

            <span>
              Total Battles
            </span>

            <strong id="profileBattles">
              0
            </strong>

          </div>


          <div class="join-info-row">

            <span>
              Active Battle
            </span>

            <strong id="profileActiveBattle">
              None
            </strong>

          </div>

        </div>


        <button
          class="secondary-button full-button"
          id="profileCloseButton"
          type="button"
        >
          Close Profile
        </button>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    const close =
      () => {

        modal.classList.remove(
          "show"
        );

        document.body.style.overflow =
          "";

      };


    $("closeProfileModal")
      ?.addEventListener(
        "click",
        close
      );


    $("profileCloseButton")
      ?.addEventListener(
        "click",
        close
      );


    modal.addEventListener(
      "click",
      event => {

        if (event.target === modal) {
          close();
        }

      }
    );

  }


  function openProfile() {

    createProfileModal();


    const modal =
      $("profileModal");


    const balance =
      getBalance();


    const battles =
      getBattles();


    const activeBattle =
      getCurrentBattle();


    $("profileBalance").textContent =
      `🪙 ${formatAmount(balance)}`;


    $("profileBattles").textContent =
      String(battles.length);


    $("profileActiveBattle").textContent =
      activeBattle
        ? `#${activeBattle.roomCode}`
        : "None";


    modal?.classList.add(
      "show"
    );


    document.body.style.overflow =
      "hidden";

  }


  /* =======================================================
     BUTTON EVENTS
  ======================================================= */


  /* CREATE */

  createBattleBtn?.addEventListener(
    "click",
    openCreateModal
  );


  emptyCreateBattleBtn?.addEventListener(
    "click",
    openCreateModal
  );


  closeCreateModal?.addEventListener(
    "click",
    closeCreateBattleModal
  );


  confirmCreateBattleBtn?.addEventListener(
    "click",
    createBattle
  );


  /* REFRESH */

  refreshBattlesBtn?.addEventListener(
    "click",
    refreshBattles
  );


  /* PROFILE */

  profileBtn?.addEventListener(
    "click",
    openProfile
  );


  /* JOIN */

  closeJoinModal?.addEventListener(
    "click",
    closeJoinBattleModal
  );


  confirmJoinBattleBtn?.addEventListener(
    "click",
    confirmJoinBattle
  );


  /* QUICK AMOUNTS */

  amountOptions.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const amount =
          Number(
            button.dataset.amount
          );


        if (
          entryAmountInput &&
          Number.isFinite(amount)
        ) {

          entryAmountInput.value =
            amount;

        }


        amountOptions.forEach(item => {

          item.classList.remove(
            "active-amount"
          );

        });


        button.classList.add(
          "active-amount"
        );


        updateCreateSummary();

      }
    );

  });


  /* INPUT */

  entryAmountInput?.addEventListener(
    "input",
    () => {

      amountOptions.forEach(item => {

        item.classList.remove(
          "active-amount"
        );

      });


      updateCreateSummary();

    }
  );


  /* CLICK OUTSIDE CREATE MODAL */

  createBattleModal?.addEventListener(
    "click",
    event => {

      if (
        event.target === createBattleModal
      ) {

        closeCreateBattleModal();

      }

    }
  );


  /* CLICK OUTSIDE JOIN MODAL */

  joinBattleModal?.addEventListener(
    "click",
    event => {

      if (
        event.target === joinBattleModal
      ) {

        closeJoinBattleModal();

      }

    }
  );


  /* ESCAPE */

  document.addEventListener(
    "keydown",
    event => {

      if (event.key === "Escape") {

        closeCreateBattleModal();

        closeJoinBattleModal();


        const profileModal =
          $("profileModal");


        if (
          profileModal &&
          profileModal.classList.contains(
            "show"
          )
        ) {

          profileModal.classList.remove(
            "show"
          );

          document.body.style.overflow =
            "";

        }

      }

    }
  );


  /* =======================================================
     STORAGE SYNC
  ======================================================= */

  window.addEventListener(
    "storage",
    () => {

      renderWallet();

      renderBattles();

      renderActiveBattle();

    }
  );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  /*
     Clean old/broken battle data
  */

  getBattles();


  /*
     Render application
  */

  renderWallet();

  updateCreateSummary();

  renderBattles();

  renderActiveBattle();

/*
=======================================================
START FIREBASE LIVE BATTLE LISTENER
=======================================================
*/

listenToFirebaseBattles((battles) => {

  firebaseBattles =
    battles
      .map(normalizeBattle)
      .filter(Boolean);

  firebaseBattlesLoaded = true;

  console.log(
    "Firebase battles loaded:",
    firebaseBattles.length
  );

  renderBattles();
});

  /*
     If a room is provided in URL,
     make sure current battle is correct
  */

  const roomFromURL =
    getQueryRoomCode();


  if (roomFromURL) {

    const battle =
      getBattles().find(
        item =>
          String(item.roomCode) ===
          String(roomFromURL)
      );


    if (battle) {

      setCurrentBattle(battle);

    }

  }


  console.log(
    "🎲 LUDOVERSE Battle Lobby Ready"
  );

});