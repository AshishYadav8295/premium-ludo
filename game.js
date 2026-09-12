import {
    auth,
    database,
    ref,
    get,
    set,
    update,
    onValue,
    onAuthStateChanged
} from "./firebase.js";

"use strict";


/* =========================================================
   LUDOVERSE
   FIREBASE 2-PLAYER MULTIPLAYER GAME

   Player 1 = RED
   Player 2 = YELLOW

   This file handles ONLY the Ludo game state.
   ========================================================= */


/* =========================================================
   DOM
   ========================================================= */

const board =
    document.getElementById("board");

const dice =
    document.getElementById("dice");

const rollBtn =
    document.getElementById("rollBtn");

const restartBtn =
    document.getElementById("restartBtn");

const soundBtn =
    document.getElementById("soundBtn");

const turnBox =
    document.getElementById("turnBox");

const status =
    document.getElementById("status");

const userScore =
    document.getElementById("userScore");

const aiScore =
    document.getElementById("aiScore");

const celebration =
    document.getElementById("celebration");

const winTitle =
    document.getElementById("winTitle");

const winText =
    document.getElementById("winText");


/* =========================================================
   ROOM
   ========================================================= */

const roomCode =
    new URLSearchParams(
        window.location.search
    ).get("room");


/* =========================================================
   GAME CONSTANTS
   ========================================================= */

const HOME = -1;

/*
   0 - 51 = main track
   52 - 56 = home lane
   56 = finished
*/

const FINISHED = 56;


/* =========================================================
   15 x 15 BOARD TRACK
   ========================================================= */

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


/* =========================================================
   PLAYER START POSITIONS
   ========================================================= */

const START = {

    red: 0,

    yellow: 26

};


/* =========================================================
   HOME LANES
   ========================================================= */

const HOME_PATH = {

    red: [
        [7,2],
        [7,3],
        [7,4],
        [7,5],
        [7,6]
    ],

    yellow: [
        [7,12],
        [7,11],
        [7,10],
        [7,9],
        [7,8]
    ]

};


/* =========================================================
   SAFE CELLS
   ========================================================= */

const SAFE = new Set([

    "2,6",
    "6,12",
    "8,2",
    "12,8",
    "6,1",
    "8,13"

]);


/* =========================================================
   BOARD STORAGE
   ========================================================= */

const cells = {};

const homeSlots = {

    red: [],

    green: [],

    blue: [],

    yellow: []

};


/* =========================================================
   TOKEN DOM
   ========================================================= */

const tokens = {

    red: [],

    yellow: []

};


/* =========================================================
   MULTIPLAYER STATE
   ========================================================= */

let currentUser = null;

let role = null;

let state = null;

let busy = false;

let soundOn = true;

let unsubscribeGame = null;


/* =========================================================
   HELPERS
   ========================================================= */

const sleep = ms =>
    new Promise(
        resolve => setTimeout(resolve, ms)
    );


function cellKey(row, col) {

    return `${row},${col}`;

}


function isSafe(row, col) {

    return SAFE.has(
        cellKey(row, col)
    );

}


function nextPlayer(color) {

    return color === "red"
        ? "yellow"
        : "red";

}


/* =========================================================
   BOARD MARKERS
   ========================================================= */

function addMarker(
    row,
    col,
    text,
    className,
    color
) {

    const marker =
        document.createElement("span");

    marker.className =
        className;

    marker.textContent =
        text;

    if (color) {

        marker.style.color =
            color;

    }

    if (cells[cellKey(row, col)]) {

        cells[
            cellKey(row, col)
        ].appendChild(marker);

    }

}


/* =========================================================
   CREATE HOME BASE
   ========================================================= */

function addBase(color) {

    const base =
        document.createElement("div");

    base.className =
        `base ${color}`;


    const inner =
        document.createElement("div");

    inner.className =
        "home-inner";


    for (let i = 0; i < 4; i++) {

        const slot =
            document.createElement("div");

        slot.className =
            `home-slot ${color}`;


        inner.appendChild(slot);

        homeSlots[color].push(slot);

    }


    base.appendChild(inner);

    board.appendChild(base);

}


/* =========================================================
   CREATE 15 x 15 BOARD
   ========================================================= */

