/* =========================================================
   LUDOVERSE — GLOBAL API CONFIGURATION
   ---------------------------------------------------------
   Environment-aware API base configuration.

   Local development:
     http://localhost:xxxx
     http://127.0.0.1:xxxx
     -> http://127.0.0.1:3000

   Production:
     Render / custom domain / future domain
     -> current website origin automatically

   This file must be loaded BEFORE any script that uses
   API_BASE.
   ========================================================= */

"use strict";

(() => {
  const hostname = window.location.hostname;

  // -------------------------------------------------------
  // 1. Detect local development environment
  // -------------------------------------------------------
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  // -------------------------------------------------------
  // 2. Select the backend base URL
  // -------------------------------------------------------
  const apiBase = isLocalhost
  ? "http://127.0.0.1:3000"
  : "https://ludoverse-backend.onrender.com";

  // -------------------------------------------------------
  // 3. Normalize the URL
  //    Prevent accidental double slashes:
  //    https://example.com//api/...
  // -------------------------------------------------------
  const normalizedApiBase = apiBase.replace(/\/+$/, "");

  // -------------------------------------------------------
  // 4. Expose the global API_BASE variable
  // -------------------------------------------------------
  window.API_BASE = normalizedApiBase;

  // -------------------------------------------------------
  // 5. Keep backward compatibility with existing code
  //    that may use LUDOVERSE_API_BASE.
  // -------------------------------------------------------
  window.LUDOVERSE_API_BASE = normalizedApiBase;
})();