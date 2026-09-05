"use strict";

/* =========================================================
   LUDOVERSE REAL FIREBASE PHONE LOGIN
========================================================= */

import {
  auth,
  database,
  ref,
  set,
  get,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "./firebase.js";


/* =========================================================
   DOM ELEMENTS
========================================================= */

const phoneStep =
  document.getElementById("phoneStep");

const otpStep =
  document.getElementById("otpStep");

const phoneNumber =
  document.getElementById("phoneNumber");

const sendOtpBtn =
  document.getElementById("sendOtpBtn");

const verifyOtpBtn =
  document.getElementById("verifyOtpBtn");

const backBtn =
  document.getElementById("backBtn");

const resendBtn =
  document.getElementById("resendBtn");

const otpInputs =
  document.querySelectorAll(".otp-input");


/* =========================================================
   LOGIN STATE
========================================================= */

let confirmationResult = null;

let userPhoneNumber = "";

let isProcessing = false;

let recaptchaVerifier = null;


/* =========================================================
   CREATE STATUS MESSAGE
========================================================= */

const statusMessage =
  document.createElement("div");

statusMessage.className =
  "login-status";

document
  .querySelector(".login-card")
  .appendChild(statusMessage);


/* =========================================================
   SHOW STATUS
========================================================= */

function showStatus(
  message,
  type = "info"
) {

  statusMessage.textContent =
    message;

  statusMessage.className =
    "login-status";

  statusMessage.classList.add(type);

  statusMessage.classList.add("show");

  setTimeout(() => {

    statusMessage.classList.remove("show");

  }, 4000);

}


/* =========================================================
   VALIDATE INDIAN PHONE NUMBER
========================================================= */

function validatePhoneNumber(number) {

  const cleaned =
    number.replace(/\D/g, "");

  return /^[6-9][0-9]{9}$/
    .test(cleaned);

}


/* =========================================================
   FORMAT PHONE NUMBER
========================================================= */

function getFullPhoneNumber(number) {

  return "+91" +
    number.replace(/\D/g, "");

}


/* =========================================================
   SHOW OTP STEP
========================================================= */

function showOtpStep() {

  phoneStep.classList.remove("active");

  otpStep.classList.add("active");

  otpInputs.forEach(input => {

    input.value = "";

  });

  setTimeout(() => {

    otpInputs[0]?.focus();

  }, 300);

}


/* =========================================================
   SHOW PHONE STEP
========================================================= */

function showPhoneStep() {

  otpStep.classList.remove("active");

  phoneStep.classList.add("active");

  otpInputs.forEach(input => {

    input.value = "";

  });

}


/* =========================================================
   INITIALIZE FIREBASE reCAPTCHA
========================================================= */

async function initializeRecaptcha() {
  if (recaptchaVerifier) {
    return;
  }

  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
      size: "normal",
      callback: () => {
        console.log("reCAPTCHA verified");
      },
      "expired-callback": () => {
        showStatus(
          "Verification expired. Please complete reCAPTCHA again.",
          "error"
        );
      }
    }
  );

  await recaptchaVerifier.render();
}


/* =========================================================
   SEND REAL OTP
========================================================= */

async function sendOTP() {

  if (isProcessing) {

    return;

  }


  const phone =
    phoneNumber.value
      .replace(/\D/g, "")
      .trim();


  /* Validate phone */

  if (!validatePhoneNumber(phone)) {

    showStatus(
      "Please enter a valid 10-digit Indian mobile number.",
      "error"
    );

    phoneNumber.focus();

    return;

  }


  isProcessing = true;

  userPhoneNumber =
    getFullPhoneNumber(phone);


  sendOtpBtn.disabled =
    true;

  sendOtpBtn.textContent =
    "Sending OTP...";


  try {

    initializeRecaptcha();


    confirmationResult =
      await signInWithPhoneNumber(
        auth,
        userPhoneNumber,
        recaptchaVerifier
      );


    showOtpStep();


    showStatus(
      "OTP sent successfully to your mobile number!",
      "success"
    );


  }

  catch (error) {
  console.error("Firebase OTP FULL ERROR:", error);
  console.log("Error code:", error.code);
  console.log("Error message:", error.message);

  showStatus(
    `${error.code}: ${error.message}`,
    "error"
  );
}


    let message =
      "Could not send OTP. Please try again.";


    if (
      error.code ===
      "auth/invalid-phone-number"
    ) {

      message =
        "Please enter a valid mobile number.";

    }


    else if (
      error.code ===
      "auth/too-many-requests"
    ) {

      message =
        "Too many attempts. Please try again later.";

    }


    else if (
      error.code ===
      "auth/captcha-check-failed"
    ) {

      message =
        "Security verification failed. Please try again.";

    }


    showStatus(
      message,
      "error"
    );


  }

  finally {

    isProcessing = false;

    sendOtpBtn.disabled =
      false;

    sendOtpBtn.textContent =
      "Continue →";

  }

}


/* =========================================================
   GET ENTERED OTP
========================================================= */

function getEnteredOTP() {

  let otp = "";

  otpInputs.forEach(input => {

    otp += input.value;

  });

  return otp;

}


/* =========================================================
   SAVE USER TO FIREBASE DATABASE
========================================================= */