function createBoard() {

    board.innerHTML = "";


    Object.keys(homeSlots)
        .forEach(color => {

            homeSlots[color] = [];

        });


    for (
        let row = 0;
        row < 15;
        row++
    ) {

        for (
            let col = 0;
            col < 15;
            col++
        ) {

            const cell =
                document.createElement("div");

            cell.className =
                "cell";

            cell.dataset.row =
                row;

            cell.dataset.col =
                col;


            board.appendChild(cell);


            cells[
                cellKey(row, col)
            ] = cell;

        }

    }


    /* RED LANE */

    for (
        let col = 1;
        col <= 6;
        col++
    ) {

        cells[
            cellKey(7, col)
        ].classList.add(
            "lane-red"
        );

    }


    /* GREEN LANE */

    for (
        let row = 1;
        row <= 6;
        row++
    ) {

        cells[
            cellKey(row, 7)
        ].classList.add(
            "lane-green"
        );

    }


    /* YELLOW LANE */

    for (
        let col = 8;
        col <= 13;
        col++
    ) {

        cells[
            cellKey(7, col)
        ].classList.add(
            "lane-yellow"
        );

    }


    /* BLUE LANE */

    for (
        let row = 8;
        row <= 13;
        row++
    ) {

        cells[
            cellKey(row, 7)
        ].classList.add(
            "lane-blue"
        );

    }


    /* START CELLS */

    [
        [6,1,"start-red"],
        [1,8,"start-green"],
        [8,13,"start-yellow"],
        [13,6,"start-blue"]

    ].forEach(
        ([row, col, className]) => {

            cells[
                cellKey(row, col)
            ].classList.add(
                className
            );

        }
    );


    /* FOUR BASES */

    [
        "red",
        "green",
        "blue",
        "yellow"

    ].forEach(addBase);


    /* SAFE STARS */

    addMarker(
        2,
        6,
        "★",
        "star",
        "var(--red)"
    );

    addMarker(
        6,
        12,
        "★",
        "star",
        "var(--green)"
    );

    addMarker(
        8,
        2,
        "★",
        "star",
        "var(--blue)"
    );

    addMarker(
        12,
        8,
        "★",
        "star",
        "#d0a900"
    );


    /* ARROWS */

    addMarker(
        7,
        0,
        "→",
        "arrow",
        "var(--red)"
    );

    addMarker(
        0,
        7,
        "↓",
        "arrow",
        "var(--green)"
    );

    addMarker(
        7,
        14,
        "←",
        "arrow",
        "#c99d00"
    );

    addMarker(
        14,
        7,
        "↑",
        "arrow",
        "var(--blue)"
    );


    /* CENTER */

    const center =
        document.createElement("div");

    center.className =
        "center-piece";


    [
        "red",
        "green",
        "yellow",
        "blue"

    ].forEach(color => {

        const triangle =
            document.createElement("div");

        triangle.className =
            `center-triangle ${color}`;

        center.appendChild(
            triangle
        );

    });


    const trophy =
        document.createElement("div");

    trophy.className =
        "center-trophy";

    trophy.textContent =
        "🏆";

    center.appendChild(
        trophy
    );

    board.appendChild(
        center
    );

}


/* =========================================================
   CREATE PLAYER TOKENS
   ========================================================= */

function createTokens() {

    document
        .querySelectorAll(".token")
        .forEach(
            element =>
                element.remove()
        );


    tokens.red = [];

    tokens.yellow = [];


    for (
        const color of
        ["red", "yellow"]
    ) {

        for (
            let index = 0;
            index < 4;
            index++
        ) {

            const token =
                document.createElement("button");

            token.type =
                "button";

            token.className =
                `token ${color}`;

            token.dataset.color =
                color;

            token.dataset.index =
                String(index);

            token.setAttribute(
                "aria-label",
                `${color} token ${index + 1}`
            );


            token.addEventListener(
                "click",
                () => {

                    moveToken(
                        color,
                        index
                    );

                }
            );


            tokens[color].push(
                token
            );

        }

    }

}


/* =========================================================
   GET TOKEN VALUE
   ========================================================= */

function getTokenValue(
    color,
    index
) {

    return Number(
        state?.tokens?.[color]?.[index]
        ?? HOME
    );

}


/* =========================================================
   GET TOKEN COORDINATE
   ========================================================= */

