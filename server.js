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
// LUDOVERSE BACKEND
// ================================================================
// Server-authoritative wallet + battle backend
//
// Battle flow:
//
// CREATE:
// P1 cashBalance -= entry
// Battle = WAITING
//
// JOIN:
// P2 cashBalance -= entry
// Battle = READY
//
// SETTLEMENT:
// totalPot = entry * 2
// platformFee = 10%
// winnerPrize = totalPot - platformFee
//
// WINNER:
// winner.winningBalance += winnerPrize
// Battle = FINISHED
// payoutStatus = PAID
//
// IMPORTANT:
// Client/browser MUST NOT be trusted to decide the winner.
// Settlement endpoint requires GAME_SERVER_SECRET.
// ================================================================

// ================================================================
// ES MODULE PATH SETUP
// ================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// EXPRESS
// ================================================================

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

// ================================================================
// CONFIGURATION
// ================================================================

const MONGO_URI =
  process.env.MONGO_URI;

const FIREBASE_SERVICE_ACCOUNT_PATH =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD;

const GAME_SERVER_SECRET =
  process.env.GAME_SERVER_SECRET;

const NODE_ENV =
  process.env.NODE_ENV || "development";

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

if (!GAME_SERVER_SECRET) {
  throw new Error(
    "GAME_SERVER_SECRET environment variable is not configured."
  );
}

// ================================================================
// SECURITY / LIMITS
// ================================================================

const MAX_JSON_SIZE = "1mb";

const ADMIN_SESSION_TTL =
  8 * 60 * 60 * 1000;

const MIN_BATTLE_ENTRY = 1;
const MAX_BATTLE_ENTRY = 100000;

const BATTLE_PLATFORM_FEE_PERCENT = 10;

const BATTLE_WINNER_PERCENT = 90;

// ================================================================
// CORS
// ================================================================

const allowedOrigins = [
  "https://premium-ludo.onrender.com",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

app.use((req, res, next) => {
  const origin =
    req.headers.origin;

  if (
    origin &&
    allowedOrigins.includes(origin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );
  }

  res.setHeader(
    "Vary",
    "Origin"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Game-Server-Secret"
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "600"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ================================================================
// BASIC SECURITY HEADERS
// ================================================================

app.use((req, res, next) => {
  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "X-Frame-Options",
    "DENY"
  );

  res.setHeader(
    "Referrer-Policy",
    "no-referrer"
  );

  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  next();
});

// ================================================================
// BODY PARSERS
// ================================================================

app.use(
  express.json({
    limit: MAX_JSON_SIZE
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: MAX_JSON_SIZE
  })
);

// ================================================================
// STATIC FRONTEND
// ================================================================

app.use(
  express.static(__dirname)
);

// ================================================================
// MONGODB
// ================================================================

mongoose.set(
  "strictQuery",
  true
);

mongoose.connection.on(
  "connected",
  () => {
    console.log(
      "Connected to MongoDB Atlas successfully."
    );
  }
);

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
// FIREBASE ADMIN INITIALIZATION
// ================================================================

if (
  !fs.existsSync(
    FIREBASE_SERVICE_ACCOUNT_PATH
  )
) {
  throw new Error(
    `Firebase service account file not found: ${FIREBASE_SERVICE_ACCOUNT_PATH}`
  );
}

let serviceAccount;

try {
  serviceAccount =
    JSON.parse(
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
        credential:
          cert(serviceAccount),

        databaseURL:
          "https://ludoverse-d4338-default-rtdb.firebaseio.com"
      });

const firebaseAuth =
  getAuth(firebaseApp);

// ================================================================
// ADMIN SESSION STORE
// ================================================================

const adminTokens =
  new Map();

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function createAdminToken() {
  const token =
    crypto.randomBytes(32)
      .toString("hex");

  adminTokens.set(token, {
    expiresAt:
      Date.now() +
      ADMIN_SESSION_TTL
  });

  return token;
}

function removeAdminToken(token) {
  adminTokens.delete(token);
}

function cleanupExpiredAdminTokens() {
  const now =
    Date.now();

  for (
    const [
      token,
      session
    ] of adminTokens.entries()
  ) {
    if (
      !session ||
      session.expiresAt <= now
    ) {
      adminTokens.delete(token);
    }
  }
}

setInterval(
  cleanupExpiredAdminTokens,
  10 * 60 * 1000
);

// ================================================================
// ADMIN AUTH
// ================================================================

function requireAdmin(
  req,
  res,
  next
) {
  const authHeader =
    req.headers.authorization || "";

  if (
    !authHeader.startsWith(
      "Bearer "
    )
  ) {
    return res.status(401).json({
      ok: false,
      error:
        "Admin authentication required."
    });
  }

  const token =
    authHeader
      .substring(7)
      .trim();

  if (!token) {
    return res.status(401).json({
      ok: false,
      error:
        "Admin authentication token is missing."
    });
  }

  const session =
    adminTokens.get(token);

  if (!session) {
    return res.status(401).json({
      ok: false,
      error:
        "Invalid or expired admin session."
    });
  }

  if (
    session.expiresAt <=
    Date.now()
  ) {
    removeAdminToken(token);

    return res.status(401).json({
      ok: false,
      error:
        "Admin session expired."
    });
  }

  req.adminToken =
    token;

  next();
}

// ================================================================
// FIREBASE USER AUTH
// ================================================================

async function requireAuth(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization || "";

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        ok: false,
        error:
          "Authentication required."
      });
    }

    const idToken =
      authHeader
        .substring(7)
        .trim();

    if (!idToken) {
      return res.status(401).json({
        ok: false,
        error:
          "Authentication token is missing."
      });
    }

    const decodedToken =
      await firebaseAuth.verifyIdToken(
        idToken
      );

    if (!decodedToken.uid) {
      return res.status(401).json({
        ok: false,
        error:
          "Invalid Firebase user."
      });
    }

    req.uid =
      decodedToken.uid;

    next();

  } catch (error) {
    console.error(
      "Firebase authentication failed:",
      error.message
    );

    return res.status(401).json({
      ok: false,
      error:
        "Invalid or expired authentication token."
    });
  }
}

