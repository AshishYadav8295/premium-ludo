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
   GAME PLAYER / STATE HELPERS
   ========================================================= */

function getPlayerColorFromGame(current, uid){

  const players =
    current?.players || {};

  if(
    String(players.red || "") ===
    String(uid)
  ){
    return "red";
  }

  if(
    String(players.yellow || "") ===
    String(uid)
  ){
    return "yellow";
  }

  return null;
}


function buildInitialGame(
  roomCode,
  redUid,
  yellowUid
){

  return {
    roomCode,

    players:{
      red:redUid || null,
      yellow:yellowUid || null
    },

    tokens:
      createInitialTokens(),

    finished:{
      red:0,
      yellow:0
    },

    turn:"red",

    dice:0,

    diceRoll:null,

    phase:"roll",

    winner:null,

    sixCount:{
      red:0,
      yellow:0
    },

    moveAnimation:null,

    version:1,

    updatedAt:
      Date.now()
  };
}


/* =========================================================
   INITIALIZE GAME
   ========================================================= */

app.post(
  "/api/game/initialize",
  requireAuth,
  async (req,res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    if(!roomCode){
      return res.status(400).json({
        ok:false,
        error:"Room code is required."
      });
    }

    try{

      const {battle} =
        await getRoomForUser(
          roomCode,
          req.user.uid
        );

      const gameRef =
        database.ref(
          `games/${roomCode}`
        );

      const creatorUid =
        battle.creatorUid || null;

      const players =
        battle.players || {};

      let yellowUid = null;

      Object.keys(players).forEach(uid => {

        if(
          String(uid) !==
          String(creatorUid)
        ){
          yellowUid = uid;
        }

      });

      const result =
        await gameRef.transaction(
          current => {

            if(current){
              return current;
            }

            /*
              Only Player 1 / room creator creates
              the first game snapshot.
            */
            if(
              String(creatorUid || "") !==
              String(req.user.uid)
            ){
              return;
            }

            return buildInitialGame(
              roomCode,
              creatorUid,
              yellowUid
            );
          }
        );

      if(
        !result.committed &&
        !result.snapshot.exists()
      ){
        return res.status(409).json({
          ok:false,
          error:
            "Game could not be initialized."
        });
      }

      return res.json({
        ok:true,
        game:
          result.snapshot.val()
      });

    }catch(error){

      console.error(
        "Game initialization failed:",
        error
      );

      return res.status(400).json({
        ok:false,
        error:
          error.message ||
          "Could not initialize game."
      });
    }
  }
);


/* =========================================================
   SERVER AUTHORITATIVE DICE ROLL
   ========================================================= */

app.post(
  "/api/game/roll",
  requireAuth,
  async (req,res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    if(!roomCode){
      return res.status(400).json({
        ok:false,
        error:"Room code is required."
      });
    }

    try{

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

            if(!current){
              return;
            }

            const color =
              getPlayerColorFromGame(
                current,
                req.user.uid
              );

            if(!validColor(color)){
              return;
            }

            if(
              current.winner ||
              current.phase !== "roll" ||
              current.turn !== color
            ){
              return;
            }

            const number =
              crypto.randomInt(1,7);

            const sixCount =
              current.sixCount || {
                red:0,
                yellow:0
              };

            const now =
              Date.now();

            /*
              The backend publishes the rolling event.
              The result is NOT resolved here, so both
              clients can display the same dice animation.
            */
            return {
              ...current,

              dice:0,

              diceRoll:{
                id:
                  crypto.randomUUID(),

                ownerUid:
                  req.user.uid,

                color,

                number,

                startedAt:now,

                resolveAfter:
                  now + 900
              },

              phase:"rolling",

              updatedAt:now
            };
          }
        );

      if(!result.committed){
        return res.status(409).json({
          ok:false,
          error:
            "Dice roll was rejected because the game state changed."
        });
      }

      return res.json({
        ok:true,
        game:
          result.snapshot.val()
      });

    }catch(error){

      console.error(
        "Roll failed:",
        error
      );

      return res.status(400).json({
        ok:false,
        error:
          error.message ||
          "Could not roll dice."
      });
    }
  }
);


/* =========================================================
   RESOLVE DICE
   ========================================================= */

