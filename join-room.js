"use strict";

import {
  auth,
  onAuthStateChanged
} from "./firebase.js";


// ================================================================
// LUDOVERSE JOIN ROOM
// SERVER AUTHORITATIVE VERSION
// ================================================================

const API_BASE =
  window.LUDOVERSE_API_BASE || "";


document.addEventListener(
  "DOMContentLoaded",
  () => {

    const roomInput =
      document.getElementById(
        "roomCode"
      ) ||
      document.getElementById(
        "roomCodeInput"
      );


    const joinButton =
      document.getElementById(
        "joinRoomBtn"
      ) ||
      document.getElementById(
        "joinBtn"
      );


    const toast =
      document.getElementById(
        "toast"
      );


    const toastMessage =
      document.getElementById(
        "toastMessage"
      );


    let currentUser =
      null;


    // ============================================================
    // TOAST
    // ============================================================

    function showToast(message) {

      if (
        !toast ||
        !toastMessage
      ) {

        alert(message);

        return;
      }


      toastMessage.textContent =
        message;


      toast.classList.add(
        "show"
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


    // ============================================================
    // API
    // ============================================================

    async function apiRequest(
      endpoint,
      options = {}
    ) {

      if (!API_BASE) {

        throw new Error(
          "Backend API is not configured."
        );
      }


      if (!auth.currentUser) {

        throw new Error(
          "Authentication required."
        );
      }


      const token =
        await auth.currentUser
          .getIdToken(true);


      const response =
        await fetch(
          `${API_BASE}${endpoint}`,
          {
            ...options,

            headers: {

              "Content-Type":
                "application/json",

              ...(options.headers || {}),

              "Authorization":
                `Bearer ${token}`
            }
          }
        );


      const payload =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok ||
        payload.ok === false
      ) {

        throw new Error(
          payload.error ||
          `Request failed (${response.status}).`
        );
      }


      return payload;
    }


    // ============================================================
    // JOIN
    // ============================================================

    joinButton?.addEventListener(
      "click",
      async () => {

        if (!currentUser) {

          showToast(
            "Please login first."
          );

          return;
        }


        const code =
          roomInput?.value
            ?.trim();


        if (
          !/^\d{6}$/.test(
            code
          )
        ) {

          showToast(
            "Enter a valid 6-digit room code."
          );

          return;
        }


        joinButton.disabled =
          true;


        const originalText =
          joinButton.innerHTML;


        joinButton.innerHTML =
          "Joining...";


        try {

          const requestId =
            crypto.randomUUID();


          const payload =
            await apiRequest(
              "/api/battles/join",
              {
                method: "POST",

                body:
                  JSON.stringify({

                    roomCode:
                      code,

                    requestId,

                    playerName:
                      currentUser
                        .displayName ||
                      "Player",

                    playerPhoto:
                      currentUser
                        .photoURL ||
                      ""
                  })
              }
            );


          const battle =
            payload.battle;


          showToast(
            "Battle joined successfully."
          );


          // ------------------------------------------------------
          // READY
          // ------------------------------------------------------

          if (
            battle.status ===
            "READY"
          ) {

            sessionStorage.setItem(
              "ludoverseBattleRoom",
              battle.roomCode
            );


            setTimeout(
              () => {

                window.location.href =
                  `battle-room.html?room=${encodeURIComponent(
                    battle.roomCode
                  )}`;

              },
              500
            );


            return;
          }


        } catch (error) {

          console.error(
            "Join battle error:",
            error
          );


          showToast(
            error?.message ||
            "Unable to join battle."
          );


        } finally {

          joinButton.disabled =
            false;


          joinButton.innerHTML =
            originalText;
        }
      }
    );


    // ============================================================
    // AUTH
    // ============================================================

    onAuthStateChanged(
      auth,
      user => {

        if (!user) {

          window.location.href =
            "login.html";

          return;
        }


        currentUser =
          user;
      }
    );

  }
);