// ================================================================
// TRUSTED GAME SERVER AUTH
// ================================================================
//
// IMPORTANT:
//
// This endpoint must NEVER be called directly by an untrusted
// browser client.
//
// Your actual game server / authoritative game logic should call it.
//
// Header:
//
// X-Game-Server-Secret: <GAME_SERVER_SECRET>
// ================================================================

function requireGameServer(
  req,
  res,
  next
) {
  const suppliedSecret =
    typeof req.headers[
      "x-game-server-secret"
    ] === "string"
      ? req.headers[
          "x-game-server-secret"
        ]
      : "";

  if (
    !suppliedSecret
  ) {
    return res.status(401).json({
      ok: false,
      error:
        "Trusted game server authentication required."
    });
  }

  const suppliedBuffer =
    Buffer.from(
      suppliedSecret,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      GAME_SERVER_SECRET,
      "utf8"
    );

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    return res.status(401).json({
      ok: false,
      error:
        "Invalid game server authentication."
    });
  }

  const valid =
    crypto.timingSafeEqual(
      suppliedBuffer,
      expectedBuffer
    );

  if (!valid) {
    return res.status(401).json({
      ok: false,
      error:
        "Invalid game server authentication."
    });
  }

  next();
}

// ================================================================
// VALIDATION HELPERS
// ================================================================

function normalizePlayerName(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return "Player";
  }

  const name =
    value.trim();

  if (!name) {
    return "Player";
  }

  return name.substring(
    0,
    80
  );
}

function normalizePlayerPhoto(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .trim()
    .substring(
      0,
      1000
    );
}

function validateRequestId(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const requestId =
    value.trim();

  if (
    requestId.length < 16 ||
    requestId.length > 100
  ) {
    return null;
  }

  return requestId;
}

function validateRoomCode(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const roomCode =
    value.trim();

  if (
    !/^\d{6}$/.test(
      roomCode
    )
  ) {
    return null;
  }

  return roomCode;
}

function validateBattleEntry(
  value
) {
  const amount =
    Number(value);

  if (
    !Number.isSafeInteger(
      amount
    )
  ) {
    return null;
  }

  if (
    amount <
      MIN_BATTLE_ENTRY ||
    amount >
      MAX_BATTLE_ENTRY
  ) {
    return null;
  }

  return amount;
}

// ================================================================
// MONEY CALCULATION
// ================================================================

function calculateBattleMoney(
  entry
) {
  const totalPot =
    entry * 2;

  const platformFee =
    Math.floor(
      (
        totalPot *
        BATTLE_PLATFORM_FEE_PERCENT
      ) / 100
    );

  const winnerPrize =
    totalPot -
    platformFee;

  return {
    totalPot,
    platformFee,
    winnerPrize
  };
}

// ================================================================
// SECURE IDS
// ================================================================

function generateBattleId() {
  return (
    "BATTLE-" +
    crypto
      .randomBytes(12)
      .toString("hex")
  );
}

function generateRoomCode() {
  return String(
    crypto.randomInt(
      100000,
      1000000
    )
  );
}

// ================================================================
// SCHEMAS
// ================================================================

// ================================================================
// USER
// ================================================================

const userSchema =
  new mongoose.Schema(
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
      versionKey: false
    }
  );

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

// ================================================================
// DEPOSIT
// ================================================================

const depositSchema =
  new mongoose.Schema(
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
        unique: true,
        index: true,
        trim: true
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
      versionKey: false
    }
  );

const Deposit =
  mongoose.models.Deposit ||
  mongoose.model(
    "Deposit",
    depositSchema
  );

// ================================================================
// TRANSACTION
// ================================================================

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
        trim: true,
        maxlength: 250
      },

      coins: {
        type: Number,
        required: true
      },

      type: {
        type: String,
        enum: [
          "DEPOSIT",
          "BATTLE_ENTRY",
          "BATTLE_WIN",
          "BATTLE_REFUND",
          "OTHER"
        ],
        default: "OTHER",
        index: true
      },

      battleId: {
        type: String,
        default: null,
        index: true
      },

      createdAt: {
        type: Date,
        default: Date.now,
        index: true
      }
    },

    {
      versionKey: false
    }
  );

const Transaction =
  mongoose.models.Transaction ||
  mongoose.model(
    "Transaction",
    transactionSchema
  );

// ================================================================
// BATTLE PLAYER
// ================================================================

const battlePlayerSchema =
  new mongoose.Schema(
    {
      uid: {
        type: String,
        required: true,
        trim: true
      },

      name: {
        type: String,
        default: "Player",
        trim: true,
        maxlength: 80
      },

      photo: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000
      },

      joinedAt: {
        type: Date,
        default: Date.now
      }
    },

    {
      _id: false
    }
  );

// ================================================================
// BATTLE
// ================================================================

