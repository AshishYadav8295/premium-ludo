import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fs from "node:fs";

import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";

import {
  getAuth
} from "firebase-admin/auth";

// ================================================================
// ES MODULE PATH SETUP
// ================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// ================================================================
// CONFIGURATION
// ================================================================

const MONGO_URI = process.env.MONGO_URI;
const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!MONGO_URI) {
  throw new Error(
    "MONGO_URI environment variable is not configured."
  );
}

if (!FIREBASE_SERVICE_ACCOUNT_PATH) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_PATH is not configured."
  );
}

if (!ADMIN_PASSWORD) {
  throw new Error(
    "ADMIN_PASSWORD environment variable is not configured."
  );
}

// ================================================================
// ADMIN SESSION TOKENS
// ================================================================

const adminTokens = new Map();

// Admin session lifetime: 8 hours
const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;

function createAdminToken() {
  const token = crypto.randomBytes(32).toString("hex");

  adminTokens.set(token, {
    expiresAt: Date.now() + ADMIN_SESSION_TTL
  });

  return token;
}

function removeAdminToken(token) {
  adminTokens.delete(token);
}

function cleanupExpiredAdminTokens() {
  const now = Date.now();

  for (const [token, session] of adminTokens.entries()) {
    if (!session || session.expiresAt <= now) {
      adminTokens.delete(token);
    }
  }
}

setInterval(cleanupExpiredAdminTokens, 10 * 60 * 1000);

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      error: "Admin authentication required."
    });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: "Admin authentication token is missing."
    });
  }

  const session = adminTokens.get(token);

  if (!session) {
    return res.status(401).json({
      ok: false,
      error: "Invalid or expired admin session."
    });
  }

  if (session.expiresAt <= Date.now()) {
    removeAdminToken(token);

    return res.status(401).json({
      ok: false,
      error: "Admin session expired. Please login again."
    });
  }

  req.adminToken = token;

  next();
}

// ================================================================
// FIREBASE ADMIN INITIALIZATION
// ================================================================

if (!fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
  throw new Error(
    `Firebase service account file not found: ${FIREBASE_SERVICE_ACCOUNT_PATH}`
  );
}

let serviceAccount;

try {
  serviceAccount = JSON.parse(
    fs.readFileSync(
      FIREBASE_SERVICE_ACCOUNT_PATH,
      "utf8"
    )
  );
} catch (error) {
  throw new Error(
    `Unable to read Firebase service account file: ${error.message}`
  );
}

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        databaseURL:
          "https://ludoverse-d4338-default-rtdb.firebaseio.com"
      });

const firebaseAuth = getAuth(firebaseApp);

// ================================================================
// FIREBASE USER AUTHENTICATION
// ================================================================

async function requireAuth(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required."
      });
    }

    const idToken =
      authHeader.substring(7).trim();

    if (!idToken) {
      return res.status(401).json({
        ok: false,
        error: "Authentication token is missing."
      });
    }

    const decodedToken =
      await firebaseAuth.verifyIdToken(idToken);

    if (!decodedToken.uid) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Firebase user."
      });
    }

    req.uid = decodedToken.uid;

    next();

  } catch (error) {
    console.error(
      "Firebase authentication failed:",
      error.message
    );

    return res.status(401).json({
      ok: false,
      error: "Invalid or expired authentication token."
    });
  }
}

// ================================================================
// CORS
// ================================================================

const allowedOrigins = [
  "https://premium-ludo.onrender.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader("Vary", "Origin");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ================================================================
// MIDDLEWARE
// ================================================================

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb"
  })
);

// Existing frontend/static files
app.use(express.static(__dirname));

// ================================================================
// MONGODB CONNECTION
// ================================================================

mongoose.set("strictQuery", true);

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 1
  })
  .then(() => {
    console.log(
      "Connected to MongoDB Atlas successfully"
    );
  })
  .catch((error) => {
    console.error(
      "MongoDB connection error:",
      error.message
    );
  });

mongoose.connection.on(
  "error",
  (error) => {
    console.error(
      "MongoDB runtime error:",
      error.message
    );
  }
);

// ================================================================
// SCHEMAS & MODELS
// ================================================================

// ------------------------------------------------
// USER
// ------------------------------------------------

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    cashBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    winningBalance: {
      type: Number,
      default: 0,
      min: 0
    },

    gamesPlayed: {
      type: Number,
      default: 0,
      min: 0
    },

    gamesWon: {
      type: Number,
      default: 0,
      min: 0
    },

    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: true
  }
);

const User =
  mongoose.models.User ||
  mongoose.model("User", userSchema);

// ------------------------------------------------
// DEPOSIT
// ------------------------------------------------

const depositSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 1
    },

    utrNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "APPROVED",
        "REJECTED"
      ],
      default: "PENDING",
      index: true
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },

    approvedAt: {
      type: Date,
      default: null
    },

    rejectedAt: {
      type: Date,
      default: null
    }
  },
  {
    versionKey: true
  }
);

const Deposit =
  mongoose.models.Deposit ||
  mongoose.model("Deposit", depositSchema);

