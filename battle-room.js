/* =========================================================
   LUDOVERSE — MULTIPLAYER BATTLE ROOM
   ---------------------------------------------------------
   Firebase Realtime Database is the source of truth.

   This page intentionally does NOT use localStorage for
   player state, readiness, opponent state, or match status.
   localStorage is used only to remember the last room code
   for convenient navigation.

   FREE PLAY:
   • LudoCoins = progression points
   • No entry fees
   • No prize pools
   • No withdrawals
   • No cash payouts
   ========================================================= */

"use strict";

import {
  auth,
  database,
  ref,
  get,
  update,
  remove,
  onValue,
  runTransaction,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  /* =======================================================
     DOM HELPER
     ======================================================= */

  const $ = (id) => document.getElementById(id);

  const walletBalance = $("walletBalance");

  const profileBtn = $("profileBtn");
  const profileMenu = $("profileMenu");
  const profileAvatar = $("profileAvatar");
  const menuAvatar = $("menuAvatar");
  const headerName = $("headerName");
  const headerEmail = $("headerEmail");
  const logoutBtn = $("logoutBtn");

  const backToLobbyBtn = $("backToLobbyBtn");
  const copyRoomCodeBtn = $("copyRoomCodeBtn");
  const shareRoomBtn = $("shareRoomBtn");

  const roomCodeElement = $("roomCode");
  const roomMode = $("roomMode");
  const battleStatus = $("battleStatus");
  const battleStatusDescription = $("battleStatusDescription");
  const statusIcon = $("statusIcon");

  const playersJoined = $("playersJoined");
  const totalPlayers = $("totalPlayers");
  const connectionLabel = $("connectionLabel");

  const playerOneName = $("playerOneName");
  const playerOneAvatar = $("playerOneAvatar");
  const playerOneDescription = $("playerOneDescription");
  const playerOneStatus = $("playerOneStatus");
  const playerOneConnection = $("playerOneConnection");

  const playerTwoName = $("playerTwoName");
  const playerTwoAvatar = $("playerTwoAvatar");
  const playerTwoDescription = $("playerTwoDescription");
  const playerTwoStatus = $("playerTwoStatus");
  const playerTwoConnection = $("playerTwoConnection");

  const readyBtn = $("readyBtn");
  const readyButtonText = $("readyButtonText");
  const readyMessage = $("readyMessage");

  const startGameBtn = $("startGameBtn");
  const startGameSubtext = $("startGameSubtext");

  const cancelBattleBtn = $("cancelBattleBtn");

  const summaryPlayers = $("summaryPlayers");
  const summaryMode = $("summaryMode");
  const summaryEntryMode = $("summaryEntryMode");
  const summaryCoinAmount = $("summaryCoinAmount");
  const summaryStatus = $("summaryStatus");
  const summaryRoom = $("summaryRoom");
  const progressFill = $("progressFill");

  const timelineCreated = $("timelineCreated");
  const timelineJoined = $("timelineJoined");
  const timelineReady = $("timelineReady");
  const timelinePlaying = $("timelinePlaying");
  const timelineWinner = $("timelineWinner");

  const activityList = $("activityList");
  const activityEmpty = $("activityEmpty");

  const leaveModal = $("leaveModal");
  const closeLeaveModalBtn = $("closeLeaveModalBtn");
  const confirmLeaveBtn = $("confirmLeaveBtn");
  const cancelLeaveBtn = $("cancelLeaveBtn");
  const leaveRoomCode = $("leaveRoomCode");
  const leaveModalTitle = $("leaveModalTitle");
  const cancelBattleLabel = $("cancelBattleLabel");

  const toast = $("toast");
  const toastIcon = $("toastIcon");
  const toastTitle = $("toastTitle");
  const toastMessage = $("toastMessage");

  /* =======================================================
     CONSTANTS
     ======================================================= */

  const ROOMS_PATH = "battles";
  const MAX_PLAYERS = 2;
  const CURRENT_ROOM_KEY = "ludoverseCurrentRoom";

  /* =======================================================
     STATE
     ======================================================= */

  let currentUser = null;
  let currentBattle = null;
  let roomUnsubscribe = null;
  let economyUnsubscribe = null;

  let profileOpen = false;
  let busy = false;
  let redirectingToGame = false;

  let lastRenderedActivityKey = "";

  /* =======================================================
     URL / ROOM CODE
     ======================================================= */

  function getRoomCodeFromURL() {
    const params = new URLSearchParams(window.location.search);

    return String(params.get("room") || "")
      .replace(/\D/g, "")
      .slice(0, 6);
  }

  const roomCode = getRoomCodeFromURL();

  if (!/^\d{6}$/.test(roomCode)) {
    renderNoRoom();
    return;
  }

  /* =======================================================
     FIREBASE REFERENCES
     ======================================================= */

  function getRoomRef() {
    return ref(database, `${ROOMS_PATH}/${roomCode}`);
  }

  function getEconomyRef(uid) {
    return ref(database, `users/${uid}/economy`);
  }

  /* =======================================================
     HELPERS
     ======================================================= */

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getPlayerName(user) {
    if (!user) return "LUDOVERSE Player";

    return (
      user.displayName ||
      user.email?.split("@")[0] ||
      user.phoneNumber ||
      "LUDOVERSE Player"
    );
  }

  function getInitials(name) {
    const initials = String(name || "Player")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();

    return initials || "P";
  }

  function normalizePlayer(uid, data) {
    const source =
      data && typeof data === "object"
        ? data
        : {};

    return {
      uid: String(source.uid || uid || ""),
      name: String(source.name || "LUDOVERSE Player"),
      photo: String(source.photo || ""),
      joinedAt: safeNumber(source.joinedAt),
      ready: source.ready === true,
      connected: source.connected !== false
    };
  }

  function normalizeRoom(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    const playersSource =
      data.players && typeof data.players === "object"
        ? data.players
        : {};

    const players = {};

    Object.entries(playersSource).forEach(([uid, player]) => {
      players[uid] = normalizePlayer(uid, player);
    });

    return {
      roomCode: String(data.roomCode || roomCode),
      battleId: String(data.battleId || data.roomCode || roomCode),
      game: String(data.game || "ludo"),
      mode: String(data.mode || "private"),
      creatorUid: String(data.creatorUid || ""),
      creatorName: String(data.creatorName || "LUDOVERSE Player"),
      creatorPhoto: String(data.creatorPhoto || ""),
      players,
      playerCount: Object.keys(players).length,
      maxPlayers: Math.max(
        MAX_PLAYERS,
        safeNumber(data.maxPlayers, MAX_PLAYERS)
      ),
      status: String(data.status || "waiting"),
      createdAt: safeNumber(data.createdAt),
      updatedAt: safeNumber(data.updatedAt),
      startedAt: safeNumber(data.startedAt),
      completedAt: safeNumber(data.completedAt),
      entryMode: String(data.entryMode || "free"),
      coinAmount: Math.max(0, safeNumber(data.coinAmount)),
      expiresAt: safeNumber(data.expiresAt),
      coinReservation: data.coinReservation && typeof data.coinReservation === "object" ? data.coinReservation : { amount: 0, status: "none" },
      winnerUid: String(data.winnerUid || ""),
      winnerName: String(data.winnerName || "")
    };
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function saveCurrentRoom() {
    localStorage.setItem(CURRENT_ROOM_KEY, roomCode);
  }

  function clearSavedRoom() {
    const saved = localStorage.getItem(CURRENT_ROOM_KEY);

    if (saved === roomCode) {
      localStorage.removeItem(CURRENT_ROOM_KEY);
    }
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(
    message,
    title = "LUDOVERSE",
    type = "success"
  ) {
    if (!toast || !toastMessage) {
      window.alert(message);
      return;
    }

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    toast.classList.remove(
      "success",
      "error",
      "info",
      "show"
    );

    toast.classList.add(type);

    if (toastIcon) {
      toastIcon.textContent =
        type === "error"
          ? "!"
          : type === "info"
            ? "i"
            : "✓";
    }

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  /* =======================================================
     PROFILE
     ======================================================= */

  function renderProfile(user) {
    const name = getPlayerName(user);
    const initials = getInitials(name);

    if (headerName) {
      headerName.textContent = name;
    }

    if (headerEmail) {
      headerEmail.textContent =
        user.email ||
        user.phoneNumber ||
        "Authenticated player";
    }

    if (profileAvatar) {
      profileAvatar.textContent = initials;
    }

    if (menuAvatar) {
      menuAvatar.textContent = initials;
    }
  }

  function toggleProfileMenu() {
    if (!profileMenu || !profileBtn) return;

    profileOpen = !profileOpen;

    profileMenu.classList.toggle(
      "show",
      profileOpen
    );

    profileBtn.classList.toggle(
      "open",
      profileOpen
    );

    profileBtn.setAttribute(
      "aria-expanded",
      String(profileOpen)
    );
  }

  function closeProfileMenu() {
    if (!profileMenu || !profileBtn) return;

    profileOpen = false;

    profileMenu.classList.remove("show");
    profileBtn.classList.remove("open");

    profileBtn.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  /* =======================================================
     ECONOMY
     ======================================================= */

  function listenToEconomy(user) {
    if (economyUnsubscribe) {
      economyUnsubscribe();
      economyUnsubscribe = null;
    }

    economyUnsubscribe = onValue(
      getEconomyRef(user.uid),
      (snapshot) => {
        const economy =
          snapshot.exists()
            ? snapshot.val()
            : {};

        const coins = Math.max(
          0,
          safeNumber(economy.ludoCoins)
        );

        if (walletBalance) {
          walletBalance.textContent =
            coins.toLocaleString("en-IN");
        }
      },
      (error) => {
        console.error(
          "Economy listener error:",
          error
        );

        if (walletBalance) {
          walletBalance.textContent = "0";
        }
      }
    );
  }

  /* =======================================================
     PLAYER ORDER
     ======================================================= */

  function getOrderedPlayers(room) {
    if (!room) return [];

    const players = Object.values(room.players || {});

    players.sort((a, b) => {
      const aIsCreator =
        a.uid === room.creatorUid;

      const bIsCreator =
        b.uid === room.creatorUid;

      if (aIsCreator && !bIsCreator) return -1;
      if (!aIsCreator && bIsCreator) return 1;

      return safeNumber(a.joinedAt) -
        safeNumber(b.joinedAt);
    });

    return players.slice(
      0,
      room.maxPlayers
    );
  }

  function getOwnPlayer(room) {
    if (!room || !currentUser) return null;

    return room.players?.[
      currentUser.uid
    ] || null;
  }

  /* =======================================================
     STATUS TEXT
     ======================================================= */

  function statusMeta(room) {
    if (!room) {
      return {
        title: "Room Not Found",
        description: "This room no longer exists.",
        icon: "!",
        className: "error"
      };
    }

    if (room.status === "waiting" && room.expiresAt && room.expiresAt <= Date.now()) {
      return {
        title: "Room Expired",
        description: "This waiting room has expired. Return to the lobby to create or join another battle.",
        icon: "⌛",
        className: "error"
      };
    }

    if (room.status === "playing") {
      return {
        title: "Match Starting",
        description: "Both players are connected. Opening the Ludo board...",
        icon: "🎲",
        className: "playing"
      };
    }

    if (room.status === "completed") {
      return {
        title: "Match Complete",
        description: room.winnerName
          ? `${room.winnerName} finished the match.`
          : "This match has been completed.",
        icon: "🏆",
        className: "complete"
      };
    }

    if (room.status === "cancelled") {
      return {
        title: "Room Closed",
        description: "This multiplayer room is no longer active.",
        icon: "×",
        className: "error"
      };
    }

    if (room.playerCount < room.maxPlayers) {
      return {
        title: "Waiting for Opponent",
        description: "Share the six-digit room code with your friend.",
        icon: "⏳",
        className: "waiting"
      };
    }

    const players = getOrderedPlayers(room);
    const allReady =
      players.length >= 2 &&
      players.every((player) => player.ready === true);

    if (allReady) {
      return {
        title: "Both Players Ready",
        description: "The room is ready. The creator can start the match.",
        icon: "✓",
        className: "ready"
      };
    }

    return {
      title: "Ready Check",
      description: "Both players are connected. Confirm when you are ready.",
      icon: "🎯",
      className: "connected"
    };
  }

  /* =======================================================
     RENDER STATUS
     ======================================================= */

  function renderStatus(room) {
    const meta = statusMeta(room);

    if (battleStatus) {
      battleStatus.textContent = meta.title;
    }

    if (battleStatusDescription) {
      battleStatusDescription.textContent =
        meta.description;
    }

    if (statusIcon) {
      statusIcon.textContent = meta.icon;
      statusIcon.className =
        `status-icon ${meta.className}`;
    }

    if (connectionLabel) {
      connectionLabel.textContent =
        room
          ? "LIVE · FIREBASE"
          : "OFFLINE";
    }

    if (summaryStatus) {
      summaryStatus.textContent =
        room.status?.toUpperCase() || "UNKNOWN";
    }
  }

  /* =======================================================
     AVATAR RENDERING
     ======================================================= */

  function setAvatar(element, player, fallback = "?") {
    if (!element) return;

    element.innerHTML = "";

    if (player?.photo) {
      const image = document.createElement("img");
      image.src = player.photo;
      image.alt = "";
      image.loading = "lazy";

      image.addEventListener(
        "error",
        () => {
          element.textContent =
            getInitials(player.name);
        },
        { once: true }
      );

      element.appendChild(image);
      return;
    }

    element.textContent =
      player
        ? getInitials(player.name)
        : fallback;
  }

  /* =======================================================
     PLAYER CARD
     ======================================================= */

  function renderPlayerCard(
    player,
    nameElement,
    avatarElement,
    descriptionElement,
    statusElement,
    connectionElement,
    playerNumber
  ) {
    if (!player) {
      if (nameElement) {
        nameElement.textContent = "Waiting...";
      }

      if (descriptionElement) {
        descriptionElement.textContent =
          "Waiting for opponent";
      }

      if (statusElement) {
        statusElement.textContent = "WAITING";
        statusElement.className =
          "player-ready-status waiting";
      }

      if (connectionElement) {
        connectionElement.textContent =
          "NOT CONNECTED";
        connectionElement.className =
          "player-connection offline";
      }

      if (avatarElement) {
        avatarElement.innerHTML = "?";
      }

      return;
    }

    if (nameElement) {
      nameElement.textContent =
        player.name;
    }

    if (descriptionElement) {
      descriptionElement.textContent =
        player.uid === currentUser?.uid
          ? "You · Connected"
          : "Opponent · Connected";
    }

    setAvatar(
      avatarElement,
      player,
      playerNumber === 1 ? "P1" : "P2"
    );

    if (statusElement) {
      statusElement.textContent =
        player.ready
          ? "READY"
          : "WAITING";

      statusElement.className =
        `player-ready-status ${
          player.ready
            ? "ready"
            : "waiting"
        }`;
    }

    if (connectionElement) {
      const connected =
        player.connected !== false;

      connectionElement.textContent =
        connected
          ? "● ONLINE"
          : "○ OFFLINE";

      connectionElement.className =
        `player-connection ${
          connected
            ? "online"
            : "offline"
        }`;
    }
  }

  function renderPlayers(room) {
    const players =
      getOrderedPlayers(room);

    const first = players[0] || null;
    const second = players[1] || null;

    renderPlayerCard(
      first,
      playerOneName,
      playerOneAvatar,
      playerOneDescription,
      playerOneStatus,
      playerOneConnection,
      1
    );

    renderPlayerCard(
      second,
      playerTwoName,
      playerTwoAvatar,
      playerTwoDescription,
      playerTwoStatus,
      playerTwoConnection,
      2
    );

    if (playersJoined) {
      playersJoined.textContent =
        String(players.length);
    }

    if (totalPlayers) {
      totalPlayers.textContent =
        String(room.maxPlayers);
    }

    if (summaryPlayers) {
      summaryPlayers.textContent =
        String(players.length);
    }

    if (summaryMode) {
      summaryMode.textContent =
        room.mode === "quick"
          ? "QUICK MATCH"
          : room.mode === "public"
            ? "PUBLIC BATTLE"
            : "PRIVATE ROOM";
    }

    if (summaryEntryMode) {
      summaryEntryMode.textContent =
        room.entryMode === "coins" ? "LUDOCOINS" : "FREE PLAY";
    }

    if (summaryCoinAmount) {
      summaryCoinAmount.textContent =
        room.entryMode === "coins"
          ? `${safeNumber(room.coinAmount).toLocaleString("en-IN")}`
          : "—";
    }

    if (summaryRoom) {
      summaryRoom.textContent =
        room.roomCode;
    }

    if (progressFill) {
      const readyCount = players.filter(
        (player) => player.ready === true
      ).length;

      const percentage =
        room.maxPlayers > 0
          ? Math.min(
              100,
              Math.round(
                (readyCount / room.maxPlayers) * 100
              )
            )
          : 0;

      progressFill.style.width =
        `${percentage}%`;
    }
  }

  /* =======================================================
     READY CONTROLS
     ======================================================= */

  function updateReadyControls(room) {
    const ownPlayer =
      getOwnPlayer(room);

    const players =
      getOrderedPlayers(room);

    const roomFull =
      players.length >= room.maxPlayers;

    const allReady =
      roomFull &&
      players.every(
        (player) => player.ready === true
      );

    const isPlaying =
      room.status === "playing";

    const isClosed =
      room.status === "completed" ||
      room.status === "cancelled" ||
      (room.status === "waiting" && room.expiresAt && room.expiresAt <= Date.now());

    if (!readyBtn) return;

    readyBtn.disabled =
      !ownPlayer ||
      !roomFull ||
      isPlaying ||
      isClosed ||
      busy;

    if (!roomFull) {
      if (readyButtonText) {
        readyButtonText.textContent =
          "Waiting for Opponent";
      }

      if (readyMessage) {
        readyMessage.textContent =
          "Both players must join before the ready check begins.";
      }

      return;
    }

    if (isPlaying) {
      if (readyButtonText) {
        readyButtonText.textContent =
          "Match Starting...";
      }

      if (readyMessage) {
        readyMessage.textContent =
          "The multiplayer match is opening.";
      }

      return;
    }

    if (ownPlayer.ready) {
      if (readyButtonText) {
        readyButtonText.textContent =
          "Cancel Ready";
      }

      if (readyMessage) {
        readyMessage.textContent =
          allReady
            ? "Both players are ready. The creator can start the match."
            : "You are ready. Waiting for the other player.";
      }

      return;
    }

    if (readyButtonText) {
      readyButtonText.textContent =
        "I'm Ready";
    }

    if (readyMessage) {
      readyMessage.textContent =
        "Confirm that you are ready to play.";
    }
  }

  /* =======================================================
     START CONTROL
     ======================================================= */

  function updateStartControl(room) {
    if (!startGameBtn) return;

    const players =
      getOrderedPlayers(room);

    const allReady =
      players.length >= room.maxPlayers &&
      players.every(
        (player) => player.ready === true
      );

    const isCreator =
      currentUser?.uid === room.creatorUid;

    const isPlaying =
      room.status === "playing";

    const isClosed =
      room.status === "completed" ||
      room.status === "cancelled" ||
      (room.status === "waiting" && room.expiresAt && room.expiresAt <= Date.now());

    startGameBtn.disabled =
      !isCreator ||
      !allReady ||
      isPlaying ||
      isClosed ||
      busy;

    if (isPlaying) {
      if (startGameSubtext) {
        startGameSubtext.textContent =
          "Opening the multiplayer board...";
      }
      return;
    }

    if (!isCreator) {
      if (startGameSubtext) {
        startGameSubtext.textContent =
          allReady
            ? "Waiting for the room creator"
            : "Both players must be ready";
      }
      return;
    }

    if (allReady) {
      if (startGameSubtext) {
        startGameSubtext.textContent =
          "Both players are ready";
      }
    } else {
      if (startGameSubtext) {
        startGameSubtext.textContent =
          "Both players must be ready";
      }
    }
  }

  /* =======================================================
     TIMELINE
     ======================================================= */

  function setTimelineState(element, active) {
    if (!element) return;

    element.classList.toggle(
      "completed",
      active
    );
  }

  function updateTimeline(room) {
    const players =
      getOrderedPlayers(room);

    const bothReady =
      players.length >= room.maxPlayers &&
      players.every(
        (player) => player.ready === true
      );

    setTimelineState(
      timelineCreated,
      true
    );

    setTimelineState(
      timelineJoined,
      players.length >= room.maxPlayers
    );

    setTimelineState(
      timelineReady,
      bothReady
    );

    setTimelineState(
      timelinePlaying,
      room.status === "playing" ||
      room.status === "completed"
    );

    setTimelineState(
      timelineWinner,
      room.status === "completed" ||
      Boolean(room.winnerUid)
    );
  }

  /* =======================================================
     ACTIVITY FEED
     ======================================================= */

  function renderActivity(room) {
    if (!activityList) return;

    const players =
      getOrderedPlayers(room);

    const events = [];

    if (room.createdAt) {
      events.push({
        key: `created-${room.createdAt}`,
        icon: "✓",
        title: "Room created",
        text: `${escapeHTML(room.creatorName)} created this room.`,
        time: room.createdAt
      });
    }

    players.forEach((player) => {
      if (player.joinedAt) {
        events.push({
          key: `joined-${player.uid}-${player.joinedAt}`,
          icon: "↗",
          title:
            player.uid === currentUser?.uid
              ? "You joined"
              : "Opponent joined",
          text: `${escapeHTML(player.name)} connected to the room.`,
          time: player.joinedAt
        });
      }

      if (player.ready) {
        events.push({
          key: `ready-${player.uid}`,
          icon: "✓",
          title:
            player.uid === currentUser?.uid
              ? "You are ready"
              : "Opponent is ready",
          text: `${escapeHTML(player.name)} confirmed readiness.`,
          time: room.updatedAt || player.joinedAt
        });
      }
    });

    if (room.status === "playing") {
      events.push({
        key: `playing-${room.startedAt}`,
        icon: "🎲",
        title: "Match started",
        text: "The room has moved into the Ludo match.",
        time: room.startedAt
      });
    }

    if (room.status === "completed") {
      events.push({
        key: `complete-${room.completedAt}`,
        icon: "🏆",
        title: "Match complete",
        text: room.winnerName
          ? `${escapeHTML(room.winnerName)} won the match.`
          : "The match has finished.",
        time: room.completedAt
      });
    }

    events.sort(
      (a, b) => safeNumber(b.time) - safeNumber(a.time)
    );

    activityList.innerHTML = "";

    if (events.length === 0) {
      activityEmpty?.classList.remove("hidden");
      return;
    }

    activityEmpty?.classList.add("hidden");

    events.slice(0, 8).forEach((event) => {
      const item = document.createElement("div");
      item.className = "activity-item";

      item.innerHTML = `
        <div class="activity-icon">${event.icon}</div>
        <div class="activity-copy">
          <strong>${event.title}</strong>
          <span>${event.text}</span>
        </div>
      `;

      activityList.appendChild(item);
    });

    lastRenderedActivityKey =
      events.map((event) => event.key).join("|");
  }

  /* =======================================================
     RENDER ENTIRE ROOM
     ======================================================= */

  function renderBattle(room) {
    currentBattle = room;

    saveCurrentRoom();

    if (roomCodeElement) {
      roomCodeElement.textContent =
        room.roomCode;
    }

    if (roomMode) {
      roomMode.textContent =
        room.mode === "quick"
          ? "QUICK MATCH · FREE"
          : `${room.mode === "public" ? "PUBLIC" : "PRIVATE"} · ${room.entryMode === "coins" ? `🪙 ${room.coinAmount.toLocaleString("en-IN")} LUDOCOINS` : "FREE PLAY"}`;
    }

    renderStatus(room);
    renderPlayers(room);
    updateReadyControls(room);
    updateStartControl(room);
    updateTimeline(room);
    renderActivity(room);

    const ownPlayer =
      getOwnPlayer(room);

    if (
      room.status === "playing" &&
      !redirectingToGame
    ) {
      redirectingToGame = true;

      if (battleStatusDescription) {
        battleStatusDescription.textContent =
          "Match started. Opening the Ludo board...";
      }

      setTimeout(() => {
        window.location.href =
          `game.html?room=${encodeURIComponent(room.roomCode)}`;
      }, 500);
    }
  }

  /* =======================================================
     NO ROOM
     ======================================================= */

  function renderNoRoom() {
    if (roomCodeElement) {
      roomCodeElement.textContent =
        "------";
    }

    if (battleStatus) {
      battleStatus.textContent =
        "Invalid Room";
    }

    if (battleStatusDescription) {
      battleStatusDescription.textContent =
        "A valid six-digit room code is required.";
    }

    if (readyBtn) {
      readyBtn.disabled = true;
    }

    if (startGameBtn) {
      startGameBtn.disabled = true;
    }
  }

  /* =======================================================
     ROOM NOT FOUND / CLOSED
     ======================================================= */

  function handleMissingRoom() {
    currentBattle = null;
    clearSavedRoom();

    if (roomCodeElement) {
      roomCodeElement.textContent =
        roomCode;
    }

    if (battleStatus) {
      battleStatus.textContent =
        "Room Not Found";
    }

    if (battleStatusDescription) {
      battleStatusDescription.textContent =
        "This room does not exist or has already been removed.";
    }

    if (readyBtn) {
      readyBtn.disabled = true;

      if (readyButtonText) {
        readyButtonText.textContent =
          "Room Unavailable";
      }
    }

    if (startGameBtn) {
      startGameBtn.disabled = true;
    }

    showToast(
      "This room is no longer available.",
      "Room",
      "error"
    );
  }

  /* =======================================================
     FIREBASE ROOM LISTENER
     ======================================================= */

  function startRoomListener() {
    if (roomUnsubscribe) {
      roomUnsubscribe();
      roomUnsubscribe = null;
    }

    roomUnsubscribe = onValue(
      getRoomRef(),
      (snapshot) => {
        if (!snapshot.exists()) {
          handleMissingRoom();
          return;
        }

        const room =
          normalizeRoom(snapshot.val());

        if (!room) {
          handleMissingRoom();
          return;
        }

        if (room.status === "waiting" && room.expiresAt && room.expiresAt <= Date.now()) {
          if (currentUser && room.creatorUid === currentUser.uid) {
            showToast("This room has expired. Returning to the lobby.", "Room Expired", "info");
          }
          clearSavedRoom();
          if (battleStatus) battleStatus.textContent = "Room Expired";
          if (battleStatusDescription) battleStatusDescription.textContent = "This waiting room is no longer active.";
          if (readyBtn) readyBtn.disabled = true;
          if (startGameBtn) startGameBtn.disabled = true;
          return;
        }

        if (
          currentUser &&
          !room.players?.[currentUser.uid]
        ) {
          clearSavedRoom();

          if (battleStatus) {
            battleStatus.textContent =
              "You Left the Room";
          }

          if (battleStatusDescription) {
            battleStatusDescription.textContent =
              "You are no longer a member of this room.";
          }

          if (readyBtn) {
            readyBtn.disabled = true;
          }

          if (startGameBtn) {
            startGameBtn.disabled = true;
          }

          return;
        }

        renderBattle(room);
      },
      (error) => {
        console.error(
          "Battle room listener error:",
          error
        );

        if (connectionLabel) {
          connectionLabel.textContent =
            "CONNECTION ERROR";
        }

        showToast(
          "Realtime room synchronization failed.",
          "Firebase Error",
          "error"
        );
      }
    );
  }

  /* =======================================================
     READY TRANSACTION
     ======================================================= */

  async function toggleReady() {
    if (busy) return;

    if (!currentUser || !currentBattle) {
      showToast(
        "The room is not ready yet.",
        "Room",
        "error"
      );
      return;
    }

    const ownPlayer =
      getOwnPlayer(currentBattle);

    if (!ownPlayer) {
      showToast(
        "You are not a member of this room.",
        "Room",
        "error"
      );
      return;
    }

    if (
      currentBattle.playerCount <
      currentBattle.maxPlayers
    ) {
      showToast(
        "Wait for the opponent to join first.",
        "Ready Check",
        "info"
      );
      return;
    }

    if (
      currentBattle.status !==
      "waiting"
    ) {
      showToast(
        "Readiness can no longer be changed.",
        "Match",
        "info"
      );
      return;
    }

    busy = true;

    if (readyBtn) {
      readyBtn.disabled = true;
    }

    try {
      const target =
        getRoomRef();

      const result =
        await runTransaction(
          target,
          (current) => {
            if (
              !current ||
              typeof current !== "object"
            ) {
              return;
            }

            const players =
              current.players &&
              typeof current.players === "object"
                ? {
                    ...current.players
                  }
                : {};

            const player =
              players[currentUser.uid];

            if (!player) {
              return;
            }

            if (
              String(
                current.status ||
                "waiting"
              ) !== "waiting"
            ) {
              return;
            }

            players[
              currentUser.uid
            ] = {
              ...player,
              ready:
                player.ready !== true
            };

            return {
              ...current,
              players,
              updatedAt:
                Date.now()
            };
          }
        );

      if (!result.committed) {
        throw new Error(
          "Ready state could not be updated."
        );
      }

      showToast(
        ownPlayer.ready
          ? "Ready status cancelled."
          : "You are marked ready.",
        "Ready Check"
      );
    } catch (error) {
      console.error(
        "Ready transaction error:",
        error
      );

      showToast(
        "Could not update your ready status.",
        "Ready Error",
        "error"
      );
    } finally {
      busy = false;

      if (currentBattle) {
        updateReadyControls(
          currentBattle
        );

        updateStartControl(
          currentBattle
        );
      }
    }
  }

  /* =======================================================
     START MATCH — CREATOR ONLY
     ======================================================= */

  async function startGame() {
    if (busy) return;

    if (!currentUser || !currentBattle) {
      showToast(
        "No active room found.",
        "Match",
        "error"
      );
      return;
    }

    if (
      currentBattle.creatorUid !==
      currentUser.uid
    ) {
      showToast(
        "Only the room creator can start the match.",
        "Match",
        "error"
      );
      return;
    }

    const players =
      getOrderedPlayers(
        currentBattle
      );

    const allReady =
      players.length >=
        currentBattle.maxPlayers &&
      players.every(
        (player) =>
          player.ready === true
      );

    if (!allReady) {
      showToast(
        "Both players must be ready first.",
        "Ready Check",
        "error"
      );
      return;
    }

    busy = true;

    if (startGameBtn) {
      startGameBtn.disabled =
        true;
    }

    try {
      const result =
        await runTransaction(
          getRoomRef(),
          (current) => {
            if (
              !current ||
              typeof current !==
                "object"
            ) {
              return;
            }

            if (
              String(
                current.creatorUid
              ) !==
              String(
                currentUser.uid
              )
            ) {
              return;
            }

            if (
              String(
                current.status ||
                "waiting"
              ) !== "waiting"
            ) {
              return;
            }

            const players =
              current.players &&
              typeof current.players ===
                "object"
                ? current.players
                : {};

            const playerList =
              Object.values(players);

            if (
              playerList.length <
              Math.max(
                2,
                safeNumber(
                  current.maxPlayers,
                  MAX_PLAYERS
                )
              )
            ) {
              return;
            }

            if (
              !playerList.every(
                (player) =>
                  player.ready === true
              )
            ) {
              return;
            }

            const startedAt =
              Date.now();

            return {
              ...current,
              status:
                "playing",
              startedAt,
              updatedAt:
                startedAt
            };
          }
        );

      if (!result.committed) {
        throw new Error(
          "The match could not be started."
        );
      }

      showToast(
        "Match started. Opening Ludo...",
        "Match Started"
      );
    } catch (error) {
      console.error(
        "Start match transaction error:",
        error
      );

      showToast(
        error?.message ||
          "Could not start the match.",
        "Match Error",
        "error"
      );
    } finally {
      busy = false;

      if (currentBattle) {
        updateStartControl(
          currentBattle
        );
      }
    }
  }

  /* =======================================================
     COPY ROOM CODE
     ======================================================= */

  async function copyRoomCode() {
    const code =
      currentBattle?.roomCode ||
      roomCode;

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          code
        );
      } else {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value = code;
        textarea.style.position =
          "fixed";
        textarea.style.opacity = "0";

        document.body.appendChild(
          textarea
        );

        textarea.select();
        document.execCommand(
          "copy"
        );

        textarea.remove();
      }

      showToast(
        `Room code ${code} copied.`,
        "Copied"
      );
    } catch (error) {
      console.error(
        "Copy room code error:",
        error
      );

      showToast(
        `Room code: ${code}`,
        "Room Code",
        "info"
      );
    }
  }

  /* =======================================================
     SHARE ROOM
     ======================================================= */

  async function shareRoom() {
    const code =
      currentBattle?.roomCode ||
      roomCode;

    const shareURL =
      `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(code)}`;

    try {
      if (
        navigator.share &&
        typeof navigator.share ===
          "function"
      ) {
        await navigator.share({
          title: "LUDOVERSE Multiplayer Room",
          text: `Join my LUDOVERSE room with code ${code}.`,
          url: shareURL
        });

        return;
      }

      await navigator.clipboard.writeText(
        shareURL
      );

      showToast(
        "Room invite link copied.",
        "Invite Ready"
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "Share error:",
        error
      );

      showToast(
        `Share code: ${code}`,
        "Invite",
        "info"
      );
    }
  }

  /* =======================================================
     LEAVE MODAL
     ======================================================= */

  function openLeaveModal() {
    if (!currentBattle) return;

    const isCreator = currentBattle.creatorUid === currentUser?.uid;

    if (leaveRoomCode) {
      leaveRoomCode.textContent = currentBattle.roomCode || roomCode;
    }

    if (leaveModalTitle) {
      leaveModalTitle.textContent = isCreator
        ? "Cancel this battle?"
        : "Exit this room?";
    }

    if (cancelBattleLabel) {
      cancelBattleLabel.textContent = isCreator
        ? "Cancel Battle"
        : "Exit Room";
    }

    if (confirmLeaveBtn) {
      confirmLeaveBtn.textContent = isCreator
        ? "Cancel Battle"
        : "Exit Room";
    }

    leaveModal?.classList.add("show");
  }

  function closeLeaveModal() {
    leaveModal?.classList.remove(
      "show"
    );
  }

  /* =======================================================
     LEAVE ROOM
     ======================================================= */

  async function leaveRoom() {
    if (
      !currentUser ||
      !currentBattle
    ) {
      window.location.href =
        "battle-lobby.html";
      return;
    }

    busy = true;

    if (confirmLeaveBtn) {
      confirmLeaveBtn.disabled =
        true;
      confirmLeaveBtn.textContent =
        "Leaving...";
    }

    try {
      const target =
        getRoomRef();

      const isCreator =
        currentBattle.creatorUid ===
        currentUser.uid;

      if (isCreator) {
        await remove(target);
      } else {
        await runTransaction(
          target,
          (current) => {
            if (
              !current ||
              typeof current !==
                "object"
            ) {
              return;
            }

            const players =
              current.players &&
              typeof current.players ===
                "object"
                ? {
                    ...current.players
                  }
                : {};

            if (
              !players[
                currentUser.uid
              ]
            ) {
              return current;
            }

            delete players[
              currentUser.uid
            ];

            return {
              ...current,
              players,
              status:
                "waiting",
              updatedAt:
                Date.now()
            };
          }
        );
      }

      clearSavedRoom();
      closeLeaveModal();

      showToast(
        isCreator ? "Battle cancelled successfully." : "You exited the room.",
        isCreator ? "Battle Cancelled" : "Room Exited",
        "success"
      );

      setTimeout(() => {
        window.location.href =
          "battle-lobby.html";
      }, 400);
    } catch (error) {
      console.error(
        "Leave room error:",
        error
      );

      showToast(
        "Could not leave the room. Please try again.",
        "Room Error",
        "error"
      );
    } finally {
      busy = false;

      if (confirmLeaveBtn) {
        confirmLeaveBtn.disabled =
          false;
        confirmLeaveBtn.textContent =
          currentBattle?.creatorUid === currentUser?.uid
            ? "Cancel Battle"
            : "Exit Room";
      }
    }
  }

  /* =======================================================
     BACK TO LOBBY
     ======================================================= */

  function backToLobby() {
    window.location.href =
      "battle-lobby.html";
  }

  /* =======================================================
     LOGOUT
     ======================================================= */

  async function logout() {
    if (!currentUser) return;

    const confirmed =
      window.confirm(
        "Are you sure you want to logout?"
      );

    if (!confirmed) return;

    try {
      await signOut(auth);
      clearSavedRoom();

      window.location.href =
        "login.html";
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      showToast(
        "Logout failed. Please try again.",
        "Logout Error",
        "error"
      );
    }
  }

  /* =======================================================
     EVENTS
     ======================================================= */

  profileBtn?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      toggleProfileMenu();
    }
  );

  profileMenu?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
    }
  );

  document.addEventListener(
    "click",
    closeProfileMenu
  );

  logoutBtn?.addEventListener(
    "click",
    logout
  );

  backToLobbyBtn?.addEventListener(
    "click",
    backToLobby
  );

  copyRoomCodeBtn?.addEventListener(
    "click",
    copyRoomCode
  );

  shareRoomBtn?.addEventListener(
    "click",
    shareRoom
  );

  readyBtn?.addEventListener(
    "click",
    toggleReady
  );

  startGameBtn?.addEventListener(
    "click",
    startGame
  );

  cancelBattleBtn?.addEventListener(
    "click",
    openLeaveModal
  );

  closeLeaveModalBtn?.addEventListener(
    "click",
    closeLeaveModal
  );

  confirmLeaveBtn?.addEventListener(
    "click",
    leaveRoom
  );

  cancelLeaveBtn?.addEventListener(
    "click",
    closeLeaveModal
  );

  leaveModal?.addEventListener(
    "click",
    (event) => {
      if (
        event.target ===
        leaveModal
      ) {
        closeLeaveModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeLeaveModal();
        closeProfileMenu();
      }
    }
  );

  /* =======================================================
     AUTH
     ======================================================= */

  onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        window.location.href =
          "login.html";
        return;
      }

      currentUser = user;

      renderProfile(user);
      listenToEconomy(user);

      try {
        const snapshot =
          await get(getRoomRef());

        if (
          !snapshot.exists()
        ) {
          handleMissingRoom();
          return;
        }

        const room =
          normalizeRoom(
            snapshot.val()
          );

        if (
          !room?.players?.[
            user.uid
          ]
        ) {
          showToast(
            "You are not a member of this room.",
            "Access Denied",
            "error"
          );

          setTimeout(() => {
            window.location.href =
              "battle-lobby.html";
          }, 700);

          return;
        }

        saveCurrentRoom();
        renderBattle(room);
        startRoomListener();
      } catch (error) {
        console.error(
          "Room initialization error:",
          error
        );

        showToast(
          "Could not load this multiplayer room.",
          "Room Error",
          "error"
        );
      }
    }
  );

  console.log(
    "🎲 LUDOVERSE Battle Room initialized — Firebase realtime mode"
  );
});