const battleSchema =
  new mongoose.Schema(
    {
      battleId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      roomCode: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      game: {
        type: String,
        required: true,
        enum: [
          "Classic Ludo"
        ],
        default:
          "Classic Ludo"
      },

      mode: {
        type: String,
        required: true,
        enum: [
          "private",
          "quick"
        ],
        default:
          "private"
      },

      entry: {
        type: Number,
        required: true,
        min: 1
      },

      totalPot: {
        type: Number,
        required: true,
        min: 0
      },

      platformFee: {
        type: Number,
        required: true,
        min: 0
      },

      winnerPrize: {
        type: Number,
        required: true,
        min: 0
      },

      maxPlayers: {
        type: Number,
        required: true,
        default: 2,
        immutable: true
      },

      status: {
        type: String,
        required: true,
        enum: [
          "WAITING",
          "READY",
          "RUNNING",
          "FINISHED",
          "CANCELLED"
        ],
        default:
          "WAITING",
        index: true
      },

      creatorUid: {
        type: String,
        required: true,
        index: true,
        trim: true
      },

      player1: {
        type: battlePlayerSchema,
        required: true
      },

      player2: {
        type: battlePlayerSchema,
        default: null
      },

      winnerUid: {
        type: String,
        default: null,
        trim: true,
        index: true
      },

      // ----------------------------------------------------------
      // PAYOUT STATE
      // ----------------------------------------------------------

      payoutStatus: {
        type: String,
        enum: [
          "UNPAID",
          "PROCESSING",
          "PAID",
          "REFUNDED"
        ],
        default:
          "UNPAID",
        index: true
      },

      payoutAmount: {
        type: Number,
        default: 0,
        min: 0
      },

      payoutTransactionId: {
        type: String,
        default: null,
        index: true
      },

      settlementRequestId: {
        type: String,
        default: null,
        unique: true,
        sparse: true,
        index: true,
        trim: true
      },

      // ----------------------------------------------------------
      // REQUEST IDS
      // ----------------------------------------------------------

      createRequestId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true
      },

      joinRequestId: {
        type: String,
        default: null,
        index: true,
        trim: true
      },

      // ----------------------------------------------------------
      // TIMESTAMPS
      // ----------------------------------------------------------

      createdAt: {
        type: Date,
        default: Date.now,
        index: true
      },

      readyAt: {
        type: Date,
        default: null
      },

      startedAt: {
        type: Date,
        default: null
      },

      finishedAt: {
        type: Date,
        default: null
      }
    },

    {
      versionKey: false
    }
  );

const Battle =
  mongoose.models.Battle ||
  mongoose.model(
    "Battle",
    battleSchema
  );

// ================================================================
// DATABASE CONNECTION
// ================================================================

async function connectDatabase() {
  await mongoose.connect(
    MONGO_URI,
    {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 20,
      minPoolSize: 1
    }
  );
}

// ================================================================
// ECONOMY
// ================================================================

app.get(
  "/api/economy",
  requireAuth,
  async (req, res) => {
    try {
      const uid =
        req.uid;

      let user =
        await User.findOne({
          uid
        });

      if (!user) {
        user =
          await User.create({
            uid,
            cashBalance: 0,
            winningBalance: 0,
            gamesPlayed: 0,
            gamesWon: 0
          });
      }

      const transactions =
        await Transaction.find({
          uid
        })
          .sort({
            createdAt: -1
          })
          .limit(20)
          .lean();

      const cashBalance =
        Number(
          user.cashBalance
        ) || 0;

      const winningBalance =
        Number(
          user.winningBalance
        ) || 0;

      const gamesPlayed =
        Number(
          user.gamesPlayed
        ) || 0;

      const gamesWon =
        Number(
          user.gamesWon
        ) || 0;

      return res.json({
        ok: true,

        economy: {
          cashBalance,

          winningBalance,

          ludoCoins:
            cashBalance +
            winningBalance,

          gamesPlayed,

          gamesWon
        },

        transactions
      });

    } catch (error) {
      console.error(
        "Economy error:",
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
// CREATE BATTLE
// ================================================================

app.post(
  "/api/battles/create",
  requireAuth,
  async (req, res) => {
    const uid =
      req.uid;

    const entry =
      validateBattleEntry(
        req.body?.entry
      );

    const mode =
      req.body?.mode === "quick"
        ? "quick"
        : "private";

    const createRequestId =
      validateRequestId(
        req.body?.requestId
      );

    const playerName =
      normalizePlayerName(
        req.body?.playerName
      );

    const playerPhoto =
      normalizePlayerPhoto(
        req.body?.playerPhoto
      );

    if (!createRequestId) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid battle request."
      });
    }

    if (entry === null) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid battle entry amount."
      });
    }

    const money =
      calculateBattleMoney(
        entry
      );

    const session =
      await mongoose.startSession();

    try {
      let result =
        null;

      await session.withTransaction(
        async () => {

          // ------------------------------------------------------
          // IDEMPOTENCY
          // ------------------------------------------------------

          const existingBattle =
            await Battle.findOne({
              createRequestId
            })
              .session(session)
              .lean();

          if (existingBattle) {

            if (
              existingBattle.creatorUid !==
              uid
            ) {
              const error =
                new Error(
                  "Invalid battle request."
                );

              error.statusCode =
                409;

              throw error;
            }

            result = {
              battle:
                existingBattle,
              duplicate:
                true
            };

            return;
          }

          // ------------------------------------------------------
          // ATOMIC WALLET DEDUCTION
          // ------------------------------------------------------

          const updatedUser =
            await User.findOneAndUpdate(
              {
                uid,

                cashBalance: {
                  $gte: entry
                }
              },

              {
                $inc: {
                  cashBalance:
                    -entry
                }
              },

              {
                new: true,
                session
              }
            );

          if (!updatedUser) {
            const error =
              new Error(
                "Insufficient wallet balance."
              );

            error.statusCode =
              400;

            throw error;
          }

          // ------------------------------------------------------
          // UNIQUE ROOM
          // ------------------------------------------------------

          let battle =
            null;

          for (
            let attempt = 0;
            attempt < 10;
            attempt++
          ) {
            const roomCode =
              generateRoomCode();

            const exists =
              await Battle.exists({
                roomCode
              })
                .session(session);

            if (exists) {
              continue;
            }

            battle = {
              battleId:
                generateBattleId(),

              roomCode,

              game:
                "Classic Ludo",

              mode,

              entry,

              totalPot:
                money.totalPot,

              platformFee:
                money.platformFee,

              winnerPrize:
                money.winnerPrize,

              maxPlayers:
                2,

              status:
                "WAITING",

              creatorUid:
                uid,

              player1: {
                uid,

                name:
                  playerName,

                photo:
                  playerPhoto,

                joinedAt:
                  new Date()
              },

              player2:
                null,

              winnerUid:
                null,

              payoutStatus:
                "UNPAID",

              payoutAmount:
                0,

              payoutTransactionId:
                null,

              settlementRequestId:
                null,

              createRequestId,

              joinRequestId:
                null,

              createdAt:
                new Date(),

              readyAt:
                null,

              startedAt:
                null,

              finishedAt:
                null
            };

            break;
          }

          if (!battle) {
            const error =
              new Error(
                "Unable to generate a unique room code."
              );

            error.statusCode =
              503;

            throw error;
          }

          // ------------------------------------------------------
          // CREATE BATTLE
          // ------------------------------------------------------

          await Battle.create(
            [battle],
            {
              session
            }
          );

          // ------------------------------------------------------
          // WALLET HISTORY
          // ------------------------------------------------------

          await Transaction.create(
            [
              {
                uid,

                description:
                  `Battle Entry - Room ${battle.roomCode}`,

                coins:
                  -entry,

                type:
                  "BATTLE_ENTRY",

                battleId:
                  battle.battleId,

                createdAt:
                  new Date()
              }
            ],
            {
              session
            }
          );

          result = {
            battle,
            duplicate:
              false
          };
        }
      );

      return res
        .status(
          result?.duplicate
            ? 200
            : 201
        )
        .json({
          ok: true,

          duplicate:
            Boolean(
              result?.duplicate
            ),

          battle: {
            battleId:
              result.battle.battleId,

            roomCode:
              result.battle.roomCode,

            game:
              result.battle.game,

            mode:
              result.battle.mode,

            entry:
              result.battle.entry,

            totalPot:
              result.battle.totalPot,

            platformFee:
              result.battle.platformFee,

            winnerPrize:
              result.battle.winnerPrize,

            status:
              result.battle.status,

            payoutStatus:
              result.battle.payoutStatus
          }
        });

    } catch (error) {
      console.error(
        "Create battle error:",
        error
      );

      if (
        error?.code ===
        11000
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "Battle request conflict. Please retry."
        });
      }

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
          ok: false,

          error:
            error.statusCode
              ? error.message
              : "Unable to create battle."
        });

    } finally {
      await session.endSession();
    }
  }
);