async function saveUserToDatabase(user) {

  const userReference =
    ref(
      database,
      `users/${user.uid}`
    );


  const snapshot =
    await get(userReference);


  /* Existing user */

  if (snapshot.exists()) {

    await set(
      userReference,
      {
        ...snapshot.val(),

        phone:
          user.phoneNumber,

        lastLogin:
          new Date().toISOString(),

        loggedIn:
          true
      }
    );

    return;

  }


  /* New user */

  const newUser = {

    uid:
      user.uid,

    phone:
      user.phoneNumber,

    username:
      null,

    displayName:
      null,

    accountStatus:
      "active",

    blocked:
      false,

    createdAt:
      new Date().toISOString(),

    lastLogin:
      new Date().toISOString(),

    totalBattles:
      0,

    wins:
      0,

    losses:
      0,

    cancelledBattles:
      0

  };


  await set(
    userReference,
    newUser
  );

}


/* =========================================================
   VERIFY REAL OTP
========================================================= */

async function verifyOTP() {

  if (isProcessing) {

    return;

  }


  if (!confirmationResult) {

    showStatus(
      "Please request an OTP first.",
      "error"
    );

    return;

  }


  const enteredOTP =
    getEnteredOTP();


  if (enteredOTP.length !== 6) {

    showStatus(
      "Please enter all 6 OTP digits.",
      "error"
    );

    return;

  }


  isProcessing = true;

  verifyOtpBtn.disabled =
    true;

  verifyOtpBtn.textContent =
    "Verifying...";


  try {

    const result =
      await confirmationResult.confirm(
        enteredOTP
      );


    const user =
      result.user;


    await saveUserToDatabase(
      user
    );


    /* Save local login state */

    const userData = {

      uid:
        user.uid,

      phone:
        user.phoneNumber,

      loggedIn:
        true,

      loginTime:
        new Date().toISOString()

    };


    localStorage.setItem(
      "ludoverseUser",
      JSON.stringify(userData)
    );


    localStorage.setItem(
      "ludoverseLoggedIn",
      "true"
    );


    verifyOtpBtn.textContent =
      "Login Successful!";


    showStatus(
      "Welcome to LUDOVERSE!",
      "success"
    );


    setTimeout(() => {

      window.location.href =
        "index.html";

    }, 1200);


  }

  catch (error) {

    console.error(
      "OTP verification error:",
      error
    );


    let message =
      "Invalid OTP. Please try again.";


    if (
      error.code ===
      "auth/code-expired"
    ) {

      message =
        "OTP has expired. Please request a new OTP.";

    }


    showStatus(
      message,
      "error"
    );


    verifyOtpBtn.disabled =
      false;

    verifyOtpBtn.textContent =
      "Verify & Continue →";

  }

  finally {

    isProcessing = false;

  }

}


/* =========================================================
   OTP INPUT CONTROLS
========================================================= */

otpInputs.forEach(
  (input, index) => {

    input.addEventListener(
      "input",
      event => {

        event.target.value =
          event.target.value
            .replace(/\D/g, "")
            .slice(0, 1);


        if (
          event.target.value &&
          index <
            otpInputs.length - 1
        ) {

          otpInputs[
            index + 1
          ].focus();

        }

      }
    );


    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Backspace" &&
          !input.value &&
          index > 0
        ) {

          otpInputs[
            index - 1
          ].focus();

        }


        if (
          event.key === "Enter"
        ) {

          verifyOTP();

        }

      }
    );


    input.addEventListener(
      "paste",
      event => {

        event.preventDefault();


        const pasted =
          event.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);


        pasted
          .split("")
          .forEach(
            (
              digit,
              digitIndex
            ) => {

              if (
                otpInputs[digitIndex]
              ) {

                otpInputs[
                  digitIndex
                ].value =
                  digit;

              }

            }
          );


        if (pasted.length) {

          const focusIndex =
            Math.min(
              pasted.length,
              otpInputs.length - 1
            );


          otpInputs[
            focusIndex
          ].focus();

        }

      }
    );

  }
);


/* =========================================================
   BACK BUTTON
========================================================= */

backBtn?.addEventListener(
  "click",
  () => {

    showPhoneStep();

  }
);


/* =========================================================
   RESEND OTP
========================================================= */

resendBtn?.addEventListener(
  "click",
  () => {

    otpInputs.forEach(input => {

      input.value = "";

    });


    confirmationResult =
      null;


    showPhoneStep();


    setTimeout(() => {

      sendOTP();

    }, 300);

  }
);


/* =========================================================
   SEND OTP BUTTON
========================================================= */

sendOtpBtn?.addEventListener(
  "click",
  sendOTP
);


/* =========================================================
   VERIFY OTP BUTTON
========================================================= */

verifyOtpBtn?.addEventListener(
  "click",
  verifyOTP
);


/* =========================================================
   PHONE NUMBER INPUT
========================================================= */

phoneNumber?.addEventListener(
  "input",
  () => {

    phoneNumber.value =
      phoneNumber.value
        .replace(/\D/g, "")
        .slice(0, 10);

  }
);


/* =========================================================
   ENTER KEY
========================================================= */

phoneNumber?.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      sendOTP();

    }

  }
);


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "LUDOVERSE Firebase Phone Login Ready"
    );

  }
);