// ------------------------------------------------
// TRANSACTION HISTORY
// ------------------------------------------------

const transactionSchema =
  new mongoose.Schema(
    {
      uid: {
        type: String,
        required: true,
        index: true,
        trim: true
      },

      description: {
        type: String,
        required: true,
        trim: true
      },

      coins: {
        type: Number,
        required: true
      },

      createdAt: {
        type: Date,
        default: Date.now,
        index: true
      }
    },
    {
      versionKey: true
    }
  );

const Transaction =
  mongoose.models.Transaction ||
  mongoose.model(
    "Transaction",
    transactionSchema
  );

// ================================================================
// USER ECONOMY
// ================================================================

app.get(
  "/api/economy",
  requireAuth,
  async (req, res) => {
    try {
      const uid = req.uid;

      let user =
        await User.findOne({ uid });

      if (!user) {
        user = await User.create({
          uid,
          cashBalance: 0,
          winningBalance: 0,
          gamesPlayed: 0,
          gamesWon: 0
        });
      }

      const transactions =
        await Transaction.find({ uid })
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();

      const cashBalance =
        Number(user.cashBalance) || 0;

      const winningBalance =
        Number(user.winningBalance) || 0;

      const gamesPlayed =
        Number(user.gamesPlayed) || 0;

      const gamesWon =
        Number(user.gamesWon) || 0;

      return res.json({
        ok: true,

        economy: {
          cashBalance,
          winningBalance,
          ludoCoins:
            cashBalance + winningBalance,
          gamesPlayed,
          gamesWon
        },

        transactions
      });

    } catch (error) {
      console.error(
        "Error in /api/economy:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to load wallet information."
      });
    }
  }
);

// ================================================================
// QR / UTR DEPOSIT REQUEST
// ================================================================

app.post(
  "/api/payment/verify-qr",
  requireAuth,
  async (req, res) => {
    try {
      const uid = req.uid;

      const {
        amount,
        utrNumber
      } = req.body || {};

      // ------------------------------------------------
      // AMOUNT VALIDATION
      // ------------------------------------------------

      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Please enter a valid deposit amount."
        });
      }

      // Keep money values at 2 decimal places.
      const cleanAmount =
        Math.round(
          numericAmount * 100
        ) / 100;

      // ------------------------------------------------
      // UTR VALIDATION
      // ------------------------------------------------

      if (
        typeof utrNumber !== "string"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "UTR number is required."
        });
      }

      const cleanUtr =
        utrNumber.trim();

      const utrRegex =
        /^\d{12}$/;

      if (!utrRegex.test(cleanUtr)) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid UTR Format! A genuine UPI reference number must be exactly 12 digits."
        });
      }

      // ------------------------------------------------
      // DUPLICATE UTR PROTECTION
      // ------------------------------------------------

      const existingDeposit =
        await Deposit.findOne({
          utrNumber: cleanUtr
        }).lean();

      if (existingDeposit) {
        return res.status(400).json({
          ok: false,
          error:
            "Security Alert: This UTR number has already been submitted."
        });
      }

      // ------------------------------------------------
      // CREATE PENDING DEPOSIT
      // ------------------------------------------------

      const newDeposit =
        await Deposit.create({
          uid,
          amount: cleanAmount,
          utrNumber: cleanUtr,
          status: "PENDING"
        });

      return res.json({
        ok: true,
        message:
          "Secure verification passed! Deposit request submitted to Admin Panel successfully.",
        depositId:
          newDeposit._id
      });

    } catch (error) {
      console.error(
        "Error in verify-qr:",
        error
      );

      // Handle duplicate UTR race condition
      if (error?.code === 11000) {
        return res.status(400).json({
          ok: false,
          error:
            "Security Alert: This UTR number has already been submitted."
        });
      }

      return res.status(500).json({
        ok: false,
        error:
          "Unable to submit deposit request."
      });
    }
  }
);

// ================================================================
// ADMIN LOGIN
// ================================================================

app.post(
  "/api/admin/login",
  async (req, res) => {
    try {
      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      if (!password) {
        return res.status(400).json({
          ok: false,
          error:
            "Admin password is required."
        });
      }

      // Constant-time comparison
      const supplied =
        Buffer.from(password);

      const expected =
        Buffer.from(ADMIN_PASSWORD);

      let passwordMatches = false;

      if (
        supplied.length ===
        expected.length
      ) {
        passwordMatches =
          crypto.timingSafeEqual(
            supplied,
            expected
          );
      }

      if (!passwordMatches) {
        return res.status(401).json({
          ok: false,
          error:
            "Invalid admin password."
        });
      }

      const adminToken =
        createAdminToken();

      return res.json({
        ok: true,
        token: adminToken,
        expiresIn:
          ADMIN_SESSION_TTL
      });

    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Admin login failed."
      });
    }
  }
);

// ================================================================
// ADMIN LOGOUT
// ================================================================

app.post(
  "/api/admin/logout",
  requireAdmin,
  async (req, res) => {
    removeAdminToken(
      req.adminToken
    );

    return res.json({
      ok: true,
      message:
        "Admin session ended successfully."
    });
  }
);