// ================================================================
// JOIN BATTLE
// ================================================================

app.post(
  "/api/battles/join",
  requireAuth,
  async (req, res) => {
    const uid =
      req.uid;

    const roomCode =
      validateRoomCode(
        req.body?.roomCode
      );

    const joinRequestId =
      validateRequestId(
        req.body?.requestId
      );

    const playerName =
      normalizePlayerName(
        req.body?.playerName
      );

    const playerPhoto =
      normalizePlayerPhoto(
        req.body?.playerPhoto
      );

    if (!roomCode) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid room code."
      });
    }

    if (!joinRequestId) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid join request."
      });
    }

    const session =
      await mongoose.startSession();

    try {
      let joinedBattle =
        null;

      await session.withTransaction(
        async () => {

          // ------------------------------------------------------
          // FIND BATTLE
          // ------------------------------------------------------

          const battle =
            await Battle.findOne({
              roomCode
            })
              .session(session);

          if (!battle) {
            const error =
              new Error(
                "Battle not found."
              );

            error.statusCode =
              404;

            throw error;
          }

          // ------------------------------------------------------
          // IDEMPOTENT JOIN
          // ------------------------------------------------------

          if (
            battle.player2?.uid ===
            uid
          ) {
            joinedBattle =
              battle;

            return;
          }

          // ------------------------------------------------------
          // CANNOT JOIN OWN BATTLE
          // ------------------------------------------------------

          if (
            battle.creatorUid ===
            uid
          ) {
            const error =
              new Error(
                "You cannot join your own battle."
              );

            error.statusCode =
              400;

            throw error;
          }

          // ------------------------------------------------------
          // STATUS
          // ------------------------------------------------------

          if (
            battle.status !==
            "WAITING"
          ) {
            const error =
              new Error(
                "This battle is no longer available."
              );

            error.statusCode =
              409;

            throw error;
          }

          const entry =
            validateBattleEntry(
              battle.entry
            );

          if (entry === null) {
            const error =
              new Error(
                "Battle has invalid entry configuration."
              );

            error.statusCode =
              500;

            throw error;
          }

          // ------------------------------------------------------
          // ATOMIC P2 WALLET DEDUCTION
          // ------------------------------------------------------

          const updatedUser =
            await User.findOneAndUpdate(
              {
                uid,

                cashBalance: {
                  $gte: entry
                }
              },

              {
                $inc: {
                  cashBalance:
                    -entry
                }
              },

              {
                new: true,
                session
              }
            );

          if (!updatedUser) {
            const error =
              new Error(
                "Insufficient wallet balance."
              );

            error.statusCode =
              400;

            throw error;
          }

          // ------------------------------------------------------
          // PLAYER 2
          // ------------------------------------------------------

          battle.player2 = {
            uid,

            name:
              playerName,

            photo:
              playerPhoto,

            joinedAt:
              new Date()
          };

          // ------------------------------------------------------
          // MONEY
          // ------------------------------------------------------

          const money =
            calculateBattleMoney(
              entry
            );

          battle.totalPot =
            money.totalPot;

          battle.platformFee =
            money.platformFee;

          battle.winnerPrize =
            money.winnerPrize;

          // ------------------------------------------------------
          // READY
          // ------------------------------------------------------

          battle.status =
            "READY";

          battle.readyAt =
            new Date();

          battle.joinRequestId =
            joinRequestId;

          // ------------------------------------------------------
          // SAVE
          // ------------------------------------------------------

          await battle.save({
            session
          });

          // ------------------------------------------------------
          // HISTORY
          // ------------------------------------------------------

          await Transaction.create(
            [
              {
                uid,

                description:
                  `Battle Entry - Room ${roomCode}`,

                coins:
                  -entry,

                type:
                  "BATTLE_ENTRY",

                battleId:
                  battle.battleId,

                createdAt:
                  new Date()
              }
            ],
            {
              session
            }
          );

          joinedBattle =
            battle;
        }
      );

      return res.json({
        ok: true,

        battle: {
          battleId:
            joinedBattle.battleId,

          roomCode:
            joinedBattle.roomCode,

          game:
            joinedBattle.game,

          mode:
            joinedBattle.mode,

          entry:
            joinedBattle.entry,

          totalPot:
            joinedBattle.totalPot,

          platformFee:
            joinedBattle.platformFee,

          winnerPrize:
            joinedBattle.winnerPrize,

          status:
            joinedBattle.status,

          payoutStatus:
            joinedBattle.payoutStatus,

          player1:
            joinedBattle.player1,

          player2:
            joinedBattle.player2
        }
      });

    } catch (error) {
      console.error(
        "Join battle error:",
        error
      );

      if (
        error?.code ===
        11000
      ) {
        return res.status(409).json({
          ok: false,
          error:
            "Battle join request conflict."
        });
      }

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
          ok: false,

          error:
            error.statusCode
              ? error.message
              : "Unable to join battle."
        });

    } finally {
      await session.endSession();
    }
  }
);

