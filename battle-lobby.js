/* =========================================================
   LUDOVERSE — MULTIPLAYER BATTLE LOBBY
   ---------------------------------------------------------
   BACKEND-AUTHORITATIVE / REAL-MONEY READY CLIENT

   CLIENT RESPONSIBILITIES
   ---------------------------------------------------------
   • Firebase Authentication UI gate
   • Send Firebase ID token to backend
   • Display authoritative wallet balance
   • Display realtime server-created rooms
   • Send create/join/quick-match/leave commands
   • Persist current battle ID/code only as UI convenience
   • Render safe room information
   • Handle loading / retry / timeout / race conditions
   • Never calculate money
   • Never debit money
   • Never credit money
   • Never settle winnings
   • Never generate authoritative battle IDs
   • Never create authoritative room records
   • Never mutate Firebase battle records

   SERVER RESPONSIBILITIES
   ---------------------------------------------------------
   • Verify Firebase ID token
   • Resolve UID
   • Validate account / eligibility
   • Validate battle mode
   • Validate stake configuration
   • Validate wallet / ledger
   • Reserve/debit entry fee
   • Generate battle ID / room code
   • Create authoritative battle
   • Add players atomically
   • Prevent duplicate joins
   • Prevent duplicate charges
   • Handle refunds
   • Validate gameplay
   • Determine result
   • Settle winnings exactly once
   • Maintain immutable financial ledger
   • Write authoritative Firebase realtime state

   SECURITY MODEL
   ---------------------------------------------------------
   Browser
      ↓ Firebase ID token
   Backend API
      ↓ verify token
   UID
      ↓
   Battle service
      ↓
   Wallet / Ledger transaction
      ↓
   Authoritative database
      ↓
   Firebase realtime broadcast

   IMPORTANT
   ---------------------------------------------------------
   Firebase client-side writes are intentionally NOT used
   for battle creation/join/leave.

   Firebase Realtime Database should be configured so that
   normal clients have READ access only to the permitted
   battle projection and NO WRITE access.

   This file does NOT and cannot guarantee 100% security.
   Backend + DB + Firebase Rules + payment/ledger system
   must be implemented correctly.
   ========================================================= */

"use strict";


/* =========================================================
   FIREBASE IMPORTS
   ---------------------------------------------------------
   IMPORTANT:
   No get()
   No runTransaction()
   No client-side Firebase room writes.
   ========================================================= */

import {
  auth,
  database,
  ref,
  onValue,
  onAuthStateChanged,
  signOut
} from "./firebase.js";