// ================================================================
// ADMIN - PENDING DEPOSITS
// ================================================================

app.get(
  "/api/admin/pending-deposits",
  requireAdmin,
  async (req, res) => {
    try {
      const requests =
        await Deposit.find({
          status: "PENDING"
        })
          .sort({ createdAt: -1 })
          .lean();

      return res.json({
        ok: true,
        requests
      });

    } catch (error) {
      console.error(
        "Error fetching pending deposits:",
        error
      );

      return res.status(500).json({
        ok: false,
        requests: [],
        error:
          "Unable to load pending deposits."
      });
    }
  }
);

// ================================================================
// ADMIN - APPROVE DEPOSIT
// ================================================================

app.post(
  "/api/admin/approve-deposit",
  requireAdmin,
  async (req, res) => {
    const { txId } =
      req.body || {};

    if (
      !txId ||
      typeof txId !== "string" ||
      !mongoose.isValidObjectId(txId)
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid transaction ID."
      });
    }

    const session =
      await mongoose.startSession();

    try {
      let approvedAmount = 0;

      await session.withTransaction(
        async () => {

          // ------------------------------------------------
          // ATOMIC PENDING -> APPROVED
          // ------------------------------------------------

          const deposit =
            await Deposit.findOneAndUpdate(
              {
                _id: txId,
                status: "PENDING"
              },
              {
                $set: {
                  status: "APPROVED",
                  approvedAt: new Date()
                }
              },
              {
                new: true,
                session
              }
            );

          if (!deposit) {
            const error =
              new Error(
                "Deposit request not found or already processed."
              );

            error.statusCode = 400;

            throw error;
          }

          const uid =
            deposit.uid;

          const amount =
            Number(deposit.amount);

          if (
            !Number.isFinite(amount) ||
            amount <= 0
          ) {
            const error =
              new Error(
                "Invalid deposit amount."
              );

            error.statusCode = 400;

            throw error;
          }

          approvedAmount =
            amount;

          // ------------------------------------------------
          // CREDIT USER WALLET
          // ------------------------------------------------

          const user =
            await User.findOneAndUpdate(
              { uid },
              {
                $inc: {
                  cashBalance: amount
                },

                $setOnInsert: {
                  uid,
                  winningBalance: 0,
                  gamesPlayed: 0,
                  gamesWon: 0,
                  createdAt: new Date()
                }
              },
              {
                new: true,
                upsert: true,
                session,
                setDefaultsOnInsert: true
              }
            );

          if (!user) {
            const error =
              new Error(
                "Unable to update user wallet."
              );

            error.statusCode = 500;

            throw error;
          }

          // ------------------------------------------------
          // TRANSACTION HISTORY
          // ------------------------------------------------

          await Transaction.create(
            [
              {
                uid,
                description:
                  `Wallet Deposit Approved (UTR: ${deposit.utrNumber})`,
                coins: amount,
                createdAt: new Date()
              }
            ],
            { session }
          );
        }
      );

      return res.json({
        ok: true,
        message:
          "Deposit approved and credited to user wallet successfully!",
        amount:
          approvedAmount
      });

    } catch (error) {
      console.error(
        "Error approving deposit:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        ok: false,
        error:
          error.statusCode
            ? error.message
            : "Unable to approve deposit."
      });

    } finally {
      await session.endSession();
    }
  }
);

// ================================================================
// ADMIN - REJECT DEPOSIT
// ================================================================

app.post(
  "/api/admin/reject-deposit",
  requireAdmin,
  async (req, res) => {
    try {
      const { txId } =
        req.body || {};

      if (
        !txId ||
        typeof txId !== "string" ||
        !mongoose.isValidObjectId(txId)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid transaction ID."
        });
      }

      const deposit =
        await Deposit.findOneAndUpdate(
          {
            _id: txId,
            status: "PENDING"
          },
          {
            $set: {
              status: "REJECTED",
              rejectedAt: new Date()
            }
          },
          {
            new: true
          }
        );

      if (!deposit) {
        return res.status(400).json({
          ok: false,
          error:
            "Deposit request not found or already processed."
        });
      }

      return res.json({
        ok: true,
        message:
          "Deposit request rejected successfully."
      });

    } catch (error) {
      console.error(
        "Error rejecting deposit:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to reject deposit request."
      });
    }
  }
);

// ================================================================
// HEALTH CHECK
// ================================================================

app.get(
  "/api/health",
  (req, res) => {
    return res.json({
      ok: true,
      service: "LUDOVERSE backend",
      status: "running"
    });
  }
);

// ================================================================
// 404 API HANDLER
// ================================================================

app.use(
  "/api",
  (req, res) => {
    return res.status(404).json({
      ok: false,
      error: "API endpoint not found."
    });
  }
);

// ================================================================
// GLOBAL ERROR HANDLER
// ================================================================

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      ok: false,
      error:
        "Internal server error."
    });
  }
);

// ================================================================
// SERVER STARTUP
// ================================================================

app.listen(PORT, () => {
  console.log(
    `LUDOVERSE backend running on port ${PORT}`
  );
});