// ================================================================
// START BATTLE
// ================================================================
//
// Trusted game server changes:
//
// READY -> RUNNING
//
// This endpoint is protected so the client cannot arbitrarily
// manipulate battle state.
// ================================================================

app.post(
  "/api/battles/:roomCode/start",
  requireGameServer,
  async (req, res) => {
    const roomCode =
      validateRoomCode(
        req.params.roomCode
      );

    if (!roomCode) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid room code."
      });
    }

    try {
      const battle =
        await Battle.findOneAndUpdate(
          {
            roomCode,

            status:
              "READY"
          },

          {
            $set: {
              status:
                "RUNNING",

              startedAt:
                new Date()
            }
          },

          {
            new: true
          }
        ).lean();

      if (!battle) {
        return res.status(409).json({
          ok: false,
          error:
            "Battle is not ready to start."
        });
      }

      return res.json({
        ok: true,

        battle: {
          battleId:
            battle.battleId,

          roomCode:
            battle.roomCode,

          status:
            battle.status,

          startedAt:
            battle.startedAt
        }
      });

    } catch (error) {
      console.error(
        "Start battle error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to start battle."
      });
    }
  }
);

// ================================================================
// GET BATTLE
// ================================================================

app.get(
  "/api/battles/:roomCode",
  requireAuth,
  async (req, res) => {
    try {
      const roomCode =
        validateRoomCode(
          req.params.roomCode
        );

      if (!roomCode) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid room code."
        });
      }

      const battle =
        await Battle.findOne({
          roomCode
        }).lean();

      if (!battle) {
        return res.status(404).json({
          ok: false,
          error:
            "Battle not found."
        });
      }

      const isPlayer =
        battle.player1?.uid ===
          req.uid ||
        battle.player2?.uid ===
          req.uid;

      if (!isPlayer) {
        return res.status(403).json({
          ok: false,
          error:
            "You are not a player in this battle."
        });
      }

      return res.json({
        ok: true,

        battle: {
          battleId:
            battle.battleId,

          roomCode:
            battle.roomCode,

          game:
            battle.game,

          mode:
            battle.mode,

          entry:
            battle.entry,

          totalPot:
            battle.totalPot,

          platformFee:
            battle.platformFee,

          winnerPrize:
            battle.winnerPrize,

          status:
            battle.status,

          payoutStatus:
            battle.payoutStatus,

          payoutAmount:
            battle.payoutAmount,

          player1:
            battle.player1,

          player2:
            battle.player2,

          winnerUid:
            battle.winnerUid,

          createdAt:
            battle.createdAt,

          readyAt:
            battle.readyAt,

          startedAt:
            battle.startedAt,

          finishedAt:
            battle.finishedAt
        }
      });

    } catch (error) {
      console.error(
        "Get battle error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to load battle."
      });
    }
  }
);

// ================================================================
// SERVER-AUTHORITATIVE BATTLE SETTLEMENT
// ================================================================
//
// FLOW:
//
// GAME FINISHED
//      ↓
// Trusted Game Server determines winner
//      ↓
// POST /api/battles/:roomCode/finish
//      ↓
// Verify trusted server secret
//      ↓
// Find battle
//      ↓
// Verify 2 players
//      ↓
// Verify winner belongs to battle
//      ↓
// Recalculate POT / FEE / PRIZE
//      ↓
// Atomic transaction
//      ↓
// winner.winningBalance += winnerPrize
// loser.gamesPlayed += 1
// winner.gamesPlayed += 1
// winner.gamesWon += 1
// create BATTLE_WIN transaction
//      ↓
// Battle = FINISHED
// payoutStatus = PAID
//      ↓
// COMMIT
//
// IMPORTANT:
// Browser/client must NEVER have GAME_SERVER_SECRET.
// ================================================================

