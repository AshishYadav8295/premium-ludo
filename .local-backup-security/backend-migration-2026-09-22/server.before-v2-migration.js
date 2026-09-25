import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import crypto from "node:crypto";

import {
  cert,
  getApps,
  initializeApp
} from "firebase-admin/app";

import {
  getAuth
} from "firebase-admin/auth";

import {
  getDatabase
} from "firebase-admin/database";


/* =========================================================
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT || 3000);

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT_PATH is not configured."
  );
}

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    `Firebase service account file not found: ${serviceAccountPath}`
  );
}

const serviceAccount =
  JSON.parse(
    fs.readFileSync(
      serviceAccountPath,
      "utf8"
    )
  );


/* =========================================================
   FIREBASE ADMIN
========================================================= */

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential:
          cert(serviceAccount),

        databaseURL:
          "https://ludoverse-d4338-default-rtdb.firebaseio.com"
      });

const database =
  getDatabase(firebaseApp);

const firebaseAuth =
  getAuth(firebaseApp);


/* =========================================================
   EXPRESS
========================================================= */

const app =
  express();

app.disable("x-powered-by");

app.use(
  cors()
);

app.use(
  express.json({
    limit: "100kb"
  })
);


/* =========================================================
   CONSTANTS
========================================================= */

const HOME_POSITION =
  -1;

const FINISHED_POSITION =
  56;

const TRACK = [
  [6,1],
  [6,2],
  [6,3],
  [6,4],
  [6,5],

  [5,6],
  [4,6],
  [3,6],
  [2,6],
  [1,6],
  [0,6],

  [0,7],

  [0,8],
  [1,8],
  [2,8],
  [3,8],
  [4,8],
  [5,8],

  [6,9],
  [6,10],
  [6,11],
  [6,12],
  [6,13],
  [6,14],

  [7,14],

  [8,14],
  [8,13],
  [8,12],
  [8,11],
  [8,10],
  [8,9],

  [9,8],
  [10,8],
  [11,8],
  [12,8],
  [13,8],
  [14,8],

  [14,7],

  [14,6],
  [13,6],
  [12,6],
  [11,6],
  [10,6],
  [9,6],

  [8,5],
  [8,4],
  [8,3],
  [8,2],
  [8,1],
  [8,0],

  [7,0],

  [6,0]
];

const START = {
  red: 0,
  yellow: 26
};

const HOME = {
  red: [
    [7,1],
    [7,2],
    [7,3],
    [7,4],
    [7,5],
    [7,6]
  ],

  yellow: [
    [7,13],
    [7,12],
    [7,11],
    [7,10],
    [7,9],
    [7,8]
  ]
};

const SAFE = new Set([
  "2:6",
  "6:12",
  "8:2",
  "12:8",
  "6:1",
  "8:13"
]);


/* =========================================================
   HELPERS
========================================================= */

function cellKey(
  coordinate
) {
  return `${coordinate[0]}:${coordinate[1]}`;
}


function coordinateFor(
  color,
  position
) {
  position =
    Number(position);

  if (
    position < 0 ||
    position > FINISHED_POSITION
  ) {
    return null;
  }

  if (position <= 50) {
    return TRACK[
      (
        START[color] +
        position
      ) % 52
    ];
  }

  return (
    HOME[color][
      position - 51
    ] || null
  );
}


function createInitialTokens() {
  return {
    red: [
      {
        id: 0,
        position: HOME_POSITION,
        finished: false
      },
      {
        id: 1,
        position: HOME_POSITION,
        finished: false
      },
      {
        id: 2,
        position: HOME_POSITION,
        finished: false
      },
      {
        id: 3,
        position: HOME_POSITION,
        finished: false
      }
    ],

    yellow: [
      {
        id: 0,
        position: HOME_POSITION,
        finished: false
      },
      {
        id: 1,
        position: HOME_POSITION,
        finished: false
      },
      {
        id: 2,
        position: HOME_POSITION,
        finished: false
      },
      {
        id: 3,
        position: HOME_POSITION,
        finished: false
      }
    ]
  };
}


