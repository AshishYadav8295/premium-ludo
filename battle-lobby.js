/* =========================================================
   LUDOVERSE — MULTIPLAYER BATTLE LOBBY
   ---------------------------------------------------------
   Firebase Realtime Multiplayer Lobby
   Version: 2.0

   FEATURES
   • Firebase Authentication
   • Realtime room discovery
   • Atomic room creation
   • Atomic room joining
   • Quick Match
   • Private Room
   • 6-digit room codes
   • Realtime room list
   • Current room persistence
   • Realtime LudoCoins display
   • Profile menu
   • Logout
   • Mobile-safe interaction
   • Race-condition protection
   • XSS-safe rendering

   ECONOMY
   • LudoCoins are progression points only.
   • They are not cash.
   • No entry fee.
   • No wagering.
   • No prize pool.
   • No cash withdrawal.
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


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     DOM HELPER
     ======================================================= */

  const $ = (id) => document.getElementById(id);

  /* Header */
  const walletBalance = $("walletBalance");

  const profileBtn = $("profileBtn");
  const profileMenu = $("profileMenu");
  const profileAvatar = $("profileAvatar");
  const menuAvatar = $("menuAvatar");
  const headerName = $("headerName");
  const headerEmail = $("headerEmail");
  const logoutBtn = $("logoutBtn");

  /* Main actions */
  const quickMatchBtn = $("quickMatchBtn");
  const createBattleBtn = $("createBattleBtn");
  const emptyCreateBtn = $("emptyCreateBtn");
  const refreshBtn = $("refreshBtn");

  /* Statistics */
  const availableBattleCount = $("availableBattleCount");
  const onlinePlayerCount = $("onlinePlayerCount");

  /* Room list */
  const roomsList = $("roomsList");
  const emptyState = $("emptyState");

  /* Active room */
  const activeRoomSection = $("activeRoomSection");
  const activeRoomCode = $("activeRoomCode");
  const activeRoomStatus = $("activeRoomStatus");
  const activeRoomPlayers = $("activeRoomPlayers");
  const copyRoomBtn = $("copyRoomBtn");
  const openRoomBtn = $("openRoomBtn");
  const leaveRoomBtn = $("leaveRoomBtn");

  /* Create modal */
  const createModal = $("createModal");
  const closeCreateModalButton = $("closeCreateModal");
  const cancelCreateBtn = $("cancelCreateBtn");
  const confirmCreateBtn = $("confirmCreateBtn");

  /* Join modal */
  const joinModal = $("joinModal");
  const closeJoinModalButton = $("closeJoinModal");
  const cancelJoinBtn = $("cancelJoinBtn");
  const confirmJoinBtn = $("confirmJoinBtn");
  const roomCodeInput = $("roomCodeInput");

  /* Toast */
  const toast = $("toast");
  const toastIcon = $("toastIcon");
  const toastTitle = $("toastTitle");
  const toastMessage = $("toastMessage");


  /* =======================================================
     CONFIGURATION
     ======================================================= */

  const CONFIG = Object.freeze({
    ROOMS_PATH: "battles",
    ECONOMY_PATH: "economy",

    MAX_PLAYERS: 2,

    ROOM_CODE_LENGTH: 6,

    STARTER_COINS: 1000,

    CURRENT_ROOM_KEY: "ludoverseCurrentRoom",

    ROOM_CREATION_ATTEMPTS: 25,

    TOAST_DURATION: 3200,

    OPEN_DELAY: 400
  });


  /* =======================================================
     STATE
     ======================================================= */

  let currentUser = null;

  let rooms = {};

  let currentRoomCode =
    localStorage.getItem(CONFIG.CURRENT_ROOM_KEY) || "";

  let roomsUnsubscribe = null;

  let economyUnsubscribe = null;

  let busy = false;

  let profileOpen = false;

  let toastTimer = null;


  /* =======================================================
     FIREBASE REFERENCES
     ======================================================= */

  function roomsRef() {
    return ref(
      database,
      CONFIG.ROOMS_PATH
    );
  }


  function roomRef(roomCode) {
    return ref(
      database,
      `${CONFIG.ROOMS_PATH}/${roomCode}`
    );
  }


  function economyRef(uid) {
    return ref(
      database,
      `users/${uid}/${CONFIG.ECONOMY_PATH}`
    );
  }


  /* =======================================================
     GENERIC HELPERS
     ======================================================= */

  function safeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }


  function normalizeString(value, fallback = "") {

    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    const result = String(value).trim();

    return result || fallback;
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

    return safeNumber(value)
      .toLocaleString("en-IN");
  }


  function formatAge(timestamp) {

    const time =
      safeNumber(timestamp);

    if (!time) {
      return "just now";
    }

    const difference =
      Math.max(
        0,
        Date.now() - time
      );

    const seconds =
      Math.floor(
        difference / 1000
      );

    if (seconds < 10) {
      return "just now";
    }

    if (seconds < 60) {
      return `${seconds}s ago`;
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    return `${Math.floor(hours / 24)}d ago`;
  }


  function getPlayerName(user) {

    if (!user) {
      return "LUDOVERSE Player";
    }

    return (
      normalizeString(
        user.displayName
      ) ||

      normalizeString(
        user.email?.split("@")[0]
      ) ||

      normalizeString(
        user.phoneNumber
      ) ||

      "LUDOVERSE Player"
    );
  }


  function getInitials(name) {

    const parts =
      String(
        name || "Player"
      )
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    const initials =
      parts
        .map(
          part =>
            part
              .charAt(0)
              .toUpperCase()
        )
        .join("");

    return initials || "P";
  }


  /* =======================================================
     TOAST
     ======================================================= */

  function showToast(
    message,
    title = "LUDOVERSE",
    type = "success"
  ) {

    if (
      !toast ||
      !toastMessage
    ) {
      console.log(
        `[${title}] ${message}`
      );

      return;
    }

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    if (toastTitle) {
      toastTitle.textContent =
        title;
    }

    toastMessage.textContent =
      message;

    toast.classList.remove(
      "success",
      "error",
      "info",
      "show"
    );

    toast.classList.add(
      type
    );

    if (toastIcon) {

      toastIcon.textContent =
        type === "error"
          ? "!"
          : type === "info"
            ? "i"
            : "✓";
    }

    requestAnimationFrame(() => {

      toast.classList.add(
        "show"
      );

    });

    toastTimer =
      setTimeout(() => {

        toast.classList.remove(
          "show"
        );

      }, CONFIG.TOAST_DURATION);
  }


  /* =======================================================
     BUSY STATE
     ======================================================= */

  function setBusy(
    value,
    source = ""
  ) {

    busy =
      Boolean(value);

    const buttons = [
      quickMatchBtn,
      createBattleBtn,
      confirmCreateBtn,
      confirmJoinBtn
    ];

    buttons
      .filter(Boolean)
      .forEach(button => {

        button.disabled =
          busy;

      });


    if (quickMatchBtn) {

      if (
        busy &&
        source === "quick"
      ) {

        if (
          !quickMatchBtn.dataset
            .originalHTML
        ) {

          quickMatchBtn.dataset
            .originalHTML =
            quickMatchBtn.innerHTML;
        }

        quickMatchBtn.innerHTML = `
          <span class="btn-icon">◌</span>
          <span>
            <strong>Finding Match...</strong>
            <small>Connecting to a live room</small>
          </span>
        `;

      } else if (
        !busy &&
        quickMatchBtn.dataset
          .originalHTML
      ) {

        quickMatchBtn.innerHTML =
          quickMatchBtn.dataset
            .originalHTML;
      }
    }


    if (confirmCreateBtn) {

      confirmCreateBtn.textContent =
        busy && source === "create"
          ? "Creating Room..."
          : "Create Room →";
    }


    if (confirmJoinBtn) {

      confirmJoinBtn.textContent =
        busy && source === "join"
          ? "Joining Room..."
          : "Join Room →";
    }
  }


  /* =======================================================
     PROFILE
     ======================================================= */

  function renderProfile(user) {

    const name =
      getPlayerName(user);

    const initials =
      getInitials(name);


    if (headerName) {
      headerName.textContent =
        name;
    }


    if (headerEmail) {

      headerEmail.textContent =
        user.email ||
        user.phoneNumber ||
        "Authenticated player";
    }


    if (profileAvatar) {
      profileAvatar.textContent =
        initials;
    }


    if (menuAvatar) {
      menuAvatar.textContent =
        initials;
    }
  }


  function toggleProfileMenu() {

    if (
      !profileMenu ||
      !profileBtn
    ) {
      return;
    }

    profileOpen =
      !profileOpen;

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

    if (
      !profileMenu ||
      !profileBtn
    ) {
      return;
    }

    profileOpen = false;

    profileMenu.classList.remove(
      "show"
    );

    profileBtn.classList.remove(
      "open"
    );

    profileBtn.setAttribute(
      "aria-expanded",
      "false"
    );
  }


  /* =======================================================
     ECONOMY
     ======================================================= */

  async function ensureEconomy(user) {

    if (!user?.uid) {
      return;
    }

    const target =
      economyRef(user.uid);

    const snapshot =
      await get(target);

    if (!snapshot.exists()) {

      const starterEconomy = {

        ludoCoins:
          CONFIG.STARTER_COINS,

        xp: 0,

        gamesPlayed: 0,

        gamesWon: 0,

        activityPoints: 0,

        platformPoints: 0,

        updatedAt:
          Date.now()
      };

      await set(
        target,
        starterEconomy
      );

      return starterEconomy;
    }

    return snapshot.val();
  }


  function listenToEconomy(user) {

    if (economyUnsubscribe) {

      economyUnsubscribe();

      economyUnsubscribe =
        null;
    }

    if (!user?.uid) {
      return;
    }

    economyUnsubscribe =
      onValue(
        economyRef(user.uid),

        snapshot => {

          const data =
            snapshot.exists()
              ? snapshot.val()
              : {};

          const coins =
            Math.max(
              0,
              safeNumber(
                data?.ludoCoins
              )
            );

          if (walletBalance) {

            walletBalance.textContent =
              formatNumber(coins);
          }
        },

        error => {

          console.error(
            "Economy listener error:",
            error
          );

          if (walletBalance) {
            walletBalance.textContent =
              "0";
          }
        }
      );
  }


  /* =======================================================
     CURRENT ROOM
     ======================================================= */

  function saveCurrentRoom(code) {

    currentRoomCode =
      normalizeString(code);

    if (currentRoomCode) {

      localStorage.setItem(
        CONFIG.CURRENT_ROOM_KEY,
        currentRoomCode
      );

    } else {

      localStorage.removeItem(
        CONFIG.CURRENT_ROOM_KEY
      );
    }

    renderActiveRoom();
  }


  function clearCurrentRoom() {

    currentRoomCode = "";

    localStorage.removeItem(
      CONFIG.CURRENT_ROOM_KEY
    );

    renderActiveRoom();
  }


  function getCurrentRoom() {

    if (!currentRoomCode) {
      return null;
    }

    return (
      rooms[currentRoomCode] ||
      null
    );
  }


  /* =======================================================
     ROOM NORMALIZATION
     ======================================================= */

  function normalizePlayer(
    uid,
    data
  ) {

    const player =
      data &&
      typeof data === "object"
        ? data
        : {};

    return {

      uid:
        normalizeString(
          player.uid,
          uid
        ),

      name:
        normalizeString(
          player.name,
          "LUDOVERSE Player"
        ),

      photo:
        normalizeString(
          player.photo
        ),

      joinedAt:
        safeNumber(
          player.joinedAt
        ),

      ready:
        player.ready === true,

      connected:
        player.connected !== false
    };
  }


  function normalizeRoom(
    code,
    data
  ) {

    if (
      !data ||
      typeof data !== "object"
    ) {
      return null;
    }

    const sourcePlayers =
      data.players &&
      typeof data.players === "object"
        ? data.players
        : {};

    const players = {};

    Object.entries(
      sourcePlayers
    ).forEach(
      ([uid, player]) => {

        if (
          player &&
          typeof player === "object"
        ) {

          players[uid] =
            normalizePlayer(
              uid,
              player
            );
        }
      }
    );


    return {

      roomCode:
        normalizeString(
          data.roomCode,
          code
        ),

      battleId:
        normalizeString(
          data.battleId,
          code
        ),

      game:
        normalizeString(
          data.game,
          "ludo"
        ),

      mode:
        normalizeString(
          data.mode,
          "private"
        ),

      creatorUid:
        normalizeString(
          data.creatorUid
        ),

      creatorName:
        normalizeString(
          data.creatorName,
          "LUDOVERSE Player"
        ),

      creatorPhoto:
        normalizeString(
          data.creatorPhoto
        ),

      players,

      playerCount:
        Object.keys(players)
          .length,

      maxPlayers:
        Math.max(
          CONFIG.MAX_PLAYERS,
          safeNumber(
            data.maxPlayers,
            CONFIG.MAX_PLAYERS
          )
        ),

      status:
        normalizeString(
          data.status,
          "waiting"
        ),

      createdAt:
        safeNumber(
          data.createdAt
        ),

      updatedAt:
        safeNumber(
          data.updatedAt
        ),

      startedAt:
        safeNumber(
          data.startedAt
        ),

      completedAt:
        safeNumber(
          data.completedAt
        )
    };
  }


  /* =======================================================
     ROOM CODE
     ======================================================= */

  function generateRoomCode() {

    return String(
      Math.floor(
        100000 +
        Math.random() * 900000
      )
    );
  }


  async function generateUniqueRoomCode() {

    for (
      let attempt = 0;
      attempt <
        CONFIG.ROOM_CREATION_ATTEMPTS;
      attempt++
    ) {

      const code =
        generateRoomCode();

      const snapshot =
        await get(
          roomRef(code)
        );

      if (!snapshot.exists()) {
        return code;
      }
    }

    throw new Error(
      "Could not generate a unique room code. Please try again."
    );
  }


  /* =======================================================
     PLAYER FACTORY
     ======================================================= */

  function createPlayerRecord(
    user,
    now
  ) {

    return {

      uid:
        user.uid,

      name:
        getPlayerName(user),

      photo:
        user.photoURL || "",

      joinedAt:
        now,

      ready:
        false,

      connected:
        true
    };
  }


  /* =======================================================
     ROOM FACTORY
     ======================================================= */

  function createRoomData(
    code,
    mode = "private"
  ) {

    const now =
      Date.now();

    const player =
      createPlayerRecord(
        currentUser,
        now
      );


    return {

      battleId:
        code,

      roomCode:
        code,

      game:
        "ludo",

      mode:
        mode === "quick"
          ? "quick"
          : "private",

      creatorUid:
        currentUser.uid,

      creatorName:
        getPlayerName(
          currentUser
        ),

      creatorPhoto:
        currentUser.photoURL || "",

      players: {

        [currentUser.uid]:
          player
      },

      maxPlayers:
        CONFIG.MAX_PLAYERS,

      status:
        "waiting",

      createdAt:
        now,

      updatedAt:
        now,

      startedAt:
        0,

      completedAt:
        0
    };
  }


  /* =======================================================
     CREATE ROOM
     ======================================================= */

  async function createRoom() {

    if (busy) {
      return;
    }

    if (!currentUser) {

      showToast(
        "Please login before creating a room.",
        "Login Required",
        "error"
      );

      return;
    }


    setBusy(
      true,
      "create"
    );


    try {

      const code =
        await generateUniqueRoomCode();

      const target =
        roomRef(code);

      const roomData =
        createRoomData(
          code,
          "private"
        );


      const result =
        await runTransaction(
          target,

          current => {

            if (
              current !== null
            ) {
              return;
            }

            return roomData;
          }
        );


      if (!result.committed) {

        throw new Error(
          "Room creation was cancelled."
        );
      }


      saveCurrentRoom(code);

      closeCreateModal();


      showToast(
        `Room ${code} created successfully.`,
        "Room Created",
        "success"
      );


      setTimeout(() => {

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(code)}`;

      }, CONFIG.OPEN_DELAY);


    } catch (error) {

      console.error(
        "Create room error:",
        error
      );

      showToast(
        error?.message ||
          "Could not create the room.",
        "Room Error",
        "error"
      );

    } finally {

      setBusy(
        false,
        "create"
      );
    }
  }


  /* =======================================================
     JOIN ROOM — ATOMIC
     ======================================================= */

  async function joinRoomInternal(
    code
  ) {

    if (!currentUser) {

      throw new Error(
        "Authentication required."
      );
    }


    const normalizedCode =
      String(code || "")
        .replace(/\D/g, "")
        .slice(
          0,
          CONFIG.ROOM_CODE_LENGTH
        );


    if (
      !/^\d{6}$/.test(
        normalizedCode
      )
    ) {

      throw new Error(
        "Enter a valid 6-digit room code."
      );
    }


    const target =
      roomRef(
        normalizedCode
      );

    const now =
      Date.now();

    const player =
      createPlayerRecord(
        currentUser,
        now
      );


    const result =
      await runTransaction(
        target,

        current => {

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


          /* Already inside room */

          if (
            players[
              currentUser.uid
            ]
          ) {

            return current;
          }


          const status =
            String(
              current.status ||
                "waiting"
            );


          if (
            status !== "waiting"
          ) {

            return;
          }


          const maxPlayers =
            Math.max(
              CONFIG.MAX_PLAYERS,
              safeNumber(
                current.maxPlayers,
                CONFIG.MAX_PLAYERS
              )
            );


          if (
            Object.keys(players)
              .length >=
            maxPlayers
          ) {

            return;
          }


          players[
            currentUser.uid
          ] = player;


          return {

            ...current,

            players,

            updatedAt:
              now
          };
        }
      );


    if (!result.committed) {

      const latest =
        await get(target);


      if (!latest.exists()) {

        throw new Error(
          "This room does not exist."
        );
      }


      const room =
        normalizeRoom(
          normalizedCode,
          latest.val()
        );


      if (
        room?.players?.[
          currentUser.uid
        ]
      ) {

        return {

          roomCode:
            normalizedCode,

          alreadyJoined:
            true
        };
      }


      if (
        room &&
        room.status !==
          "waiting"
      ) {

        throw new Error(
          "This room has already started."
        );
      }


      throw new Error(
        "This room is full or unavailable."
      );
    }


    return {

      roomCode:
        normalizedCode,

      alreadyJoined:
        false
    };
  }


  /* =======================================================
     PUBLIC JOIN
     ======================================================= */

  async function joinRoom(
    code
  ) {

    if (busy) {
      return;
    }

    if (!currentUser) {

      showToast(
        "Please login before joining a room.",
        "Login Required",
        "error"
      );

      return;
    }


    setBusy(
      true,
      "join"
    );


    try {

      const result =
        await joinRoomInternal(
          code
        );


      saveCurrentRoom(
        result.roomCode
      );

      closeJoinModal();


      showToast(
        result.alreadyJoined
          ? "Opening your room..."
          : "You joined the room successfully.",
        result.alreadyJoined
          ? "Room"
          : "Room Joined",
        "success"
      );


      setTimeout(() => {

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(
            result.roomCode
          )}`;

      }, CONFIG.OPEN_DELAY);


    } catch (error) {

      console.error(
        "Join room error:",
        error
      );

      showToast(
        error?.message ||
          "Could not join the room.",
        "Join Error",
        "error"
      );

    } finally {

      setBusy(
        false,
        "join"
      );
    }
  }


  /* =======================================================
     QUICK MATCH
     ======================================================= */

  async function quickMatch() {

    if (busy) {
      return;
    }

    if (!currentUser) {

      showToast(
        "Please login before using Quick Match.",
        "Login Required",
        "error"
      );

      return;
    }


    setBusy(
      true,
      "quick"
    );


    try {

      const snapshot =
        await get(
          roomsRef()
        );


      const data =
        snapshot.exists()
          ? snapshot.val()
          : {};


      const candidates = [];


      Object.entries(data)
        .forEach(
          ([code, rawRoom]) => {

            const room =
              normalizeRoom(
                code,
                rawRoom
              );

            if (!room) {
              return;
            }


            const available =
              room.status ===
                "waiting" &&

              room.playerCount <
                room.maxPlayers &&

              !room.players?.[
                currentUser.uid
              ];


            if (available) {

              candidates.push(
                room
              );
            }
          }
        );


      candidates.sort(
        (a, b) =>
          safeNumber(
            a.createdAt
          ) -
          safeNumber(
            b.createdAt
          )
      );


      /* Try existing room */

      for (
        const candidate
          of candidates
      ) {

        try {

          const result =
            await joinRoomInternal(
              candidate.roomCode
            );


          saveCurrentRoom(
            result.roomCode
          );


          showToast(
            "Opponent found. Opening the room...",
            "Match Found",
            "success"
          );


          setTimeout(() => {

            window.location.href =
              `battle-room.html?room=${encodeURIComponent(
                result.roomCode
              )}`;

          }, CONFIG.OPEN_DELAY);


          return;

        } catch (error) {

          console.warn(
            "Quick Match candidate unavailable:",
            candidate.roomCode,
            error
          );
        }
      }


      /* No room found → create one */

      const code =
        await generateUniqueRoomCode();


      const roomData =
        createRoomData(
          code,
          "quick"
        );


      const result =
        await runTransaction(
          roomRef(code),

          current => {

            if (
              current !== null
            ) {
              return;
            }

            return roomData;
          }
        );


      if (!result.committed) {

        throw new Error(
          "Could not create Quick Match room."
        );
      }


      saveCurrentRoom(
        code
      );


      showToast(
        `Quick Match room ${code} created.`,
        "Quick Match",
        "success"
      );


      setTimeout(() => {

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(
            code
          )}`;

      }, CONFIG.OPEN_DELAY);


    } catch (error) {

      console.error(
        "Quick Match error:",
        error
      );

      showToast(
        error?.message ||
          "Quick Match could not start.",
        "Match Error",
        "error"
      );

    } finally {

      setBusy(
        false,
        "quick"
      );
    }
  }


  /* =======================================================
     RENDER ROOMS
     ======================================================= */

  function renderRooms() {

    if (!roomsList) {
      return;
    }


    const availableRooms =
      Object.values(rooms)
        .map(room =>
          normalizeRoom(
            room.roomCode,
            room
          )
        )
        .filter(Boolean)
        .filter(room =>

          room.status ===
            "waiting" &&

          room.playerCount <
            room.maxPlayers
        )
        .sort(
          (a, b) =>
            safeNumber(
              a.createdAt
            ) -
            safeNumber(
              b.createdAt
            )
        );


    if (availableBattleCount) {

      availableBattleCount.textContent =
        String(
          availableRooms.length
        );
    }


    if (onlinePlayerCount) {

      onlinePlayerCount.textContent =
        String(
          availableRooms.reduce(
            (total, room) =>
              total +
              room.playerCount,

            0
          )
        );
    }


    roomsList.innerHTML =
      "";


    if (
      availableRooms.length ===
      0
    ) {

      emptyState?.classList
        .remove("hidden");

      return;
    }


    emptyState?.classList
      .add("hidden");


    availableRooms.forEach(
      room => {

        const card =
          document.createElement(
            "article"
          );


        card.className =
          "room-card";


        const creator =
          escapeHTML(
            room.creatorName
          );


        const code =
          escapeHTML(
            room.roomCode
          );


        const age =
          escapeHTML(
            formatAge(
              room.createdAt
            )
          );


        const initials =
          escapeHTML(
            getInitials(
              room.creatorName
            )
          );


        card.innerHTML = `

          <div class="room-left">

            <div
              class="room-avatar"
              aria-hidden="true"
            >
              ${initials}
            </div>

            <div class="room-info">

              <div class="room-title-line">

                <h3>
                  ${creator}
                </h3>

                <span
                  class="room-live-dot"
                  aria-hidden="true"
                ></span>

              </div>

              <div class="room-meta">

                <span
                  class="waiting-badge"
                >
                  ● WAITING
                </span>

                <span
                  class="room-players"
                >
                  ${room.playerCount}/${room.maxPlayers}
                  players
                </span>

                <span
                  class="room-age"
                >
                  ${age}
                </span>

              </div>

              <p class="room-description">
                Free Ludo multiplayer · Ready when you are
              </p>

            </div>

          </div>


          <div class="room-actions">

            <div
              class="room-code-small"
              aria-label="Room code"
            >
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


        const joinButton =
          card.querySelector(
            ".join-room-btn"
          );


        joinButton?.addEventListener(
          "click",
          () => {

            openJoinModal(
              room.roomCode
            );

          }
        );


        roomsList.appendChild(
          card
        );
      }
    );
  }


  /* =======================================================
     ACTIVE ROOM
     ======================================================= */

  function renderActiveRoom() {

    if (!activeRoomSection) {
      return;
    }


    const room =
      getCurrentRoom();


    if (!room) {

      activeRoomSection.classList
        .remove("show");

      return;
    }


    if (
      currentUser &&
      !room.players?.[
        currentUser.uid
      ]
    ) {

      clearCurrentRoom();

      return;
    }


    activeRoomSection.classList
      .add("show");


    if (activeRoomCode) {

      activeRoomCode.textContent =
        room.roomCode;
    }


    if (activeRoomPlayers) {

      activeRoomPlayers.textContent =
        `${room.playerCount}/${room.maxPlayers}`;
    }


    if (activeRoomStatus) {

      if (
        room.status ===
        "playing"
      ) {

        activeRoomStatus.textContent =
          "Match is in progress";

      } else if (
        room.playerCount >=
        room.maxPlayers
      ) {

        activeRoomStatus.textContent =
          "Opponent connected · Open the room to get ready";

      } else {

        activeRoomStatus.textContent =
          "Waiting for another player...";
      }
    }
  }


  /* =======================================================
     REALTIME ROOM LISTENER
     ======================================================= */

  function startRoomsListener() {

    if (roomsUnsubscribe) {
      return;
    }


    roomsUnsubscribe =
      onValue(

        roomsRef(),

        snapshot => {

          const data =
            snapshot.exists()
              ? snapshot.val()
              : {};


          const normalized =
            {};


          Object.entries(data)
            .forEach(
              ([code, rawRoom]) => {

                const room =
                  normalizeRoom(
                    code,
                    rawRoom
                  );


                if (room) {

                  normalized[
                    room.roomCode
                  ] = room;
                }
              }
            );


          rooms =
            normalized;


          renderRooms();

          renderActiveRoom();
        },


        error => {

          console.error(
            "Room listener error:",
            error
          );

          showToast(
            "Live room updates are temporarily unavailable.",
            "Connection Error",
            "error"
          );
        }
      );
  }


  /* =======================================================
     VALIDATE SAVED ROOM
     ======================================================= */

  async function validateCurrentRoom() {

    if (!currentRoomCode) {

      renderActiveRoom();

      return;
    }


    try {

      const snapshot =
        await get(
          roomRef(
            currentRoomCode
          )
        );


      if (!snapshot.exists()) {

        clearCurrentRoom();

        return;
      }


      const room =
        normalizeRoom(
          currentRoomCode,
          snapshot.val()
        );


      if (!room) {

        clearCurrentRoom();

        return;
      }


      if (
        currentUser &&
        !room.players?.[
          currentUser.uid
        ]
      ) {

        clearCurrentRoom();

        return;
      }


      rooms[
        room.roomCode
      ] = room;


      renderActiveRoom();


    } catch (error) {

      console.error(
        "Current room validation error:",
        error
      );
    }
  }


  /* =======================================================
     MODALS
     ======================================================= */

  function openCreateModal() {

    if (!createModal) {
      return;
    }

    createModal.classList
      .add("show");

    document.body.classList
      .add("modal-open");
  }


  function closeCreateModal() {

    if (!createModal) {
      return;
    }

    createModal.classList
      .remove("show");

    document.body.classList
      .remove("modal-open");
  }


  function openJoinModal(
    code = ""
  ) {

    if (!joinModal) {
      return;
    }


    if (roomCodeInput) {

      roomCodeInput.value =
        String(code || "")
          .replace(/\D/g, "")
          .slice(0, 6);

      setTimeout(() => {

        roomCodeInput.focus();

      }, 80);
    }


    joinModal.classList
      .add("show");

    document.body.classList
      .add("modal-open");
  }


  function closeJoinModal() {

    if (!joinModal) {
      return;
    }

    joinModal.classList
      .remove("show");

    document.body.classList
      .remove("modal-open");
  }


  /* =======================================================
     COPY
     ======================================================= */

  async function copyText(
    value
  ) {

    const text =
      String(value || "");


    if (!text) {
      return false;
    }


    try {

      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {

        await navigator.clipboard
          .writeText(text);

        return true;
      }

    } catch (error) {

      console.warn(
        "Clipboard API failed:",
        error
      );
    }


    try {

      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value =
        text;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.focus();

      textarea.select();

      const success =
        document.execCommand(
          "copy"
        );

      textarea.remove();

      return success;

    } catch (error) {

      console.error(
        "Fallback copy failed:",
        error
      );

      return false;
    }
  }


  /* =======================================================
     LEAVE ROOM FROM LOBBY
     ======================================================= */

  async function leaveCurrentRoom() {

    if (!currentUser) {
      return;
    }


    const code =
      currentRoomCode;


    if (!code) {
      return;
    }


    try {

      const target =
        roomRef(code);


      const result =
        await runTransaction(
          target,

          current => {

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


            const isCreator =
              current.creatorUid ===
              currentUser.uid;


            if (isCreator) {

              return null;
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


      if (
        !result.committed
      ) {

        throw new Error(
          "Could not leave the room."
        );
      }


      clearCurrentRoom();


      showToast(
        "You left the room.",
        "Room",
        "success"
      );


    } catch (error) {

      console.error(
        "Leave room error:",
        error
      );

      showToast(
        error?.message ||
          "Could not leave the room.",
        "Leave Error",
        "error"
      );
    }
  }


  /* =======================================================
     EVENT LISTENERS
     ======================================================= */

  quickMatchBtn?.addEventListener(
    "click",
    quickMatch
  );


  createBattleBtn?.addEventListener(
    "click",
    openCreateModal
  );


  emptyCreateBtn?.addEventListener(
    "click",
    openCreateModal
  );


  refreshBtn?.addEventListener(
    "click",
    () => {

      renderRooms();

      validateCurrentRoom();

      showToast(
        "Room list refreshed.",
        "Lobby",
        "info"
      );
    }
  );


  closeCreateModalButton
    ?.addEventListener(
      "click",
      closeCreateModal
    );


  cancelCreateBtn
    ?.addEventListener(
      "click",
      closeCreateModal
    );


  confirmCreateBtn
    ?.addEventListener(
      "click",
      createRoom
    );


  closeJoinModalButton
    ?.addEventListener(
      "click",
      closeJoinModal
    );


  cancelJoinBtn
    ?.addEventListener(
      "click",
      closeJoinModal
    );


  confirmJoinBtn
    ?.addEventListener(
      "click",
      () => {

        joinRoom(
          roomCodeInput?.value
        );

      }
    );


  roomCodeInput
    ?.addEventListener(
      "input",
      () => {

        roomCodeInput.value =
          roomCodeInput.value
            .replace(/\D/g, "")
            .slice(0, 6);
      }
    );


  roomCodeInput
    ?.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();

          joinRoom(
            roomCodeInput.value
          );
        }
      }
    );


  profileBtn
    ?.addEventListener(
      "click",
      event => {

        event.stopPropagation();

        toggleProfileMenu();
      }
    );


  document.addEventListener(
    "click",
    event => {

      if (
        profileOpen &&
        profileMenu &&
        !profileMenu.contains(
          event.target
        ) &&
        !profileBtn?.contains(
          event.target
        )
      ) {

        closeProfileMenu();
      }
    }
  );


  logoutBtn
    ?.addEventListener(
      "click",
      async () => {

        try {

          await signOut(auth);

        } catch (error) {

          console.error(
            "Logout error:",
            error
          );

          showToast(
            "Could not logout.",
            "Logout Error",
            "error"
          );
        }
      }
    );


  copyRoomBtn
    ?.addEventListener(
      "click",
      async () => {

        const code =
          currentRoomCode;

        const success =
          await copyText(code);

        showToast(
          success
            ? "Room code copied."
            : `Room code: ${code}`,
          "Room Code",
          success
            ? "success"
            : "info"
        );
      }
    );


  openRoomBtn
    ?.addEventListener(
      "click",
      () => {

        if (!currentRoomCode) {
          return;
        }

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(
            currentRoomCode
          )}`;
      }
    );


  leaveRoomBtn
    ?.addEventListener(
      "click",
      leaveCurrentRoom
    );


  /* =======================================================
     MODAL BACKDROP
     ======================================================= */

  [createModal, joinModal]
    .filter(Boolean)
    .forEach(modal => {

      modal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            modal
          ) {

            if (
              modal ===
              createModal
            ) {

              closeCreateModal();

            } else {

              closeJoinModal();
            }
          }
        }
      );
    });


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {

        closeCreateModal();

        closeJoinModal();

        closeProfileMenu();
      }
    }
  );


  /* =======================================================
     AUTH STATE
     ======================================================= */

  onAuthStateChanged(
    auth,

    async user => {

      currentUser =
        user || null;


      if (!currentUser) {

        if (
          economyUnsubscribe
        ) {

          economyUnsubscribe();

          economyUnsubscribe =
            null;
        }


        if (
          roomsUnsubscribe
        ) {

          roomsUnsubscribe();

          roomsUnsubscribe =
            null;
        }


        window.location.href =
          "login.html";

        return;
      }


      renderProfile(
        currentUser
      );


      try {

        await ensureEconomy(
          currentUser
        );

      } catch (error) {

        console.error(
          "Economy initialization error:",
          error
        );
      }


      listenToEconomy(
        currentUser
      );


      startRoomsListener();


      await validateCurrentRoom();


      renderRooms();

      renderActiveRoom();
    }
  );


  /* =======================================================
     INITIAL UI
     ======================================================= */

  renderRooms();

  renderActiveRoom();

});