function getCoordinate(
    color,
    value
) {

    if (
        value === HOME ||
        value === undefined ||
        value === null
    ) {

        return null;

    }


    if (
        value >= 52
    ) {

        return (
            HOME_PATH[color][
                value - 52
            ] || null
        );

    }


    if (
        value >= 0 &&
        value < TRACK.length
    ) {

        return TRACK[
            (
                START[color] +
                value
            ) % TRACK.length
        ];

    }


    return null;

}


/* =========================================================
   CHECK VALID MOVE
   ========================================================= */

function canMove(
    color,
    index
) {

    if (!state) {

        return false;

    }


    if (
        state.turn !== color
    ) {

        return false;

    }


    if (
        state.phase !== "move"
    ) {

        return false;

    }


    const value =
        getTokenValue(
            color,
            index
        );


    if (
        value === FINISHED
    ) {

        return false;

    }


    const number =
        Number(
            state.dice || 0
        );


    if (!number) {

        return false;

    }


    /* HOME TOKEN */

    if (
        value === HOME
    ) {

        return number === 6;

    }


    /* NORMAL TOKEN */

    return (
        value + number <= FINISHED
    );

}


/* =========================================================
   GET TOKENS ON SAME CELL
   ========================================================= */

function tokensAt(
    row,
    col
) {

    const result = [];


    for (
        const color of
        ["red", "yellow"]
    ) {

        for (
            let index = 0;
            index < 4;
            index++
        ) {

            const position =
                getCoordinate(
                    color,
                    getTokenValue(
                        color,
                        index
                    )
                );


            if (
                position &&
                position[0] === row &&
                position[1] === col
            ) {

                result.push({
                    color,
                    index
                });

            }

        }

    }


    return result;

}


/* =========================================================
   PLACE TOKEN
   ========================================================= */

function placeToken(
    token,
    row,
    col,
    indexInGroup,
    groupSize
) {

    const cell =
        cells[
            cellKey(row, col)
        ];


    if (!cell) {

        return;

    }


    cell.appendChild(
        token
    );


    const offsets = [

        [0,0],

        [-10,-10],

        [10,-10],

        [-10,10],

        [10,10]

    ];


    const offset =
        groupSize > 1
            ? (
                offsets[
                    indexInGroup
                ] || offsets[0]
            )
            : offsets[0];


    token.style.left =
        `calc(50% + ${offset[0]}%)`;

    token.style.top =
        `calc(50% + ${offset[1]}%)`;

}


/* =========================================================
   RENDER TOKENS
   ========================================================= */