app.post(
  "/api/game/roll/resolve",
  requireAuth,
  async (req,res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    const rollId =
      String(
        req.body?.rollId || ""
      ).trim();

    if(
      !roomCode ||
      !rollId
    ){
      return res.status(400).json({
        ok:false,
        error:
          "Room code and rollId are required."
      });
    }

    try{

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

            if(!current){
              return;
            }

            const roll =
              current.diceRoll;

            /*
              Idempotent behaviour:
              if this roll has already been resolved,
              simply keep the current authoritative state.
            */
            if(
              !roll ||
              roll.id !== rollId ||
              current.phase !== "rolling"
            ){
              return current;
            }

            if(
              String(roll.ownerUid) !==
              String(req.user.uid)
            ){
              return;
            }

            const color =
              getPlayerColorFromGame(
                current,
                req.user.uid
              );

            if(!validColor(color)){
              return;
            }

            const number =
              Number(roll.number);

            if(
              !Number.isInteger(number) ||
              number < 1 ||
              number > 6
            ){
              return;
            }

            const sixCount =
              current.sixCount || {
                red:0,
                yellow:0
              };

            const currentSixes =
              Number(
                sixCount[color] || 0
              );

            const newSixes =
              number === 6
                ? currentSixes + 1
                : 0;

            const next =
              otherColor(color);

            /*
              Three consecutive sixes:
              lose the turn.
            */
            if(newSixes >= 3){

              return {
                ...current,

                dice:number,

                diceRoll:null,

                phase:"roll",

                turn:next,

                sixCount:{
                  ...sixCount,
                  [color]:0,
                  [next]:0
                },

                updatedAt:
                  Math.max(
                    Date.now(),
                    Number(
                      current.updatedAt || 0
                    ) + 1
                  )
              };
            }

            const tokens =
              current.tokens || {
                red:[],
                yellow:[]
              };

            const hasValidMove =
              (tokens[color] || [])
                .some(token =>
                  isValidToken(
                    token,
                    number
                  )
                );

            /*
              No legal token:
              6 => same player rolls again
              otherwise => opponent turn
            */
            if(!hasValidMove){

              return {
                ...current,

                dice:number,

                diceRoll:null,

                phase:"roll",

                turn:
                  number === 6
                    ? color
                    : next,

                sixCount:{
                  ...sixCount,

                  [color]:
                    number === 6
                      ? newSixes
                      : 0,

                  [next]:
                    number === 6
                      ? newSixes
                      : 0
                },

                updatedAt:
                  Math.max(
                    Date.now(),
                    Number(
                      current.updatedAt || 0
                    ) + 1
                  )
              };
            }

            return {
              ...current,

              dice:number,

              diceRoll:null,

              phase:"move",

              turn:color,

              sixCount:{
                ...sixCount,
                [color]:newSixes
              },

              updatedAt:
                Math.max(
                  Date.now(),
                  Number(
                    current.updatedAt || 0
                  ) + 1
                )
            };
          }
        );

      if(!result.committed){
        return res.status(409).json({
          ok:false,
          error:
            "Dice result could not be resolved."
        });
      }

      return res.json({
        ok:true,
        game:
          result.snapshot.val()
      });

    }catch(error){

      console.error(
        "Dice resolution failed:",
        error
      );

      return res.status(400).json({
        ok:false,
        error:
          error.message ||
          "Could not resolve dice."
      });
    }
  }
);


/* =========================================================
   AUTHORITATIVE TOKEN MOVE
   ========================================================= */