app.post(
  "/api/battles/:roomCode/finish",
  requireGameServer,
  async (req, res) => {

    // ------------------------------------------------------------
    // VALIDATE ROOM
    // ------------------------------------------------------------

    const roomCode =
      validateRoomCode(
        req.params.roomCode
      );

    // ------------------------------------------------------------
    // VALIDATE WINNER
    // ------------------------------------------------------------

    const winnerUid =
      typeof req.body?.winnerUid === "string"
        ? req.body.winnerUid.trim()
        : "";

    // ------------------------------------------------------------
    // VALIDATE SETTLEMENT REQUEST ID
    //
    // This makes the settlement idempotent.
    //
    // Example:
    //
    // requestId = "battle-finish-abc123..."
    //
    // If the same request reaches the server twice,
    // winner must NOT receive the payout twice.
    // ------------------------------------------------------------

    const settlementRequestId =
      validateRequestId(
        req.body?.requestId
      );

    // ------------------------------------------------------------
    // BASIC VALIDATION
    // ------------------------------------------------------------

    if (!roomCode) {
      return res.status(400).json({
        ok: false,
        error:
          "Invalid room code."
      });
    }

    if (!winnerUid) {
      return res.status(400).json({
        ok: false,
        error:
          "Winner UID is required."
      });
    }

    if (!settlementRequestId) {
      return res.status(400).json({
        ok: false,
        error:
          "Settlement request ID is required."
      });
    }

    // ------------------------------------------------------------
    // START MONGODB SESSION
    // ------------------------------------------------------------

    const session =
      await mongoose.startSession();

    try {

      let settlementResult = null;

      // ----------------------------------------------------------
      // ATOMIC TRANSACTION
      // ----------------------------------------------------------

      await session.withTransaction(
        async () => {

          // ======================================================
          // 1. CHECK WHETHER THIS EXACT REQUEST WAS ALREADY USED
          // ======================================================

          const previousSettlement =
            await Battle.findOne({
              settlementRequestId
            })
              .session(session)
              .lean();

          if (previousSettlement) {

            // ----------------------------------------------------
            // IMPORTANT SECURITY CHECK
            //
            // Same requestId must refer to the same winner.
            // ----------------------------------------------------

            if (
              previousSettlement.winnerUid !==
              winnerUid
            ) {

              const error =
                new Error(
                  "Settlement request ID was already used for another winner."
                );

              error.statusCode = 409;

              throw error;
            }

            // ----------------------------------------------------
            // SAME REQUEST = IDEMPOTENT RETRY
            // ----------------------------------------------------

            settlementResult = {
              battle:
                previousSettlement,

              duplicate:
                true
            };

            return;
          }

          // ======================================================
          // 2. LOAD BATTLE
          // ======================================================

          const battle =
            await Battle.findOne({
              roomCode
            })
              .session(session);

          if (!battle) {

            const error =
              new Error(
                "Battle not found."
              );

            error.statusCode = 404;

            throw error;
          }

          // ======================================================
          // 3. ALREADY PAID CHECK
          // ======================================================

          if (
            battle.payoutStatus === "PAID" ||
            battle.status === "FINISHED"
          ) {

            // ----------------------------------------------------
            // If the battle was already paid,
            // NEVER credit it again.
            // ----------------------------------------------------

            if (
              battle.winnerUid === winnerUid
            ) {

              settlementResult = {
                battle,

                duplicate:
                  true
              };

              return;
            }

            const error =
              new Error(
                "Battle has already been settled."
              );

            error.statusCode = 409;

            throw error;
          }

          // ======================================================
          // 4. VALIDATE BATTLE STATE
          // ======================================================

          if (
            battle.status !== "READY" &&
            battle.status !== "RUNNING"
          ) {

            const error =
              new Error(
                `Battle cannot be settled from status ${battle.status}.`
              );

            error.statusCode = 409;

            throw error;
          }

          // ======================================================
          // 5. BOTH PLAYERS REQUIRED
          // ======================================================

          if (
            !battle.player1 ||
            !battle.player2
          ) {

            const error =
              new Error(
                "Battle must contain exactly two players before settlement."
              );

            error.statusCode = 409;

            throw error;
          }

          // ======================================================
          // 6. VERIFY WINNER IS A BATTLE PARTICIPANT
          // ======================================================

          const winnerIsPlayer1 =
            battle.player1.uid ===
            winnerUid;

          const winnerIsPlayer2 =
            battle.player2.uid ===
            winnerUid;

          if (
            !winnerIsPlayer1 &&
            !winnerIsPlayer2
          ) {

            const error =
              new Error(
                "Winner is not a participant in this battle."
              );

            error.statusCode = 400;

            throw error;
          }

          // ======================================================
          // 7. DETERMINE LOSER
          // ======================================================

          const loserUid =
            winnerIsPlayer1
              ? battle.player2.uid
              : battle.player1.uid;

          // ======================================================
          // 8. VALIDATE ENTRY
          // ======================================================

          const entry =
            validateBattleEntry(
              battle.entry
            );

          if (entry === null) {

            const error =
              new Error(
                "Battle contains an invalid entry amount."
              );

            error.statusCode = 500;

            throw error;
          }

          // ======================================================
          // 9. SERVER-SIDE MONEY CALCULATION
          // ======================================================

          const money =
            calculateBattleMoney(
              entry
            );

          const totalPot =
            money.totalPot;

          const platformFee =
            money.platformFee;

          const winnerPrize =
            money.winnerPrize;

          // ======================================================
          // 10. SANITY CHECK
          // ======================================================

          if (
            totalPot !==
              entry * 2 ||
            platformFee < 0 ||
            winnerPrize <= 0 ||
            winnerPrize + platformFee !==
              totalPot
          ) {

            const error =
              new Error(
                "Battle money calculation failed."
              );

            error.statusCode = 500;

            throw error;
          }

          // ======================================================
          // 11. CREATE UNIQUE PAYOUT TRANSACTION ID
          // ======================================================

          const payoutTransactionId =
            "PAYOUT-" +
            crypto
              .randomBytes(16)
              .toString("hex");

          // ======================================================
          // 12. ATOMIC WINNER WALLET CREDIT
          // ======================================================
          //
          // winner.winningBalance += winnerPrize
          //
          // This happens INSIDE the MongoDB transaction.
          // ======================================================

          const updatedWinner =
            await User.findOneAndUpdate(
              {
                uid:
                  winnerUid
              },

              {
                $inc: {
                  winningBalance:
                    winnerPrize,

                  gamesPlayed:
                    1,

                  gamesWon:
                    1
                },

                $setOnInsert: {
                  uid:
                    winnerUid,

                  cashBalance:
                    0,

                  winningBalance:
                    winnerPrize,

                  gamesPlayed:
                    1,

                  gamesWon:
                    1,

                  createdAt:
                    new Date()
                }
              },

              {
                new: true,

                upsert: true,

                session,

                setDefaultsOnInsert:
                  true,

                runValidators:
                  true
              }
            );

          if (!updatedWinner) {

            const error =
              new Error(
                "Unable to credit winner wallet."
              );

            error.statusCode = 500;

            throw error;
          }

          // ======================================================
          // 13. UPDATE LOSER STATS
          // ======================================================

          const updatedLoser =
            await User.findOneAndUpdate(
              {
                uid:
                  loserUid
              },

              {
                $inc: {
                  gamesPlayed:
                    1
                },

                $setOnInsert: {
                  uid:
                    loserUid,

                  cashBalance:
                    0,

                  winningBalance:
                    0,

                  gamesPlayed:
                    1,

                  gamesWon:
                    0,

                  createdAt:
                    new Date()
                }
              },

              {
                new: true,

                upsert: true,

                session,

                setDefaultsOnInsert:
                  true,

                runValidators:
                  true
              }
            );

          if (!updatedLoser) {

            const error =
              new Error(
                "Unable to update loser statistics."
              );

            error.statusCode = 500;

            throw error;
          }

          // ======================================================
          // 14. CREATE WIN TRANSACTION HISTORY
          // ======================================================

          await Transaction.create(
            [
              {
                uid:
                  winnerUid,

                description:
                  `Battle Won - Room ${roomCode}`,

                coins:
                  winnerPrize,

                type:
                  "BATTLE_WIN",

                battleId:
                  battle.battleId,

                createdAt:
                  new Date()
              }
            ],
            {
              session
            }
          );

          // ======================================================
          // 15. UPDATE BATTLE MONEY
          // ======================================================

          battle.totalPot =
            totalPot;

          battle.platformFee =
            platformFee;

          battle.winnerPrize =
            winnerPrize;

          // ======================================================
          // 16. FINAL BATTLE STATE
          // ======================================================

          battle.status =
            "FINISHED";

          battle.winnerUid =
            winnerUid;

          battle.payoutStatus =
            "PAID";

          battle.payoutAmount =
            winnerPrize;

          battle.payoutTransactionId =
            payoutTransactionId;

          battle.settlementRequestId =
            settlementRequestId;

          battle.finishedAt =
            new Date();

          // ======================================================
          // 17. SAVE FINAL BATTLE
          // ======================================================

          await battle.save({
            session
          });

          // ======================================================
          // 18. RETURN RESULT
          // ======================================================

          settlementResult = {
            battle,

            duplicate:
              false
          };
        }
      );

      // ==========================================================
      // SUCCESS RESPONSE
      // ==========================================================

      return res.json({
        ok: true,

        duplicate:
          Boolean(
            settlementResult?.duplicate
          ),

        message:
          settlementResult?.duplicate
            ? "Battle was already settled."
            : "Battle finished and winner payout completed successfully.",

        settlement: {

          battleId:
            settlementResult.battle.battleId,

          roomCode:
            settlementResult.battle.roomCode,

          winnerUid:
            settlementResult.battle.winnerUid,

          totalPot:
            settlementResult.battle.totalPot,

          platformFee:
            settlementResult.battle.platformFee,

          winnerPrize:
            settlementResult.battle.winnerPrize,

          payoutAmount:
            settlementResult.battle.payoutAmount,

          payoutStatus:
            settlementResult.battle.payoutStatus,

          status:
            settlementResult.battle.status,

          payoutTransactionId:
            settlementResult.battle.payoutTransactionId,

          finishedAt:
            settlementResult.battle.finishedAt
        }
      });

    } catch (error) {

      // ==========================================================
      // ERROR LOG
      // ==========================================================

      console.error(
        "Battle settlement error:",
        error
      );

      // ==========================================================
      // DUPLICATE / UNIQUE INDEX CONFLICT
      // ==========================================================

      if (
        error?.code === 11000
      ) {

        return res.status(409).json({
          ok: false,

          error:
            "Settlement request conflict. The settlement may already have been processed."
        });
      }

      // ==========================================================
      // NORMAL ERROR
      // ==========================================================

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
          ok: false,

          error:
            error.statusCode
              ? error.message
              : "Unable to settle battle."
        });

    } finally {

      // ==========================================================
      // ALWAYS CLOSE SESSION
      // ==========================================================

      await session.endSession();
    }
  }
);

