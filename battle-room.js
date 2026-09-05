"use strict";

/* =========================================================
   LUDOVERSE — BATTLE ROOM
   COMPLETE DEMO VERSION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  const $ = (id) =>
    document.getElementById(id);


  /* =======================================================
     DOM
  ======================================================= */

  const walletBalance =
    $("walletBalance");

  const roomCodeElement =
    $("roomCode");

  const copyRoomCodeBtn =
    $("copyRoomCodeBtn");

  const backToLobbyBtn =
    $("backToLobbyBtn");

  const profileBtn =
    $("profileBtn");


  const battleStatus =
    $("battleStatus");

  const battleStatusDescription =
    $("battleStatusDescription");

  const statusIcon =
    $("statusIcon");


  const playersJoined =
    $("playersJoined");

  const totalPlayers =
    $("totalPlayers");


  const playerOneName =
    $("playerOneName");

  const playerTwoName =
    $("playerTwoName");

  const playerTwoDescription =
    $("playerTwoDescription");

  const playerTwoAvatar =
    $("playerTwoAvatar");


  const playerOneStatus =
    $("playerOneStatus");

  const playerTwoStatus =
    $("playerTwoStatus");


  const playerOneEntry =
    $("playerOneEntry");

  const playerTwoEntry =
    $("playerTwoEntry");


  const readyBtn =
    $("readyBtn");

  const readyMessage =
    $("readyMessage");

  const startGameBtn =
    $("startGameBtn");

  const cancelBattleBtn =
    $("cancelBattleBtn");


  const entryAmount =
    $("entryAmount");

  const summaryPlayers =
    $("summaryPlayers");

  const totalPool =
    $("totalPool");

  const commissionAmount =
    $("commissionAmount");

  const winnerPrize =
    $("winnerPrize");


  const cancelModal =
    $("cancelModal");

  const cancelModalMessage =
    $("cancelModalMessage");

  const closeCancelModalBtn =
    $("closeCancelModalBtn");

  const confirmCancelBattleBtn =
    $("confirmCancelBattleBtn");


  const toast =
    $("toast");

  const toastMessage =
    $("toastMessage");

  const toastIcon =
    $("toastIcon");


  /* TIMELINE */

  const timelineCreated =
    $("timelineCreated");

  const timelineJoined =
    $("timelineJoined");

  const timelineReady =
    $("timelineReady");

  const timelinePlaying =
    $("timelinePlaying");

  const timelineWinner =
    $("timelineWinner");


  /* =======================================================
     STATE
  ======================================================= */

  let currentBattle = null;


  /* =======================================================
     FORMAT
  ======================================================= */

  function formatAmount(value) {

    return Number(value || 0)
      .toLocaleString("en-IN");

  }


  /* =======================================================
     WALLET
  ======================================================= */

  function getBalance() {

    return Number(
      localStorage.getItem(
        "ludoverseBalance"
      )
    ) || 0;

  }


  function setBalance(value) {

    localStorage.setItem(
      "ludoverseBalance",
      String(
        Math.max(
          0,
          Number(value) || 0
        )
      )
    );


    renderWallet();

  }


  function renderWallet() {

    if (walletBalance) {

      walletBalance.textContent =
        formatAmount(
          getBalance()
        );

    }

  }


  /* =======================================================
     STORAGE
  ======================================================= */

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

    }

    catch (error) {

      return [];

    }

  }


  function saveBattles(battles) {

    localStorage.setItem(
      "ludoverseBattles",
      JSON.stringify(battles)
    );

  }


  function getCurrentBattle() {

    try {

      return JSON.parse(
        localStorage.getItem(
          "ludoverseCurrentBattle"
        )
      ) || null;

    }

    catch (error) {

      return null;

    }

  }


  function saveCurrentBattle(battle) {

    currentBattle = battle;


    localStorage.setItem(
      "ludoverseCurrentBattle",
      JSON.stringify(battle)
    );

  }


  /* =======================================================
     TOAST
  ======================================================= */

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
      "warning",
      "show"
    );


    toast.classList.add(type);


    if (toastIcon) {

      if (type === "success") {

        toastIcon.textContent = "✓";

      }

      else if (type === "error") {

        toastIcon.textContent = "✕";

      }

      else {

        toastIcon.textContent = "!";

      }

    }


    requestAnimationFrame(() => {

      toast.classList.add("show");

    });


    clearTimeout(
      window.ludoverseRoomToastTimer
    );


    window.ludoverseRoomToastTimer =
      setTimeout(() => {

        toast.classList.remove("show");

      }, 3000);

  }


  /* =======================================================
     GET ROOM CODE FROM URL
  ======================================================= */

  function getRequestedRoomCode() {

    const params =
      new URLSearchParams(
        window.location.search
      );


    return params.get("room");

  }


  /* =======================================================
     LOAD CORRECT BATTLE
  ======================================================= */

  function loadBattle() {

    const requestedRoomCode =
      getRequestedRoomCode();


    const battles =
      getBattles();


    let battle = null;


    /* URL ROOM */

    if (requestedRoomCode) {

      battle =
        battles.find(
          item =>
            String(item.roomCode) ===
            String(requestedRoomCode)
        ) || null;

    }


    /* FALLBACK */

    if (!battle) {

      const savedBattle =
        getCurrentBattle();


      if (savedBattle) {

        battle =
          battles.find(
            item =>
              String(item.roomCode) ===
              String(savedBattle.roomCode)
          ) || savedBattle;

      }

    }


    if (!battle) {

      currentBattle = null;

      showNoBattle();

      return;

    }


    saveCurrentBattle(battle);

    renderBattle();

  }


  /* =======================================================
     NO BATTLE
  ======================================================= */

  function showNoBattle() {

    if (roomCodeElement) {

      roomCodeElement.textContent =
        "------";

    }


    if (battleStatus) {

      battleStatus.textContent =
        "No Active Battle";

    }


    if (battleStatusDescription) {

      battleStatusDescription.textContent =
        "Please create or join a battle first.";

    }


    if (readyBtn) {

      readyBtn.disabled = true;

      readyBtn.textContent =
        "No Active Battle";

    }


    if (startGameBtn) {

      startGameBtn.disabled = true;

    }

  }


  /* =======================================================
     UPDATE STORAGE
  ======================================================= */

  function updateBattleInStorage() {

    if (!currentBattle) return;


    const battles =
      getBattles();


    const index =
      battles.findIndex(
        battle =>
          String(battle.roomCode) ===
          String(currentBattle.roomCode)
      );


    if (index !== -1) {

      battles[index] = {

        ...battles[index],

        ...currentBattle

      };


      saveBattles(battles);

    }


    saveCurrentBattle(
      currentBattle
    );

  }


  /* =======================================================
     RENDER BATTLE
  ======================================================= */

  function renderBattle() {

    if (!currentBattle) {

      showNoBattle();

      return;

    }


    const entry =
      Number(
        currentBattle.entryAmount
      ) || 0;


    const pool =
      Number(
        currentBattle.totalPool
      ) || entry * 2;


    const commission =
      Number(
        currentBattle.commission
      ) || Math.round(pool * 0.10);


    const prize =
      Number(
        currentBattle.prizeAmount
      ) ||
      pool - commission;


    const joined =
      Number(
        currentBattle.playersJoined
      ) || 1;


    /* ROOM CODE */

    if (roomCodeElement) {

      roomCodeElement.textContent =
        currentBattle.roomCode ||
        "------";

    }


    /* PLAYERS */

    if (playersJoined) {

      playersJoined.textContent =
        joined;

    }


    if (totalPlayers) {

      totalPlayers.textContent = "2";

    }


    if (summaryPlayers) {

      summaryPlayers.textContent = "2";

    }


    /* PLAYER ONE */

    if (playerOneName) {

      playerOneName.textContent =
        currentBattle.creator ||
        "You";

    }


    if (playerOneEntry) {

      playerOneEntry.textContent =
        formatAmount(entry);

    }


    /* PLAYER TWO */

    if (playerTwoEntry) {

      playerTwoEntry.textContent =
        formatAmount(entry);

    }


    /* MONEY */

    if (entryAmount) {

      entryAmount.textContent =
        formatAmount(entry);

    }


    if (totalPool) {

      totalPool.textContent =
        formatAmount(pool);

    }


    if (commissionAmount) {

      commissionAmount.textContent =
        formatAmount(commission);

    }


    if (winnerPrize) {

      winnerPrize.textContent =
        formatAmount(prize);

    }


    /* OPPONENT */

    if (joined >= 2) {

      if (playerTwoName) {

        playerTwoName.textContent =
          currentBattle.opponent ||
          "Opponent";

      }


      if (playerTwoDescription) {

        playerTwoDescription.textContent =
          "Battle opponent joined";

      }


      if (playerTwoAvatar) {

        playerTwoAvatar.textContent =
          "👤";

      }


      if (playerTwoStatus) {

        playerTwoStatus.textContent =
          currentBattle.opponentReady
            ? "READY"
            : "JOINED";

      }

    }

    else {

      if (playerTwoName) {

        playerTwoName.textContent =
          "Waiting...";

      }


      if (playerTwoDescription) {

        playerTwoDescription.textContent =
          "Waiting for opponent";

      }


      if (playerTwoAvatar) {

        playerTwoAvatar.textContent =
          "?";

      }


      if (playerTwoStatus) {

        playerTwoStatus.textContent =
          "WAITING";

      }

    }


    /* CREATOR STATUS */

    if (playerOneStatus) {

      playerOneStatus.textContent =
        currentBattle.creatorReady
          ? "READY"
          : "WAITING";

    }


    updateStatus();

    updateReadyButton();

    updateStartButton();

    updateTimeline();

  }


  /* =======================================================
     STATUS
  ======================================================= */

  function updateStatus() {

    if (!currentBattle) return;


    const status =
      currentBattle.status;


    const joined =
      Number(
        currentBattle.playersJoined
      ) || 1;


    let title =
      "Waiting for Opponent";

    let description =
      "Waiting for another player to join this battle.";

    let icon =
      "⏳";


    if (
      joined >= 2 &&
      status !== "playing"
    ) {

      title =
        "Opponent Joined";

      description =
        "Both players can now confirm readiness.";

      icon =
        "🤝";

    }


    if (status === "ready") {

      title =
        "Players Ready";

      description =
        "Both players are ready. Start the match.";

      icon =
        "🎯";

    }


    if (status === "playing") {

      title =
        "Match In Progress";

      description =
        "The Ludo battle is currently in progress.";

      icon =
        "🎲";

    }


    if (status === "completed") {

      title =
        "Match Completed";

      description =
        "The winner has been declared.";

      icon =
        "🏆";

    }


    if (battleStatus) {

      battleStatus.textContent =
        title;

    }


    if (battleStatusDescription) {

      battleStatusDescription.textContent =
        description;

    }


    if (statusIcon) {

      statusIcon.textContent =
        icon;

    }

  }


  /* =======================================================
     READY BUTTON
  ======================================================= */

  function updateReadyButton() {

    if (!readyBtn || !currentBattle) {

      return;

    }


    const joined =
      Number(
        currentBattle.playersJoined
      ) || 1;


    if (joined < 2) {

      readyBtn.disabled = true;

      readyBtn.innerHTML =
        "⏳ Waiting for Opponent";


      if (readyMessage) {

        readyMessage.textContent =
          "Another player must join before you can get ready.";

      }


      return;

    }


    if (
      currentBattle.status ===
      "playing"
    ) {

      readyBtn.disabled = true;

      readyBtn.innerHTML =
        "🎲 Match Started";

      return;

    }


    readyBtn.disabled = false;


    if (currentBattle.creatorReady) {

      readyBtn.innerHTML =
        "✓ You Are Ready";


      readyBtn.classList.add(
        "ready-active"
      );


      if (readyMessage) {

        readyMessage.textContent =
          currentBattle.opponentReady
            ? "Both players are ready."
            : "Waiting for your opponent.";

      }

    }

    else {

      readyBtn.innerHTML =
        "✓ I'm Ready";


      readyBtn.classList.remove(
        "ready-active"
      );


      if (readyMessage) {

        readyMessage.textContent =
          "Confirm that you are ready to play.";

      }

    }

  }


  /* =======================================================
     MARK READY
  ======================================================= */

  function markPlayerReady() {

    if (!currentBattle) {

      showToast(
        "No active battle found.",
        "error"
      );

      return;

    }


    if (
      Number(
        currentBattle.playersJoined
      ) < 2
    ) {

      showToast(
        "Please wait for an opponent to join.",
        "warning"
      );

      return;

    }


    if (currentBattle.creatorReady) {

      showToast(
        "You are already ready.",
        "success"
      );

      return;

    }


    currentBattle.creatorReady = true;

    currentBattle.readyAt =
      new Date().toISOString();


    /*
      DEMO TEST MODE

      Real multiplayer backend अभी नहीं है,
      इसलिए testing के लिए opponent automatically
      ready किया जा रहा है।
    */

    currentBattle.opponentReady = true;

    currentBattle.status = "ready";


    updateBattleInStorage();


    renderBattle();


    showToast(
      "Both players are ready! You can start the match.",
      "success"
    );

  }


  /* =======================================================
     START BUTTON
  ======================================================= */

  function updateStartButton() {

    if (
      !startGameBtn ||
      !currentBattle
    ) {

      return;

    }


    const bothReady =
      currentBattle.creatorReady === true &&
      currentBattle.opponentReady === true;


    startGameBtn.disabled =
      !bothReady;


    const smallText =
      startGameBtn.querySelector("small");


    if (
      bothReady &&
      smallText
    ) {

      smallText.textContent =
        "Both players are ready";

    }

  }


  /* =======================================================
     START GAME
  ======================================================= */

  function startGame() {

    if (!currentBattle) {

      showToast(
        "No active battle found.",
        "error"
      );

      return;

    }


    const bothReady =
      currentBattle.creatorReady === true &&
      currentBattle.opponentReady === true;


    if (!bothReady) {

      showToast(
        "Both players must be ready first.",
        "error"
      );

      return;

    }


    currentBattle.status =
      "playing";


    currentBattle.startedAt =
      new Date().toISOString();


    updateBattleInStorage();


    renderBattle();


    showToast(
      "Battle started successfully!",
      "success"
    );


    setTimeout(() => {

      window.location.href =
        `game.html?room=${encodeURIComponent(currentBattle.roomCode)}`;

    }, 700);

  }


  /* =======================================================
     COPY ROOM CODE
  ======================================================= */

  function copyRoomCode() {

    if (
      !currentBattle ||
      !currentBattle.roomCode
    ) {

      showToast(
        "No room code available.",
        "error"
      );

      return;

    }


    const code =
      String(
        currentBattle.roomCode
      );


    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {

      navigator.clipboard
        .writeText(code)
        .then(() => {

          showToast(
            "Room code copied successfully!",
            "success"
          );

        })
        .catch(() => {

          fallbackCopy(code);

        });

    }

    else {

      fallbackCopy(code);

    }

  }


  function fallbackCopy(text) {

    const textarea =
      document.createElement("textarea");


    textarea.value = text;


    document.body.appendChild(textarea);


    textarea.select();


    document.execCommand("copy");


    textarea.remove();


    showToast(
      "Room code copied successfully!",
      "success"
    );

  }


  /* =======================================================
     CANCEL MODAL
  ======================================================= */

  function openCancelModal() {

    if (!currentBattle) {

      showToast(
        "No active battle found.",
        "error"
      );

      return;

    }


    if (cancelModalMessage) {

      if (
        Number(
          currentBattle.playersJoined
        ) < 2
      ) {

        cancelModalMessage.textContent =
          "Your opponent has not joined yet. Your demo entry will be refunded.";

      }

      else {

        cancelModalMessage.textContent =
          "Are you sure you want to cancel this demo battle?";

      }

    }


    cancelModal?.classList.add(
      "active"
    );

  }


  function closeCancelModal() {

    cancelModal?.classList.remove(
      "active"
    );

  }


  /* =======================================================
     CANCEL BATTLE
  ======================================================= */

  function cancelBattle() {

    if (!currentBattle) return;


    const joined =
      Number(
        currentBattle.playersJoined
      ) || 1;


    const entry =
      Number(
        currentBattle.entryAmount
      ) || 0;


    /* REFUND ONLY IF NO OPPONENT */

    if (joined < 2) {

      setBalance(
        getBalance() + entry
      );


      addTransaction(
        "credit",
        entry,
        `Battle #${currentBattle.roomCode} cancelled - refund`
      );

    }


    currentBattle.status =
      "cancelled";


    currentBattle.cancelledAt =
      new Date().toISOString();


    updateBattleInStorage();


    localStorage.removeItem(
      "ludoverseCurrentBattle"
    );


    closeCancelModal();


    showToast(
      "Battle cancelled successfully.",
      "success"
    );


    setTimeout(() => {

      window.location.href =
        "battle-lobby.html";

    }, 600);

  }


  /* =======================================================
     TIMELINE
  ======================================================= */

  function updateTimeline() {

    const timelineItems = [

      timelineCreated,
      timelineJoined,
      timelineReady,
      timelinePlaying,
      timelineWinner

    ];


    timelineItems.forEach(item => {

      item?.classList.remove(
        "completed"
      );

    });


    if (!currentBattle) return;


    timelineCreated?.classList.add(
      "completed"
    );


    if (
      Number(
        currentBattle.playersJoined
      ) >= 2
    ) {

      timelineJoined?.classList.add(
        "completed"
      );

    }


    if (
      currentBattle.creatorReady &&
      currentBattle.opponentReady
    ) {

      timelineReady?.classList.add(
        "completed"
      );

    }


    if (
      currentBattle.status === "playing" ||
      currentBattle.status === "completed"
    ) {

      timelinePlaying?.classList.add(
        "completed"
      );

    }


    if (
      currentBattle.status === "completed"
    ) {

      timelineWinner?.classList.add(
        "completed"
      );

    }

  }


  /* =======================================================
     REFRESH DATA
  ======================================================= */

  function refreshBattleData() {

    if (!currentBattle) return;


    const battles =
      getBattles();


    const updatedBattle =
      battles.find(
        battle =>
          String(battle.roomCode) ===
          String(currentBattle.roomCode)
      );


    if (updatedBattle) {

      currentBattle =
        updatedBattle;


      saveCurrentBattle(
        updatedBattle
      );


      renderBattle();

    }

  }


  /* =======================================================
     EVENTS
  ======================================================= */

  backToLobbyBtn?.addEventListener(
    "click",
    () => {

      window.location.href =
        "battle-lobby.html";

    }
  );


  copyRoomCodeBtn?.addEventListener(
    "click",
    copyRoomCode
  );


  readyBtn?.addEventListener(
    "click",
    markPlayerReady
  );


  startGameBtn?.addEventListener(
    "click",
    startGame
  );


  cancelBattleBtn?.addEventListener(
    "click",
    openCancelModal
  );


  closeCancelModalBtn?.addEventListener(
    "click",
    closeCancelModal
  );


  confirmCancelBattleBtn?.addEventListener(
    "click",
    cancelBattle
  );


  cancelModal?.addEventListener(
    "click",
    event => {

      if (
        event.target === cancelModal
      ) {

        closeCancelModal();

      }

    }
  );


  /* PROFILE */

  profileBtn?.addEventListener(
    "click",
    () => {

      alert(

        `LUDOVERSE Profile

Demo Balance: ${formatAmount(getBalance())} coins
Current Room: ${currentBattle?.roomCode || "None"}`

      );

    }
  );


  /* STORAGE SYNC */

  window.addEventListener(
    "storage",
    () => {

      renderWallet();

      loadBattle();

    }
  );


  /* =======================================================
     INITIALIZE
  ======================================================= */

  renderWallet();

  loadBattle();


  setInterval(
    refreshBattleData,
    2000
  );


  console.log(
    "🎲 LUDOVERSE Battle Room Ready"
  );

});