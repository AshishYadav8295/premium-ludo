// ================= LUDOVERSE ADMIN PANEL SCRIPT =================

// ================================================================
// INITIALIZATION
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
    checkAdminAuthState();
});


// ================================================================
// ADMIN SESSION HELPERS
// ================================================================

function getAdminToken() {
    return sessionStorage.getItem("adminToken");
}


function clearAdminSession() {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("adminToken");
}


function handleAdminUnauthorized() {
    clearAdminSession();

    const adminLoginBox =
        document.getElementById("adminLoginBox");

    const adminDashboard =
        document.getElementById("adminDashboard");

    if (adminLoginBox) {
        adminLoginBox.style.display = "block";
    }

    if (adminDashboard) {
        adminDashboard.style.display = "none";
    }

    const errorMsg =
        document.getElementById("loginError");

    if (errorMsg) {
        errorMsg.innerText =
            "Admin session expired. Please login again.";
    }
}


// ================================================================
// 1. CHECK ADMIN AUTH STATE
// ================================================================

function checkAdminAuthState() {

    const adminAuth =
        sessionStorage.getItem("adminAuth");

    const adminToken =
        getAdminToken();

    const adminLoginBox =
        document.getElementById("adminLoginBox");

    const adminDashboard =
        document.getElementById("adminDashboard");


    // Both authentication flag AND token are required.
    if (adminAuth === "true" && adminToken) {

        if (adminLoginBox) {
            adminLoginBox.style.display = "none";
        }

        if (adminDashboard) {
            adminDashboard.style.display = "block";
        }

        loadPendingDeposits();

        // Auto refresh every 10 seconds.
        setInterval(loadPendingDeposits, 10000);

    } else {

        clearAdminSession();

        if (adminLoginBox) {
            adminLoginBox.style.display = "block";
        }

        if (adminDashboard) {
            adminDashboard.style.display = "none";
        }
    }
}


// ================================================================
// 2. ADMIN LOGIN
// ================================================================

async function verifyAdminPassword() {

    const passwordInput =
        document.getElementById("adminPasswordInput");

    const errorMsg =
        document.getElementById("loginError");


    if (!passwordInput) {
        return;
    }


    const enteredPassword =
        passwordInput.value.trim();


    if (!enteredPassword) {

        if (errorMsg) {
            errorMsg.innerText =
                "Please enter the admin password!";
        }

        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/admin/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        password: enteredPassword
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok || !data.ok || !data.token) {

            if (errorMsg) {
                errorMsg.innerText =
                    data.error || "Admin login failed.";
            }

            return;
        }


        // Save admin session.
        sessionStorage.setItem(
            "adminAuth",
            "true"
        );

        sessionStorage.setItem(
            "adminToken",
            data.token
        );


        if (errorMsg) {
            errorMsg.innerText = "";
        }


        // Clear password field.
        passwordInput.value = "";


        // Reload dashboard.
        window.location.reload();

    } catch (error) {

        console.error(
            "Admin login error:",
            error
        );


        if (errorMsg) {
            errorMsg.innerText =
                "Unable to connect to server.";
        }
    }
}


// ================================================================
// 3. FETCH PENDING DEPOSITS
// ================================================================

async function loadPendingDeposits() {

    const adminToken =
        getAdminToken();


    if (!adminToken) {
        handleAdminUnauthorized();
        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/admin/pending-deposits`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${adminToken}`
                    }
                }
            );


        const data =
            await response.json();


        // Admin session invalid/expired.
        if (response.status === 401) {
            handleAdminUnauthorized();
            return;
        }


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Failed to load pending deposits."
            );
        }


        const tableBody =
            document.getElementById(
                "depositsTableBody"
            );


        if (!tableBody) {
            return;
        }


        const requests =
            data.requests || [];


        tableBody.innerHTML = "";


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


        requests.forEach((request) => {

            const txId =
                request._id || request.id;


            const formattedDate =
                new Date(
                    request.createdAt || Date.now()
                ).toLocaleString();


            const row =
                document.createElement("tr");


            row.innerHTML = `
                <td>${formattedDate}</td>

                <td style="font-family: monospace;">
                    ${request.uid || "N/A"}
                </td>

                <td style="color: #10B981; font-weight: bold;">
                    ₹${request.amount}
                </td>

                <td style="font-family: monospace;">
                    ${request.utrNumber || "N/A"}
                </td>

                <td style="color: #F59E0B; font-weight: bold;">
                    ${request.status || "PENDING"}
                </td>

                <td>
                    <button
                        onclick="approveDeposit('${txId}')"
                        class="btn btn-approve"
                    >
                        Approve
                    </button>

                    <button
                        onclick="rejectDeposit('${txId}')"
                        class="btn btn-reject"
                    >
                        Reject
                    </button>
                </td>
            `;


            tableBody.appendChild(row);
        });

    } catch (error) {

        console.error(
            "Error fetching pending deposits:",
            error
        );
    }
}


// ================================================================
// 4. APPROVE DEPOSIT
// ================================================================

async function approveDeposit(txId) {

    if (!txId || txId === "undefined") {

        alert(
            "Security Error: Invalid Transaction ID!"
        );

        return;
    }


    const adminToken =
        getAdminToken();


    if (!adminToken) {

        handleAdminUnauthorized();
        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to APPROVE this deposit? Wallet balance will be credited."
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/admin/approve-deposit`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${adminToken}`
                    },

                    body: JSON.stringify({
                        txId
                    })
                }
            );


        const data =
            await response.json();


        if (response.status === 401) {

            handleAdminUnauthorized();
            return;
        }


        if (!response.ok || !data.ok) {

            alert(
                "Failed: " +
                (
                    data.error ||
                    "Unknown error"
                )
            );

            return;
        }


        alert(
            "Deposit approved successfully!"
        );


        // Refresh table.
        loadPendingDeposits();

    } catch (error) {

        console.error(
            "Error approving deposit:",
            error
        );

        alert(
            "Network error while approving deposit."
        );
    }
}


// ================================================================
// 5. REJECT DEPOSIT
// ================================================================

async function rejectDeposit(txId) {

    if (!txId || txId === "undefined") {

        alert(
            "Security Error: Invalid Transaction ID!"
        );

        return;
    }


    const adminToken =
        getAdminToken();


    if (!adminToken) {

        handleAdminUnauthorized();
        return;
    }


    const confirmed =
        confirm(
            "Are you sure you want to REJECT this deposit request?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE}/api/admin/reject-deposit`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${adminToken}`
                    },

                    body: JSON.stringify({
                        txId
                    })
                }
            );


        const data =
            await response.json();


        if (response.status === 401) {

            handleAdminUnauthorized();
            return;
        }


        if (!response.ok || !data.ok) {

            alert(
                "Failed: " +
                (
                    data.error ||
                    "Unknown error"
                )
            );

            return;
        }


        alert(
            "Deposit rejected successfully."
        );


        // Refresh table.
        loadPendingDeposits();

    } catch (error) {

        console.error(
            "Error rejecting deposit:",
            error
        );

        alert(
            "Network error while rejecting deposit."
        );
    }
}


// ================================================================
// 6. ADMIN LOGOUT
// ================================================================

function logoutAdmin() {

    clearAdminSession();

    window.location.reload();
}