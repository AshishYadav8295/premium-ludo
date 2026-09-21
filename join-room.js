"use strict";

import {
  auth,
  database,
  ref,
  get,
  runTransaction,
  onAuthStateChanged
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  const roomCodeInput = document.getElementById("roomCodeInput");
  const codeCount = document.getElementById("codeCount");
  const joinBattleBtn = document.getElementById("joinBattleBtn");
  const backBtn = document.getElementById("backBtn");
  const homeCancelBtn = document.getElementById("homeCancelBtn");
  const roomPreview = document.getElementById("roomPreview");
  const previewTitle = document.getElementById("previewTitle");
  const previewMeta = document.getElementById("previewMeta");
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toastIcon");
  const toastTitle = document.getElementById("toastTitle");
  const toastMessage = document.getElementById("toastMessage");

  const ROOM_PATH = "battles";
  const MAX_PLAYERS = 2;
  const CODE_LENGTH = 6;
  const CURRENT_ROOM_KEY = "ludoverseCurrentRoom";
  const ROOM_LIFETIME_MS = 15 * 60 * 1000;

  let currentUser = null;
  let busy = false;
  let previewTimer = null;
  let previewRequest = 0;

  function toastMessageShow(message, title = "LUDOVERSE", type = "error") {
    if (!toast) {
      window.alert(message);
      return;
    }
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toastIcon.textContent = type === "success" ? "✓" : type === "info" ? "i" : "!";
    toast.classList.remove("show");
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(toastMessageShow.timer);
    toastMessageShow.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function normalizeCode(value) {
    return String(value || "").replace(/\D/g, "").slice(0, CODE_LENGTH);
  }

  function roomRef(code) {
    return ref(database, `${ROOM_PATH}/${code}`);
  }

  function isRoomExpired(room, now = Date.now()) {
    if (!room || typeof room !== "object") return true;

    const expiresAt = Number(room.expiresAt) || 0;
    if (expiresAt > 0) return expiresAt <= now;

    // Backward compatibility for rooms created before expiresAt existed.
    const createdAt = Number(room.createdAt) || 0;
    return createdAt > 0 && createdAt + ROOM_LIFETIME_MS <= now;
  }

  function playerName(user) {
    return user?.displayName ||
      user?.email?.split("@")[0] ||
      user?.phoneNumber ||
      "LUDOVERSE Player";
  }

  function setButtonState() {
    joinBattleBtn.disabled = busy || roomCodeInput.value.length !== CODE_LENGTH;
    joinBattleBtn.innerHTML = busy
      ? "<span>Joining Room...</span><b>◌</b>"
      : "<span>Join Room</span><b>→</b>";
  }

  function hidePreview() {
    roomPreview.hidden = true;
  }

  async function preview(code) {
    const request = ++previewRequest;
    if (!/^\d{6}$/.test(code)) {
      hidePreview();
      return;
    }

    try {
      const snapshot = await get(roomRef(code));
      if (request !== previewRequest) return;

      if (!snapshot.exists()) {
        hidePreview();
        toastMessageShow("No room found with that six-digit code.", "Room Not Found");
        return;
      }

      const room = snapshot.val() || {};
      const players = room.players && typeof room.players === "object" ? room.players : {};
      const count = Object.keys(players).length;
      const maxPlayers = Math.max(MAX_PLAYERS, Number(room.maxPlayers) || MAX_PLAYERS);
      const status = String(room.status || "waiting");

      if (status === "waiting" && isRoomExpired(room)) {
        hidePreview();
        toastMessageShow(
          "This room has expired. Create a new room to continue.",
          "Room Expired"
        );
        return;
      }

      if (status !== "waiting") {
        hidePreview();
        toastMessageShow(
          status === "playing" ? "This room has already started." : "This room is not available.",
          "Room Unavailable"
        );
        return;
      }

      if (count >= maxPlayers && !players[currentUser?.uid]) {
        hidePreview();
        toastMessageShow("This room is already full.", "Room Full");
        return;
      }

      previewTitle.textContent = players[currentUser?.uid]
        ? "You are already in this room"
        : "Room is available";
      previewMeta.textContent =
        `${count}/${maxPlayers} players · ${room.mode === "quick" ? "Quick Match" : "Private Room"}`;
      roomPreview.hidden = false;
    } catch (error) {
      console.error("Room preview error:", error);
      hidePreview();
      toastMessageShow("Could not check this room right now.", "Connection Error");
    }
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => preview(normalizeCode(roomCodeInput.value)), 220);
  }

  async function joinRoom() {
    if (busy) return;

    if (!currentUser) {
      toastMessageShow("Please login first.", "Login Required");
      return;
    }

    const code = normalizeCode(roomCodeInput.value);
    roomCodeInput.value = code;

    if (!/^\d{6}$/.test(code)) {
      toastMessageShow("Enter the complete six-digit room code.", "Invalid Code");
      roomCodeInput.focus();
      return;
    }

    busy = true;
    setButtonState();

    try {
      const result = await runTransaction(roomRef(code), (current) => {
        if (current === null) return current;
        if (typeof current !== "object") return;

        const players = current.players && typeof current.players === "object"
          ? { ...current.players }
          : {};

        if (players[currentUser.uid]) {
          return current;
        }

        const maxPlayers = Math.max(MAX_PLAYERS, Number(current.maxPlayers) || MAX_PLAYERS);

        if (String(current.status || "waiting") !== "waiting") return;
        if (isRoomExpired(current)) return;
        if (Object.keys(players).length >= maxPlayers) return;

        players[currentUser.uid] = {
          uid: currentUser.uid,
          name: playerName(currentUser),
          photo: currentUser.photoURL || "",
          joinedAt: Date.now(),
          ready: false,
          connected: true
        };

        return { ...current, players, updatedAt: Date.now() };
      });

      if (!result.committed) {
        const latest = await get(roomRef(code));
        if (!latest.exists()) throw new Error("This room does not exist.");

        const room = latest.val() || {};
        const players = room.players && typeof room.players === "object" ? room.players : {};

        if (!players[currentUser.uid]) {
          if (isRoomExpired(room)) {
            throw new Error("This room has expired. Create a new room to continue.");
          }
          if (String(room.status || "waiting") !== "waiting") {
            throw new Error("This room has already started.");
          }
          throw new Error("This room is full or unavailable.");
        }
      }

      localStorage.setItem(CURRENT_ROOM_KEY, code);
      toastMessageShow("Room joined. Opening the Battle Room...", "Connected", "success");

      setTimeout(() => {
        window.location.href = `battle-room.html?room=${encodeURIComponent(code)}`;
      }, 450);
    } catch (error) {
      console.error("Join room error:", error);
      toastMessageShow(error?.message || "Could not join the room.", "Join Error");
    } finally {
      busy = false;
      setButtonState();
    }
  }

  roomCodeInput.addEventListener("input", () => {
    roomCodeInput.value = normalizeCode(roomCodeInput.value);
    codeCount.textContent = `${roomCodeInput.value.length}/${CODE_LENGTH}`;
    setButtonState();
    schedulePreview();
  });

  roomCodeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      joinRoom();
    }
  });

  joinBattleBtn.addEventListener("click", joinRoom);
  backBtn.addEventListener("click", () => {
    window.location.href = "battle-lobby.html";
  });

  homeCancelBtn?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    setButtonState();
    console.log("LUDOVERSE Join Room Ready:", user.uid);
  });
});
