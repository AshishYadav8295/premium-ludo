/* =========================================================
   LUDOVERSE — MULTIPLAYER BATTLE ROOM
   ---------------------------------------------------------
   Firebase Realtime Battle Room
   Version: 2.0

   FEATURES
   • Firebase realtime room state
   • Authentication
   • Player synchronization
   • 1/2 → 2/2 player count
   • Ready / Unready
   • Creator-only start
   • Room code copy
   • Native share
   • Leave room
   • Profile / logout
   • Realtime LudoCoins
   • Timeline
   • Activity feed
   • Mobile-safe controls
   • Race-condition protection
   • XSS-safe rendering

   IMPORTANT
   This file controls the multiplayer LOBBY/ROOM.
   Actual Ludo board turn synchronization belongs
   to game.js and is the next multiplayer stabilization step.

   FREE PLAY ONLY
   • LudoCoins are progression points.
   • No cash wagering.
   • No entry fee.
   • No prize pool.
   • No withdrawal.
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


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /* =======================================================
       DOM HELPER
       ======================================================= */

    const $ =
      id =>
        document.getElementById(id);


    /* =======================================================
       HEADER
       ======================================================= */

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


    /* =======================================================
       NAVIGATION
       ======================================================= */

    const backToLobbyBtn =
      $("backToLobbyBtn");

    const copyRoomCodeBtn =
      $("copyRoomCodeBtn");

    const shareRoomBtn =
      $("shareRoomBtn");


    /* =======================================================
       ROOM HEADER
       ======================================================= */

    const roomCodeElement =
      $("roomCode");

    const roomMode =
      $("roomMode");

    const battleStatus =
      $("battleStatus");

    const battleStatusDescription =
      $("battleStatusDescription");

    const statusIcon =
      $("statusIcon");


    /* =======================================================
       ROOM SUMMARY
       ======================================================= */

    const playersJoined =
      $("playersJoined");

    const totalPlayers =
      $("totalPlayers");

    const connectionLabel =
      $("connectionLabel");


    /* =======================================================
       PLAYER ONE
       ======================================================= */

    const playerOneName =
      $("playerOneName");

    const playerOneAvatar =
      $("playerOneAvatar");

    const playerOneDescription =
      $("playerOneDescription");

    const playerOneStatus =
      $("playerOneStatus");

    const playerOneConnection =
      $("playerOneConnection");


    /* =======================================================
       PLAYER TWO
       ======================================================= */

    const playerTwoName =
      $("playerTwoName");

    const playerTwoAvatar =
      $("playerTwoAvatar");

    const playerTwoDescription =
      $("playerTwoDescription");

    const playerTwoStatus =
      $("playerTwoStatus");

    const playerTwoConnection =
      $("playerTwoConnection");


    /* =======================================================
       READY
       ======================================================= */

    const readyBtn =
      $("readyBtn");

    const readyButtonText =
      $("readyButtonText");

    const readyMessage =
      $("readyMessage");


    /* =======================================================
       START
       ======================================================= */

    const startGameBtn =
      $("startGameBtn");

    const startGameSubtext =
      $("startGameSubtext");


    /* =======================================================
       LEAVE
       ======================================================= */

    const cancelBattleBtn =
      $("cancelBattleBtn");


    /* =======================================================
       SUMMARY
       ======================================================= */

    const summaryPlayers =
      $("summaryPlayers");

    const summaryMode =
      $("summaryMode");

    const summaryStatus =
      $("summaryStatus");

    const summaryRoom =
      $("summaryRoom");

    const progressFill =
      $("progressFill");


    /* =======================================================
       TIMELINE
       ======================================================= */

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
       ACTIVITY
       ======================================================= */

    const activityList =
      $("activityList");

    const activityEmpty =
      $("activityEmpty");


    /* =======================================================
       LEAVE MODAL
       ======================================================= */

    const leaveModal =
      $("leaveModal");

    const closeLeaveModalBtn =
      $("closeLeaveModalBtn");

    const confirmLeaveBtn =
      $("confirmLeaveBtn");

    const cancelLeaveBtn =
      $("cancelLeaveBtn");

    const leaveRoomCode =
      $("leaveRoomCode");


    /* =======================================================
       TOAST
       ======================================================= */

    const toast =
      $("toast");

    const toastIcon =
      $("toastIcon");

    const toastTitle =
      $("toastTitle");

    const toastMessage =
      $("toastMessage");


    /* =======================================================
       CONFIG
       ======================================================= */

    const CONFIG =
      Object.freeze({

        ROOMS_PATH:
          "battles",

        ECONOMY_PATH:
          "economy",

        MAX_PLAYERS:
          2,

        ROOM_CODE_LENGTH:
          6,

        CURRENT_ROOM_KEY:
          "ludoverseCurrentRoom",

        TOAST_DURATION:
          3200,

        REDIRECT_DELAY:
          600
      });


    /* =======================================================
       STATE
       ======================================================= */

    let currentUser =
      null;

    let currentBattle =
      null;

    let roomUnsubscribe =
      null;

    let economyUnsubscribe =
      null;

    let profileOpen =
      false;

    let busy =
      false;

    let redirectingToGame =
      false;

    let toastTimer =
      null;

    let lastActivitySignature =
      "";


    /* =======================================================
       ROOM CODE
       ======================================================= */

    function getRoomCodeFromURL() {

      const params =
        new URLSearchParams(
          window.location.search
        );


      return String(
        params.get("room") || ""
      )
        .replace(/\D/g, "")
        .slice(
          0,
          CONFIG.ROOM_CODE_LENGTH
        );
    }


    const roomCode =
      getRoomCodeFromURL();


    /* =======================================================
       INVALID ROOM
       ======================================================= */

    if (
      !/^\d{6}$/.test(
        roomCode
      )
    ) {

      renderNoRoom();

      return;
    }


    /* =======================================================
       FIREBASE REFERENCES
       ======================================================= */

    function getRoomRef() {

      return ref(
        database,
        `${CONFIG.ROOMS_PATH}/${roomCode}`
      );
    }


    function getEconomyRef(uid) {

      return ref(
        database,
        `users/${uid}/${CONFIG.ECONOMY_PATH}`
      );
    }


    /* =======================================================
       HELPERS
       ======================================================= */

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


    function normalizeString(
      value,
      fallback = ""
    ) {

      if (
        value === null ||
        value === undefined
      ) {

        return fallback;
      }

      const text =
        String(value).trim();

      return text || fallback;
    }


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


    function getPlayerName(
      user
    ) {

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

        clearTimeout(
          toastTimer
        );
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


      requestAnimationFrame(
        () => {

          toast.classList.add(
            "show"
          );
        }
      );


      toastTimer =
        setTimeout(
          () => {

            toast.classList.remove(
              "show"
            );

          },
          CONFIG.TOAST_DURATION
        );
    }


    /* =======================================================
       PROFILE
       ======================================================= */

    function renderProfile(
      user
    ) {

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


    /* =======================================================
       ECONOMY
       ======================================================= */

    function listenToEconomy(
      user
    ) {

      if (
        economyUnsubscribe
      ) {

        economyUnsubscribe();

        economyUnsubscribe =
          null;
      }


      if (!user?.uid) {
        return;
      }


      economyUnsubscribe =
        onValue(

          getEconomyRef(
            user.uid
          ),

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
                coins.toLocaleString(
                  "en-IN"
                );
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
       PLAYER NORMALIZATION
       ======================================================= */

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
          normalizeString(
            source.uid,
            uid
          ),

        name:
          normalizeString(
            source.name,
            "LUDOVERSE Player"
          ),

        photo:
          normalizeString(
            source.photo
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


    /* =======================================================
       ROOM NORMALIZATION
       ======================================================= */

    function normalizeRoom(
      data
    ) {

      if (
        !data ||
        typeof data !==
          "object"
      ) {

        return null;
      }


      const sourcePlayers =
        data.players &&
        typeof data.players ===
          "object"

          ? data.players

          : {};


      const players =
        {};


      Object.entries(
        sourcePlayers
      ).forEach(
        ([uid, player]) => {

          players[uid] =
            normalizePlayer(
              uid,
              player
            );
        }
      );


      return {

        roomCode:
          normalizeString(
            data.roomCode,
            roomCode
          ),

        battleId:
          normalizeString(
            data.battleId,
            roomCode
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
          ),

        winnerUid:
          normalizeString(
            data.winnerUid
          ),

        winnerName:
          normalizeString(
            data.winnerName
          )
      };
    }


    /* =======================================================
       PLAYER ORDER
       ======================================================= */

    function getOrderedPlayers(
      room
    ) {

      if (!room) {
        return [];
      }


      const players =
        Object.values(
          room.players || {}
        );


      players.sort(
        (a, b) => {

          const aCreator =
            a.uid ===
            room.creatorUid;

          const bCreator =
            b.uid ===
            room.creatorUid;


          if (
            aCreator &&
            !bCreator
          ) {

            return -1;
          }


          if (
            !aCreator &&
            bCreator
          ) {

            return 1;
          }


          return (
            safeNumber(
              a.joinedAt
            ) -
            safeNumber(
              b.joinedAt
            )
          );
        }
      );


      return players.slice(
        0,
        room.maxPlayers
      );
    }


    function getOwnPlayer(
      room
    ) {

      if (
        !room ||
        !currentUser
      ) {

        return null;
      }


      return (
        room.players?.[
          currentUser.uid
        ] ||
        null
      );
    }


    /* =======================================================
       STATUS
       ======================================================= */

    function getStatusMeta(
      room
    ) {

      if (!room) {

        return {

          title:
            "Room Not Found",

          description:
            "This room no longer exists.",

          icon:
            "!",

          className:
            "error"
        };
      }


      if (
        room.status ===
        "playing"
      ) {

        return {

          title:
            "Match Starting",

          description:
            "Both players are connected. Opening the Ludo board...",

          icon:
            "🎲",

          className:
            "playing"
        };
      }


      if (
        room.status ===
        "completed"
      ) {

        return {

          title:
            "Match Complete",

          description:
            room.winnerName
              ? `${room.winnerName} finished the match.`
              : "This match has been completed.",

          icon:
            "🏆",

          className:
            "complete"
        };
      }


      if (
        room.status ===
        "cancelled"
      ) {

        return {

          title:
            "Room Closed",

          description:
            "This multiplayer room is no longer active.",

          icon:
            "×",

          className:
            "error"
        };
      }


      if (
        room.playerCount <
        room.maxPlayers
      ) {

        return {

          title:
            "Waiting for Opponent",

          description:
            "Share the six-digit room code with your friend.",

          icon:
            "⏳",

          className:
            "waiting"
        };
      }


      const players =
        getOrderedPlayers(
          room
        );


      const allReady =
        players.length >=
          room.maxPlayers &&

        players.every(
          player =>
            player.ready ===
            true
        );


      if (allReady) {

        return {

          title:
            "Both Players Ready",

          description:
            "The room is ready. The creator can start the match.",

          icon:
            "✓",

          className:
            "ready"
        };
      }


      return {

        title:
          "Ready Check",

        description:
          "Both players are connected. Confirm when you are ready.",

        icon:
          "🎯",

        className:
          "connected"
      };
    }


    /* =======================================================
       STATUS RENDER
       ======================================================= */

    function renderStatus(
      room
    ) {

      const meta =
        getStatusMeta(
          room
        );


      if (battleStatus) {

        battleStatus.textContent =
          meta.title;
      }


      if (
        battleStatusDescription
      ) {

        battleStatusDescription.textContent =
          meta.description;
      }


      if (statusIcon) {

        statusIcon.textContent =
          meta.icon;

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
          room?.status
            ?.toUpperCase() ||
          "UNKNOWN";
      }
    }


    /* =======================================================
       AVATAR
       ======================================================= */

    function setAvatar(
      element,
      player,
      fallback = "?"
    ) {

      if (!element) {
        return;
      }


      element.innerHTML =
        "";


      if (
        player?.photo
      ) {

        const image =
          document.createElement(
            "img"
          );


        image.src =
          player.photo;

        image.alt =
          "";

        image.loading =
          "lazy";


        image.addEventListener(
          "error",
          () => {

            element.textContent =
              getInitials(
                player.name
              );

          },
          {
            once: true
          }
        );


        element.appendChild(
          image
        );


        return;
      }


      element.textContent =
        player
          ? getInitials(
              player.name
            )
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
      number
    ) {

      if (!player) {

        if (nameElement) {

          nameElement.textContent =
            "Waiting...";
        }


        if (descriptionElement) {

          descriptionElement.textContent =
            "Waiting for opponent";
        }


        if (statusElement) {

          statusElement.textContent =
            "WAITING";

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

          avatarElement.textContent =
            "?";
        }


        return;
      }


      if (nameElement) {

        nameElement.textContent =
          player.name;
      }


      if (descriptionElement) {

        descriptionElement.textContent =
          player.uid ===
          currentUser?.uid

            ? "You · Connected"

            : "Opponent · Connected";
      }


      setAvatar(
        avatarElement,
        player,
        number === 1
          ? "P1"
          : "P2"
      );


      if (statusElement) {

        const ready =
          player.ready ===
          true;


        statusElement.textContent =
          ready
            ? "READY"
            : "WAITING";


        statusElement.className =
          `player-ready-status ${
            ready
              ? "ready"
              : "waiting"
          }`;
      }


      if (
        connectionElement
      ) {

        const connected =
          player.connected !==
          false;


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


    /* =======================================================
       PLAYERS
       ======================================================= */

    function renderPlayers(
      room
    ) {

      const players =
        getOrderedPlayers(
          room
        );


      const first =
        players[0] ||
        null;

      const second =
        players[1] ||
        null;


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
          String(
            players.length
          );
      }


      if (totalPlayers) {

        totalPlayers.textContent =
          String(
            room.maxPlayers
          );
      }


      if (summaryPlayers) {

        summaryPlayers.textContent =
          String(
            players.length
          );
      }


      if (summaryMode) {

        summaryMode.textContent =
          room.mode ===
          "quick"

            ? "QUICK MATCH"

            : "PRIVATE ROOM";
      }


      if (summaryRoom) {

        summaryRoom.textContent =
          room.roomCode;
      }


      if (progressFill) {

        const readyCount =
          players.filter(
            player =>
              player.ready ===
              true
          ).length;


        const percentage =
          room.maxPlayers >
          0

            ? Math.min(
                100,
                Math.round(
                  (
                    readyCount /
                    room.maxPlayers
                  ) *
                  100
                )
              )

            : 0;


        progressFill.style.width =
          `${percentage}%`;
      }
    }


    /* =======================================================
       READY CONTROL
       ======================================================= */

    function updateReadyControls(
      room
    ) {

      if (!readyBtn) {
        return;
      }


      const ownPlayer =
        getOwnPlayer(
          room
        );


      const players =
        getOrderedPlayers(
          room
        );


      const full =
        players.length >=
        room.maxPlayers;


      const allReady =
        full &&
        players.every(
          player =>
            player.ready ===
            true
        );


      const playing =
        room.status ===
        "playing";


      const closed =
        room.status ===
          "completed" ||
        room.status ===
          "cancelled";


      readyBtn.disabled =
        !ownPlayer ||
        !full ||
        playing ||
        closed ||
        busy;


      if (!full) {

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


      if (playing) {

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


      if (
        ownPlayer.ready
      ) {

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

    function updateStartControl(
      room
    ) {

      if (!startGameBtn) {
        return;
      }


      const players =
        getOrderedPlayers(
          room
        );


      const allReady =
        players.length >=
          room.maxPlayers &&

        players.every(
          player =>
            player.ready ===
            true
        );


      const creator =
        currentUser?.uid ===
        room.creatorUid;


      const playing =
        room.status ===
        "playing";


      const closed =
        room.status ===
          "completed" ||
        room.status ===
          "cancelled";


      startGameBtn.disabled =
        !creator ||
        !allReady ||
        playing ||
        closed ||
        busy;


      if (playing) {

        if (startGameSubtext) {

          startGameSubtext.textContent =
            "Opening the multiplayer board...";
        }


        return;
      }


      if (!creator) {

        if (startGameSubtext) {

          startGameSubtext.textContent =
            allReady

              ? "Waiting for the room creator"

              : "Both players must be ready";
        }


        return;
      }


      if (startGameSubtext) {

        startGameSubtext.textContent =
          allReady

            ? "Both players are ready"

            : "Both players must be ready";
      }
    }


    /* =======================================================
       TIMELINE
       ======================================================= */

    function setTimelineState(
      element,
      active
    ) {

      if (!element) {
        return;
      }


      element.classList.toggle(
        "completed",
        Boolean(active)
      );
    }


    function updateTimeline(
      room
    ) {

      const players =
        getOrderedPlayers(
          room
        );


      const bothReady =
        players.length >=
          room.maxPlayers &&

        players.every(
          player =>
            player.ready ===
            true
        );


      setTimelineState(
        timelineCreated,
        true
      );


      setTimelineState(
        timelineJoined,
        players.length >=
          room.maxPlayers
      );


      setTimelineState(
        timelineReady,
        bothReady
      );


      setTimelineState(
        timelinePlaying,
        room.status ===
          "playing" ||
        room.status ===
          "completed"
      );


      setTimelineState(
        timelineWinner,
        room.status ===
          "completed" ||
        Boolean(
          room.winnerUid
        )
      );
    }


    /* =======================================================
       ACTIVITY
       ======================================================= */

    function renderActivity(
      room
    ) {

      if (!activityList) {
        return;
      }


      const players =
        getOrderedPlayers(
          room
        );


      const events = [];


      if (room.createdAt) {

        events.push({

          key:
            `created-${room.createdAt}`,

          icon:
            "✓",

          title:
            "Room created",

          text:
            `${room.creatorName} created this room.`,

          time:
            room.createdAt
        });
      }


      if (
        players.length >=
        room.maxPlayers
      ) {

        const joinedAt =
          Math.max(
            ...players.map(
              player =>
                safeNumber(
                  player.joinedAt
                )
            )
          );


        events.push({

          key:
            `joined-${joinedAt}`,

          icon:
            "👥",

          title:
            "Opponent joined",

          text:
            "Both player slots are now filled.",

          time:
            joinedAt
        });
      }


      const readyPlayers =
        players.filter(
          player =>
            player.ready ===
            true
        );


      if (
        readyPlayers.length
      ) {

        const latestReady =
          Math.max(
            ...readyPlayers.map(
              player =>
                safeNumber(
                  player.joinedAt
                )
            )
          );


        events.push({

          key:
            `ready-${readyPlayers
              .map(p => p.uid)
              .sort()
              .join("-")}`,

          icon:
            "✓",

          title:
            "Ready check",

          text:
            `${readyPlayers.length}/${room.maxPlayers} players ready.`,

          time:
            latestReady
        });
      }


      if (room.status === "playing") {

        events.push({

          key:
            `playing-${room.startedAt}`,

          icon:
            "🎲",

          title:
            "Match started",

          text:
            "The multiplayer match has started.",

          time:
            room.startedAt ||
            Date.now()
        });
      }


      if (room.status === "completed") {

        events.push({

          key:
            `completed-${room.completedAt}`,

          icon:
            "🏆",

          title:
            "Match completed",

          text:
            room.winnerName
              ? `${room.winnerName} won the match.`
              : "The match has ended.",

          time:
            room.completedAt ||
            Date.now()
        });
      }


      events.sort(
        (a, b) =>
          safeNumber(
            b.time
          ) -
          safeNumber(
            a.time
          )
      );


      const signature =
        events
          .map(
            event =>
              event.key
          )
          .join("|");


      if (
        signature ===
        lastActivitySignature
      ) {

        return;
      }


      lastActivitySignature =
        signature;


      activityList.innerHTML =
        "";


      if (
        events.length ===
        0
      ) {

        activityEmpty
          ?.classList
          .remove("hidden");

        return;
      }


      activityEmpty
        ?.classList
        .add("hidden");


      events.forEach(
        event => {

          const item =
            document.createElement(
              "div"
            );


          item.className =
            "activity-item";


          item.innerHTML = `

            <div
              class="activity-icon"
              aria-hidden="true"
            >
              ${escapeHTML(
                event.icon
              )}
            </div>

            <div
              class="activity-content"
            >

              <strong>
                ${escapeHTML(
                  event.title
                )}
              </strong>

              <p>
                ${escapeHTML(
                  event.text
                )}
              </p>

            </div>

          `;


          activityList.appendChild(
            item
          );
        }
      );
    }


    /* =======================================================
       RENDER ROOM
       ======================================================= */

    function renderRoom(
      room
    ) {

      if (!room) {
        return;
      }


      currentBattle =
        room;


      if (roomCodeElement) {

        roomCodeElement.textContent =
          room.roomCode;
      }


      if (roomMode) {

        roomMode.textContent =
          room.mode ===
          "quick"

            ? "QUICK MATCH"

            : "PRIVATE ROOM";
      }


      renderStatus(
        room
      );


      renderPlayers(
        room
      );


      updateReadyControls(
        room
      );


      updateStartControl(
        room
      );


      updateTimeline(
        room
      );


      renderActivity(
        room
      );


      if (
        room.status ===
        "playing"
      ) {

        redirectToGame(
          room
        );
      }
    }


    /* =======================================================
       READY TRANSACTION
       ======================================================= */

    async function toggleReady() {

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


      setBusy(
        true,
        "ready"
      );


      try {

        const target =
          getRoomRef();


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


              const own =
                players[
                  currentUser.uid
                ];


              if (!own) {
                return;
              }


              const playerCount =
                Object.keys(
                  players
                ).length;


              if (
                playerCount <
                CONFIG.MAX_PLAYERS
              ) {

                return;
              }


              if (
                current.status !==
                "waiting"
              ) {

                return;
              }


              players[
                currentUser.uid
              ] = {

                ...own,

                ready:
                  own.ready !==
                  true
              };


              return {

                ...current,

                players,

                updatedAt:
                  Date.now()
              };
            }
          );


        if (
          !result.committed
        ) {

          throw new Error(
            "Ready status could not be updated."
          );
        }


      } catch (error) {

        console.error(
          "Ready transaction error:",
          error
        );


        showToast(
          error?.message ||
            "Could not update ready status.",
          "Ready Error",
          "error"
        );

      } finally {

        setBusy(
          false,
          "ready"
        );


        if (currentBattle) {

          updateReadyControls(
            currentBattle
          );
        }
      }
    }


    /* =======================================================
       START MATCH
       ======================================================= */

    async function startMatch() {

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


      setBusy(
        true,
        "start"
      );


      try {

        const target =
          getRoomRef();


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


              if (
                current.creatorUid !==
                currentUser.uid
              ) {

                return;
              }


              if (
                current.status !==
                "waiting"
              ) {

                return current;
              }


              const players =
                current.players &&
                typeof current.players ===
                  "object"

                  ? current.players

                  : {};


              const playerIds =
                Object.keys(
                  players
                );


              if (
                playerIds.length !==
                CONFIG.MAX_PLAYERS
              ) {

                return;
              }


              const allReady =
                playerIds.every(
                  uid =>
                    players[uid]
                      ?.ready ===
                    true
                );


              if (!allReady) {
                return;
              }


              const now =
                Date.now();


              return {

                ...current,

                status:
                  "playing",

                startedAt:
                  now,

                updatedAt:
                  now
              };
            }
          );


        if (
          !result.committed
        ) {

          throw new Error(
            "Both players must be ready before the match can start."
          );
        }


        showToast(
          "Match started. Opening the Ludo board...",
          "Match Started",
          "success"
        );


      } catch (error) {

        console.error(
          "Start match error:",
          error
        );


        showToast(
          error?.message ||
            "Could not start the match.",
          "Start Error",
          "error"
        );

      } finally {

        setBusy(
          false,
          "start"
        );
      }
    }


    /* =======================================================
       COPY ROOM CODE
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
          "Clipboard failed:",
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


        const result =
          document.execCommand(
            "copy"
          );


        textarea.remove();


        return result;

      } catch (error) {

        console.error(
          "Copy fallback failed:",
          error
        );


        return false;
      }
    }


    async function copyRoomCode() {

      const success =
        await copyText(
          roomCode
        );


      showToast(
        success
          ? "Room code copied to clipboard."
          : `Room code: ${roomCode}`,
        "Room Code",
        success
          ? "success"
          : "info"
      );
    }


    /* =======================================================
       SHARE ROOM
       ======================================================= */

    async function shareRoom() {

      const url =
        window.location.href;


      const shareData = {

        title:
          "LUDOVERSE Multiplayer",

        text:
          `Join my LUDOVERSE room: ${roomCode}`,

        url
      };


      try {

        if (
          navigator.share
        ) {

          await navigator.share(
            shareData
          );

          return;
        }


        const copied =
          await copyText(
            url
          );


        showToast(
          copied
            ? "Room link copied."
            : `Room code: ${roomCode}`,
          "Invite Friend",
          copied
            ? "success"
            : "info"
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


        const copied =
          await copyText(
            url
          );


        showToast(
          copied
            ? "Room link copied."
            : `Room code: ${roomCode}`,
          "Invite Friend",
          copied
            ? "success"
            : "info"
        );
      }
    }


    /* =======================================================
       LEAVE ROOM
       ======================================================= */

    function openLeaveModal() {

      if (!leaveModal) {
        leaveRoomDirect();
        return;
      }


      if (leaveRoomCode) {

        leaveRoomCode.textContent =
          roomCode;
      }


      leaveModal.classList
        .add("show");


      document.body.classList
        .add("modal-open");
    }


    function closeLeaveModal() {

      if (!leaveModal) {
        return;
      }


      leaveModal.classList
        .remove("show");


      document.body.classList
        .remove("modal-open");
    }


    async function leaveRoomDirect() {

      if (!currentUser) {
        return;
      }


      try {

        const target =
          getRoomRef();


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


              const creator =
                current.creatorUid ===
                currentUser.uid;


              /*
                 Creator leaves:
                 remove complete room.

                 Opponent leaves:
                 remove only own player.
              */

              if (creator) {

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


        localStorage.removeItem(
          CONFIG.CURRENT_ROOM_KEY
        );


        showToast(
          "You left the room.",
          "Room Closed",
          "success"
        );


        setTimeout(
          () => {

            window.location.href =
              "battle-lobby.html";

          },
          450
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
       REDIRECT TO GAME
       ======================================================= */

    function redirectToGame(
      room
    ) {

      if (
        redirectingToGame
      ) {
        return;
      }


      if (
        room.status !==
        "playing"
      ) {

        return;
      }


      if (
        !currentUser ||
        !room.players?.[
          currentUser.uid
        ]
      ) {

        return;
      }


      redirectingToGame =
        true;


      localStorage.setItem(
        CONFIG.CURRENT_ROOM_KEY,
        room.roomCode
      );


      setTimeout(
        () => {

          window.location.href =
            `game.html?room=${encodeURIComponent(
              room.roomCode
            )}`;

        },
        CONFIG.REDIRECT_DELAY
      );
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


      if (
        battleStatusDescription
      ) {

        battleStatusDescription.textContent =
          "No valid six-digit room code was provided.";
      }


      if (statusIcon) {

        statusIcon.textContent =
          "!";

        statusIcon.className =
          "status-icon error";
      }


      if (readyBtn) {

        readyBtn.disabled =
          true;
      }


      if (startGameBtn) {

        startGameBtn.disabled =
          true;
      }
    }


    /* =======================================================
       REALTIME ROOM LISTENER
       ======================================================= */

    function startRoomListener() {

      if (roomUnsubscribe) {

        roomUnsubscribe();

        roomUnsubscribe =
          null;
      }


      roomUnsubscribe =
        onValue(

          getRoomRef(),

          snapshot => {

            if (
              !snapshot.exists()
            ) {

              currentBattle =
                null;


              renderStatus(
                null
              );


              renderNoRoom();


              showToast(
                "This room no longer exists.",
                "Room Closed",
                "error"
              );


              return;
            }


            const room =
              normalizeRoom(
                snapshot.val()
              );


            if (!room) {

              renderNoRoom();

              return;
            }


            /*
              Security UX:
              Only room members should
              remain on the battle page.
            */

            if (
              currentUser &&
              !room.players?.[
                currentUser.uid
              ]
            ) {

              showToast(
                "You are no longer a member of this room.",
                "Room Access",
                "error"
              );


              localStorage.removeItem(
                CONFIG.CURRENT_ROOM_KEY
              );


              setTimeout(
                () => {

                  window.location.href =
                    "battle-lobby.html";

                },
                500
              );


              return;
            }


            renderRoom(
              room
            );
          },


          error => {

            console.error(
              "Battle room listener error:",
              error
            );


            showToast(
              "Realtime room connection failed.",
              "Firebase Error",
              "error"
            );
          }
        );
    }


    /* =======================================================
       EVENTS
       ======================================================= */

    readyBtn?.addEventListener(
      "click",
      toggleReady
    );


    startGameBtn?.addEventListener(
      "click",
      startMatch
    );


    copyRoomCodeBtn
      ?.addEventListener(
        "click",
        copyRoomCode
      );


    shareRoomBtn
      ?.addEventListener(
        "click",
        shareRoom
      );


    backToLobbyBtn
      ?.addEventListener(
        "click",
        () => {

          window.location.href =
            "battle-lobby.html";

        }
      );


    cancelBattleBtn
      ?.addEventListener(
        "click",
        openLeaveModal
      );


    closeLeaveModalBtn
      ?.addEventListener(
        "click",
        closeLeaveModal
      );


    cancelLeaveBtn
      ?.addEventListener(
        "click",
        closeLeaveModal
      );


    confirmLeaveBtn
      ?.addEventListener(
        "click",
        async () => {

          closeLeaveModal();

          await leaveRoomDirect();
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


    logoutBtn
      ?.addEventListener(
        "click",
        async () => {

          try {

            await signOut(
              auth
            );

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


    leaveModal?.addEventListener(
      "click",
      event => {

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
      event => {

        if (
          event.key ===
          "Escape"
        ) {

          closeProfileMenu();

          closeLeaveModal();
        }
      }
    );


    /* =======================================================
       AUTH
       ======================================================= */

    onAuthStateChanged(
      auth,

      user => {

        currentUser =
          user || null;


        if (!currentUser) {

          if (
            roomUnsubscribe
          ) {

            roomUnsubscribe();

            roomUnsubscribe =
              null;
          }


          if (
            economyUnsubscribe
          ) {

            economyUnsubscribe();

            economyUnsubscribe =
              null;
          }


          window.location.href =
            "login.html";


          return;
        }


        renderProfile(
          currentUser
        );


        listenToEconomy(
          currentUser
        );


        localStorage.setItem(
          CONFIG.CURRENT_ROOM_KEY,
          roomCode
        );


        startRoomListener();
      }
    );

  }
);