// ================================================================
// PAYMENT / UTR DEPOSIT
// ================================================================

app.post(
  "/api/payment/verify-qr",
  requireAuth,
  async (req, res) => {
    try {
      const uid =
        req.uid;

      const amount =
        Number(
          req.body?.amount
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Please enter a valid deposit amount."
        });
      }

      const cleanAmount =
        Math.round(
          amount * 100
        ) / 100;

      const rawUtr =
        req.body?.utrNumber;

      if (
        typeof rawUtr !==
        "string"
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "UTR number is required."
        });
      }

      const cleanUtr =
        rawUtr.trim();

      if (
        !/^\d{12}$/.test(
          cleanUtr
        )
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid UTR format. UTR must be exactly 12 digits."
        });
      }

      const existingDeposit =
        await Deposit.findOne({
          utrNumber:
            cleanUtr
        }).lean();

      if (
        existingDeposit
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "This UTR number has already been submitted."
        });
      }

      const newDeposit =
        await Deposit.create({
          uid,

          amount:
            cleanAmount,

          utrNumber:
            cleanUtr,

          status:
            "PENDING"
        });

      return res.json({
        ok: true,

        message:
          "Deposit request submitted successfully.",

        depositId:
          newDeposit._id
      });

    } catch (error) {
      console.error(
        "Verify QR error:",
        error
      );

      if (
        error?.code ===
        11000
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "This UTR number has already been submitted."
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
        typeof req.body?.password ===
        "string"
          ? req.body.password
          : "";

      if (!password) {
        return res.status(400).json({
          ok: false,
          error:
            "Admin password is required."
        });
      }

      const supplied =
        Buffer.from(
          password,
          "utf8"
        );

      const expected =
        Buffer.from(
          ADMIN_PASSWORD,
          "utf8"
        );

      let passwordMatches =
        false;

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

        token:
          adminToken,

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
          status:
            "PENDING"
        })
          .sort({
            createdAt: -1
          })
          .lean();

      return res.json({
        ok: true,
        requests
      });

    } catch (error) {
      console.error(
        "Pending deposits error:",
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
    const txId =
      typeof req.body?.txId ===
      "string"
        ? req.body.txId
        : "";

    if (
      !txId ||
      !mongoose.isValidObjectId(
        txId
      )
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
      let approvedAmount =
        0;

      await session.withTransaction(
        async () => {

          const deposit =
            await Deposit.findOneAndUpdate(
              {
                _id:
                  txId,

                status:
                  "PENDING"
              },

              {
                $set: {
                  status:
                    "APPROVED",

                  approvedAt:
                    new Date()
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

            error.statusCode =
              400;

            throw error;
          }

          const amount =
            Number(
              deposit.amount
            );

          if (
            !Number.isFinite(
              amount
            ) ||
            amount <= 0
          ) {
            const error =
              new Error(
                "Invalid deposit amount."
              );

            error.statusCode =
              400;

            throw error;
          }

          approvedAmount =
            amount;

          const user =
            await User.findOneAndUpdate(
              {
                uid:
                  deposit.uid
              },

              {
                $inc: {
                  cashBalance:
                    amount
                },

                $setOnInsert: {
                  uid:
                    deposit.uid,

                  winningBalance:
                    0,

                  gamesPlayed:
                    0,

                  gamesWon:
                    0,

                  createdAt:
                    new Date()
                }
              },

              {
                new: true,

                upsert: true,

                session,

                setDefaultsOnInsert:
                  true
              }
            );

          if (!user) {
            const error =
              new Error(
                "Unable to update user wallet."
              );

            error.statusCode =
              500;

            throw error;
          }

          await Transaction.create(
            [
              {
                uid:
                  deposit.uid,

                description:
                  `Wallet Deposit Approved (UTR: ${deposit.utrNumber})`,

                coins:
                  amount,

                type:
                  "DEPOSIT",

                battleId:
                  null,

                createdAt:
                  new Date()
              }
            ],
            {
              session
            }
          );
        }
      );

      return res.json({
        ok: true,

        message:
          "Deposit approved and wallet credited successfully.",

        amount:
          approvedAmount
      });

    } catch (error) {
      console.error(
        "Approve deposit error:",
        error
      );

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
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
      const txId =
        typeof req.body?.txId ===
        "string"
          ? req.body.txId
          : "";

      if (
        !txId ||
        !mongoose.isValidObjectId(
          txId
        )
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
            _id:
              txId,

            status:
              "PENDING"
          },

          {
            $set: {
              status:
                "REJECTED",

              rejectedAt:
                new Date()
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
        "Reject deposit error:",
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
// ADMIN - BATTLE LOOKUP
// ================================================================

app.get(
  "/api/admin/battles/:roomCode",
  requireAdmin,
  async (req, res) => {
    try {
      const roomCode =
        validateRoomCode(
          req.params.roomCode
        );

      if (!roomCode) {
        return res.status(400).json({
          ok: false,
          error:
            "Invalid room code."
        });
      }

      const battle =
        await Battle.findOne({
          roomCode
        }).lean();

      if (!battle) {
        return res.status(404).json({
          ok: false,
          error:
            "Battle not found."
        });
      }

      return res.json({
        ok: true,
        battle
      });

    } catch (error) {
      console.error(
        "Admin battle lookup error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to load battle."
      });
    }
  }
);

// ================================================================
// HEALTH CHECK
// ================================================================

app.get(
  "/api/health",
  async (req, res) => {
    const mongoReady =
      mongoose.connection.readyState ===
      1;

    return res.status(
      mongoReady
        ? 200
        : 503
    ).json({
      ok:
        mongoReady,

      service:
        "LUDOVERSE backend",

      status:
        mongoReady
          ? "running"
          : "database_unavailable",

      environment:
        NODE_ENV,

      database:
        mongoReady
          ? "connected"
          : "disconnected"
    });
  }
);

// ================================================================
// API 404
// ================================================================

app.use(
  "/api",
  (req, res) => {
    return res.status(404).json({
      ok: false,
      error:
        "API endpoint not found."
    });
  }
);

// ================================================================
// GLOBAL ERROR HANDLER
// ================================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (
      res.headersSent
    ) {
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
// GRACEFUL SHUTDOWN
// ================================================================

let server;

async function shutdown(
  signal
) {
  console.log(
    `${signal} received. Shutting down...`
  );

  if (server) {
    server.close(
      async () => {
        try {
          await mongoose.connection.close();

          console.log(
            "MongoDB connection closed."
          );

          process.exit(0);

        } catch (error) {
          console.error(
            "Shutdown error:",
            error
          );

          process.exit(1);
        }
      }
    );
  } else {
    await mongoose.connection.close();
    process.exit(0);
  }
}

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

// ================================================================
// START SERVER
// ================================================================

async function startServer() {
  try {
    await connectDatabase();

    server =
      app.listen(
        PORT,
        () => {
          console.log(
            "================================================"
          );

          console.log(
            "LUDOVERSE BACKEND"
          );

          console.log(
            `Environment: ${NODE_ENV}`
          );

          console.log(
            `Port: ${PORT}`
          );

          console.log(
            "MongoDB: Connected"
          );

          console.log(
            "Battle settlement: ENABLED"
          );

          console.log(
            "================================================"
          );
        }
      );

  } catch (error) {
    console.error(
      "Server startup failed:",
      error
    );

    process.exit(1);
  }
}

startServer();