app.post(
  "/api/game/move",
  requireAuth,
  async (req,res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    const tokenId =
      Number(
        req.body?.tokenId
      );

    if(
      !roomCode ||
      !Number.isInteger(tokenId) ||
      tokenId < 0 ||
      tokenId > 3
    ){
      return res.status(400).json({
        ok:false,
        error:
          "Valid roomCode and tokenId are required."
      });
    }

    try{

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

            if(!current){
              return;
            }

            const color =
              getPlayerColorFromGame(
                current,
                req.user.uid
              );

            if(!validColor(color)){
              return;
            }

            if(
              current.winner ||
              current.phase !== "move" ||
              current.turn !== color
            ){
              return;
            }

            const number =
              Number(current.dice);

            if(
              !Number.isInteger(number) ||
              number < 1 ||
              number > 6
            ){
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

            if(
              !isValidToken(
                movingToken,
                number
              )
            ){
              return;
            }

            const fromPosition =
              Number(
                movingToken.position
              );

            /*
              Preserve the existing HOME-token
              visual ordering behaviour.
            */
            const homeTokensBeforeMove =
              tokens[color]
                .filter(token =>
                  Number(token.position) ===
                  HOME_POSITION
                )
                .sort(
                  (a,b) =>
                    Number(a.id) -
                    Number(b.id)
                );

            const fromHomeIndex =
              fromPosition === HOME_POSITION
                ? Math.max(
                    0,
                    homeTokensBeforeMove.findIndex(
                      token =>
                        Number(token.id) ===
                        tokenId
                    )
                  )
                : null;

            const toPosition =
              fromPosition === HOME_POSITION
                ? 0
                : fromPosition + number;

            if(
              toPosition >
              FINISHED_POSITION
            ){
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

            /*
              Capture only happens on an unsafe
              outer-track cell.
            */
            if(
              coordinate &&
              toPosition <= 50 &&
              !SAFE.has(
                cellKey(coordinate)
              )
            ){

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

                    if(
                      opponentPosition >= 0 &&
                      opponentPosition <= 50
                    ){

                      const opponentCoordinate =
                        coordinateFor(
                          opponent,
                          opponentPosition
                        );

                      if(
                        opponentCoordinate &&
                        cellKey(
                          opponentCoordinate
                        ) === targetKey
                      ){

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

            const oldSixCount =
              current.sixCount || {
                red:0,
                yellow:0
              };

            const nextSixCount =
              number === 6
                ? (
                    captured
                      ? 0
                      : Number(
                          oldSixCount[color] || 0
                        )
                  )
                : 0;

            const finished = {
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
            };

            const steps =
              fromPosition === HOME_POSITION
                ? 1
                : number;

            const stepDuration =
              fromPosition === HOME_POSITION
                ? 420
                : 120;

            const duration =
              stepDuration * steps;

            const now =
              Date.now();

            const moveId =
              `${color}-${tokenId}-${now}-${crypto.randomUUID().slice(0,8)}`;

            const finalUpdatedAt =
              now +
              120 +
              duration +
              1;

            const resultState = {
              tokens,

              finished,

              dice:0,

              phase:
                winner
                  ? "finished"
                  : "roll",

              turn:nextTurn,

              winner,

              sixCount:{
                ...oldSixCount,
                [color]:
                  nextSixCount
              }
            };

            return {
              ...current,

              /*
                Destination state is stored immediately,
                but UI animation still shows the movement proxy.
              */
              tokens,

              finished,

              phase:"animating",

              dice:number,

              moveAnimation:{
                id:moveId,

                ownerUid:
                  req.user.uid,

                color,

                tokenId,

                fromPosition,

                fromHomeIndex,

                toPosition,

                steps,

                duration,

                startedAt:
                  now + 120,

                finalUpdatedAt,

                result:resultState
              },

              updatedAt:now
            };
          }
        );

      if(!result.committed){
        return res.status(409).json({
          ok:false,
          error:
            "Move was rejected because the game state changed or the move is invalid."
        });
      }

      return res.json({
        ok:true,
        game:
          result.snapshot.val()
      });

    }catch(error){

      console.error(
        "Move failed:",
        error
      );

      return res.status(400).json({
        ok:false,
        error:
          error.message ||
          "Could not move token."
      });
    }
  }
);


/* =========================================================
   COMPLETE MOVEMENT ANIMATION
   ========================================================= */

app.post(
  "/api/game/move/complete",
  requireAuth,
  async (req,res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    const moveId =
      String(
        req.body?.moveId || ""
      ).trim();

    if(
      !roomCode ||
      !moveId
    ){
      return res.status(400).json({
        ok:false,
        error:
          "Room code and moveId are required."
      });
    }

    try{

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

            if(!current){
              return;
            }

            const move =
              current.moveAnimation;

            /*
              Idempotent:
              if another client already completed
              this move, return current state.
            */
            if(
              !move ||
              move.id !== moveId
            ){
              return current;
            }

            const isOwner =
              String(move.ownerUid) ===
              String(req.user.uid);

            const elapsed =
              Date.now() -
              Number(
                move.startedAt || 0
              );

            /*
              Non-owner recovery is allowed only
              after the animation should have finished.
            */
            const recoveryAllowed =
              elapsed >=
              Math.max(
                0,
                Number(move.duration || 0)
              );

            if(
              !isOwner &&
              !recoveryAllowed
            ){
              return;
            }

            const resultState =
              move.result;

            if(!resultState){
              return;
            }

            return {
              ...current,

              tokens:
                resultState.tokens,

              finished:
                resultState.finished,

              dice:
                Number(
                  resultState.dice || 0
                ),

              phase:
                resultState.phase,

              turn:
                resultState.turn,

              winner:
                resultState.winner,

              sixCount:
                resultState.sixCount,

              moveAnimation:null,

              updatedAt:
                Math.max(
                  Date.now(),
                  Number(
                    move.finalUpdatedAt || 0
                  ),
                  Number(
                    current.updatedAt || 0
                  ) + 1
                )
            };
          }
        );

      if(!result.committed){

        const snapshot =
          result.snapshot.val();

        if(
          snapshot &&
          !snapshot.moveAnimation
        ){
          return res.json({
            ok:true,
            game:snapshot
          });
        }

        return res.status(409).json({
          ok:false,
          error:
            "Move completion was rejected."
        });
      }

      return res.json({
        ok:true,
        game:
          result.snapshot.val()
      });

    }catch(error){

      console.error(
        "Move completion failed:",
        error
      );

      return res.status(400).json({
        ok:false,
        error:
          error.message ||
          "Could not complete move."
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
  async (req,res) => {

    const roomCode =
      String(
        req.body?.roomCode || ""
      ).trim();

    if(!roomCode){
      return res.status(400).json({
        ok:false,
        error:
          "Room code is required."
      });
    }

    try{

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

            if(!current){
              return;
            }

            const color =
              getPlayerColorFromGame(
                current,
                req.user.uid
              );

            if(!validColor(color)){
              return;
            }

            const fresh =
              buildInitialGame(
                roomCode,
                current.players?.red || null,
                current.players?.yellow || null
              );

            fresh.version =
              Number(
                current.version || 1
              ) + 1;

            return fresh;
          }
        );

      if(!result.committed){
        return res.status(409).json({
          ok:false,
          error:
            "Game restart was rejected."
        });
      }

      return res.json({
        ok:true,
        game:
          result.snapshot.val()
      });

    }catch(error){

      console.error(
        "Restart failed:",
        error
      );

      return res.status(400).json({
        ok:false,
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
