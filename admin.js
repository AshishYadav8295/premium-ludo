// ================= LUDOVERSE ADMIN PANEL SCRIPT =================

document.addEventListener("DOMContentLoaded", () => {
    checkAdminAuthState();
});

// 1. Check Login State and Toggle Views based on admin.html IDs
function checkAdminAuthState() {
    const adminAuth = sessionStorage.getItem("adminAuth");
    const adminLoginBox = document.getElementById("adminLoginBox");
    const adminDashboard = document.getElementById("adminDashboard");

    if (adminAuth === "true") {
        if (adminLoginBox) adminLoginBox.style.display = "none";
        if (adminDashboard) adminDashboard.style.display = "block";
        loadPendingDeposits();
        // Auto refresh every 10 seconds
        setInterval(loadPendingDeposits, 10000);
    } else {
        if (adminLoginBox) adminLoginBox.style.display = "block";
        if (adminDashboard) adminDashboard.style.display = "none";
    }
}

// 2. Admin Login Handler (Matches admin.html onclick="verifyAdminPassword()")
function verifyAdminPassword() {
    const passwordInput = document.getElementById("adminPasswordInput");
    const errorMsg = document.getElementById("loginError");

    if (!passwordInput) return;

    const enteredPassword = passwordInput.value.trim();
    const correctPassword = "ashishyadav190701"; // Aapka secure admin password

    if (!enteredPassword) {
        if (errorMsg) errorMsg.innerText = "Please enter the admin password!";
        return;
    }

    if (enteredPassword === correctPassword) {
        sessionStorage.setItem("adminAuth", "true");
        if (errorMsg) errorMsg.innerText = "";
        window.location.reload();
    } else {
        if (errorMsg) {
            errorMsg.innerText = "❌ Incorrect password! Please try again.";
        }
    }
}

// 3. Fetch and Render Pending Deposits cleanly (Matches admin.html table body ID)
function loadPendingDeposits() {
    fetch('/api/admin/pending-deposits')
        .then(res => res.json())
        .then(data => {
            const tableBody = document.getElementById('depositsTableBody');
            if (!tableBody) return;

            const requests = data.requests || data;
            tableBody.innerHTML = '';

            if (!requests || requests.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No pending deposit requests found.</td></tr>`;
                return;
            }

            requests.forEach(req => {
                const txId = req._id || req.id;
                const formattedDate = new Date(req.createdAt || Date.now()).toLocaleString();

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td style="font-family: monospace;">${req.uid || 'N/A'}</td>
                    <td style="color: #10B981; font-weight: bold;">₹${req.amount}</td>
                    <td style="font-family: monospace;">${req.utrNumber}</td>
                    <td style="color: #F59E0B; font-weight: bold;">${req.status}</td>
                    <td>
                        <button onclick="approveDeposit('${txId}')" class="btn btn-approve">Approve</button>
                        <button onclick="rejectDeposit('${txId}')" class="btn btn-reject">Reject</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        })
        .catch(err => console.error("Error fetching pending deposits:", err));
}

// 4. Secure Approve Function
function approveDeposit(txId) {
    if (!txId || txId === 'undefined') {
        alert("Security Error: Invalid Transaction ID!");
        return;
    }

    if (!confirm("Are you sure you want to APPROVE this deposit? Wallet balance will be credited.")) {
        return;
    }

    fetch('/api/admin/approve-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.ok) {
            alert("Deposit approved successfully!");
            loadPendingDeposits();
        } else {
            alert("Failed: " + (data.error || "Unknown error"));
        }
    })
    .catch(err => {
        console.error("Error approving deposit:", err);
        alert("Network error while approving deposit.");
    });
}

// 5. Secure Reject Function
function rejectDeposit(txId) {
    if (!txId || txId === 'undefined') {
        alert("Security Error: Invalid Transaction ID!");
        return;
    }

    if (!confirm("Are you sure you want to REJECT this deposit request?")) {
        return;
    }

    fetch('/api/admin/reject-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.ok) {
            alert("Deposit rejected successfully.");
            loadPendingDeposits();
        } else {
            alert("Failed: " + (data.error || "Unknown error"));
        }
    })
    .catch(err => {
        console.error("Error rejecting deposit:", err);
        alert("Network error while rejecting deposit.");
    });
}

// 6. Logout Handler (Matches admin.html onclick="logoutAdmin()")
function logoutAdmin() {
    sessionStorage.removeItem("adminAuth");
    window.location.reload();
}