function isValidToken(
  token,
  number
) {
  if (!token) {
    return false;
  }

  if (
    Number(token.position) ===
    FINISHED_POSITION
  ) {
    return false;
  }

  if (
    Number(token.position) ===
    HOME_POSITION
  ) {
    return number === 6;
  }

  return (
    Number(token.position) +
      number <=
    FINISHED_POSITION
  );
}


function finishedCount(
  tokens,
  color
) {
  return tokens[color]
    .filter(
      token =>
        Number(token.position) ===
        FINISHED_POSITION
    )
    .length;
}


function getWinner(
  tokens
) {
  if (
    finishedCount(tokens, "red") ===
    4
  ) {
    return "red";
  }

  if (
    finishedCount(tokens, "yellow") ===
    4
  ) {
    return "yellow";
  }

  return null;
}


function otherColor(
  color
) {
  return color === "red"
    ? "yellow"
    : "red";
}


function validColor(
  color
) {
  return (
    color === "red" ||
    color === "yellow"
  );
}


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

async function requireAuth(
  req,
  res,
  next
) {
  try {
    const header =
      req.headers.authorization || "";

    if (
      !header.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        ok: false,
        error: "Authentication required."
      });
    }

    const idToken =
      header.slice(7).trim();

    if (!idToken) {
      return res.status(401).json({
        ok: false,
        error: "Authentication token missing."
      });
    }

    req.user =
      await firebaseAuth.verifyIdToken(
        idToken
      );

    next();

  } catch (error) {
    console.error(
      "Authentication failed:",
      error.message
    );

    return res.status(401).json({
      ok: false,
      error: "Invalid or expired authentication token."
    });
  }
}


/* =========================================================
   ROOM ACCESS
========================================================= */

async function getRoomForUser(
  roomCode,
  uid
) {
  const snapshot =
    await database
      .ref(`battles/${roomCode}`)
      .once("value");

  const battle =
    snapshot.val();

  if (!battle) {
    throw new Error(
      "Room not found."
    );
  }

  const players =
    battle.players || {};

  const player =
    players[uid];

  if (!player) {
    throw new Error(
      "You are not a player in this room."
    );
  }

  return {
    battle,
    player
  };
}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  (_req, res) => {
    res.json({
      ok: true,
      service:
        "LUDOVERSE backend"
    });
  }
);


/* =========================================================
   AUTHENTICATED FIREBASE TEST
========================================================= */

app.get(
  "/api/auth-check",
  requireAuth,
  async (req, res) => {
    res.json({
      ok: true,
      uid: req.user.uid
    });
  }
);


/* =========================================================
   SERVER AUTHORITATIVE DICE
========================================================= */

app.post(
  "/api/game/roll",
  requireAuth,
  async (req, res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    if (!roomCode) {
      return res.status(400).json({
        ok: false,
        error: "Room code is required."
      });
    }

    try {

      await getRoomForUser(
        roomCode,
        req.user.uid
      );

      const gameRef =
        database.ref(
          `games/${roomCode}`
        );

      const result =
        await gameRef.transaction(
          current => {

            if (!current) {
              return;
            }

            const players =
              current.players || {};

            let color = null;

            if (
              players.red?.uid ===
              req.user.uid
            ) {
              color = "red";
            }

            if (
              players.yellow?.uid ===
              req.user.uid
            ) {
              color = "yellow";
            }

            if (!validColor(color)) {
              return;
            }

            if (
              current.winner ||
              current.phase !== "roll" ||
              current.turn !== color
            ) {
              return;
            }

            const number =
              crypto.randomInt(1, 7);

            const sixCount =
              current.sixCount || {
                red: 0,
                yellow: 0
              };

            const currentSixes =
              Number(
                sixCount[color] || 0
              );

            /*
              Three consecutive sixes:
              the player loses the turn.
            */
            if (
              number === 6 &&
              currentSixes >= 2
            ) {
              const next =
                otherColor(color);

              return {
                ...current,

                dice: 6,

                diceRoll: {
                  id:
                    crypto.randomUUID(),

                  ownerUid:
                    req.user.uid,

                  color,

                  number: 6,

                  startedAt:
                    Date.now()
                },

                phase: "roll",

                turn: next,

                sixCount: {
                  ...sixCount,
                  [color]: 0
                },

                updatedAt:
                  Date.now()
              };
            }

            return {
              ...current,

              dice: number,

              diceRoll: {
                id:
                  crypto.randomUUID(),

                ownerUid:
                  req.user.uid,

                color,

                number,

                startedAt:
                  Date.now()
              },

              phase: "move",

              sixCount: {
                ...sixCount,
                [color]:
                  number === 6
                    ? currentSixes + 1
                    : 0
              },

              updatedAt:
                Date.now()
            };
          }
        );

      if (!result.committed) {
        return res.status(409).json({
          ok: false,
          error:
            "Dice roll was rejected because the game state changed."
        });
      }

      return res.json({
        ok: true,
        game:
          result.snapshot.val()
      });

    } catch (error) {

      console.error(
        "Roll failed:",
        error
      );

      return res.status(400).json({
        ok: false,
        error:
          error.message ||
          "Could not roll dice."
      });
    }
  }
);


