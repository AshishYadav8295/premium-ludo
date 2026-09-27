"use strict";

/* =========================================================
   LUDOVERSE ADMIN PANEL
   Secure Admin Authentication + Deposit Management
========================================================= */


/* =========================================================
   ADMIN SESSION HELPERS
========================================================= */

function getAdminToken() {
    return sessionStorage.getItem("adminToken");
}


function setAdminSession(token) {
    sessionStorage.setItem("adminAuth", "true");
    sessionStorage.setItem("adminToken", token);
}


function clearAdminSession() {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("adminToken");
}


function isAdminAuthenticated() {
    const adminAuth =
        sessionStorage.getItem("adminAuth");

    const adminToken =
        getAdminToken();

    return (
        adminAuth === "true" &&
        Boolean(adminToken)
    );
}


/* =========================================================
   ADMIN UNAUTHORIZED HANDLER
========================================================= */

function handleAdminUnauthorized() {

    clearAdminSession();

    const adminLoginBox =
        document.getElementById("adminLoginBox");

    const adminDashboard =
        document.getElementById("adminDashboard");

    const errorMsg =
        document.getElementById("loginError");


    if (adminLoginBox) {
        adminLoginBox.style.display = "block";
    }


    if (adminDashboard) {
        adminDashboard.style.display = "none";
    }


    if (errorMsg) {
        errorMsg.innerText =
            "Admin session expired. Please login again.";
    }
}


/* =========================================================
   SAFE JSON RESPONSE
========================================================= */

async function parseJsonResponse(response) {

    try {
        return await response.json();
    } catch {
        return {};
    }
}


/* =========================================================
   ADMIN API REQUEST
========================================================= */

async function adminApiRequest(
    endpoint,
    options = {}
) {

    const token =
        getAdminToken();


    if (!token) {
        handleAdminUnauthorized();
        throw new Error(
            "Admin authentication required."
        );
    }


    const headers = {
        ...(options.headers || {}),
        "Authorization": `Bearer ${token}`
    };


    if (
        options.body &&
        !headers["Content-Type"]
    ) {
        headers["Content-Type"] =
            "application/json";
    }


    const response =
        await fetch(
            `${API_BASE}${endpoint}`,
            {
                ...options,
                headers
            }
        );


    const data =
        await parseJsonResponse(
            response
        );


    if (response.status === 401) {
        handleAdminUnauthorized();

        throw new Error(
            data.error ||
            "Admin session expired."
        );
    }


    if (!response.ok) {
        throw new Error(
            data.error ||
            `Request failed (${response.status}).`
        );
    }


    return data;
}


/* =========================================================
   1. CHECK ADMIN AUTH STATE
========================================================= */

function checkAdminAuthState() {

    const adminLoginBox =
        document.getElementById("adminLoginBox");

    const adminDashboard =
        document.getElementById("adminDashboard");


    if (isAdminAuthenticated()) {

        if (adminLoginBox) {
            adminLoginBox.style.display =
                "none";
        }


        if (adminDashboard) {
            adminDashboard.style.display =
                "block";
        }


        loadPendingDeposits();

    } else {

        clearAdminSession();


        if (adminLoginBox) {
            adminLoginBox.style.display =
                "block";
        }


        if (adminDashboard) {
            adminDashboard.style.display =
                "none";
        }
    }
}


/* =========================================================
   2. ADMIN LOGIN
========================================================= */

