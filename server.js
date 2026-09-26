import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ES Module __filename & __dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ================= CORS =================
const allowedOrigins = [
  "https://premium-ludo.onrender.com"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ================= MIDDLEWARES =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from the root directory
app.use(express.static(__dirname));

// ================= MONGODB DATABASE CONNECTION =================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error("MONGO_URI environment variable is not configured.");
}

mongoose.connect(MONGO_URI, { 
  serverSelectionTimeoutMS: 5000 
})
  .then(() => console.log('✅ Connected to MongoDB Atlas successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
  });

// ================= SCHEMAS & MODELS =================

// 1. User Schema (Wallet & Game Stats)
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  cashBalance: { type: Number, default: 0 },
  winningBalance: { type: Number, default: 0 },
  gamesPlayed: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// 2. Deposit / Transaction Schema (QR & Gateway Deposits)
const depositSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  amount: { type: Number, required: true },
  utrNumber: { type: String, required: true },
  status: { type: String, default: 'PENDING' }, // PENDING, APPROVED, REJECTED
  createdAt: { type: Date, default: Date.now }
});

const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', depositSchema);

// 3. Activity Transaction History Schema
const transactionSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  description: { type: String, required: true },
  coins: { type: Number, required: true }, // Positive for credit, negative for debit
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);


// ================= USER & WALLET API ENDPOINTS =================

// Get user economy stats and transaction history
app.get('/api/economy', async (req, res) => {
  try {
    // Note: Production mein yahan Firebase token verify kiya jata hai
    const uid = req.query.uid || "sample-user-uid";
    
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.create({ uid, cashBalance: 0, winningBalance: 0, gamesPlayed: 0, gamesWon: 0 });
    }

    const transactions = await Transaction.find({ uid }).sort({ createdAt: -1 }).limit(20);

    res.json({
      ok: true,
      economy: {
        cashBalance: user.cashBalance,
        winningBalance: user.winningBalance,
        ludoCoins: user.cashBalance + user.winningBalance,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
      },
      transactions
    });
  } catch (err) {
    console.error("Error in /api/economy:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// QR / Manual Deposit Verification Request
app.post('/api/payment/verify-qr', async (req, res) => {
  try {
    const { amount, utrNumber } = req.body;
    const uid = req.body.uid || "sample-user-uid";

    if (!amount || !utrNumber) {
      return res.status(400).json({ ok: false, error: "Amount and UTR number are required." });
    }

    // 1. Strict 12-digit UPI RRN check
    const utrRegex = /^\d{12}$/;
    if (!utrRegex.test(utrNumber.trim())) {
      return res.status(400).json({ 
        ok: false, 
        error: "Invalid UTR Format! A genuine UPI reference number must be exactly 12 digits." 
      });
    }

    const cleanUtr = utrNumber.trim();

    // 2. Advanced Check: Check if this UTR already exists in PENDING or APPROVED state
    const existingActiveDeposit = await Deposit.findOne({ 
      utrNumber: cleanUtr, 
      status: { $in: ['PENDING', 'APPROVED'] } 
    });

    if (existingActiveDeposit) {
      return res.status(400).json({ 
        ok: false, 
        error: "Security Alert: This UTR number is already active or has been processed for another transaction!" 
      });
    }

    // 3. Optional Smart Cleanup: If an old request with this UTR was 'REJECTED', 
    // we allow the new request to proceed so real users don't get blocked by a prank.
    await Deposit.deleteMany({ utrNumber: cleanUtr, status: 'REJECTED' });

    // 4. Save new valid deposit request
    const newDeposit = new Deposit({
      uid,
      amount: Number(amount),
      utrNumber: cleanUtr,
      status: 'PENDING'
    });

    await newDeposit.save();

    res.json({ 
      ok: true, 
      message: "Secure verification passed! Deposit request submitted to Admin Panel successfully." 
    });

  } catch (err) {
    console.error("Error in verify-qr:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// ================= ADMIN PANEL API ENDPOINTS =================

// 1. Fetch all pending deposit requests
app.get('/api/admin/pending-deposits', async (req, res) => {
  try {
    const requests = await Deposit.find({ status: 'PENDING' }).sort({ createdAt: -1 });
    res.json({ requests });
  } catch (err) {
    console.error("Error fetching pending deposits:", err);
    res.status(500).json({ requests: [], error: err.message });
  }
});

// 2. Approve Deposit Request & Credit User Wallet
app.post('/api/admin/approve-deposit', async (req, res) => {
  try {
    const { txId } = req.body;

    const deposit = await Deposit.findById(txId);
    if (!deposit || deposit.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: "Deposit request not found or already processed." });
    }

    deposit.status = 'APPROVED';
    await deposit.save();

    const uid = deposit.uid;
    const amount = deposit.amount;

    // Update or create User wallet balance
    let user = await User.findOne({ uid });
    if (!user) {
      user = await User.create({ uid, cashBalance: Number(amount) });
    } else {
      user.cashBalance += Number(amount);
      await user.save();
    }

    // Log transaction history
    await Transaction.create({
      uid,
      description: `Wallet Deposit Approved (UTR: ${deposit.utrNumber})`,
      coins: Number(amount)
    });

    res.json({ ok: true, message: "Deposit approved and credited to user wallet successfully!" });
  } catch (err) {
    console.error("Error approving deposit:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Reject Deposit Request
app.post('/api/admin/reject-deposit', async (req, res) => {
  try {
    const { txId } = req.body;

    const deposit = await Deposit.findById(txId);
    if (!deposit) {
      return res.status(404).json({ ok: false, error: "Deposit request not found." });
    }

    deposit.status = 'REJECTED';
    await deposit.save();

    res.json({ ok: true, message: "Deposit request rejected successfully." });
  } catch (err) {
    console.error("Error rejecting deposit:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// ================= SERVER STARTUP =================
app.listen(PORT, () => {
  console.log(`🚀 LUDOVERSE backend running at http://127.0.0.1:${PORT}`);
});