/* =========================================================
   MOVE TOKEN
========================================================= */

app.post(
  "/api/game/move",
  requireAuth,
  async (req, res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    const tokenId =
      Number(
        req.body?.tokenId
      );

    if (
      !roomCode ||
      !Number.isInteger(tokenId) ||
      tokenId < 0 ||
      tokenId > 3
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Valid roomCode and tokenId are required."
      });
    }

    try {

      await getRoomForUser(
        roomCode,
        req.user.uid
      );

      const gameRef =
        database.ref(
          `games/${roomCode}`
        );

      const result =
        await gameRef.transaction(
          current => {

            if (!current) {
              return;
            }

            const players =
              current.players || {};

            let color = null;

            if (
              players.red?.uid ===
              req.user.uid
            ) {
              color = "red";
            }

            if (
              players.yellow?.uid ===
              req.user.uid
            ) {
              color = "yellow";
            }

            if (!validColor(color)) {
              return;
            }

            if (
              current.winner ||
              current.phase !== "move" ||
              current.turn !== color
            ) {
              return;
            }

            const number =
              Number(current.dice);

            if (
              !Number.isInteger(number) ||
              number < 1 ||
              number > 6
            ) {
              return;
            }

            const tokens = {
              red:
                (current.tokens?.red || [])
                  .map(token => ({
                    ...token
                  })),

              yellow:
                (current.tokens?.yellow || [])
                  .map(token => ({
                    ...token
                  }))
            };

            const movingToken =
              tokens[color][tokenId];

            if (
              !isValidToken(
                movingToken,
                number
              )
            ) {
              return;
            }

            const fromPosition =
              Number(
                movingToken.position
              );

            const toPosition =
              fromPosition ===
              HOME_POSITION
                ? 0
                : fromPosition + number;

            if (
              toPosition >
              FINISHED_POSITION
            ) {
              return;
            }

            movingToken.position =
              toPosition;

            movingToken.finished =
              toPosition ===
              FINISHED_POSITION;

            let captured = false;

            const coordinate =
              coordinateFor(
                color,
                toPosition
              );

            if (
              coordinate &&
              toPosition <= 50 &&
              !SAFE.has(
                cellKey(coordinate)
              )
            ) {

              const opponent =
                otherColor(color);

              const targetKey =
                cellKey(coordinate);

              tokens[opponent]
                .forEach(
                  opponentToken => {

                    const opponentPosition =
                      Number(
                        opponentToken.position
                      );

                    if (
                      opponentPosition >= 0 &&
                      opponentPosition <= 50
                    ) {

                      const opponentCoordinate =
                        coordinateFor(
                          opponent,
                          opponentPosition
                        );

                      if (
                        opponentCoordinate &&
                        cellKey(
                          opponentCoordinate
                        ) === targetKey
                      ) {

                        opponentToken.position =
                          HOME_POSITION;

                        opponentToken.finished =
                          false;

                        captured = true;
                      }
                    }
                  }
                );
            }

            const winner =
              getWinner(tokens);

            const finishedToken =
              toPosition ===
              FINISHED_POSITION;

            const extraTurn =
              number === 6 ||
              captured ||
              finishedToken;

            const nextTurn =
              winner
                ? color
                : extraTurn
                  ? color
                  : otherColor(color);

            const sixCount =
              current.sixCount || {
                red: 0,
                yellow: 0
              };

            const nextSixCount =
              number === 6
                ? (
                    captured
                      ? 0
                      : Number(
                          sixCount[color] || 0
                        )
                  )
                : 0;

            const moveId =
              `${color}-${tokenId}-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;

            const finalState = {
              ...current,

              tokens,

              finished: {
                red:
                  finishedCount(
                    tokens,
                    "red"
                  ),

                yellow:
                  finishedCount(
                    tokens,
                    "yellow"
                  )
              },

              dice: 0,

              phase:
                winner
                  ? "finished"
                  : "roll",

              turn:
                nextTurn,

              winner,

              sixCount: {
                ...sixCount,
                [color]:
                  nextSixCount
              },

              moveAnimation: {
                id: moveId,
                ownerUid:
                  req.user.uid,
                color,
                tokenId,
                fromPosition,
                toPosition,
                steps:
                  fromPosition ===
                  HOME_POSITION
                    ? 1
                    : number,
                startedAt:
                  Date.now() + 120,

                result: {
                  tokens,
                  finished: {
                    red:
                      finishedCount(
                        tokens,
                        "red"
                      ),
                    yellow:
                      finishedCount(
                        tokens,
                        "yellow"
                      )
                  },
                  phase:
                    winner
                      ? "finished"
                      : "roll",
                  turn: nextTurn,
                  winner,
                  sixCount: {
                    ...sixCount,
                    [color]:
                      nextSixCount
                  }
                }
              },

              updatedAt:
                Date.now()
            };

            return finalState;
          }
        );

      if (!result.committed) {
        return res.status(409).json({
          ok: false,
          error:
            "Move was rejected because the game state changed or the move is invalid."
        });
      }

      return res.json({
        ok: true,
        game:
          result.snapshot.val()
      });

    } catch (error) {

      console.error(
        "Move failed:",
        error
      );

      return res.status(400).json({
        ok: false,
        error:
          error.message ||
          "Could not move token."
      });
    }
  }
);


/* =========================================================
   RESTART GAME
========================================================= */

app.post(
  "/api/game/restart",
  requireAuth,
  async (req, res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    if (!roomCode) {
      return res.status(400).json({
        ok: false,
        error:
          "Room code is required."
      });
    }

    try {

      await getRoomForUser(
        roomCode,
        req.user.uid
      );

      const gameRef =
        database.ref(
          `games/${roomCode}`
        );

      const result =
        await gameRef.transaction(
          current => {

            if (!current) {
              return;
            }

            const players =
              current.players || {};

            const isPlayer =
              players.red?.uid ===
                req.user.uid ||
              players.yellow?.uid ===
                req.user.uid;

            if (!isPlayer) {
              return;
            }

            return {
              ...current,

              tokens:
                createInitialTokens(),

              finished: {
                red: 0,
                yellow: 0
              },

              dice: 0,

              diceRoll: null,

              moveAnimation: null,

              phase: "roll",

              turn: "red",

              winner: null,

              sixCount: {
                red: 0,
                yellow: 0
              },

              updatedAt:
                Date.now()
            };
          }
        );

      if (!result.committed) {
        return res.status(409).json({
          ok: false,
          error:
            "Game restart was rejected."
        });
      }

      return res.json({
        ok: true,
        game:
          result.snapshot.val()
      });

    } catch (error) {

      console.error(
        "Restart failed:",
        error
      );

      return res.status(400).json({
        ok: false,
        error:
          error.message ||
          "Could not restart game."
      });
    }
  }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, _req, res, _next) => {

    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      ok: false,
      error:
        "Internal server error."
    });
  }
);


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log(
      `LUDOVERSE backend running at http://127.0.0.1:${PORT}`
    );
  }
);
