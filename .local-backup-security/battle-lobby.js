/* =========================================================
   LUDOVERSE — MULTIPLAYER LOBBY
   Production-style FREE-PLAY lobby controller
   ---------------------------------------------------------
   Responsibilities:
   • Firebase Authentication gate
   • Realtime room discovery
   • Atomic private-room creation
   • Atomic room joining
   • Quick Match
   • Current-room persistence
   • Realtime LudoCoin display
   • Profile / logout
   • Mobile-safe interaction handling

   IMPORTANT:
   LudoCoins are progression points only. They are not cash,
   cannot be withdrawn, and are never used as an entry fee,
   prize pool, payout, or wagering balance.
   ========================================================= */

"use strict";

import {
  auth,
  database,
  ref,
  get,
  set,
  onValue,
  runTransaction,
  onAuthStateChanged,
  signOut
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  /* =======================================================
     DOM
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

  const quickMatchBtn = $("quickMatchBtn");
  const createBattleBtn = $("createBattleBtn");
  const createPublicBtn = $("createPublicBtn");
  const createPrivateBtn = $("createPrivateBtn");
  const emptyCreateBtn = $("emptyCreateBtn");
  const refreshBtn = $("refreshBtn");

  const availableBattleCount = $("availableBattleCount");
  const onlinePlayerCount = $("onlinePlayerCount");

  const roomsList = $("roomsList");
  const emptyState = $("emptyState");

  const activeRoomSection = $("activeRoomSection");
  const activeRoomCode = $("activeRoomCode");
  const activeRoomStatus = $("activeRoomStatus");
  const activeRoomPlayers = $("activeRoomPlayers");
  const copyRoomBtn = $("copyRoomBtn");
  const openRoomBtn = $("openRoomBtn");
  const leaveRoomBtn = $("leaveRoomBtn");

  const createModal = $("createModal");
  const closeCreateModal = $("closeCreateModal");
  const cancelCreateBtn = $("cancelCreateBtn");
  const confirmCreateBtn = $("confirmCreateBtn");

  const joinModal = $("joinModal");
  const closeJoinModal = $("closeJoinModal");
  const cancelJoinBtn = $("cancelJoinBtn");
  const confirmJoinBtn = $("confirmJoinBtn");
  const roomCodeInput = $("roomCodeInput");

  const toast = $("toast");
  const toastIcon = $("toastIcon");
  const toastTitle = $("toastTitle");
  const toastMessage = $("toastMessage");

  /* =======================================================
     CONSTANTS
     ======================================================= */

  const ROOMS_PATH = "battles";
  const MAX_PLAYERS = 2;
  const ROOM_CODE_LENGTH = 6;
  const STARTER_COINS = 1000;
  const CURRENT_ROOM_KEY = "ludoverseCurrentRoom";

  /* =======================================================
     STATE
     ======================================================= */

  let currentUser = null;
  let rooms = {};
  let currentRoomCode = localStorage.getItem(CURRENT_ROOM_KEY) || "";

  let roomsUnsubscribe = null;
  let economyUnsubscribe = null;

  let busy = false;
  let profileOpen = false;

  /* =======================================================
     FIREBASE REFERENCES
     ======================================================= */

  function roomsRef() {
    return ref(database, ROOMS_PATH);
  }

  function roomRef(code) {
    return ref(database, `${ROOMS_PATH}/${code}`);
  }

  function economyRef(uid) {
    return ref(database, `users/${uid}/economy`);
  }

  /* =======================================================
     PLAYER / DATA HELPERS
     ======================================================= */

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
    const parts = String(name || "Player")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    const initials = parts
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();

    return initials || "P";
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeEconomy(data) {
    const source = data && typeof data === "object" ? data : {};

    return {
      ludoCoins: Math.max(0, safeNumber(source.ludoCoins)),
      xp: Math.max(0, safeNumber(source.xp)),
      gamesPlayed: Math.max(0, safeNumber(source.gamesPlayed)),
      gamesWon: Math.max(0, safeNumber(source.gamesWon)),
      activityPoints: Math.max(0, safeNumber(source.activityPoints)),
      platformPoints: Math.max(0, safeNumber(source.platformPoints))
    };
  }

  function normalizePlayer(uid, data) {
    const source = data && typeof data === "object" ? data : {};

    return {
      uid: String(source.uid || uid || ""),
      name: String(source.name || "LUDOVERSE Player"),
      photo: String(source.photo || ""),
      joinedAt: safeNumber(source.joinedAt),
      ready: source.ready === true,
      connected: source.connected !== false
    };
  }

  function normalizeRoom(code, data) {
    if (!data || typeof data !== "object") return null;

    const playersSource =
      data.players && typeof data.players === "object"
        ? data.players
        : {};

    const players = {};

    Object.entries(playersSource).forEach(([uid, player]) => {
      if (player && typeof player === "object") {
        players[uid] = normalizePlayer(uid, player);
      }
    });

    const playerList = Object.values(players);

    return {
      roomCode: String(data.roomCode || code),
      battleId: String(data.battleId || data.roomCode || code),
      game: String(data.game || "ludo"),
      mode: String(data.mode || "private"),
      creatorUid: String(data.creatorUid || ""),
      creatorName: String(data.creatorName || "LUDOVERSE Player"),
      creatorPhoto: String(data.creatorPhoto || ""),
      players,
      playerCount: playerList.length,
      maxPlayers: Math.max(2, safeNumber(data.maxPlayers, MAX_PLAYERS)),
      status: String(data.status || "waiting"),
      createdAt: safeNumber(data.createdAt),
      updatedAt: safeNumber(data.updatedAt),
      startedAt: safeNumber(data.startedAt),
      completedAt: safeNumber(data.completedAt),
      entryMode: String(data.entryMode || "free"),
      coinAmount: Math.max(0, safeNumber(data.coinAmount)),
      expiresAt: safeNumber(data.expiresAt),
      coinReservation: data.coinReservation && typeof data.coinReservation === "object"
        ? data.coinReservation
        : { amount: 0, status: "none" }
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

  function formatNumber(value) {
    return safeNumber(value).toLocaleString("en-IN");
  }

  function formatAge(timestamp) {
    const time = safeNumber(timestamp);
    if (!time) return "just now";

    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));

    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return `${Math.floor(hours / 24)}d ago`;
  }

  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(message, title = "LUDOVERSE", type = "success") {
    if (!toast || !toastMessage) {
      window.alert(message);
      return;
    }

    toastTitle.textContent = title;
    toastMessage.textContent = message;

    toast.classList.remove("success", "error", "info", "show");
    toast.classList.add(type);

    if (toastIcon) {
      toastIcon.textContent =
        type === "error" ? "!" :
        type === "info" ? "i" : "✓";
    }

    requestAnimationFrame(() => toast.classList.add("show"));

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  /* =======================================================
     BUSY STATE
     ======================================================= */

  function setBusy(value, source = "") {
    busy = Boolean(value);

    [quickMatchBtn, createBattleBtn, confirmCreateBtn, confirmJoinBtn]
      .filter(Boolean)
      .forEach((button) => {
        button.disabled = busy;
      });

    if (quickMatchBtn) {
      if (busy && source === "quick") {
        quickMatchBtn.dataset.originalHTML ||= quickMatchBtn.innerHTML;
        quickMatchBtn.innerHTML = `
          <span class="btn-icon">◌</span>
          <span>
            <strong>Finding Match...</strong>
            <small>Connecting to a live room</small>
          </span>
        `;
      } else if (!busy && quickMatchBtn.dataset.originalHTML) {
        quickMatchBtn.innerHTML = quickMatchBtn.dataset.originalHTML;
      }
    }

    if (confirmCreateBtn) {
      confirmCreateBtn.textContent = busy && source === "create"
        ? "Creating Room..."
        : "Create Room →";
    }

    if (confirmJoinBtn) {
      confirmJoinBtn.textContent = busy && source === "join"
        ? "Joining Room..."
        : "Join Room →";
    }
  }

  /* =======================================================
     PROFILE
     ======================================================= */

  function renderProfile(user) {
    const name = getPlayerName(user);
    const initials = getInitials(name);

    if (headerName) headerName.textContent = name;

    if (headerEmail) {
      headerEmail.textContent =
        user.email ||
        user.phoneNumber ||
        "Authenticated player";
    }

    if (profileAvatar) profileAvatar.textContent = initials;
    if (menuAvatar) menuAvatar.textContent = initials;
  }

  function toggleProfileMenu() {
    if (!profileMenu || !profileBtn) return;

    profileOpen = !profileOpen;

    profileMenu.classList.toggle("show", profileOpen);
    profileBtn.classList.toggle("open", profileOpen);
    profileBtn.setAttribute("aria-expanded", String(profileOpen));
  }

  function closeProfileMenu() {
    if (!profileMenu || !profileBtn) return;

    profileOpen = false;
    profileMenu.classList.remove("show");
    profileBtn.classList.remove("open");
    profileBtn.setAttribute("aria-expanded", "false");
  }

  /* =======================================================
     ECONOMY
     ======================================================= */

  async function ensureEconomy(user) {
    const target = economyRef(user.uid);
    const snapshot = await get(target);

    if (!snapshot.exists()) {
      const starterEconomy = {
        ludoCoins: STARTER_COINS,
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        activityPoints: 0,
        platformPoints: 0,
        updatedAt: Date.now()
      };

      await set(target, starterEconomy);
      return starterEconomy;
    }

    return normalizeEconomy(snapshot.val());
  }

  function listenToEconomy(user) {
    if (economyUnsubscribe) {
      economyUnsubscribe();
      economyUnsubscribe = null;
    }

    economyUnsubscribe = onValue(
      economyRef(user.uid),
      (snapshot) => {
        const economy = snapshot.exists()
          ? normalizeEconomy(snapshot.val())
          : normalizeEconomy({});

        if (walletBalance) {
          walletBalance.textContent = formatNumber(economy.ludoCoins);
        }
      },
      (error) => {
        console.error("Economy listener error:", error);
        if (walletBalance) walletBalance.textContent = "0";
      }
    );
  }

  /* =======================================================
     CURRENT ROOM
     ======================================================= */

  function saveCurrentRoom(code) {
    currentRoomCode = String(code || "");

    if (currentRoomCode) {
      localStorage.setItem(CURRENT_ROOM_KEY, currentRoomCode);
    } else {
      localStorage.removeItem(CURRENT_ROOM_KEY);
    }

    renderActiveRoom();
  }

  function clearCurrentRoom() {
    currentRoomCode = "";
    localStorage.removeItem(CURRENT_ROOM_KEY);
    renderActiveRoom();
  }

  function getCurrentRoom() {
    return currentRoomCode
      ? rooms[currentRoomCode] || null
      : null;
  }

  /* =======================================================
     ROOM CODE
     ======================================================= */

  function generateRoomCode() {
    return String(
      Math.floor(100000 + Math.random() * 900000)
    );
  }

  async function generateUniqueRoomCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = generateRoomCode();
      const snapshot = await get(roomRef(code));

      if (!snapshot.exists()) return code;
    }

    throw new Error("Unable to create a unique room code.");
  }

  /* =======================================================
     ROOM OBJECT FACTORY
     ======================================================= */

  const ROOM_LIFETIME_MS = 15 * 60 * 1000;

  function isRoomExpired(room, now = Date.now()) {
    if (!room || typeof room !== "object") return true;

    const expiresAt = safeNumber(room.expiresAt);
    if (expiresAt > 0) return expiresAt <= now;

    // Backward compatibility for rooms created before expiresAt was stored.
    const createdAt = safeNumber(room.createdAt);
    return createdAt > 0 && createdAt + ROOM_LIFETIME_MS <= now;
  }

  function createPlayerRecord(user, now) {
    return {
      uid: user.uid,
      name: getPlayerName(user),
      photo: user.photoURL || "",
      joinedAt: now,
      ready: false,
      connected: true
    };
  }

  function createRoomData(code, mode = "private") {
    const now = Date.now();
    const player = createPlayerRecord(currentUser, now);

    return {
      battleId: code,
      roomCode: code,
      game: "ludo",
      mode,
      creatorUid: currentUser.uid,
      creatorName: getPlayerName(currentUser),
      creatorPhoto: currentUser.photoURL || "",
      players: {
        [currentUser.uid]: player
      },
      maxPlayers: MAX_PLAYERS,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
      startedAt: 0,
      completedAt: 0,
      entryMode: "free",
      coinAmount: 0,
      expiresAt: now + ROOM_LIFETIME_MS,
      coinReservation: { amount: 0, status: "none", ownerUid: currentUser.uid, refundedAt: 0 }
    };
  }

  /* =======================================================
     CREATE ROOM
     ======================================================= */

  async function createRoom() {
    if (busy) return;

    if (!currentUser) {
      showToast("Please login before creating a room.", "Login Required", "error");
      return;
    }

    setBusy(true, "create");

    try {
      const code = await generateUniqueRoomCode();
      const target = roomRef(code);
      const roomData = createRoomData(code, "private");

      const result = await runTransaction(target, (current) => {
        if (current !== null) return;
        return roomData;
      });

      if (!result.committed) {
        throw new Error("Room creation was cancelled.");
      }

      saveCurrentRoom(code);
      closeCreateModalFn();

      showToast(
        `Room ${code} is ready. Share the code with your friend.`,
        "Room Created"
      );

      setTimeout(() => {
        window.location.href =
          `battle-room.html?room=${encodeURIComponent(code)}`;
      }, 500);
    } catch (error) {
      console.error("Create room error:", error);

      showToast(
        error?.message || "Could not create the room.",
        "Room Error",
        "error"
      );
    } finally {
      setBusy(false, "create");
    }
  }

  /* =======================================================
     JOIN ROOM — ATOMIC
     ======================================================= */

  async function joinRoomInternal(code) {
    if (!currentUser) {
      throw new Error("Authentication required.");
    }

    const normalizedCode = String(code || "")
      .replace(/\D/g, "")
      .slice(0, ROOM_CODE_LENGTH);

    if (!/^\d{6}$/.test(normalizedCode)) {
      throw new Error("Enter a valid 6-digit room code.");
    }

    const target = roomRef(normalizedCode);
    const now = Date.now();
    const player = createPlayerRecord(currentUser, now);

    const result = await runTransaction(target, (current) => {
      if (current === null) return current;
      if (typeof current !== "object") return;

      const players =
        current.players && typeof current.players === "object"
          ? { ...current.players }
          : {};

      if (players[currentUser.uid]) {
        return current;
      }

      const maxPlayers = Math.max(
        2,
        safeNumber(current.maxPlayers, MAX_PLAYERS)
      );

      if (String(current.status || "waiting") !== "waiting") {
        return;
      }

      if (isRoomExpired(current, now)) {
        return;
      }

      if (Object.keys(players).length >= maxPlayers) {
        return;
      }

      players[currentUser.uid] = player;

      return {
        ...current,
        players,
        updatedAt: now
      };
    });

    if (!result.committed) {
      const latest = await get(target);

      if (!latest.exists()) {
        throw new Error("This room does not exist.");
      }

      const room = normalizeRoom(normalizedCode, latest.val());

      if (room?.players?.[currentUser.uid]) {
        return {
          roomCode: normalizedCode,
          alreadyJoined: true
        };
      }

      if (room && isRoomExpired(room)) {
        throw new Error("This room has expired. Create a new room to continue.");
      }

      if (room && room.status !== "waiting") {
        throw new Error("This room has already started.");
      }

      throw new Error("This room is full or unavailable.");
    }

    return {
      roomCode: normalizedCode,
      alreadyJoined: false
    };
  }

  async function joinRoom(code) {
    if (busy) return;

    if (!currentUser) {
      showToast("Please login before joining a room.", "Login Required", "error");
      return;
    }

    setBusy(true, "join");

    try {
      const result = await joinRoomInternal(code);

      saveCurrentRoom(result.roomCode);
      closeJoinModalFn();

      showToast(
        result.alreadyJoined
          ? "Opening your room..."
          : "You joined the room successfully.",
        result.alreadyJoined ? "Room" : "Room Joined"
      );

      setTimeout(() => {
        window.location.href =
          `battle-room.html?room=${encodeURIComponent(result.roomCode)}`;
      }, 450);
    } catch (error) {
      console.error("Join room error:", error);

      showToast(
        error?.message || "Could not join the room.",
        "Join Error",
        "error"
      );
    } finally {
      setBusy(false, "join");
    }
  }

  /* =======================================================
     QUICK MATCH
     ======================================================= */

  async function quickMatch() {
    if (busy) return;

    if (!currentUser) {
      showToast("Please login before using Quick Match.", "Login Required", "error");
      return;
    }

    setBusy(true, "quick");

    try {
      const snapshot = await get(roomsRef());
      const data = snapshot.exists() ? snapshot.val() : {};
      const candidates = [];

      Object.entries(data).forEach(([code, rawRoom]) => {
        const room = normalizeRoom(code, rawRoom);

        if (!room) return;

        const isAvailable =
          (room.mode === "public" || room.mode === "quick") &&
          room.status === "waiting" &&
          room.playerCount < room.maxPlayers &&
          !isRoomExpired(room) &&
          !room.players?.[currentUser.uid];

        if (isAvailable) candidates.push(room);
      });

      candidates.sort(
        (a, b) => safeNumber(a.createdAt) - safeNumber(b.createdAt)
      );

      if (candidates.length > 0) {
        for (const candidate of candidates) {
          try {
            const result = await joinRoomInternal(candidate.roomCode);

            saveCurrentRoom(result.roomCode);

            showToast(
              "Opponent found. Opening the room...",
              "Match Found"
            );

            setTimeout(() => {
              window.location.href =
                `battle-room.html?room=${encodeURIComponent(result.roomCode)}`;
            }, 450);

            return;
          } catch (joinError) {
            console.warn(
              "Quick Match candidate became unavailable:",
              candidate.roomCode,
              joinError
            );
          }
        }
      }

      const code = await generateUniqueRoomCode();
      const roomData = createRoomData(code, "quick");

      const result = await runTransaction(
        roomRef(code),
        (current) => {
          if (current !== null) return;
          return roomData;
        }
      );

      if (!result.committed) {
        throw new Error("Could not create a Quick Match room.");
      }

      saveCurrentRoom(code);

      showToast(
        `Matchmaking room ${code} created. Waiting for an opponent...`,
        "Quick Match"
      );

      setTimeout(() => {
        window.location.href =
          `battle-room.html?room=${encodeURIComponent(code)}`;
      }, 550);
    } catch (error) {
      console.error("Quick Match error:", error);

      showToast(
        error?.message || "Quick Match could not start.",
        "Match Error",
        "error"
      );
    } finally {
      setBusy(false, "quick");
    }
  }

  /* =======================================================
     RENDER ROOM LIST
     ======================================================= */

  function renderRooms() {
    if (!roomsList) return;

    const roomArray = Object.values(rooms)
      .map((room) => normalizeRoom(room.roomCode, room))
      .filter(Boolean)
      .filter(
        (room) =>
          (room.mode === "public" || room.mode === "quick") &&
          room.status === "waiting" &&
          room.playerCount < room.maxPlayers &&
          (!room.expiresAt || room.expiresAt > Date.now())
      )
      .sort(
        (a, b) => safeNumber(a.createdAt) - safeNumber(b.createdAt)
      );

    if (availableBattleCount) {
      availableBattleCount.textContent = String(roomArray.length);
    }

    if (onlinePlayerCount) {
      onlinePlayerCount.textContent = String(
        roomArray.reduce(
          (total, room) => total + room.playerCount,
          0
        )
      );
    }

    roomsList.innerHTML = "";

    if (roomArray.length === 0) {
      emptyState?.classList.remove("hidden");
      return;
    }

    emptyState?.classList.add("hidden");

    roomArray.forEach((room) => {
      const card = document.createElement("article");
      card.className = "room-card";

      const creator = escapeHTML(
        room.creatorName || "LUDOVERSE Player"
      );

      const code = escapeHTML(room.roomCode);
      const age = escapeHTML(formatAge(room.createdAt));

      const creatorInitials = escapeHTML(
        getInitials(room.creatorName)
      );

      card.innerHTML = `
        <div class="room-left">
          <div class="room-avatar" aria-hidden="true">
            ${creatorInitials}
          </div>

          <div class="room-info">
            <div class="room-title-line">
              <h3>${creator}</h3>
              <span class="room-live-dot"></span>
            </div>

            <div class="room-meta">
              <span class="waiting-badge">● WAITING</span>
              <span class="room-players">
                ${room.playerCount}/${room.maxPlayers} players
              </span>
              <span class="room-age">${age}</span>
              <span class="room-entry">${room.entryMode === "coins" ? `🪙 ${formatNumber(room.coinAmount)} LudoCoins` : "FREE PLAY"}</span>
            </div>

            <p class="room-description">
              ${room.mode === "quick" ? "Quick Match" : "Public Battle"} · Ready when you are
            </p>
          </div>
        </div>

        <div class="room-actions">
          <div class="room-code-small" aria-label="Room code">
            ${code}
          </div>

          <button
            type="button"
            class="join-room-btn"
            data-room-code="${code}"
          >
            Join →
          </button>
        </div>
      `;

      const joinButton = card.querySelector(".join-room-btn");

      joinButton?.addEventListener("click", () => {
        openJoinModal(room.roomCode);
      });

      roomsList.appendChild(card);
    });
  }

  /* =======================================================
     ACTIVE ROOM
     ======================================================= */

  function renderActiveRoom() {
    if (!activeRoomSection) return;

    const room = getCurrentRoom();

    if (!room) {
      activeRoomSection.classList.remove("show");
      return;
    }

    if (
      currentUser &&
      !room.players?.[currentUser.uid]
    ) {
      clearCurrentRoom();
      return;
    }

    activeRoomSection.classList.add("show");

    if (activeRoomCode) {
      activeRoomCode.textContent = room.roomCode;
    }

    if (activeRoomPlayers) {
      activeRoomPlayers.textContent =
        `${room.playerCount}/${room.maxPlayers}`;
    }

    if (leaveRoomBtn) {
      leaveRoomBtn.textContent =
        room.creatorUid === currentUser?.uid
          ? "Cancel Battle"
          : "Exit Room";
    }

    if (activeRoomStatus) {
      if (room.status === "playing") {
        activeRoomStatus.textContent = "Match is in progress";
      } else if (room.expiresAt && room.expiresAt <= Date.now()) {
        activeRoomStatus.textContent = "Room expired · creating a new battle is required";
      } else if (room.playerCount >= room.maxPlayers) {
        activeRoomStatus.textContent =
          "Opponent connected · Open the room to get ready";
      } else {
        activeRoomStatus.textContent =
          "Waiting for another player...";
      }
    }
  }

  /* =======================================================
     ROOM LISTENER
     ======================================================= */

  function startRoomsListener() {
    if (roomsUnsubscribe) return;

    roomsUnsubscribe = onValue(
      roomsRef(),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : {};
        const normalized = {};

        Object.entries(data).forEach(([code, rawRoom]) => {
          const room = normalizeRoom(code, rawRoom);
          if (room) normalized[room.roomCode] = room;
        });

        rooms = normalized;

        // Recover the user's active room even if localStorage was cleared.
        if (currentUser) {
          const ownRooms = Object.values(rooms)
            .filter((room) => room.players?.[currentUser.uid])
            .sort((a, b) => safeNumber(b.updatedAt || b.createdAt) - safeNumber(a.updatedAt || a.createdAt));

          const liveOwnRoom = ownRooms.find((room) =>
            ["waiting", "playing"].includes(room.status) &&
            (!room.expiresAt || room.expiresAt > Date.now())
          );

          if (liveOwnRoom) {
            currentRoomCode = liveOwnRoom.roomCode;
            localStorage.setItem(CURRENT_ROOM_KEY, currentRoomCode);
          } else if (currentRoomCode && !rooms[currentRoomCode]) {
            clearCurrentRoom();
          }
        }

        renderRooms();
        renderActiveRoom();
      },
      (error) => {
        console.error("Room listener error:", error);

        showToast(
          "Live room updates are temporarily unavailable.",
          "Connection Error",
          "error"
        );
      }
    );
  }

  /* =======================================================
     CURRENT ROOM VALIDATION
     ======================================================= */

  async function validateCurrentRoom() {
    if (!currentRoomCode) {
      renderActiveRoom();
      return;
    }

    try {
      const snapshot = await get(roomRef(currentRoomCode));

      if (!snapshot.exists()) {
        clearCurrentRoom();
        return;
      }

      const room = normalizeRoom(
        currentRoomCode,
        snapshot.val()
      );

      if (!room) {
        clearCurrentRoom();
        return;
      }

      if (
        currentUser &&
        !room.players?.[currentUser.uid]
      ) {
        clearCurrentRoom();
        return;
      }

      rooms[currentRoomCode] = room;
      renderActiveRoom();
    } catch (error) {
      console.error("Current room validation error:", error);
    }
  }

  /* =======================================================
     COPY
     ======================================================= */

  async function copyCurrentRoomCode() {
    const room = getCurrentRoom();

    if (!room?.roomCode) {
      showToast("There is no active room.", "Room", "error");
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(room.roomCode);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = room.roomCode;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      showToast(
        `Room code ${room.roomCode} copied.`,
        "Copied"
      );
    } catch (error) {
      console.error("Copy error:", error);
      showToast(
        `Room code: ${room.roomCode}`,
        "Room Code",
        "info"
      );
    }
  }

  /* =======================================================
     NAVIGATION
     ======================================================= */

  function openCurrentRoom() {
    const room = getCurrentRoom();

    if (!room?.roomCode) {
      showToast("There is no active room.", "Room", "error");
      return;
    }

    window.location.href =
      `battle-room.html?room=${encodeURIComponent(room.roomCode)}`;
  }

  /* =======================================================
     LEAVE ACTIVE ROOM FROM LOBBY
     ======================================================= */

  async function leaveCurrentRoom() {
    const room = getCurrentRoom();

    if (!room || !currentUser) {
      clearCurrentRoom();
      return;
    }

    const confirmed = window.confirm(
      "Leave your current multiplayer room?"
    );

    if (!confirmed) return;

    try {
      const target = roomRef(room.roomCode);

      await runTransaction(target, (current) => {
        if (!current || typeof current !== "object") return;

        const players =
          current.players && typeof current.players === "object"
            ? { ...current.players }
            : {};

        if (!players[currentUser.uid]) {
          return current;
        }

        delete players[currentUser.uid];

        if (String(current.creatorUid) === String(currentUser.uid)) {
          return null;
        }

        return {
          ...current,
          players,
          status: "waiting",
          updatedAt: Date.now()
        };
      });

      clearCurrentRoom();

      showToast(
        "You left the room.",
        "Room Left"
      );
    } catch (error) {
      console.error("Leave room error:", error);

      showToast(
        "Could not leave the room. Please try again.",
        "Room Error",
        "error"
      );
    }
  }

  /* =======================================================
     CREATE BATTLE NAVIGATION
     ======================================================= */

  function openBattleSetup() {
    if (!currentUser) {
      showToast("Please login before creating a battle.", "Login Required", "error");
      return;
    }
    window.location.href = "battle-setup.html";
  }

  /* =======================================================
     MODALS
     ======================================================= */

  function openCreateModal() {
    if (!currentUser) {
      showToast("Please login before creating a room.", "Login Required", "error");
      return;
    }
    window.location.href = "battle-setup.html?mode=private";
  }

  function openPublicSetup() {
    if (!currentUser) {
      showToast("Please login before creating a battle.", "Login Required", "error");
      return;
    }
    window.location.href = "battle-setup.html?mode=public";
  }

  function closeCreateModalFn() {
    createModal?.classList.remove("show");
  }
  // Compatibility alias: keeps older event paths from throwing a TypeError.
  const closeCreateModalLegacy = closeCreateModalFn;

  function openJoinModal(code = "") {
    if (!currentUser) {
      showToast("Please login before joining a room.", "Login Required", "error");
      return;
    }

    if (roomCodeInput) {
      roomCodeInput.value = String(code)
        .replace(/\D/g, "")
        .slice(0, ROOM_CODE_LENGTH);
    }

    joinModal?.classList.add("show");

    setTimeout(() => roomCodeInput?.focus(), 100);
  }

  function closeJoinModalFn() {
    joinModal?.classList.remove("show");
  }
  // Compatibility alias for legacy navigation/event paths.
  const closeJoinModalLegacy = closeJoinModalFn;

  /* =======================================================
     LOGOUT
     ======================================================= */

  async function logout() {
    if (!currentUser) return;

    const confirmed = window.confirm(
      "Are you sure you want to logout?"
    );

    if (!confirmed) return;

    try {
      await signOut(auth);
      localStorage.removeItem(CURRENT_ROOM_KEY);
      window.location.href = "login.html";
    } catch (error) {
      console.error("Logout error:", error);

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

  profileBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileMenu();
  });

  profileMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    closeProfileMenu();
  });

  logoutBtn?.addEventListener("click", logout);

  quickMatchBtn?.addEventListener("click", quickMatch);
  createBattleBtn?.addEventListener("click", openBattleSetup);
  emptyCreateBtn?.addEventListener("click", openBattleSetup);

  confirmCreateBtn?.addEventListener("click", createRoom);

  closeCreateModal?.addEventListener(
    "click",
    closeCreateModalFn
  );

  cancelCreateBtn?.addEventListener(
    "click",
    closeCreateModalFn
  );

  closeJoinModal?.addEventListener(
    "click",
    closeJoinModalFn
  );

  cancelJoinBtn?.addEventListener(
    "click",
    closeJoinModalFn
  );

  confirmJoinBtn?.addEventListener("click", () => {
    joinRoom(roomCodeInput?.value || "");
  });

  refreshBtn?.addEventListener("click", async () => {
    if (busy) return;

    refreshBtn.disabled = true;

    try {
      await validateCurrentRoom();
      renderRooms();

      showToast("Live room list refreshed.", "Updated", "info");
    } finally {
      setTimeout(() => {
        refreshBtn.disabled = false;
      }, 500);
    }
  });

  copyRoomBtn?.addEventListener(
    "click",
    copyCurrentRoomCode
  );

  openRoomBtn?.addEventListener(
    "click",
    openCurrentRoom
  );

  leaveRoomBtn?.addEventListener(
    "click",
    leaveCurrentRoom
  );

  roomCodeInput?.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value
      .replace(/\D/g, "")
      .slice(0, ROOM_CODE_LENGTH);
  });

  roomCodeInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      joinRoom(roomCodeInput.value);
    }
  });

  [createModal, joinModal].forEach((modal) => {
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.classList.remove("show");
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    closeCreateModalFn();
    closeJoinModalFn();
    closeProfileMenu();
  });

  /* =======================================================
     AUTH INITIALIZATION
     ======================================================= */

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    renderProfile(user);

    try {
      await ensureEconomy(user);
      listenToEconomy(user);
    } catch (error) {
      console.error("Economy initialization error:", error);

      if (walletBalance) walletBalance.textContent = "0";

      showToast(
        "Your LudoCoin balance could not be loaded.",
        "Wallet",
        "error"
      );
    }

    startRoomsListener();
    await validateCurrentRoom();

    renderRooms();
    renderActiveRoom();
  });

  console.log(
    "🎲 LUDOVERSE Multiplayer Lobby initialized — Firebase realtime mode"
  );
});