function renderTokens() {

    if (!state) {

        return;

    }


    /* FIRST: PUT HOME TOKENS */

    for (
        const color of
        ["red", "yellow"]
    ) {

        for (
            let index = 0;
            index < 4;
            index++
        ) {

            const token =
                tokens[color][index];

            const value =
                getTokenValue(
                    color,
                    index
                );


            token.classList.remove(
                "selectable",
                "moving",
                "capture-pop",
                "finish-pop"
            );


            if (
                value === FINISHED
            ) {

                token.style.display =
                    "none";

                continue;

            }


            token.style.display =
                "block";


            if (
                value === HOME
            ) {

                const slot =
                    homeSlots[color][
                        index
                    ];


                if (slot) {

                    slot.appendChild(
                        token
                    );

                    token.style.left =
                        "11%";

                    token.style.top =
                        "11%";

                }

            }

        }

    }


    /* GROUP TOKENS ON BOARD */

    const groups = {};


    for (
        const color of
        ["red", "yellow"]
    ) {

        for (
            let index = 0;
            index < 4;
            index++
        ) {

            const value =
                getTokenValue(
                    color,
                    index
                );


            const position =
                getCoordinate(
                    color,
                    value
                );


            if (!position) {

                continue;

            }


            const key =
                cellKey(
                    position[0],
                    position[1]
                );


            if (!groups[key]) {

                groups[key] = [];

            }


            groups[key].push({
                color,
                index
            });

        }

    }


    Object.entries(
        groups
    ).forEach(
        ([key, group]) => {

            const [
                row,
                col
            ] =
                key
                    .split(",")
                    .map(Number);


            group.forEach(
                (
                    item,
                    groupIndex
                ) => {

                    const token =
                        tokens[
                            item.color
                        ][
                            item.index
                        ];


                    placeToken(
                        token,
                        row,
                        col,
                        groupIndex,
                        group.length
                    );


                    if (
                        item.color === role &&
                        canMove(
                            item.color,
                            item.index
                        )
                    ) {

                        token.classList.add(
                            "selectable"
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   RENDER GAME UI
   ========================================================= */

function render() {

    if (!state) {

        return;

    }


    const myTurn =
        state.turn === role;


    /* TURN */

    if (
        state.turn === "red"
    ) {

        turnBox.innerHTML =
            "🔴 You<small>Your Turn</small>";

    } else {

        turnBox.innerHTML =
            "🟡 Player 2<small>Opponent's Turn</small>";

    }


    /* DICE */

    const faces = {

        1: "⚀",
        2: "⚁",
        3: "⚂",
        4: "⚃",
        5: "⚄",
        6: "⚅"

    };


    dice.textContent =
        state.dice
            ? faces[state.dice]
            : "🎲";


    /* SCORE */

    userScore.textContent =
        `${state.finished?.red || 0} / 4`;

    aiScore.textContent =
        `${state.finished?.yellow || 0} / 4`;


    /* MESSAGE */

    if (
        state.winner
    ) {

        status.textContent =
            state.winner === role
                ? "🎉 You won the match!"
                : "🏆 Player 2 won the match!";

    }

    else if (!myTurn) {

        status.textContent =
            "⏳ Waiting for the other player...";

    }

    else if (
        state.phase === "roll"
    ) {

        status.textContent =
            "🎲 Your turn! Roll the dice.";

    }

    else {

        status.textContent =
            "👇 Select a glowing token.";

    }


    /* ROLL BUTTON */

    rollBtn.disabled =
        busy ||
        !myTurn ||
        state.phase !== "roll" ||
        Boolean(state.winner);


    /* TOKEN DISPLAY */

    renderTokens();


    /* WIN SCREEN */

    if (
        state.winner
    ) {

        if (
            state.winner === role
        ) {

            winTitle.textContent =
                "🎉 Congratulations!";

            winText.textContent =
                "You brought all four tokens home!";

        }

        else {

            winTitle.textContent =
                "🏆 Player 2 Won!";

            winText.textContent =
                "The other player brought all four tokens home first.";

        }


        celebration.style.display =
            "grid";

    }

    else {

        celebration.style.display =
            "none";

    }

}


/* =========================================================
   SIMPLE SOUND
   ========================================================= */

function playSound(type) {

    if (!soundOn) {

        return;

    }


    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext) {

            return;

        }


        const context =
            new AudioContext();


        const oscillator =
            context.createOscillator();


        const gain =
            context.createGain();


        oscillator.connect(gain);

        gain.connect(
            context.destination
        );


        const frequency =
            type === "capture"
                ? 110
                : type === "win"
                    ? 700
                    : 420;


        oscillator.frequency.value =
            frequency;


        gain.gain.value =
            0.08;


        oscillator.start();


        oscillator.stop(
            context.currentTime + 0.12
        );

    }

    catch (_) {}

}


/* =========================================================
   CAPTURE
   ========================================================= */

function captureOpponent(
    tokenData,
    color,
    position
) {

    if (
        position < 0 ||
        position >= 52
    ) {

        return false;

    }


    const landed =
        getCoordinate(
            color,
            position
        );


    if (!landed) {

        return false;

    }


    if (
        isSafe(
            landed[0],
            landed[1]
        )
    ) {

        return false;

    }


    const opponent =
        nextPlayer(color);


    let captured = false;


    for (
        let index = 0;
        index < 4;
        index++
    ) {

        const opponentPosition =
            tokenData[
                opponent
            ][index];


        if (
            opponentPosition < 0 ||
            opponentPosition >= 52
        ) {

            continue;

        }


        const opponentCell =
            getCoordinate(
                opponent,
                opponentPosition
            );


        if (
            opponentCell &&
            opponentCell[0] === landed[0] &&
            opponentCell[1] === landed[1]
        ) {

            tokenData[
                opponent
            ][index] = HOME;


            captured = true;

        }

    }


    return captured;

}


/* =========================================================
   ROLL DICE
   ========================================================= */

async function rollDice() {

    if (
        !state ||
        busy ||
        state.winner ||
        state.turn !== role ||
        state.phase !== "roll"
    ) {

        return;

    }


    busy = true;

    render();


    dice.classList.add(
        "rolling"
    );


    await sleep(500);


    const rolled =
        Math.floor(
            Math.random() * 6
        ) + 1;


    const faces = {

        1: "⚀",
        2: "⚁",
        3: "⚂",
        4: "⚃",
        5: "⚄",
        6: "⚅"

    };


    dice.textContent =
        faces[rolled];


    dice.classList.remove(
        "rolling"
    );


    playSound("roll");


    const possible =
        state.tokens[
            role
        ].some(
            (_, index) => {

                const value =
                    state.tokens[
                        role
                    ][index];


                if (
                    value === FINISHED
                ) {

                    return false;

                }


                if (
                    value === HOME
                ) {

                    return rolled === 6;

                }


                return (
                    value + rolled <=
                    FINISHED
                );

            }
        );


    const gameRef =
        ref(
            database,
            `games/${roomCode}`
        );


    const sixCount = {

        red:
            Number(
                state.sixCount?.red || 0
            ),

        yellow:
            Number(
                state.sixCount?.yellow || 0
            )

    };


    sixCount[role] =
        rolled === 6
            ? sixCount[role] + 1
            : 0;


    /* THREE SIXES */

    if (
        sixCount[role] >= 3
    ) {

        sixCount[role] = 0;


        await update(
            gameRef,
            {

                dice: 0,

                phase: "roll",

                turn:
                    nextPlayer(role),

                sixCount

            }
        );


        busy = false;

        return;

    }


    /* NO VALID MOVE */

    if (!possible) {

        await update(
            gameRef,
            {

                dice: 0,

                phase: "roll",

                turn:
                    rolled === 6
                        ? role
                        : nextPlayer(role),

                sixCount

            }
        );


        busy = false;

        return;

    }


    /* PLAYER MUST SELECT TOKEN */

    await update(
        gameRef,
        {

            dice: rolled,

            phase: "move",

            sixCount

        }
    );


    busy = false;

}


/* =========================================================
   MOVE TOKEN
   ========================================================= */

async function moveToken(
    color,
    index
) {

    if (
        busy ||
        !state ||
        color !== role ||
        state.turn !== role ||
        state.phase !== "move" ||
        !canMove(color, index)
    ) {

        return;

    }


    busy = true;


    const number =
        Number(state.dice);


    const tokenData = {

        red: [
            ...state.tokens.red
        ],

        yellow: [
            ...state.tokens.yellow
        ]

    };


    let newPosition =
        tokenData[
            color
        ][index];


    /* TOKEN LEAVES HOME */

    if (
        newPosition === HOME
    ) {

        newPosition = 0;

    }

    else {

        newPosition += number;

    }


    tokenData[
        color
    ][index] =
        newPosition;


    /* CAPTURE */

    const captured =
        captureOpponent(
            tokenData,
            color,
            newPosition
        );


    /* FINISHED COUNTS */

    const finished = {

        red:
            tokenData.red.filter(
                value =>
                    value === FINISHED
            ).length,

        yellow:
            tokenData.yellow.filter(
                value =>
                    value === FINISHED
            ).length

    };


    /* WINNER */

    const winner =
        finished[color] === 4
            ? color
            : null;


    /* SIX COUNTER */

    const sixCount = {

        red:
            Number(
                state.sixCount?.red || 0
            ),

        yellow:
            Number(
                state.sixCount?.yellow || 0
            )

    };


    /*
       6 = extra turn
       capture = extra turn
    */

    let extraTurn =
        number === 6 ||
        captured;


    if (
        winner
    ) {

        extraTurn = false;

    }


    if (!extraTurn) {

        sixCount[color] = 0;

    }


    const gameRef =
        ref(
            database,
            `games/${roomCode}`
        );


    await update(
        gameRef,
        {

            tokens: tokenData,

            finished,

            winner,

            dice: 0,

            phase:
                winner
                    ? "over"
                    : "roll",

            turn:
                winner
                    ? color
                    : extraTurn
                        ? color
                        : nextPlayer(color),

            sixCount

        }
    );


    if (captured) {

        playSound(
            "capture"
        );

    }

    else {

        playSound(
            "move"
        );

    }


    busy = false;

}


/* =========================================================
   RESTART
   ========================================================= */

async function restartGame() {

    /*
       Only Player 1 can restart.
    */

    if (
        !state ||
        role !== "red"
    ) {

        status.textContent =
            "Only Player 1 can restart the match.";

        return;

    }


    busy = true;


    await update(
        ref(
            database,
            `games/${roomCode}`
        ),

        {

            tokens: {

                red: [
                    HOME,
                    HOME,
                    HOME,
                    HOME
                ],

                yellow: [
                    HOME,
                    HOME,
                    HOME,
                    HOME
                ]

            },


            finished: {

                red: 0,

                yellow: 0

            },


            turn: "red",

            dice: 0,

            phase: "roll",

            winner: null,


            sixCount: {

                red: 0,

                yellow: 0

            }

        }
    );


    celebration.style.display =
        "none";


    busy = false;

}


/* =========================================================
   HIDE CELEBRATION
   ========================================================= */

function hideCelebration() {

    celebration.style.display =
        "none";

}


/*
   Your current HTML has:
   onclick="resetGame();hideCelebration()"

   So expose these names globally.
*/

window.resetGame =
    restartGame;

window.hideCelebration =
    hideCelebration;


/* =========================================================
   BUTTONS
   ========================================================= */

rollBtn.addEventListener(
    "click",
    rollDice
);


restartBtn.addEventListener(
    "click",
    restartGame
);


if (soundBtn) {

    soundBtn.addEventListener(
        "click",
        () => {

            soundOn =
                !soundOn;


            soundBtn.textContent =
                soundOn
                    ? "🔊 Sound: ON"
                    : "🔇 Sound: OFF";

        }
    );

}


/* =========================================================
   INITIAL BOARD
   ========================================================= */

createBoard();

createTokens();


/* =========================================================
   FIREBASE AUTH
   ========================================================= */

onAuthStateChanged(
    auth,
    async user => {

        currentUser =
            user;


        if (!user) {

            status.textContent =
                "🔐 Please login first.";

            rollBtn.disabled =
                true;

            return;

        }


        try {

            await loadRoom();

        }

        catch (error) {

            console.error(
                "LUDOVERSE multiplayer error:",
                error
            );


            status.textContent =
                "❌ Could not load the multiplayer game.";

            rollBtn.disabled =
                true;

        }

    }
);


/* =========================================================
   LOAD ROOM
   ========================================================= */

async function loadRoom() {

    if (!roomCode) {

        status.textContent =
            "❌ No room code found in the URL.";

        rollBtn.disabled =
            true;

        return;

    }


    /* GET BATTLE */

    const battleSnapshot =
        await get(
            ref(
                database,
                `battles/${roomCode}`
            )
        );


    if (
        !battleSnapshot.exists()
    ) {

        status.textContent =
            "❌ Room not found in Firebase.";

        rollBtn.disabled =
            true;

        return;

    }


    const battle =
        battleSnapshot.val();


    const creatorUid =
        battle.creatorUid;


    const players =
        battle.players || {};


    /*
       CREATOR = PLAYER 1
       JOINED PLAYER = PLAYER 2
    */

    if (
        currentUser.uid ===
        creatorUid
    ) {

        role = "red";

    }

    else if (
        players[
            currentUser.uid
        ]
    ) {

        role = "yellow";

    }

    else {

        status.textContent =
            "❌ You are not a player in this room.";

        rollBtn.disabled =
            true;

        return;

    }


    /* GAME REFERENCE */

    const gameRef =
        ref(
            database,
            `games/${roomCode}`
        );


    const existing =
        await get(
            gameRef
        );


    /*
       PLAYER 1 creates initial
       shared game state.
    */

    if (
        !existing.exists() &&
        role === "red"
    ) {

        await set(
            gameRef,
            {

                roomCode,

                players: {

                    red:
                        creatorUid,

                    yellow:
                        null

                },


                tokens: {

                    red: [
                        HOME,
                        HOME,
                        HOME,
                        HOME
                    ],

                    yellow: [
                        HOME,
                        HOME,
                        HOME,
                        HOME
                    ]

                },


                finished: {

                    red: 0,

                    yellow: 0

                },


                turn: "red",

                dice: 0,

                phase: "roll",

                winner: null,


                sixCount: {

                    red: 0,

                    yellow: 0

                },


                createdAt:
                    Date.now()

            }
        );

    }


    /*
       REALTIME LISTENER
    */

    if (unsubscribeGame) {

        unsubscribeGame();

    }


    unsubscribeGame =
        onValue(
            gameRef,
            snapshot => {

                state =
                    snapshot.val();


                if (!state) {

                    status.textContent =
                        "⏳ Waiting for Player 1...";

                    return;

                }


                render();

            }
        );


    status.textContent =
        role === "red"
            ? "🔴 You are Player 1."
            : "🟡 You are Player 2.";

}