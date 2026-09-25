"use strict";

import {
  auth,
  onAuthStateChanged
} from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  const walletBalanceElement = document.getElementById("walletBalance");
  const gamesPlayedElement = document.getElementById("gamesPlayed");
  const gamesWonElement = document.getElementById("gamesWon");
  const winRateElement = document.getElementById("winRate");
  const transactionList = document.getElementById("transactionList");
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMessage");

  function showToast(message) {
    if (!toast || !toastMessage) {
      alert(message);
      return;
    }
    toastMessage.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  async function apiRequest(path) {
    if (!API_BASE) {
      throw new Error("LUDOVERSE backend is not configured for this deployment.");
    }
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Authentication required.");
    }
    const token = await user.getIdToken(true);
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Request failed (${response.status}).`);
    }
    return payload;
  }

  function formatCoins(value) {
    return Math.max(0, Number(value) || 0).toLocaleString("en-IN");
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderTransactions(transactions) {
    if (!transactionList) return;
    transactionList.innerHTML = "";
    if (!Array.isArray(transactions) || transactions.length === 0) {
      transactionList.innerHTML = `
        <div class="empty-history">
          <div class="empty-icon">🪙</div>
          <h3>No activity yet</h3>
          <p>Your virtual LudoCoin activity will appear here.</p>
        </div>
      `;
      return;
    }

    transactions.forEach(transaction => {
      const item = document.createElement("div");
      item.className = "transaction-item";
      const timestamp = Number(transaction.createdAt);
      const date = new Date(timestamp);
      const formattedDate =
        Number.isFinite(timestamp) && !Number.isNaN(date.getTime())
          ? date.toLocaleString()
          : "";
      const coins = Number(transaction.coins) || 0;
      const positive = coins > 0;

      item.innerHTML = `
        <div class="transaction-left">
          <div class="transaction-icon ${positive ? "credit" : "debit"}">
            ${positive ? "🪙" : "🎮"}
          </div>
          <div>
            <h4>${escapeHTML(transaction.description || "LUDOVERSE Match Activity")}</h4>
            <p>${escapeHTML(formattedDate)}</p>
          </div>
        </div>
        <div class="transaction-amount ${positive ? "positive" : "negative"}">
          ${positive ? "+" : ""}${formatCoins(coins)}
        </div>
      `;
      transactionList.appendChild(item);
    });
  }

  async function loadEconomy() {
    const payload = await apiRequest("/api/economy");
    const economy = payload.economy || {};

    if (walletBalanceElement) {
      walletBalanceElement.textContent = formatCoins(
        economy.cashBalance !== undefined ? economy.cashBalance : economy.ludoCoins
      );
    }

    const cashBalanceElement = document.getElementById("cashBalance");
    if (cashBalanceElement) cashBalanceElement.textContent = formatCoins(economy.cashBalance || 0);

    const winningBalanceElement = document.getElementById("winningBalance");
    if (winningBalanceElement) winningBalanceElement.textContent = formatCoins(economy.winningBalance || 0);

    if (gamesPlayedElement) gamesPlayedElement.textContent = formatCoins(economy.gamesPlayed);
    if (gamesWonElement) gamesWonElement.textContent = formatCoins(economy.gamesWon);

    if (winRateElement) {
      const played = Number(economy.gamesPlayed) || 0;
      const won = Number(economy.gamesWon) || 0;
      winRateElement.textContent = played > 0 ? `${Math.round((won / played) * 100)}%` : "0%";
    }

    renderTransactions(payload.transactions || []);
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    try {
      await loadEconomy();
    } catch (error) {
      console.error("Wallet economy load failed:", error);
      showToast(error?.message || "Could not load your wallet.");
    }
  });
});

// Modal Global Functions
window.openAddMoneyModal = function() {
  document.getElementById('addAmountInput').value = '';
  document.getElementById('addMoneyModal').style.display = 'flex';
};

window.openWithdrawModal = function() {
  document.getElementById('withdrawAmountInput').value = '';
  document.getElementById('upiIdInput').value = '';
  document.getElementById('withdrawModal').style.display = 'flex';
};

window.closeModals = function() {
  document.getElementById('addMoneyModal').style.display = 'none';
  document.getElementById('withdrawModal').style.display = 'none';
};

window.processAddMoney = async function() {
  const amount = document.getElementById('addAmountInput').value;
  if (!amount || amount <= 0) {
    alert('Please enter a valid deposit amount!');
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      alert('Authentication required. Please login again.');
      window.location.href = 'login.html';
      return;
    }

    const token = await user.getIdToken(true);

    const res = await fetch(`${API_BASE}/api/payment/create-order`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();

    if (!data.ok) {
      alert(data.error || 'Failed to initiate payment order.');
      return;
    }

    const options = {
      "key": data.keyId,
      "amount": data.order.amount,
      "currency": "INR",
      "name": "LUDOVERSE",
      "description": "Wallet Deposit",
      "order_id": data.order.id,
      "handler": async function (response) {
        const verifyRes = await fetch(`${API_BASE}/api/payment/verify`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            amount: amount
          })
        });

        const verifyData = await verifyRes.json();

        if (verifyData.ok) {
          alert('Payment Successful & Credited to Wallet!');
          window.closeModals();
          location.reload();
        } else {
          alert('Payment verification failed.');
        }
      },
      "theme": { "color": "#10B981" }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    console.error(err);
    alert('Payment gateway error.');
  }
};

window.processWithdrawal = async function() {
  const amount = document.getElementById('withdrawAmountInput').value;
  const upiId = document.getElementById('upiIdInput2') || document.getElementById('upiIdInput').value;

  if (!amount || amount <= 0) {
    alert('Please enter a valid withdrawal amount!');
    return;
  }

  if (!upiId) {
    alert('Please enter your UPI ID!');
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      alert('Authentication required.');
      window.location.href = 'login.html';
      return;
    }

    const token = await user.getIdToken(true);

    const res = await fetch(`${API_BASE}/api/wallet/withdraw`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount, upiId })
    });

    const data = await res.json();

    if (data.ok) {
      alert(`Withdrawal request of ₹${amount} submitted successfully!`);
      window.closeModals();
      location.reload();
    } else {
      alert(data.error || 'Withdrawal failed.');
    }
  } catch (err) {
    console.error(err);
    alert('Error processing withdrawal.');
  }
};

async function processQRPayment() {
  const amountInput = document.getElementById('addAmountInput');
  const utrInput = document.getElementById('utrInput');
  
  const amount = amountInput ? amountInput.value : '';
  const utrNumber = utrInput ? utrInput.value : '';

  if (!amount || Number(amount) <= 0) {
    alert('Kripya sahi amount darj karein!');
    return;
  }

  if (!utrNumber) {
    alert('Kripya valid UTR / Transaction ID daalein!');
    return;
  }

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      window.location.href = 'login.html';
      return;
    }

    const token = await currentUser.getIdToken(true);

    const res = await fetch(`${API_BASE}/api/payment/verify-qr`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount, utrNumber })
    });

    const data = await res.json();

    if (data.ok) {
      alert(data.message);
      closeModals();
      location.reload();
    } else {
      alert(data.error || 'Payment process karne mein samasya aayi.');
    }
  } catch (err) {
    console.error(err);
    alert('Server communication error.');
  }
}

window.processQRPayment = processQRPayment;