/* =========================================================
   APPLICATION BOOT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {


    /* =====================================================
       DOM HELPER
       ===================================================== */

    const $ = (id) =>
      document.getElementById(id);


    /* =====================================================
       DOM REFERENCES
       ===================================================== */

    const walletBalance =
      $("walletBalance");

    const profileBtn =
      $("profileBtn");

    const profileMenu =
      $("profileMenu");

    const profileAvatar =
      $("profileAvatar");

    const menuAvatar =
      $("menuAvatar");

    const headerName =
      $("headerName");

    const headerEmail =
      $("headerEmail");

    const logoutBtn =
      $("logoutBtn");

    const quickMatchBtn =
      $("quickMatchBtn");

    const createBattleBtn =
      $("createBattleBtn");

    const createPublicBtn =
      $("createPublicBtn");

    const createPrivateBtn =
      $("createPrivateBtn");

    const emptyCreateBtn =
      $("emptyCreateBtn");

    const refreshBtn =
      $("refreshBtn");

    const availableBattleCount =
      $("availableBattleCount");

    const onlinePlayerCount =
      $("onlinePlayerCount");

    const roomsList =
      $("roomsList");

    const emptyState =
      $("emptyState");

    const activeRoomSection =
      $("activeRoomSection");

    const activeRoomCode =
      $("activeRoomCode");

    const activeRoomStatus =
      $("activeRoomStatus");

    const activeRoomPlayers =
      $("activeRoomPlayers");

    const copyRoomBtn =
      $("copyRoomBtn");

    const openRoomBtn =
      $("openRoomBtn");

    const leaveRoomBtn =
      $("leaveRoomBtn");

    const createModal =
      $("createModal");

    const closeCreateModal =
      $("closeCreateModal");

    const cancelCreateBtn =
      $("cancelCreateBtn");

    const confirmCreateBtn =
      $("confirmCreateBtn");

    const joinModal =
      $("joinModal");

    const closeJoinModal =
      $("closeJoinModal");

    const cancelJoinBtn =
      $("cancelJoinBtn");

    const confirmJoinBtn =
      $("confirmJoinBtn");

    const roomCodeInput =
      $("roomCodeInput");

    const toast =
      $("toast");

    const toastIcon =
      $("toastIcon");

    const toastTitle =
      $("toastTitle");

    const toastMessage =
      $("toastMessage");


    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const API_BASE =
      String(
        window.API_BASE || ""
      )
        .trim()
        .replace(
          /\/+$/,
          ""
        );


    /*
     * These routes are deliberately centralized.
     *
     * If your backend uses different paths, change them
     * here instead of changing the whole application.
     */

    const API_ROUTES = {

      economy:
        "/api/economy",

      currentBattle:
        "/api/battles/current",

      createBattle:
        "/api/battles",

      quickMatch:
        "/api/battles/quick-match",

      joinBattle:
        (code) =>
          `/api/battles/${encodeURIComponent(
            code
          )}/join`,

      leaveBattle:
        (code) =>
          `/api/battles/${encodeURIComponent(
            code
          )}/leave`
    };


    /* =====================================================
       CONSTANTS
       ===================================================== */

    const ROOMS_PATH =
      "battles";

    const MAX_PLAYERS =
      2;

    const ROOM_CODE_LENGTH =
      6;

    const CURRENT_ROOM_KEY =
      "ludoverseCurrentRoom";

    const API_TIMEOUT_MS =
      12000;

    const MAX_ROOM_SCAN =
      500;

    const REDIRECT_DELAY_MS =
      350;

    const VALID_ROOM_STATUSES =
      new Set([
        "waiting",
        "playing",
        "completed",
        "cancelled",
        "expired"
      ]);

    const VALID_ROOM_MODES =
      new Set([
        "private",
        "public",
        "quick"
      ]);


    /* =====================================================
       STATE
       ===================================================== */

    let currentUser =
      null;

    let rooms =
      {};

    let currentRoomCode =
      readStoredRoomCode();

    let roomsUnsubscribe =
      null;

    let economyRequestId =
      0;

    let currentBattleRequestId =
      0;

    let busy =
      false;

    let profileOpen =
      false;

    let destroyed =
      false;

    let authGeneration =
      0;


    /*
     * Prevent duplicate operations caused by double taps,
     * multiple event dispatches, etc.
     */

    const activeOperations =
      new Map();


    /* =====================================================
       SAFE STORAGE
       ===================================================== */

    function readStoredRoomCode() {

      try {

        return String(
          localStorage.getItem(
            CURRENT_ROOM_KEY
          ) || ""
        )
          .replace(
            /\D/g,
            ""
          )
          .slice(
            0,
            ROOM_CODE_LENGTH
          );

      } catch (error) {

        console.warn(
          "Unable to read current battle from localStorage:",
          error
        );

        return "";
      }
    }


    function writeStoredRoomCode(
      code
    ) {

      try {

        if (code) {

          localStorage.setItem(
            CURRENT_ROOM_KEY,
            String(code)
          );

        } else {

          localStorage.removeItem(
            CURRENT_ROOM_KEY
          );
        }

      } catch (error) {

        console.warn(
          "Unable to update localStorage:",
          error
        );
      }
    }


    /* =====================================================
       AUTHENTICATION
       ===================================================== */

    function requireUser() {

      if (
        !currentUser
      ) {

        throw new Error(
          "Authentication required."
        );
      }


      return currentUser;
    }


    /* =====================================================
       ID / REQUEST HELPERS
       ===================================================== */

    function createRequestId() {

      if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
          "function"
      ) {

        return window.crypto.randomUUID();
      }


      /*
       * This is only an idempotency/request identifier.
       *
       * It is NOT used as an authoritative battle ID,
       * room ID, wallet transaction ID, or security token.
       */

      return [
        Date.now().toString(36),

        Math.random()
          .toString(36)
          .slice(2),

        Math.random()
          .toString(36)
          .slice(2)
      ].join("-");
    }


    function normalizeRoomCode(
      code
    ) {

      return String(
        code || ""
      )
        .replace(
          /\D/g,
          ""
        )
        .slice(
          0,
          ROOM_CODE_LENGTH
        );
    }


    function isValidRoomCode(
      code
    ) {

      return /^\d{6}$/.test(
        normalizeRoomCode(
          code
        )
      );
    }


    /* =====================================================
       BACKEND API
       ===================================================== */

    async function apiRequest(
      path,
      options = {}
    ) {

      if (!API_BASE) {

        throw new Error(
          "LUDOVERSE backend is not configured for this deployment."
        );
      }


      const user =
        auth.currentUser;


      if (!user) {

        throw new Error(
          "Authentication required."
        );
      }


      const method =
        String(
          options.method ||
          "GET"
        ).toUpperCase();


      const body =
        options.body === undefined
          ? undefined
          : JSON.stringify(
              options.body
            );


      /*
       * One idempotency key must remain identical for the
       * complete logical operation.
       *
       * Backend must store/use it atomically.
       */

      const idempotencyKey =
        options.idempotencyKey ||
        (
          method === "GET"
            ? ""
            : createRequestId()
        );


      async function execute(
        forceRefreshToken = false
      ) {

        const token =
          await user.getIdToken(
            forceRefreshToken
          );


        const controller =
          new AbortController();


        const timeout =
          setTimeout(
            () => {
              controller.abort();
            },
            API_TIMEOUT_MS
          );


        try {

          const headers = {

            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json"
          };


          if (
            body !== undefined
          ) {

            headers[
              "Content-Type"
            ] =
              "application/json";
          }


          if (
            idempotencyKey
          ) {

            headers[
              "Idempotency-Key"
            ] =
              idempotencyKey;
          }


          const response =
            await fetch(
              `${API_BASE}${path}`,
              {
                method,

                headers,

                body,

                credentials:
                  "omit",

                cache:
                  "no-store",

                signal:
                  controller.signal
              }
            );


          const payload =
            await response
              .json()
              .catch(
                () => ({})
              );


          return {
            response,
            payload
          };

        } finally {

          clearTimeout(
            timeout
          );
        }
      }


      try {

        let result =
          await execute(
            false
          );


        /*
         * Token may have expired.
         *
         * Refresh token once and retry.
         */

        if (
          result.response.status ===
          401
        ) {

          result =
            await execute(
              true
            );
        }


        const {
          response,
          payload
        } =
          result;


        if (
          !response.ok ||
          payload?.ok === false
        ) {

          const error =
            new Error(
              payload?.error ||
              payload?.message ||
              `Request failed (${response.status}).`
            );


          error.code =
            payload?.code ||
            `HTTP_${response.status}`;


          error.status =
            response.status;


          error.payload =
            payload;


          throw error;
        }


        return payload;

      } catch (error) {

        if (
          error?.name ===
          "AbortError"
        ) {

          const timeoutError =
            new Error(
              "The server took too long to respond. Please try again."
            );


          timeoutError.code =
            "REQUEST_TIMEOUT";


          throw timeoutError;
        }


        throw error;
      }
    }


    /* =====================================================
       SAFE NUMBER
       ===================================================== */

    function safeNumber(
      value,
      fallback = 0
    ) {

      const number =
        Number(value);


      return Number.isFinite(
        number
      )
        ? number
        : fallback;
    }


    function formatNumber(
      value
    ) {

      return safeNumber(
        value
      ).toLocaleString(
        "en-IN"
      );
    }


    /* =====================================================
       PLAYER HELPERS
       ===================================================== */

    function getPlayerName(
      user
    ) {

      if (!user) {

        return "LUDOVERSE Player";
      }


      return (
        String(
          user.displayName || ""
        ).trim() ||

        String(
          user.email?.split("@")[0] || ""
        ).trim() ||

        String(
          user.phoneNumber || ""
        ).trim() ||

        "LUDOVERSE Player"
      );
    }


    function getInitials(
      name
    ) {

      const parts =
        String(
          name || "Player"
        )
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(
            0,
            2
          );


      const initials =
        parts
          .map(
            (part) =>
              part
                .charAt(0)
                .toUpperCase()
          )
          .join("");


      return (
        initials ||
        "P"
      );
    }


    /* =====================================================
       ECONOMY
       -----------------------------------------------------
       IMPORTANT:
       These values are display-only.

       The client NEVER:
       • calculates available money
       • deducts money
       • reserves money
       • settles money
       • determines winnings
       ===================================================== */

    function normalizeEconomy(
      data
    ) {

      const source =
        data &&
        typeof data === "object"
          ? data
          : {};


      return {

        cashBalance:
          Math.max(
            0,
            safeNumber(
              source.cashBalance
            )
          ),

        winningBalance:
          Math.max(
            0,
            safeNumber(
              source.winningBalance
            )
          ),

        ludoCoins:
          Math.max(
            0,
            safeNumber(
              source.ludoCoins
            )
          ),

        xp:
          Math.max(
            0,
            safeNumber(
              source.xp
            )
          ),

        gamesPlayed:
          Math.max(
            0,
            safeNumber(
              source.gamesPlayed
            )
          ),

        gamesWon:
          Math.max(
            0,
            safeNumber(
              source.gamesWon
            )
          )
      };
    }


    async function ensureEconomy(
      user
    ) {

      if (
        !user
      ) {

        return null;
      }


      const requestId =
        ++economyRequestId;


      const payload =
        await apiRequest(
          API_ROUTES.economy
        );


      if (
        destroyed ||
        requestId !==
          economyRequestId ||
        currentUser?.uid !==
          user.uid
      ) {

        return null;
      }


      const economy =
        normalizeEconomy(
          payload?.economy
        );


      if (
        walletBalance
      ) {

        walletBalance.textContent =
          formatNumber(
            economy.cashBalance
          );
      }


      return economy;
    }


    async function refreshWallet() {

      if (
        !currentUser
      ) {

        return;
      }


      try {

        await ensureEconomy(
          currentUser
        );

      } catch (error) {

        console.error(
          "Wallet refresh error:",
          error
        );


        if (
          walletBalance
        ) {

          walletBalance.textContent =
            "—";
        }
      }
    }


    /* =====================================================
       PLAYER NORMALIZATION
       ===================================================== */

    function normalizePlayer(
      uid,
      data
    ) {

      const source =
        data &&
        typeof data === "object"
          ? data
          : {};


      return {

        uid:
          String(
            source.uid ||
            uid ||
            ""
          ),

        name:
          String(
            source.name ||
            "LUDOVERSE Player"
          ).slice(
            0,
            80
          ),

        photo:
          String(
            source.photo ||
            ""
          ).slice(
            0,
            500
          ),

        joinedAt:
          safeNumber(
            source.joinedAt
          ),

        ready:
          source.ready === true,

        connected:
          source.connected !== false
      };
    }


    /* =====================================================
       ROOM NORMALIZATION
       -----------------------------------------------------
       Financial fields here are DISPLAY ONLY.
       They are never sent back to Firebase/backend as
       authoritative values.
       ===================================================== */

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


      const roomCode =
        normalizeRoomCode(
          data.roomCode ||
          code
        );


      if (
        !isValidRoomCode(
          roomCode
        )
      ) {

        return null;
      }


      const playersSource =
        data.players &&
        typeof data.players ===
          "object"

          ? data.players

          : {};


      const players =
        {};


      Object.entries(
        playersSource
      )
        .slice(
          0,
          MAX_PLAYERS
        )
        .forEach(
          ([uid, player]) => {

            if (
              player &&
              typeof player ===
                "object"
            ) {

              players[uid] =
                normalizePlayer(
                  uid,
                  player
                );
            }
          }
        );


      const playerList =
        Object.values(
          players
        );


      const mode =
        String(
          data.mode ||
          "private"
        );


      const status =
        String(
          data.status ||
          "waiting"
        );


      /*
       * Server may publish display-only fee metadata.
       *
       * Client must NEVER use this to decide whether a
       * player can afford a battle.
       */

      const entryFeeMinor =
        Math.max(
          0,
          safeNumber(
            data.entryFeeMinor
          )
        );


      return {

        roomCode,

        battleId:
          String(
            data.battleId ||
            roomCode
          ),

        game:
          String(
            data.game ||
            "ludo"
          ),

        mode:
          VALID_ROOM_MODES.has(
            mode
          )
            ? mode
            : "private",

        creatorUid:
          String(
            data.creatorUid ||
            ""
          ),

        creatorName:
          String(
            data.creatorName ||
            "LUDOVERSE Player"
          ).slice(
            0,
            80
          ),

        creatorPhoto:
          String(
            data.creatorPhoto ||
            ""
          ).slice(
            0,
            500
          ),

        players,

        playerCount:
          playerList.length,

        maxPlayers:
          Math.max(
            2,
            Math.min(
              MAX_PLAYERS,
              safeNumber(
                data.maxPlayers,
                MAX_PLAYERS
              )
            )
          ),

        status:
          VALID_ROOM_STATUSES.has(
            status
          )
            ? status
            : "waiting",

        createdAt:
          safeNumber(
            data.createdAt
          ),

        updatedAt:
          safeNumber(
            data.updatedAt
          ),

        expiresAt:
          safeNumber(
            data.expiresAt
          ),

        /*
         * DISPLAY ONLY.
         */

        entryType:
          String(
            data.entryType ||
            "free"
          ).slice(
            0,
            30
          ),

        entryFeeMinor,

        currency:
          String(
            data.currency ||
            "INR"
          ).slice(
            0,
            10
          ),

        /*
         * IMPORTANT:
         *
         * There is intentionally NO:
         *
         * coinReservation
         * wallet debit
         * payout
         * settlement
         * winner amount
         *
         * in client-created data.
         */
      };
    }


    /* =====================================================
       HTML SAFETY
       ===================================================== */

    function escapeHTML(
      value
    ) {

      return String(
        value ?? ""
      )
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
       TIME
       ===================================================== */

    function formatAge(
      timestamp
    ) {

      const time =
        safeNumber(
          timestamp
        );


      if (!time) {

        return "just now";
      }


      const seconds =
        Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              time
            ) / 1000
          )
        );


      if (
        seconds < 10
      ) {

        return "just now";
      }


      if (
        seconds < 60
      ) {

        return `${seconds}s ago`;
      }


      const minutes =
        Math.floor(
          seconds / 60
        );


      if (
        minutes < 60
      ) {

        return `${minutes}m ago`;
      }


      const hours =
        Math.floor(
          minutes / 60
        );


      if (
        hours < 24
      ) {

        return `${hours}h ago`;
      }


      return `${Math.floor(
        hours / 24
      )}d ago`;
    }


    /* =====================================================
       ROOM STATE HELPERS
       ===================================================== */

    function isRoomExpired(
      room
    ) {

      if (
        !room
      ) {

        return true;
      }


      const expiresAt =
        safeNumber(
          room.expiresAt
        );


      if (
        expiresAt <= 0
      ) {

        return false;
      }


      return (
        expiresAt <=
        Date.now()
      );
    }


    function isJoinableRoom(
      room
    ) {

      if (
        !room
      ) {

        return false;
      }


      if (
        room.status !==
        "waiting"
      ) {

        return false;
      }


      if (
        isRoomExpired(
          room
        )
      ) {

        return false;
      }


      if (
        room.playerCount >=
        room.maxPlayers
      ) {

        return false;
      }


      if (
        currentUser &&
        room.players?.[
          currentUser.uid
        ]
      ) {

        return false;
      }


      return (
        room.mode ===
          "public" ||

        room.mode ===
          "quick"
      );
    }


    /* =====================================================
       TOAST
       ===================================================== */

    function showToast(
      message,
      title = "LUDOVERSE",
      type = "success"
    ) {

      if (
        !toast ||
        !toastMessage
      ) {

        window.alert(
          message
        );

        return;
      }


      toastTitle.textContent =
        String(
          title
        );


      toastMessage.textContent =
        String(
          message
        );


      toast.classList.remove(
        "success",
        "error",
        "info",
        "show"
      );


      toast.classList.add(
        type
      );


      if (
        toastIcon
      ) {

        toastIcon.textContent =
          type === "error"
            ? "!"
            : type === "info"
              ? "i"
              : "✓";
      }


      requestAnimationFrame(
        () => {

          toast.classList.add(
            "show"
          );
        }
      );


      clearTimeout(
        showToast.timer
      );


      showToast.timer =
        setTimeout(
          () => {

            toast.classList.remove(
              "show"
            );

          },
          3200
        );
    }


    /* =====================================================
       BUSY STATE
       ===================================================== */

    function setBusy(
      value,
      source = ""
    ) {

      busy =
        Boolean(
          value
        );


      [
        quickMatchBtn,
        createBattleBtn,
        createPublicBtn,
        createPrivateBtn,
        emptyCreateBtn,
        confirmCreateBtn,
        confirmJoinBtn
      ]
        .filter(Boolean)
        .forEach(
          (button) => {

            button.disabled =
              busy;
          }
        );


      if (
        refreshBtn
      ) {

        refreshBtn.disabled =
          busy;
      }


      if (
        quickMatchBtn
      ) {

        if (
          busy &&
          source ===
            "quick"
        ) {

          if (
            !quickMatchBtn.dataset.originalHTML
          ) {

            quickMatchBtn.dataset.originalHTML =
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
          quickMatchBtn.dataset.originalHTML
        ) {

          quickMatchBtn.innerHTML =
            quickMatchBtn.dataset.originalHTML;

          delete quickMatchBtn
            .dataset
            .originalHTML;
        }
      }


      if (
        confirmCreateBtn
      ) {

        confirmCreateBtn.textContent =
          busy &&
          source ===
            "create"

            ? "Creating Room..."

            : "Create Room →";
      }


      if (
        confirmJoinBtn
      ) {

        confirmJoinBtn.textContent =
          busy &&
          source ===
            "join"

            ? "Joining Room..."

            : "Join Room →";
      }
    }


    /* =====================================================
       PROFILE
       ===================================================== */

    function renderProfile(
      user
    ) {

      const name =
        getPlayerName(
          user
        );


      const initials =
        getInitials(
          name
        );


      if (
        headerName
      ) {

        headerName.textContent =
          name;
      }


      if (
        headerEmail
      ) {

        headerEmail.textContent =
          user.email ||
          user.phoneNumber ||
          "Authenticated player";
      }


      if (
        profileAvatar
      ) {

        profileAvatar.textContent =
          initials;
      }


      if (
        menuAvatar
      ) {

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
        String(
          profileOpen
        )
      );
    }


    function closeProfileMenu() {

      if (
        !profileMenu ||
        !profileBtn
      ) {

        return;
      }


      profileOpen =
        false;


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


    /* =====================================================
       CURRENT BATTLE STORAGE
       -----------------------------------------------------
       localStorage is convenience ONLY.
       It is never considered proof that the user owns
       a battle.
       ===================================================== */

    function saveCurrentRoom(
      code
    ) {

      const normalized =
        normalizeRoomCode(
          code
        );


      currentRoomCode =
        isValidRoomCode(
          normalized
        )
          ? normalized
          : "";


      writeStoredRoomCode(
        currentRoomCode
      );


      renderActiveRoom();
    }


    function clearCurrentRoom() {

      currentRoomCode =
        "";


      writeStoredRoomCode(
        ""
      );


      renderActiveRoom();
    }


    function getCurrentRoom() {

      return currentRoomCode
        ? rooms[
            currentRoomCode
          ] || null
        : null;
    }


    /* =====================================================
       CURRENT BATTLE — SERVER VALIDATION
       ===================================================== */

    async function validateCurrentRoom() {

      const requestId =
        ++currentBattleRequestId;


      if (
        !currentUser
      ) {

        clearCurrentRoom();

        return null;
      }


      try {

        const payload =
          await apiRequest(
            API_ROUTES.currentBattle
          );


        if (
          destroyed ||
          requestId !==
            currentBattleRequestId
        ) {

          return null;
        }


        const serverRoom =
          normalizeRoom(
            payload?.battle?.roomCode ||
            payload?.room?.roomCode ||
            currentRoomCode,
            payload?.battle ||
            payload?.room
          );


        /*
         * Backend is the authority for whether this user
         * actually has an active battle.
         */

        if (
          serverRoom &&
          serverRoom.players?.[
            currentUser.uid
          ]
        ) {

          rooms[
            serverRoom.roomCode
          ] =
            serverRoom;


          saveCurrentRoom(
            serverRoom.roomCode
          );


          return serverRoom;
        }


        clearCurrentRoom();

        return null;

      } catch (error) {

        /*
         * Do not blindly delete local state when the backend
         * is temporarily unavailable.
         */

        console.error(
          "Current battle validation error:",
          error
        );


        return null;
      }
    }


    /* =====================================================
       BACKEND BATTLE CREATE
       ===================================================== */

    async function createBattle(
      mode = "private"
    ) {

      if (
        busy
      ) {

        return;
      }


      if (
        !currentUser
      ) {

        showToast(
          "Please login before creating a battle.",
          "Login Required",
          "error"
        );

        return;
      }


      if (
        !VALID_ROOM_MODES.has(
          mode
        )
      ) {

        showToast(
          "Invalid battle mode.",
          "Battle Error",
          "error"
        );

        return;
      }


      const operationKey =
        `create:${mode}`;


      if (
        activeOperations.has(
          operationKey
        )
      ) {

        return;
      }


      activeOperations.set(
        operationKey,
        true
      );


      setBusy(
        true,
        "create"
      );


      try {

        /*
         * IMPORTANT:
         *
         * Do NOT send:
         *
         * walletBalance
         * cashBalance
         * coinAmount
         * payout
         * reservation
         * creatorUid
         * roomCode
         *
         * Server determines all of them.
         *
         * If your battle setup allows choosing a stake,
         * send a SERVER-DEFINED stakeId here, not an amount
         * supplied as authority by the browser.
         */

        const payload =
          await apiRequest(
            API_ROUTES.createBattle,
            {
              method:
                "POST",

              body: {
                mode
              }
            }
          );


        const battle =
          payload?.battle;


        const code =
          normalizeRoomCode(
            battle?.roomCode ||
            battle?.code
          );


        if (
          !isValidRoomCode(
            code
          )
        ) {

          throw new Error(
            "Server returned an invalid battle code."
          );
        }


        saveCurrentRoom(
          code
        );


        closeCreateModalFn();


        showToast(
          `Battle ${code} created successfully.`,
          "Battle Created"
        );


        redirectToRoom(
          code
        );

      } catch (error) {

        console.error(
          "Backend battle creation error:",
          error
        );


        if (
          error?.code ===
          "INSUFFICIENT_BALANCE"
        ) {

          showToast(
            "You do not have enough available balance for this battle.",
            "Insufficient Balance",
            "error"
          );

        } else {

          showToast(
            error?.message ||
            "Could not create the battle.",
            "Battle Error",
            "error"
          );
        }

      } finally {

        activeOperations.delete(
          operationKey
        );


        setBusy(
          false,
          "create"
        );
      }
    }


    /* =====================================================
       BACKEND JOIN
       ===================================================== */

    async function joinRoomInternal(
      code
    ) {

      const normalizedCode =
        normalizeRoomCode(
          code
        );


      if (
        !isValidRoomCode(
          normalizedCode
        )
      ) {

        throw new Error(
          "Enter a valid 6-digit room code."
        );
      }


      requireUser();


      const operationKey =
        `join:${normalizedCode}`;


      if (
        activeOperations.has(
          operationKey
        )
      ) {

        throw new Error(
          "Join request is already being processed."
        );
      }


      activeOperations.set(
        operationKey,
        true
      );


      try {

        /*
         * The server must atomically:
         *
         * 1. Verify UID.
         * 2. Find battle.
         * 3. Verify waiting state.
         * 4. Verify player limit.
         * 5. Verify eligibility.
         * 6. Verify stake configuration.
         * 7. Reserve/debit money if applicable.
         * 8. Add player exactly once.
         * 9. Return authoritative battle.
         *
         * Client performs NONE of these financial decisions.
         */

        const payload =
          await apiRequest(
            API_ROUTES.joinBattle(
              normalizedCode
            ),
            {
              method:
                "POST",

              body: {}
            }
          );


        const battle =
          payload?.battle;


        const serverCode =
          normalizeRoomCode(
            battle?.roomCode ||
            normalizedCode
          );


        if (
          !isValidRoomCode(
            serverCode
          )
        ) {

          throw new Error(
            "Server returned an invalid battle code."
          );
        }


        return {

          roomCode:
            serverCode,

          alreadyJoined:
            payload?.alreadyJoined ===
              true,

          battle
        };

      } finally {

        activeOperations.delete(
          operationKey
        );
      }
    }


    async function joinRoom(
      code
    ) {

      if (
        busy
      ) {

        return;
      }


      if (
        !currentUser
      ) {

        showToast(
          "Please login before joining a battle.",
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


        closeJoinModalFn();


        showToast(
          result.alreadyJoined
            ? "Opening your battle..."
            : "You joined the battle successfully.",

          result.alreadyJoined
            ? "Battle"
            : "Battle Joined"
        );


        redirectToRoom(
          result.roomCode
        );

      } catch (error) {

        console.error(
          "Join battle error:",
          error
        );


        switch (
          error?.code
        ) {

          case "INSUFFICIENT_BALANCE":

            showToast(
              "You do not have enough available balance for this battle.",
              "Insufficient Balance",
              "error"
            );

            break;


          case "BATTLE_FULL":

            showToast(
              "This battle is already full.",
              "Battle Full",
              "error"
            );

            break;


          case "BATTLE_STARTED":

            showToast(
              "This battle has already started.",
              "Battle Started",
              "error"
            );

            break;


          case "BATTLE_EXPIRED":

            showToast(
              "This battle has expired.",
              "Battle Expired",
              "error"
            );

            break;


          default:

            showToast(
              error?.message ||
              "Could not join the battle.",
              "Join Error",
              "error"
            );
        }

      } finally {

        setBusy(
          false,
          "join"
        );
      }
    }


    /* =====================================================
       QUICK MATCH
       ===================================================== */

    async function quickMatch() {

      if (
        busy
      ) {

        return;
      }


      if (
        !currentUser
      ) {

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


      const operationKey =
        "quick-match";


      try {

        if (
          activeOperations.has(
            operationKey
          )
        ) {

          return;
        }


        activeOperations.set(
          operationKey,
          true
        );


        /*
         * Server performs matchmaking atomically.
         *
         * Client does NOT:
         *
         * • scan Firebase
         * • select a room
         * • check balance
         * • reserve coins
         * • create a room
         */

        const payload =
          await apiRequest(
            API_ROUTES.quickMatch,
            {
              method:
                "POST",

              body: {}
            }
          );


        const battle =
          payload?.battle;


        const code =
          normalizeRoomCode(
            battle?.roomCode ||
            battle?.code
          );


        if (
          !isValidRoomCode(
            code
          )
        ) {

          throw new Error(
            "Server returned an invalid Quick Match battle."
          );
        }


        saveCurrentRoom(
          code
        );


        const matched =
          payload?.matched ===
          true;


        showToast(
          matched
            ? "Opponent found. Opening the battle..."
            : "Matchmaking battle created. Waiting for an opponent...",

          matched
            ? "Match Found"
            : "Quick Match"
        );


        redirectToRoom(
          code
        );

      } catch (error) {

        console.error(
          "Quick Match error:",
          error
        );


        if (
          error?.code ===
          "INSUFFICIENT_BALANCE"
        ) {

          showToast(
            "You do not have enough available balance for Quick Match.",
            "Insufficient Balance",
            "error"
          );

        } else {

          showToast(
            error?.message ||
            "Quick Match could not start.",
            "Match Error",
            "error"
          );
        }

      } finally {

        activeOperations.delete(
          operationKey
        );


        setBusy(
          false,
          "quick"
        );
      }
    }


    /* =====================================================
       ROOM LIST RENDERING
       ===================================================== */

    function renderRooms() {

      if (
        !roomsList
      ) {

        return;
      }


      const roomArray =
        Object.values(
          rooms
        )
          .filter(
            isJoinableRoom
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


      if (
        availableBattleCount
      ) {

        availableBattleCount.textContent =
          String(
            roomArray.length
          );
      }


      if (
        onlinePlayerCount
      ) {

        onlinePlayerCount.textContent =
          String(
            roomArray.reduce(
              (
                total,
                room
              ) =>
                total +
                room.playerCount,

              0
            )
          );
      }


      roomsList.innerHTML =
        "";


      if (
        roomArray.length ===
        0
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
        (room) => {

          const card =
            document.createElement(
              "article"
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


          const age =
            escapeHTML(
              formatAge(
                room.createdAt
              )
            );


          const creatorInitials =
            escapeHTML(
              getInitials(
                room.creatorName
              )
            );


          /*
           * Fee is display-only server metadata.
           *
           * No balance calculation happens here.
           */

          let entryText =
            "FREE PLAY";


          if (
            room.entryType ===
              "cash" &&
            room.entryFeeMinor >
              0
          ) {

            const rupees =
              room.entryFeeMinor /
              100;


            entryText =
              `₹${formatNumber(
                rupees
              )} ENTRY`;

          } else if (
            room.entryType ===
              "coins" &&
            room.entryFeeMinor >
              0
          ) {

            entryText =
              `ENTRY ${formatNumber(
                room.entryFeeMinor
              )}`;
          }


          const modeText =
            room.mode ===
              "quick"

              ? "Quick Match"

              : "Public Battle";


          card.innerHTML = `

            <div class="room-left">

              <div
                class="room-avatar"
                aria-hidden="true"
              >
                ${creatorInitials}
              </div>

              <div class="room-info">

                <div class="room-title-line">

                  <h3>
                    ${creator}
                  </h3>

                  <span
                    class="room-live-dot"
                    aria-label="Live room"
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
                    ${room.playerCount}/${room.maxPlayers} players
                  </span>

                  <span
                    class="room-age"
                  >
                    ${age}
                  </span>

                  <span
                    class="room-entry"
                  >
                    ${escapeHTML(
                      entryText
                    )}
                  </span>

                </div>

                <p
                  class="room-description"
                >
                  ${escapeHTML(
                    modeText
                  )}
                  · Ready when you are
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


    /* =====================================================
       ACTIVE ROOM
       ===================================================== */

    function renderActiveRoom() {

      if (
        !activeRoomSection
      ) {

        return;
      }


      const room =
        getCurrentRoom();


      if (
        !room
      ) {

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

        /*
         * Do NOT immediately delete server state.
         *
         * The realtime projection might briefly lag.
         *
         * Server validation remains authoritative.
         */

        activeRoomSection.classList.remove(
          "show"
        );

        return;
      }


      activeRoomSection.classList.add(
        "show"
      );


      if (
        activeRoomCode
      ) {

        activeRoomCode.textContent =
          room.roomCode;
      }


      if (
        activeRoomPlayers
      ) {

        activeRoomPlayers.textContent =
          `${room.playerCount}/${room.maxPlayers}`;
      }


      if (
        leaveRoomBtn
      ) {

        leaveRoomBtn.textContent =
          room.creatorUid ===
          currentUser?.uid

            ? "Cancel Battle"

            : "Exit Battle";
      }


      if (
        activeRoomStatus
      ) {

        if (
          room.status ===
          "playing"
        ) {

          activeRoomStatus.textContent =
            "Match is in progress";

        } else if (
          room.status ===
          "completed"
        ) {

          activeRoomStatus.textContent =
            "Match completed";

        } else if (
          room.status ===
          "cancelled"
        ) {

          activeRoomStatus.textContent =
            "Battle cancelled";

        } else if (
          room.status ===
          "expired" ||
          isRoomExpired(
            room
          )
        ) {

          activeRoomStatus.textContent =
            "Battle expired";

        } else if (
          room.playerCount >=
          room.maxPlayers
        ) {

          activeRoomStatus.textContent =
            "Opponent connected · Open the battle to continue";

        } else {

          activeRoomStatus.textContent =
            "Waiting for another player...";
        }
      }
    }


    /* =====================================================
       REALTIME FIREBASE LISTENER
       -----------------------------------------------------
       READ ONLY.

       The server writes this projection.

       Client does NOT:
       • create
       • join
       • delete
       • update
       • settle
       ===================================================== */

    function startRoomsListener() {

      if (
        roomsUnsubscribe ||
        destroyed
      ) {

        return;
      }


      roomsUnsubscribe =
        onValue(
          ref(
            database,
            ROOMS_PATH
          ),

          (snapshot) => {

            if (
              destroyed
            ) {

              return;
            }


            const data =
              snapshot.exists()
                ? snapshot.val()
                : {};


            const normalized =
              {};


            Object.entries(
              data
            )
              .slice(
                0,
                MAX_ROOM_SCAN
              )
              .forEach(
                ([code, rawRoom]) => {

                  const room =
                    normalizeRoom(
                      code,
                      rawRoom
                    );


                  if (
                    room
                  ) {

                    normalized[
                      room.roomCode
                    ] =
                      room;
                  }
                }
              );


            rooms =
              normalized;


            /*
             * Reconcile local current-room reference with
             * server-published realtime state.
             *
             * This is display recovery only.
             */

            if (
              currentUser &&
              currentRoomCode
            ) {

              const room =
                rooms[
                  currentRoomCode
                ];


              if (
                room &&
                room.players?.[
                  currentUser.uid
                ]
              ) {

                renderActiveRoom();
              }
            }


            renderRooms();

            renderActiveRoom();
          },

          (error) => {

            console.error(
              "Realtime battle listener error:",
              error
            );


            showToast(
              "Live battle updates are temporarily unavailable.",
              "Connection Error",
              "error"
            );
          }
        );
    }


    /* =====================================================
       STOP LISTENER
       ===================================================== */

    function stopRoomsListener() {

      if (
        roomsUnsubscribe
      ) {

        try {

          roomsUnsubscribe();

        } catch (error) {

          console.warn(
            "Battle listener cleanup error:",
            error
          );
        }


        roomsUnsubscribe =
          null;
      }
    }


    /* =====================================================
       COPY ROOM CODE
       ===================================================== */

    async function copyCurrentRoomCode() {

      const room =
        getCurrentRoom();


      if (
        !room?.roomCode
      ) {

        showToast(
          "There is no active battle.",
          "Battle",
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

        } else {

          const textarea =
            document.createElement(
              "textarea"
            );


          textarea.value =
            room.roomCode;


          textarea.style.position =
            "fixed";


          textarea.style.opacity =
            "0";


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
          `Battle code ${room.roomCode} copied.`,
          "Copied"
        );

      } catch (error) {

        console.error(
          "Copy error:",
          error
        );


        showToast(
          `Battle code: ${room.roomCode}`,
          "Battle Code",
          "info"
        );
      }
    }


    /* =====================================================
       NAVIGATION
       ===================================================== */

    function redirectToRoom(
      code
    ) {

      const normalized =
        normalizeRoomCode(
          code
        );


      if (
        !isValidRoomCode(
          normalized
        )
      ) {

        showToast(
          "Invalid battle code.",
          "Navigation Error",
          "error"
        );

        return;
      }


      setTimeout(
        () => {

          if (
            destroyed
          ) {

            return;
          }


          window.location.assign(
            `battle-room.html?room=${encodeURIComponent(
              normalized
            )}`
          );

        },
        REDIRECT_DELAY_MS
      );
    }


    function openCurrentRoom() {

      const room =
        getCurrentRoom();


      if (
        !room?.roomCode
      ) {

        showToast(
          "There is no active battle.",
          "Battle",
          "error"
        );

        return;
      }


      redirectToRoom(
        room.roomCode
      );
    }


    /* =====================================================
       LEAVE / CANCEL BATTLE
       -----------------------------------------------------
       CRITICAL:
       No Firebase delete.
       No local financial mutation.

       Backend decides:
       • whether leaving is allowed
       • whether entry fee was reserved
       • whether refund applies
       • how much is refunded
       • whether battle can be cancelled
       • whether settlement has started
       ===================================================== */

    async function leaveCurrentRoom() {

      const room =
        getCurrentRoom();


      if (
        !room ||
        !currentUser
      ) {

        clearCurrentRoom();

        return;
      }


      if (
        busy
      ) {

        return;
      }


      const confirmed =
        window.confirm(
          "Leave your current battle?"
        );


      if (
        !confirmed
      ) {

        return;
      }


      busy =
        true;


      if (
        leaveRoomBtn
      ) {

        leaveRoomBtn.disabled =
          true;
      }


      try {

        /*
         * Backend is responsible for the complete leave
         * transaction.
         */

        const payload =
          await apiRequest(
            API_ROUTES.leaveBattle(
              room.roomCode
            ),
            {
              method:
                "POST",

              body: {}
            }
          );


        /*
         * Server may return refund information for display.
         *
         * This client does NOT calculate it.
         */

        const refund =
          payload?.refund;


        clearCurrentRoom();


        if (
          refund?.processed ===
          true
        ) {

          showToast(
            "You left the battle. Any applicable refund was processed by the server.",
            "Battle Left"
          );

        } else {

          showToast(
            "You left the battle.",
            "Battle Left"
          );
        }

      } catch (error) {

        console.error(
          "Leave battle error:",
          error
        );


        showToast(
          error?.message ||
          "Could not leave the battle.",
          "Battle Error",
          "error"
        );

      } finally {

        busy =
          false;


        if (
          leaveRoomBtn
        ) {

          leaveRoomBtn.disabled =
            false;
        }
      }
    }


    /* =====================================================
       BATTLE SETUP NAVIGATION
       ===================================================== */

    function openBattleSetup() {

      if (
        !currentUser
      ) {

        showToast(
          "Please login before creating a battle.",
          "Login Required",
          "error"
        );

        return;
      }


      window.location.assign(
        "battle-setup.html"
      );
    }


    function openCreateModal() {

      if (
        !currentUser
      ) {

        showToast(
          "Please login before creating a battle.",
          "Login Required",
          "error"
        );

        return;
      }


      /*
       * Keep your existing setup page as the place where
       * the user chooses the server-defined battle/stake.
       */

      window.location.assign(
        "battle-setup.html?mode=private"
      );
    }


    function openPublicSetup() {

      if (
        !currentUser
      ) {

        showToast(
          "Please login before creating a battle.",
          "Login Required",
          "error"
        );

        return;
      }


      window.location.assign(
        "battle-setup.html?mode=public"
      );
    }


    /* =====================================================
       MODALS
       ===================================================== */

    function closeCreateModalFn() {

      createModal?.classList.remove(
        "show"
      );
    }


    function openJoinModal(
      code = ""
    ) {

      if (
        !currentUser
      ) {

        showToast(
          "Please login before joining a battle.",
          "Login Required",
          "error"
        );

        return;
      }


      if (
        roomCodeInput
      ) {

        roomCodeInput.value =
          normalizeRoomCode(
            code
          );
      }


      joinModal?.classList.add(
        "show"
      );


      setTimeout(
        () => {

          roomCodeInput?.focus();

        },
        100
      );
    }


    function closeJoinModalFn() {

      joinModal?.classList.remove(
        "show"
      );
    }


    /* =====================================================
       LOGOUT
       ===================================================== */

    async function logout() {

      if (
        !currentUser
      ) {

        return;
      }


      if (
        busy
      ) {

        return;
      }


      const confirmed =
        window.confirm(
          "Are you sure you want to logout?"
        );


      if (
        !confirmed
      ) {

        return;
      }


      try {

        busy =
          true;


        /*
         * Invalidate pending asynchronous operations.
         */

        economyRequestId +=
          1;

        currentBattleRequestId +=
          1;

        authGeneration +=
          1;


        stopRoomsListener();


        await signOut(
          auth
        );


        currentUser =
          null;


        rooms =
          {};


        clearCurrentRoom();


        window.location.assign(
          "login.html"
        );

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

      } finally {

        busy =
          false;
      }
    }


    /* =====================================================
       EVENT LISTENERS
       ===================================================== */

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
      () => {

        closeProfileMenu();
      }
    );


    logoutBtn?.addEventListener(
      "click",
      logout
    );


    quickMatchBtn?.addEventListener(
      "click",
      quickMatch
    );


    createBattleBtn?.addEventListener(
      "click",
      openBattleSetup
    );


    createPublicBtn?.addEventListener(
      "click",
      openPublicSetup
    );


    createPrivateBtn?.addEventListener(
      "click",
      openCreateModal
    );


    emptyCreateBtn?.addEventListener(
      "click",
      openBattleSetup
    );


    /*
     * Compatibility:
     *
     * If old HTML still has confirmCreateBtn,
     * the server creates the private battle.
     *
     * For stake-based battles, battle-setup.html should
     * eventually own the creation request.
     */

    confirmCreateBtn?.addEventListener(
      "click",
      () => {

        createBattle(
          "private"
        );
      }
    );


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


    confirmJoinBtn?.addEventListener(
      "click",
      () => {

        joinRoom(
          roomCodeInput?.value ||
          ""
        );
      }
    );


    refreshBtn?.addEventListener(
      "click",
      async () => {

        if (
          busy
        ) {

          return;
        }


        refreshBtn.disabled =
          true;


        try {

          await refreshWallet();

          await validateCurrentRoom();

          renderRooms();

          renderActiveRoom();


          showToast(
            "Wallet and battle state refreshed.",
            "Updated",
            "info"
          );

        } catch (error) {

          console.error(
            "Refresh error:",
            error
          );


          showToast(
            "Could not refresh the latest data.",
            "Refresh Error",
            "error"
          );

        } finally {

          setTimeout(
            () => {

              if (
                refreshBtn
              ) {

                refreshBtn.disabled =
                  false;
              }

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


    leaveRoomBtn?.addEventListener(
      "click",
      leaveCurrentRoom
    );


    roomCodeInput?.addEventListener(
      "input",
      () => {

        roomCodeInput.value =
          normalizeRoomCode(
            roomCodeInput.value
          );
      }
    );


    roomCodeInput?.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();


          if (
            !busy
          ) {

            joinRoom(
              roomCodeInput.value
            );
          }
        }
      }
    );


    [
      createModal,
      joinModal
    ].forEach(
      (modal) => {

        modal?.addEventListener(
          "click",
          (event) => {

            if (
              event.target ===
              modal
            ) {

              modal.classList.remove(
                "show"
              );
            }
          }
        );
      }
    );


    document.addEventListener(
      "keydown",
      (event) => {

        if (
          event.key !==
          "Escape"
        ) {

          return;
        }


        closeCreateModalFn();

        closeJoinModalFn();

        closeProfileMenu();
      }
    );


    /* =====================================================
       PAGE LIFECYCLE
       ===================================================== */

    window.addEventListener(
      "pagehide",
      () => {

        destroyed =
          true;

        economyRequestId +=
          1;

        currentBattleRequestId +=
          1;

        authGeneration +=
          1;

        stopRoomsListener();
      }
    );


    document.addEventListener(
      "visibilitychange",
      () => {

        if (
          document.visibilityState !==
          "visible"
        ) {

          return;
        }


        if (
          currentUser &&
          !busy
        ) {

          refreshWallet();

          validateCurrentRoom();

          renderRooms();

          renderActiveRoom();
        }
      }
    );


    /* =====================================================
       AUTH INITIALIZATION
       ===================================================== */

    onAuthStateChanged(
      auth,
      async (user) => {

        const generation =
          ++authGeneration;


        if (
          destroyed
        ) {

          return;
        }


        if (
          !user
        ) {

          economyRequestId +=
            1;

          currentBattleRequestId +=
            1;


          currentUser =
            null;


          stopRoomsListener();


          window.location.assign(
            "login.html"
          );


          return;
        }


        currentUser =
          user;


        renderProfile(
          user
        );


        /*
         * Load authoritative wallet.
         */

        try {

          await ensureEconomy(
            user
          );

        } catch (error) {

          console.error(
            "Economy initialization error:",
            error
          );


          if (
            walletBalance
          ) {

            walletBalance.textContent =
              "—";
          }


          showToast(
            "Wallet could not be refreshed. Please try again.",
            "Wallet",
            "error"
          );
        }


        /*
         * Authentication may have changed while wallet
         * request was in progress.
         */

        if (
          destroyed ||
          generation !==
            authGeneration ||
          currentUser?.uid !==
            user.uid
        ) {

          return;
        }


        startRoomsListener();


        /*
         * Server decides whether a current battle actually
         * belongs to this user.
         */

        await validateCurrentRoom();


        if (
          destroyed ||
          generation !==
            authGeneration
        ) {

          return;
        }


        renderRooms();

        renderActiveRoom();
      }
    );


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    console.log(
      "🎲 LUDOVERSE Battle Lobby initialized — backend-authoritative battle flow + read-only Firebase realtime projection"
    );

  }
);