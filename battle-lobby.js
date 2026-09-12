"use strict";

import {
  auth,
  database,
  ref,
  get,
  set,
  update,
  onValue,
  runTransaction,
  onAuthStateChanged,
  signOut
} from "./firebase.js";


/*
=========================================================
 LUDOVERSE — PROFESSIONAL MULTIPLAYER LOBBY
=========================================================

 FEATURES
 - Firebase Realtime Database
 - Authentication protected
 - Live room list
 - Quick Match
 - Private 6-digit rooms
 - Atomic room creation
 - Atomic player joining
 - Realtime LudoCoin display
 - Active room persistence
 - Profile menu
 - Logout
 - Mobile responsive UI

 FREE PLAY
 - No entry amount
 - No prize pool
 - No withdrawals
 - No cash rewards
 - LudoCoins are progression points only
=========================================================
*/


document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     DOM
  ========================= */

  const walletBalance =
    document.getElementById("walletBalance");

  const headerName =
    document.getElementById("headerName");

  const headerEmail =
    document.getElementById("headerEmail");

  const profileBtn =
    document.getElementById("profileBtn");

  const profileMenu =
    document.getElementById("profileMenu");

  const profileAvatar =
    document.getElementById("profileAvatar");

  const menuAvatar =
    document.getElementById("menuAvatar");

  const logoutBtn =
    document.getElementById("logoutBtn");

  const availableBattleCount =
    document.getElementById("availableBattleCount");

  const onlinePlayerCount =
    document.getElementById("onlinePlayerCount");

  const roomsList =
    document.getElementById("roomsList");

  const emptyState =
    document.getElementById("emptyState");

  const quickMatchBtn =
    document.getElementById("quickMatchBtn");

  const createBattleBtn =
    document.getElementById("createBattleBtn");

  const emptyCreateBtn =
    document.getElementById("emptyCreateBtn");

  const refreshBtn =
    document.getElementById("refreshBtn");

  const activeRoomSection =
    document.getElementById("activeRoomSection");

  const activeRoomCode =
    document.getElementById("activeRoomCode");

  const activeRoomStatus =
    document.getElementById("activeRoomStatus");

  const copyRoomBtn =
    document.getElementById("copyRoomBtn");

  const openRoomBtn =
    document.getElementById("openRoomBtn");

  const createModal =
    document.getElementById("createModal");

  const closeCreateModal =
    document.getElementById("closeCreateModal");

  const cancelCreateBtn =
    document.getElementById("cancelCreateBtn");

  const confirmCreateBtn =
    document.getElementById("confirmCreateBtn");

  const joinModal =
    document.getElementById("joinModal");

  const closeJoinModal =
    document.getElementById("closeJoinModal");

  const cancelJoinBtn =
    document.getElementById("cancelJoinBtn");

  const confirmJoinBtn =
    document.getElementById("confirmJoinBtn");

  const roomCodeInput =
    document.getElementById("roomCodeInput");

  const toast =
    document.getElementById("toast");

  const toastIcon =
    document.getElementById("toastIcon");

  const toastTitle =
    document.getElementById("toastTitle");

  const toastMessage =
    document.getElementById("toastMessage");


  /* =========================
     STATE
  ========================= */

  let currentUser = null;

  let rooms = {};

  let currentRoomCode =
    localStorage.getItem("ludoverseCurrentRoom") || "";

  let roomsUnsubscribe = null;

  let economyUnsubscribe = null;

  let busy = false;


  /* =========================
     CONSTANTS
  ========================= */

  const ROOMS_PATH = "battles";

  const MAX_PLAYERS = 2;

  const ROOM_CODE_LENGTH = 6;

  const STARTER_COINS = 1000;


  /* =========================
     HELPERS
  ========================= */

  function getRoomsRef() {
    return ref(database, ROOMS_PATH);
  }


  function getRoomRef(roomCode) {
    return ref(
      database,
      `${ROOMS_PATH}/${roomCode}`
    );
  }


  function getEconomyRef(uid) {
    return ref(
      database,
      `users/${uid}/economy`
    );
  }


  function playerName(user) {

    if (!user) {
      return "LUDOVERSE Player";
    }

    return (
      user.displayName ||
      user.email?.split("@")[0] ||
      user.phoneNumber ||
      "LUDOVERSE Player"
    );
  }


  function initials(name) {

    const value =
      String(name || "Player")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0))
        .join("")
        .toUpperCase();

    return value || "P";
  }


  function normalizeNumber(value, fallback = 0) {

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }


  function normalizeEconomy(data) {

    return {
      ludoCoins: Math.max(
        0,
        normalizeNumber(data?.ludoCoins)
      ),

      xp: Math.max(
        0,
        normalizeNumber(data?.xp)
      ),

      gamesPlayed: Math.max(
        0,
        normalizeNumber(data?.gamesPlayed)
      ),

      gamesWon: Math.max(
        0,
        normalizeNumber(data?.gamesWon)
      ),

      activityPoints: Math.max(
        0,
        normalizeNumber(data?.activityPoints)
      ),

      platformPoints: Math.max(
        0,
        normalizeNumber(data?.platformPoints)
      )
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


  function showToast(
    message,
    title = "LUDOVERSE",
    type = "success"
  ) {

    if (!toast || !toastMessage) {
      alert(message);
      return;
    }

    if (toastTitle) {
      toastTitle.textContent = title;
    }

    toastMessage.textContent = message;

    if (toastIcon) {

      if (type === "error") {
        toastIcon.textContent = "!";
        toastIcon.style.color = "#fca5a5";
        toastIcon.style.background =
          "rgba(239,68,68,.11)";
      }

      else if (type === "info") {
        toastIcon.textContent = "i";
        toastIcon.style.color = "#93c5fd";
        toastIcon.style.background =
          "rgba(59,130,246,.11)";
      }

      else {
        toastIcon.textContent = "✓";
        toastIcon.style.color = "#86efac";
        toastIcon.style.background =
          "rgba(34,197,94,.11)";
      }
    }

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }


  function setBusy(value) {

    busy = value;

    if (quickMatchBtn) {
      quickMatchBtn.disabled = value;

      if (value) {
        quickMatchBtn.dataset.originalHTML =
          quickMatchBtn.innerHTML;

        quickMatchBtn.innerHTML = `
          <span class="btn-icon">◌</span>
          <span>
            <strong>Finding Match...</strong>
            <small>Please wait</small>
          </span>
        `;
      }

      else if (quickMatchBtn.dataset.originalHTML) {
        quickMatchBtn.innerHTML =
          quickMatchBtn.dataset.originalHTML;
      }
    }

    if (createBattleBtn) {
      createBattleBtn.disabled = value;
    }

    if (confirmCreateBtn) {
      confirmCreateBtn.disabled = value;
      confirmCreateBtn.textContent =
        value ? "Creating Room..." : "Create Room →";
    }

    if (confirmJoinBtn) {
      confirmJoinBtn.disabled = value;
      confirmJoinBtn.textContent =
        value ? "Joining Room..." : "Join Room →";
    }
  }


  /* =========================
     PROFILE
  ========================= */

  function renderProfile(user) {

    const name = playerName(user);

    if (headerName) {
      headerName.textContent = name;
    }

    if (headerEmail) {
      headerEmail.textContent =
        user.email ||
        user.phoneNumber ||
        "Authenticated player";
    }

    const letters = initials(name);

    if (profileAvatar) {
      profileAvatar.textContent = letters;
    }

    if (menuAvatar) {
      menuAvatar.textContent = letters;
    }
  }


  function toggleProfileMenu() {

    if (!profileMenu || !profileBtn) {
      return;
    }

    const isOpen =
      profileMenu.classList.toggle("show");

    profileBtn.classList.toggle(
      "open",
      isOpen
    );

    profileBtn.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  }


  function closeProfileMenu() {

    if (!profileMenu || !profileBtn) {
      return;
    }

    profileMenu.classList.remove("show");
    profileBtn.classList.remove("open");

    profileBtn.setAttribute(
      "aria-expanded",
      "false"
    );
  }


  /* =========================
     ECONOMY
  ========================= */

  async function ensureEconomy(user) {

    const economyRef =
      getEconomyRef(user.uid);

    const snapshot =
      await get(economyRef);

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

      await set(
        economyRef,
        starterEconomy
      );

      return starterEconomy;
    }

    return normalizeEconomy(
      snapshot.val()
    );
  }


  function listenToEconomy(user) {

    if (economyUnsubscribe) {
      economyUnsubscribe();
      economyUnsubscribe = null;
    }

    economyUnsubscribe =
      onValue(
        getEconomyRef(user.uid),

        snapshot => {

          const economy =
            snapshot.exists()
              ? normalizeEconomy(snapshot.val())
              : {
                  ludoCoins: 0,
                  xp: 0,
                  gamesPlayed: 0,
                  gamesWon: 0,
                  activityPoints: 0,
                  platformPoints: 0
                };

          if (walletBalance) {
            walletBalance.textContent =
              economy.ludoCoins.toLocaleString();
          }
        },

        error => {

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


  /* =========================
     ROOM NORMALIZATION
  ========================= */

  function normalizeRoom(
    roomCode,
    data
  ) {

    if (
      !data ||
      typeof data !== "object"
    ) {
      return null;
    }

    const players =
      data.players &&
      typeof data.players === "object"
        ? data.players
        : {};

    const playerList =
      Object.values(players);

    return {

      roomCode: String(roomCode),

      battleId:
        data.battleId ||
        String(roomCode),

      game:
        data.game ||
        "ludo",

      mode:
        data.mode ||
        "private",

      creatorUid:
        data.creatorUid ||
        "",

      creatorName:
        data.creatorName ||
        "LUDOVERSE Player",

      creatorPhoto:
        data.creatorPhoto ||
        "",

      players,

      playerCount:
        playerList.length,

      maxPlayers:
        Math.max(
          2,
          normalizeNumber(
            data.maxPlayers,
            MAX_PLAYERS
          )
        ),

      status:
        data.status ||
        "waiting",

      createdAt:
        normalizeNumber(
          data.createdAt,
          0
        ),

      updatedAt:
        normalizeNumber(
          data.updatedAt,
          0
        )
    };
  }


  /* =========================
     ROOM CODE
  ========================= */

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
      attempt < 15;
      attempt++
    ) {

      const code =
        generateRoomCode();

      const snapshot =
        await get(
          getRoomRef(code)
        );

      if (!snapshot.exists()) {
        return code;
      }
    }

    throw new Error(
      "Could not generate a unique room code."
    );
  }


  /* =========================
     CURRENT ROOM
  ========================= */

  function saveCurrentRoom(code) {

    currentRoomCode =
      String(code || "");

    if (currentRoomCode) {

      localStorage.setItem(
        "ludoverseCurrentRoom",
        currentRoomCode
      );

    } else {

      localStorage.removeItem(
        "ludoverseCurrentRoom"
      );
    }

    renderActiveRoom();
  }


  function clearCurrentRoom() {

    currentRoomCode = "";

    localStorage.removeItem(
      "ludoverseCurrentRoom"
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


  /* =========================
     ROOM MODALS
  ========================= */

  function openCreateModal() {

    if (!currentUser) {

      showToast(
        "Please login before creating a room.",
        "Login Required",
        "error"
      );

      return;
    }

    createModal?.classList.add("show");
  }


  function closeCreate() {

    createModal?.classList.remove("show");
  }


  function openJoinModal(code = "") {

    if (!currentUser) {

      showToast(
        "Please login before joining a room.",
        "Login Required",
        "error"
      );

      return;
    }

    if (roomCodeInput) {

      roomCodeInput.value =
        String(code)
          .replace(/\D/g, "")
          .slice(
            0,
            ROOM_CODE_LENGTH
          );
    }

    joinModal?.classList.add("show");

    setTimeout(() => {
      roomCodeInput?.focus();
    }, 120);
  }


  function closeJoin() {

    joinModal?.classList.remove("show");
  }


  /* =========================
     CREATE ROOM
  ========================= */

  async function createRoom() {

    if (busy) {
      return;
    }

    if (!currentUser) {

      showToast(
        "Please login first.",
        "Login Required",
        "error"
      );

      return;
    }

    setBusy(true);

    try {

      const roomCode =
        await generateUniqueRoomCode();

      const now = Date.now();

      const player = {
        uid: currentUser.uid,
        name: playerName(currentUser),
        photo: currentUser.photoURL || "",
        joinedAt: now,
        ready: false
      };

      const roomData = {

        battleId: roomCode,

        roomCode: roomCode,

        game: "ludo",

        mode: "private",

        creatorUid:
          currentUser.uid,

        creatorName:
          playerName(currentUser),

        creatorPhoto:
          currentUser.photoURL || "",

        players: {
          [currentUser.uid]: player
        },

        maxPlayers:
          MAX_PLAYERS,

        status: "waiting",

        createdAt: now,

        updatedAt: now
      };


      const roomRef =
        getRoomRef(roomCode);


      const transaction =
        await runTransaction(
          roomRef,
          current => {

            if (current !== null) {
              return;
            }

            return roomData;
          }
        );


      if (!transaction.committed) {

        throw new Error(
          "Room creation was cancelled."
        );
      }


      saveCurrentRoom(roomCode);

      closeCreate();

      showToast(
        `Room ${roomCode} created successfully.`,
        "Room Created"
      );


      setTimeout(() => {

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(roomCode)}`;

      }, 450);

    }

    catch (error) {

      console.error(
        "Create room error:",
        error
      );

      showToast(
        "Could not create the room. Please try again.",
        "Room Error",
        "error"
      );

    }

    finally {

      setBusy(false);

    }
  }


  /* =========================
     JOIN ROOM INTERNAL
  ========================= */

  async function joinRoomInternal(
    roomCode
  ) {

    if (!currentUser) {
      throw new Error(
        "Authentication required."
      );
    }

    const normalizedCode =
      String(roomCode || "")
        .replace(/\D/g, "")
        .slice(
          0,
          ROOM_CODE_LENGTH
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


    const roomRef =
      getRoomRef(normalizedCode);


    const now = Date.now();


    const player = {

      uid:
        currentUser.uid,

      name:
        playerName(currentUser),

      photo:
        currentUser.photoURL || "",

      joinedAt:
        now,

      ready:
        false
    };


    let joinResult;


    joinResult =
      await runTransaction(
        roomRef,
        current => {

          if (!current) {
            return;
          }


          const players =
            current.players &&
            typeof current.players === "object"
              ? {
                  ...current.players
                }
              : {};


          const existingPlayer =
            players[
              currentUser.uid
            ];


          if (
            existingPlayer
          ) {

            return current;
          }


          const playerCount =
            Object.keys(players)
              .length;


          const maxPlayers =
            Math.max(
              2,
              normalizeNumber(
                current.maxPlayers,
                MAX_PLAYERS
              )
            );


          if (
            current.status !==
            "waiting"
          ) {
            return;
          }


          if (
            playerCount >=
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


    if (
      !joinResult.committed
    ) {

      const latest =
        await get(roomRef);


      if (!latest.exists()) {

        throw new Error(
          "This room does not exist."
        );
      }


      const latestRoom =
        normalizeRoom(
          normalizedCode,
          latest.val()
        );


      if (
        latestRoom?.players?.[
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


      throw new Error(
        "This room is already full or unavailable."
      );
    }


    return {
      roomCode:
        normalizedCode,

      alreadyJoined:
        false
    };
  }


  /* =========================
     JOIN ROOM
  ========================= */

  async function joinRoom(
    roomCode
  ) {

    if (busy) {
      return;
    }

    if (!currentUser) {

      showToast(
        "Please login first.",
        "Login Required",
        "error"
      );

      return;
    }

    setBusy(true);

    try {

      const result =
        await joinRoomInternal(
          roomCode
        );


      saveCurrentRoom(
        result.roomCode
      );

      closeJoin();

      showToast(
        result.alreadyJoined
          ? "Opening your room..."
          : "You joined the room successfully.",
        result.alreadyJoined
          ? "Room"
          : "Room Joined"
      );


      setTimeout(() => {

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(result.roomCode)}`;

      }, 400);

    }

    catch (error) {

      console.error(
        "Join room error:",
        error
      );

      showToast(
        error.message ||
        "Could not join the room.",
        "Join Error",
        "error"
      );

    }

    finally {

      setBusy(false);

    }
  }


  /* =========================
     QUICK MATCH
  ========================= */

  async function quickMatch() {

    if (busy) {
      return;
    }

    if (!currentUser) {

      showToast(
        "Please login first.",
        "Login Required",
        "error"
      );

      return;
    }

    setBusy(true);

    try {

      const snapshot =
        await get(
          getRoomsRef()
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


            if (
              room.status ===
              "waiting" &&

              room.playerCount <
              room.maxPlayers &&

              !room.players?.[
                currentUser.uid
              ]
            ) {

              candidates.push(room);
            }

          }
        );


      candidates.sort(
        (a, b) =>
          Number(a.createdAt) -
          Number(b.createdAt)
      );


      if (
        candidates.length > 0
      ) {

        try {

          const result =
            await joinRoomInternal(
              candidates[0].roomCode
            );


          saveCurrentRoom(
            result.roomCode
          );


          showToast(
            "Opponent found. Opening your room...",
            "Match Found"
          );


          setTimeout(() => {

            window.location.href =
              `battle-room.html?room=${encodeURIComponent(result.roomCode)}`;

          }, 450);


          return;

        }

        catch (joinError) {

          console.warn(
            "Selected Quick Match room became unavailable:",
            joinError
          );

        }
      }


      /*
       * No available room.
       * Create a new free matchmaking room.
       */

      const roomCode =
        await generateUniqueRoomCode();

      const now = Date.now();

      const player = {

        uid:
          currentUser.uid,

        name:
          playerName(currentUser),

        photo:
          currentUser.photoURL || "",

        joinedAt:
          now,

        ready:
          false
      };


      const roomData = {

        battleId:
          roomCode,

        roomCode:
          roomCode,

        game:
          "ludo",

        mode:
          "quick",

        creatorUid:
          currentUser.uid,

        creatorName:
          playerName(currentUser),

        creatorPhoto:
          currentUser.photoURL || "",

        players: {
          [currentUser.uid]:
            player
        },

        maxPlayers:
          MAX_PLAYERS,

        status:
          "waiting",

        createdAt:
          now,

        updatedAt:
          now
      };


      const result =
        await runTransaction(
          getRoomRef(roomCode),
          current => {

            if (current !== null) {
              return;
            }

            return roomData;
          }
        );


      if (!result.committed) {

        throw new Error(
          "Could not create a Quick Match room."
        );
      }


      saveCurrentRoom(
        roomCode
      );


      showToast(
        `Room ${roomCode} created. Waiting for an opponent...`,
        "Quick Match"
      );


      setTimeout(() => {

        window.location.href =
          `battle-room.html?room=${encodeURIComponent(roomCode)}`;

      }, 600);

    }

    catch (error) {

      console.error(
        "Quick Match error:",
        error
      );

      showToast(
        "Quick Match could not start. Please try again.",
        "Match Error",
        "error"
      );

    }

    finally {

      setBusy(false);

    }
  }


  /* =========================
     RENDER ROOMS
  ========================= */

  function renderRooms() {

    if (!roomsList) {
      return;
    }


    const roomArray =
      Object.values(rooms)
        .map(room =>
          normalizeRoom(
            room.roomCode,
            room
          )
        )
        .filter(Boolean)
        .filter(
          room =>
            room.status ===
            "waiting" &&

            room.playerCount <
            room.maxPlayers
        )
        .sort(
          (a, b) =>
            Number(a.createdAt) -
            Number(b.createdAt)
        );


    if (availableBattleCount) {

      availableBattleCount.textContent =
        roomArray.length.toLocaleString();
    }


    if (onlinePlayerCount) {

      onlinePlayerCount.textContent =
        roomArray
          .reduce(
            (total, room) =>
              total +
              room.playerCount,
            0
          )
          .toLocaleString();
    }


    roomsList.innerHTML = "";


    if (
      roomArray.length === 0
    ) {

      emptyState?.classList.remove(
        "hidden"
      );

      return;
    }


    emptyState?.classList.add(
      "hidden"
    );


    roomArray.forEach(
      room => {

        const card =
          document.createElement(
            "div"
          );


        card.className =
          "room-card";


        const creator =
          escapeHTML(
            room.creatorName ||
            "LUDOVERSE Player"
          );


        const code =
          escapeHTML(
            room.roomCode
          );


        card.innerHTML = `

          <div class="room-left">

            <div class="room-avatar">
              🎲
            </div>

            <div class="room-info">

              <h3>
                ${creator}
              </h3>

              <div class="room-meta">

                <span class="waiting-badge">
                  ● WAITING
                </span>

                <span class="room-players">
                  ${room.playerCount}/${room.maxPlayers} players
                </span>

              </div>

              <p class="room-description">
                Free Ludo multiplayer room
              </p>

            </div>

          </div>


          <div class="room-actions">

            <div class="room-code-small">
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
            "[data-room-code]"
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


  /* =========================
     ACTIVE ROOM
  ========================= */

  function renderActiveRoom() {

    if (!activeRoomSection) {
      return;
    }


    const room =
      getCurrentRoom();


    if (!room) {

      activeRoomSection.classList.remove(
        "show"
      );

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


    activeRoomSection.classList.add(
      "show"
    );


    if (activeRoomCode) {

      activeRoomCode.textContent =
        room.roomCode;
    }


    if (activeRoomStatus) {

      if (
        room.playerCount >=
        room.maxPlayers
      ) {

        activeRoomStatus.textContent =
          "Both players connected. Open the room to get ready.";

      }

      else {

        activeRoomStatus.textContent =
          "Waiting for another player...";
      }
    }
  }


  /* =========================
     ROOM LISTENER
  ========================= */

  function startRoomsListener() {

    if (roomsUnsubscribe) {
      return;
    }


    roomsUnsubscribe =
      onValue(
        getRoomsRef(),

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
                  normalized[code] =
                    room;
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
            "Rooms listener error:",
            error
          );


          showToast(
            "Live room updates are unavailable.",
            "Connection Error",
            "error"
          );
        }
      );
  }


  /* =========================
     CURRENT ROOM VALIDATION
  ========================= */

  async function validateCurrentRoom() {

    if (!currentRoomCode) {

      renderActiveRoom();

      return;
    }


    try {

      const snapshot =
        await get(
          getRoomRef(
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
        currentRoomCode
      ] = room;


      renderActiveRoom();

    }

    catch (error) {

      console.error(
        "Current room validation error:",
        error
      );

    }
  }


  /* =========================
     COPY ROOM CODE
  ========================= */

  async function copyCurrentRoomCode() {

    const room =
      getCurrentRoom();


    if (!room?.roomCode) {

      showToast(
        "There is no active room.",
        "Room",
        "error"
      );

      return;
    }


    try {

      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {

        await navigator.clipboard.writeText(
          room.roomCode
        );

      }

      else {

        const temp =
          document.createElement(
            "textarea"
          );

        temp.value =
          room.roomCode;

        temp.style.position =
          "fixed";

        temp.style.opacity =
          "0";

        document.body.appendChild(
          temp
        );

        temp.select();

        document.execCommand(
          "copy"
        );

        temp.remove();
      }


      showToast(
        `Room code ${room.roomCode} copied.`,
        "Copied"
      );

    }

    catch (error) {

      console.error(
        "Copy error:",
        error
      );

      showToast(
        `Room code: ${room.roomCode}`,
        "Room Code",
        "info"
      );
    }
  }


  /* =========================
     OPEN CURRENT ROOM
  ========================= */

  function openCurrentRoom() {

    const room =
      getCurrentRoom();


    if (!room?.roomCode) {

      showToast(
        "There is no active room.",
        "Room",
        "error"
      );

      return;
    }


    window.location.href =
      `battle-room.html?room=${encodeURIComponent(room.roomCode)}`;
  }


  /* =========================
     LOGOUT
  ========================= */

  async function logout() {

    if (!currentUser) {
      return;
    }


    const confirmed =
      window.confirm(
        "Are you sure you want to logout?"
      );


    if (!confirmed) {
      return;
    }


    try {

      await signOut(auth);

      localStorage.removeItem(
        "ludoverseCurrentRoom"
      );

      window.location.href =
        "login.html";

    }

    catch (error) {

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


  /* =========================
     EVENTS
  ========================= */

  profileBtn?.addEventListener(
    "click",
    event => {

      event.stopPropagation();

      toggleProfileMenu();

    }
  );


  profileMenu?.addEventListener(
    "click",
    event => {

      event.stopPropagation();

    }
  );


  document.addEventListener(
    "click",
    () => {

      closeProfileMenu();

    }
  );


  logoutBtn?.addEventListener(
    "click",
    logout
  );


  createBattleBtn?.addEventListener(
    "click",
    openCreateModal
  );


  emptyCreateBtn?.addEventListener(
    "click",
    openCreateModal
  );


  quickMatchBtn?.addEventListener(
    "click",
    quickMatch
  );


  confirmCreateBtn?.addEventListener(
    "click",
    createRoom
  );


  closeCreateModal?.addEventListener(
    "click",
    closeCreate
  );


  cancelCreateBtn?.addEventListener(
    "click",
    closeCreate
  );


  closeJoinModal?.addEventListener(
    "click",
    closeJoin
  );


  cancelJoinBtn?.addEventListener(
    "click",
    closeJoin
  );


  confirmJoinBtn?.addEventListener(
    "click",
    () => {

      joinRoom(
        roomCodeInput?.value || ""
      );

    }
  );


  refreshBtn?.addEventListener(
    "click",
    async () => {

      if (busy) {
        return;
      }

      refreshBtn.disabled = true;

      try {

        await validateCurrentRoom();

        showToast(
          "Room list updated.",
          "Updated"
        );

      }

      finally {

        setTimeout(
          () => {
            refreshBtn.disabled =
              false;
          },
          500
        );

      }
    }
  );


  copyRoomBtn?.addEventListener(
    "click",
    copyCurrentRoomCode
  );


  openRoomBtn?.addEventListener(
    "click",
    openCurrentRoom
  );


  roomCodeInput?.addEventListener(
    "input",
    () => {

      roomCodeInput.value =
        roomCodeInput.value
          .replace(/\D/g, "")
          .slice(
            0,
            ROOM_CODE_LENGTH
          );

    }
  );


  roomCodeInput?.addEventListener(
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


  createModal?.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        createModal
      ) {
        closeCreate();
      }

    }
  );


  joinModal?.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        joinModal
      ) {
        closeJoin();
      }

    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {

        closeCreate();

        closeJoin();

        closeProfileMenu();

      }

    }
  );


  /* =========================
     AUTH
  ========================= */

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


      renderProfile(
        user
      );


      try {

        await ensureEconomy(
          user
        );

        listenToEconomy(
          user
        );

      }

      catch (error) {

        console.error(
          "Economy initialization error:",
          error
        );

        if (walletBalance) {
          walletBalance.textContent =
            "0";
        }

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

    }
  );


  console.log(
    "LUDOVERSE Professional Multiplayer Lobby Ready"
  );

});