async function verifyAdminPassword() {

    const passwordInput =
        document.getElementById(
            "adminPasswordInput"
        );

    const errorMsg =
        document.getElementById(
            "loginError"
        );


    if (!passwordInput) {
        console.error(
            "Admin password input not found."
        );
        return;
    }


    const enteredPassword =
        passwordInput.value.trim();


    if (!enteredPassword) {

        if (errorMsg) {
            errorMsg.innerText =
                "Please enter the admin password.";
        }

        return;
    }


    try {

        if (errorMsg) {
            errorMsg.innerText =
                "Checking credentials...";
        }


        const response =
            await fetch(
                `${API_BASE}/api/admin/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        password:
                            enteredPassword
                    })
                }
            );


        const data =
            await parseJsonResponse(
                response
            );


        if (
            !response.ok ||
            !data.ok ||
            !data.token
        ) {

            if (errorMsg) {
                errorMsg.innerText =
                    data.error ||
                    "Admin login failed.";
            }

            return;
        }


        /* -----------------------------------------
           SAVE SECURE ADMIN SESSION
        ----------------------------------------- */

        setAdminSession(
            data.token
        );


        passwordInput.value = "";


        if (errorMsg) {
            errorMsg.innerText = "";
        }


        /* -----------------------------------------
           Show dashboard immediately
        ----------------------------------------- */

        const adminLoginBox =
            document.getElementById(
                "adminLoginBox"
            );

        const adminDashboard =
            document.getElementById(
                "adminDashboard"
            );


        if (adminLoginBox) {
            adminLoginBox.style.display =
                "none";
        }


        if (adminDashboard) {
            adminDashboard.style.display =
                "block";
        }


        await loadPendingDeposits();


    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );


        if (errorMsg) {
            errorMsg.innerText =
                "Unable to connect to server. Please try again.";
        }
    }
}


/* =========================================================
   3. FETCH PENDING DEPOSITS
========================================================= */

async function loadPendingDeposits() {

    if (!isAdminAuthenticated()) {
        handleAdminUnauthorized();
        return;
    }


    const tableBody =
        document.getElementById(
            "depositsTableBody"
        );


    if (!tableBody) {
        console.warn(
            "depositsTableBody element not found."
        );
        return;
    }


    try {

        const data =
            await adminApiRequest(
                "/api/admin/pending-deposits",
                {
                    method: "GET"
                }
            );


        const requests =
            Array.isArray(data.requests)
                ? data.requests
                : [];


        tableBody.innerHTML = "";


        /* -----------------------------------------
           NO PENDING REQUESTS
        ----------------------------------------- */

        if (requests.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="6"
                        class="empty-state"
                    >
                        No pending deposit requests found.
                    </td>
                </tr>
            `;

            return;
        }


        /* -----------------------------------------
           RENDER REQUESTS
        ----------------------------------------- */

        requests.forEach((request) => {

            const txId =
                request._id ||
                request.id;


            if (!txId) {
                return;
            }


            const createdAt =
                request.createdAt
                    ? new Date(
                        request.createdAt
                    )
                    : new Date();


            const formattedDate =
                Number.isNaN(
                    createdAt.getTime()
                )
                    ? "N/A"
                    : createdAt.toLocaleString();


            const amount =
                Number(request.amount) || 0;


            const uid =
                request.uid ||
                "N/A";


            const utrNumber =
                request.utrNumber ||
                "N/A";


            const status =
                request.status ||
                "PENDING";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `
                <td>
                    ${escapeHTML(
                        formattedDate
                    )}
                </td>

                <td
                    style="font-family: monospace;"
                >
                    ${escapeHTML(uid)}
                </td>

                <td
                    style="
                        color: #10B981;
                        font-weight: bold;
                    "
                >
                    ₹${formatAmount(amount)}
                </td>

                <td
                    style="font-family: monospace;"
                >
                    ${escapeHTML(
                        utrNumber
                    )}
                </td>

                <td
                    style="
                        color: #F59E0B;
                        font-weight: bold;
                    "
                >
                    ${escapeHTML(status)}
                </td>

                <td>

                    <button
                        type="button"
                        onclick="approveDeposit('${escapeAttribute(txId)}')"
                        class="btn btn-approve"
                    >
                        Approve
                    </button>

                    <button
                        type="button"
                        onclick="rejectDeposit('${escapeAttribute(txId)}')"
                        class="btn btn-reject"
                    >
                        Reject
                    </button>

                </td>
            `;


            tableBody.appendChild(
                row
            );
        });


    } catch (error) {

        console.error(
            "Error fetching pending deposits:",
            error
        );
    }
}


