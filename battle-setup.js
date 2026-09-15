"use strict";

import {
  auth,
  database,
  ref,
  get,
  set,
  update,
  runTransaction,
  onAuthStateChanged
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const createBtn = $("createBtn");
  const createBtnText = $("createBtnText");
  const cancelBtn = $("cancelBtn");
  const coinPanel = $("coinPanel");
  const customCoinAmount = $("customCoinAmount");
  const summaryVisibility = $("summaryVisibility");
  const summaryEntry = $("summaryEntry");
  const status = $("status");
  const toast = $("toast");
  const toastIcon = $("toastIcon");
  const toastTitle = $("toastTitle");
  const toastMessage = $("toastMessage");

  const ROOM_PATH = "battles";
  const ECONOMY_PATH = "economy";
  const CODE_LENGTH = 6;
  const MAX_PLAYERS = 2;
  const ROOM_TTL_MS = 15 * 60 * 1000;
  const STARTER_COINS = 1000;

  let currentUser = null;
  let busy = false;

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function playerName(user) {
    return user?.displayName || user?.email?.split("@")[0] || user?.phoneNumber || "LUDOVERSE Player";
  }

  function roomRef(code) {
    return ref(database, `${ROOM_PATH}/${code}`);
  }

  function economyRef(uid) {
    return ref(database, `users/${uid}/${ECONOMY_PATH}`);
  }

  function getParamMode() {
    const mode = new URLSearchParams(location.search).get("mode");
    return mode === "private" ? "private" : "public";
  }

  function getChoice(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
  }

  function getSelectedCoinAmount() {
    if (getChoice("coinAmount") === "custom") {
      return safeNumber(customCoinAmount?.value, 50);
    }
    return safeNumber(getChoice("coinAmount"), 250);
  }

  function validCoinAmount(amount) {
    return Number.isInteger(amount) && amount >= 50 && amount <= 10000;
  }

  function showToast(message, title = "LUDOVERSE", type = "error") {
    if (!toast) return;
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toastIcon.textContent = type === "success" ? "✓" : type === "info" ? "i" : "!";
    toast.classList.remove("show");
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function refreshOptionVisuals() {
    document.querySelectorAll(".option").forEach((label) => {
      const input = label.querySelector("input");
      label.classList.toggle("selected", Boolean(input?.checked));
    });
    document.querySelectorAll(".coin-options label").forEach((label) => {
      const input = label.querySelector("input");
      label.classList.toggle("selected", Boolean(input?.checked));
    });
  }

  function updateUI() {
    const visibility = getChoice("visibility");
    const entryMode = getChoice("entryMode");
    const coinMode = entryMode === "coins";

    summaryVisibility.textContent = visibility === "private" ? "PRIVATE" : "PUBLIC";
    const amount = getSelectedCoinAmount();
    summaryEntry.textContent = coinMode
      ? `LUDOCOINS ${Math.max(0, amount).toLocaleString("en-IN")}`
      : "FREE PLAY";
    coinPanel.hidden = !coinMode;
    createBtnText.textContent = "Create Battle";

    if (customCoinAmount) {
      customCoinAmount.disabled = !coinMode || getChoice("coinAmount") !== "custom";
    }

    createBtn.disabled = busy || (coinMode && !validCoinAmount(amount));
    refreshOptionVisuals();
  }

  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async function uniqueCode() {
    for (let i = 0; i < 25; i += 1) {
      const code = generateCode();
      const snapshot = await get(roomRef(code));
      if (!snapshot.exists()) return code;
    }
    throw new Error("Could not generate a unique room code. Please try again.");
  }

  async function ensureEconomy() {
    const target = economyRef(currentUser.uid);
    const snapshot = await get(target);
    if (!snapshot.exists()) {
      const initial = {
        ludoCoins: STARTER_COINS,
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        activityPoints: 0,
        platformPoints: 0,
        updatedAt: Date.now()
      };
      await set(target, initial);
      return initial;
    }
    return snapshot.val() || {};
  }

  async function reserveCoins(amount) {
    const target = economyRef(currentUser.uid);
    const result = await runTransaction(target, (current) => {
      const economy = current && typeof current === "object" ? { ...current } : {
        ludoCoins: STARTER_COINS,
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        activityPoints: 0,
        platformPoints: 0
      };
      const balance = Math.max(0, safeNumber(economy.ludoCoins));
      if (balance < amount) return;
      return { ...economy, ludoCoins: balance - amount, updatedAt: Date.now() };
    });
    if (!result.committed) throw new Error("You do not have enough LudoCoins for this room.");
  }

  async function refundCoins(amount) {
    if (!amount) return;
    await runTransaction(economyRef(currentUser.uid), (current) => {
      const economy = current && typeof current === "object" ? { ...current } : { ludoCoins: 0 };
      return { ...economy, ludoCoins: Math.max(0, safeNumber(economy.ludoCoins) + amount), updatedAt: Date.now() };
    });
  }

  function buildRoom(code, visibility, entryMode, coinAmount) {
    const now = Date.now();
    const uid = currentUser.uid;
    return {
      schemaVersion: 2,
      battleId: code,
      roomCode: code,
      game: "ludo",
      mode: visibility,
      entryMode,
      coinAmount: entryMode === "coins" ? coinAmount : 0,
      creatorUid: uid,
      creatorName: playerName(currentUser),
      creatorPhoto: currentUser.photoURL || "",
      players: {
        [uid]: {
          uid,
          name: playerName(currentUser),
          photo: currentUser.photoURL || "",
          joinedAt: now,
          ready: false,
          connected: true
        }
      },
      maxPlayers: MAX_PLAYERS,
      status: "waiting",
      createdAt: now,
      updatedAt: now,
      expiresAt: now + ROOM_TTL_MS,
      startedAt: 0,
      completedAt: 0,
      winnerUid: "",
      winnerName: "",
      coinReservation: entryMode === "coins" ? {
        amount: coinAmount,
        status: "reserved",
        ownerUid: uid,
        refundedAt: 0
      } : { amount: 0, status: "none", ownerUid: uid, refundedAt: 0 }
    };
  }

  async function createBattle() {
    if (busy) return;
    if (!currentUser) {
      showToast("Please login before creating a battle.", "Login Required");
      return;
    }

    const visibility = getChoice("visibility");
    const entryMode = getChoice("entryMode");
    const coinAmount = entryMode === "coins" ? getSelectedCoinAmount() : 0;

    if (entryMode === "coins" && !validCoinAmount(coinAmount)) {
      showToast("Choose a LudoCoins amount between 50 and 10,000.", "Invalid Amount");
      return;
    }
    let reserved = false;
    let code = "";

    busy = true;
    createBtn.disabled = true;
    createBtnText.textContent = "Creating secure room...";
    status.textContent = "Preparing your realtime battle room...";

    try {
      await ensureEconomy();

      if (entryMode === "coins") {
        await reserveCoins(coinAmount);
        reserved = true;
      }

      code = await uniqueCode();
      const room = buildRoom(code, visibility, entryMode, coinAmount);
      const result = await runTransaction(roomRef(code), (current) => current === null ? room : undefined);

      if (!result.committed) throw new Error("Room creation was interrupted. Please try again.");

      localStorage.setItem("ludoverseCurrentRoom", code);
      status.textContent = `Room ${code} created. Opening Battle Room...`;
      showToast(`Room ${code} is ready.`, "Battle Created", "success");

      setTimeout(() => {
        location.href = `battle-room.html?room=${encodeURIComponent(code)}`;
      }, 450);
    } catch (error) {
      console.error("Battle setup error:", error);
      if (reserved) {
        try { await refundCoins(coinAmount); } catch (refundError) { console.error("Fallback refund failed:", refundError); }
      }
      status.textContent = "The room could not be created.";
      showToast(error?.message || "Could not create the battle room.", "Create Error");
    } finally {
      busy = false;
      createBtn.disabled = false;
      updateUI();
    }
  }

  document.querySelectorAll('input[name="visibility"], input[name="entryMode"], input[name="coinAmount"]').forEach((input) => {
    input.addEventListener("change", updateUI);
  });

  customCoinAmount?.addEventListener("input", () => {
    const value = Math.max(0, Math.floor(safeNumber(customCoinAmount.value, 0)));
    customCoinAmount.value = String(Math.min(10000, value));
    updateUI();
  });

  cancelBtn.addEventListener("click", () => { location.href = "index.html"; });
  createBtn.addEventListener("click", createBattle);

  const initialMode = getParamMode();
  const initialVisibility = document.querySelector(`input[name="visibility"][value="${initialMode}"]`);
  if (initialVisibility) initialVisibility.checked = true;
  updateUI();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "login.html";
      return;
    }
    currentUser = user;
    try { await ensureEconomy(); } catch (error) { console.error("Economy init failed:", error); }
  });
});