/* =========================================================
   4. APPROVE DEPOSIT
========================================================= */

async function approveDeposit(txId) {

    if (
        !txId ||
        txId === "undefined" ||
        txId === "null"
    ) {

        alert(
            "Security Error: Invalid Transaction ID."
        );

        return;
    }


    if (!isAdminAuthenticated()) {
        handleAdminUnauthorized();
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to APPROVE this deposit? The wallet balance will be credited."
        );


    if (!confirmed) {
        return;
    }


    try {

        const data =
            await adminApiRequest(
                "/api/admin/approve-deposit",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        txId
                    })
                }
            );


        if (!data.ok) {

            alert(
                data.error ||
                "Deposit approval failed."
            );

            return;
        }


        alert(
            "Deposit approved successfully!"
        );


        await loadPendingDeposits();


    } catch (error) {

        console.error(
            "Error approving deposit:",
            error
        );


        if (
            error.message &&
            !error.message.includes(
                "Admin session"
            )
        ) {

            alert(
                error.message ||
                "Network error while approving deposit."
            );
        }
    }
}


/* =========================================================
   5. REJECT DEPOSIT
========================================================= */

async function rejectDeposit(txId) {

    if (
        !txId ||
        txId === "undefined" ||
        txId === "null"
    ) {

        alert(
            "Security Error: Invalid Transaction ID."
        );

        return;
    }


    if (!isAdminAuthenticated()) {
        handleAdminUnauthorized();
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to REJECT this deposit request?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const data =
            await adminApiRequest(
                "/api/admin/reject-deposit",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        txId
                    })
                }
            );


        if (!data.ok) {

            alert(
                data.error ||
                "Deposit rejection failed."
            );

            return;
        }


        alert(
            "Deposit rejected successfully."
        );


        await loadPendingDeposits();


    } catch (error) {

        console.error(
            "Error rejecting deposit:",
            error
        );


        if (
            error.message &&
            !error.message.includes(
                "Admin session"
            )
        ) {

            alert(
                error.message ||
                "Network error while rejecting deposit."
            );
        }
    }
}


/* =========================================================
   6. ADMIN LOGOUT
========================================================= */

function logoutAdmin() {

    clearAdminSession();

    window.location.reload();
}


/* =========================================================
   7. FORMATTING HELPERS
========================================================= */

function formatAmount(value) {

    const number =
        Number(value);


    if (!Number.isFinite(number)) {
        return "0";
    }


    return number.toLocaleString(
        "en-IN",
        {
            maximumFractionDigits: 2
        }
    );
}


function escapeHTML(value) {

    return String(value ?? "")
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


/*
 * Transaction IDs are normally MongoDB ObjectIds.
 * This helper prevents quote-breaking when the ID
 * is inserted into an onclick attribute.
 */
function escapeAttribute(value) {

    return String(value ?? "")
        .replaceAll(
            "\\",
            "\\\\"
        )
        .replaceAll(
            "'",
            "\\'"
        )
        .replaceAll(
            "\n",
            "\\n"
        )
        .replaceAll(
            "\r",
            "\\r"
        );
}


/* =========================================================
   8. AUTO REFRESH
========================================================= */

let adminRefreshTimer = null;


function startAdminAutoRefresh() {

    if (adminRefreshTimer) {
        clearInterval(
            adminRefreshTimer
        );
    }


    adminRefreshTimer =
        setInterval(
            () => {

                if (
                    isAdminAuthenticated()
                ) {
                    loadPendingDeposits();
                }

            },
            10000
        );
}


function stopAdminAutoRefresh() {

    if (adminRefreshTimer) {

        clearInterval(
            adminRefreshTimer
        );

        adminRefreshTimer = null;
    }
}


/* =========================================================
   9. INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkAdminAuthState();


        if (
            isAdminAuthenticated()
        ) {

            startAdminAutoRefresh();

        } else {

            stopAdminAutoRefresh();
        }


        console.log(
            "LUDOVERSE Admin Panel Ready"
        );
    }
);