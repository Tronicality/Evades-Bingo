// ==UserScript==
// @name         Evades Bingo Client
// @namespace    https://github.com/Tronicality/Evades-Bingo
// @version      0.2.1
// @description  Evades bingo
// @author       Br1h
// @match        https://*.evades.io/*
// @match        https://*.evades.online/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=evades.io
// @run-at       document-start
// @downloadURL  https://raw.githubusercontent.com/Tronicality/Evades-Bingo/refs/heads/main/client.js
// @updateURL    https://raw.githubusercontent.com/Tronicality/Evades-Bingo/refs/heads/main/client.js
// @grant        none
// ==/UserScript==
'use strict';

/* TODO
- Security (not really tho)
- Add back rest of options
- Fix disconnect issue - hopfully fixed?
- Fix focus bug on settings menu - DEVS MADE IT LIKE THIS
- Fix end game
- Fix send run buttons?
- Fix board not resetting after game after creating new room
- Fix assignment of new admin
- /reset /warp upon clicking goal
- Fix not sending sometimes
- Fix make disconnects more lenient
- Fix area mismatch on multiple win areas
- Board shown on room join
- Bug with cybot ability and color mismatching (pp)?
- Auto send area
- Optimise finding specific run
*/

// ===== Global Variables =====
let win = typeof unsafeWindow === "undefined" ? window : unsafeWindow;
let miniBoardEl, bigBoardEl, tooltipEl, miniHoverArea, settingsStyle, self, state, heroes, hb;
let bingoSaveData = { board: [], lastSave: {} };
const LS_KEY = 'evbingo:settings';
const TEAMS = new Set(['red', 'green', 'blue', 'orange']);
const MESSAGE_TYPES = { // Fake Enum :sob:
    "DEFAULT": "default",
    "ROOM_INFO": "room",
    "ERROR": "error",
    "UNKNOWN": "unknown",
    "WINNER": "winner",
}
const CLIENT_MESSAGE_TYPES = {
    CREATE_ROOM: 'create_room',
    START_GAME: 'start_game',
    RESTART_GAME: 'restart_game',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    MAKE_MOVE: 'make_move',
    JOIN_TEAM: 'join_team',
    LEAVE_TEAM: 'leave_team',
    CHANGE_TEAM: 'change_team',
}
const SERVER_INFO_SCENES = { // Fake Enum :sob:
    NOT_CONNECTED: 'not_connected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    IN_ROOM: 'in_room',
    GAME_STARTED: 'game_started',
}

const REGIONS = {
    "Burning Bunker": 36,
    "Burning Bunker Hard": 36,
    "Central Core": 40,
    "Central Core Hard": 40,
    "Cyber Castle": 15,
    "Cyber Castle Hard": 22,
    "Catastrophic Core": 40,
    "Coupled Corridors": 64,
    "Dangerous District": 80,
    "Dangerous District Hard": 80,
    "Dusty Depths": 20,
    "Elite Expanse": 80,
    "Elite Expanse Hard": 80,
    /*
    "Endless Echo": 0,
    "Endless Echo Hard": 0,
    */
    "Frozen Fjord": 40,
    "Frozen Fjord Hard": 40,
    "Glacial Gorge": 40,
    "Glacial Gorge Hard": 40,
    "Grand Garden": 28,
    "Grand Garden Hard": 28,
    "Humongous Hollow": 80,
    "Humongous Hollow Hard": 80,
    "Haunted Halls": 16,
    "Haunted Halls Deep Woods": 25,
    "Infinite Inferno": 38,
    "Monumental Migration 120": 120,
    "Monumental Migration 480": 480,
    "Magnetic Monopole": 36,
    "Magnetic Monopole Dipole": 35,
    "Magnetic Monopole Hard": 36,
    "Magnetic Monopole Dipole Hard": 35,
    "Mysterious Mansion Hedge": 59, //Hat
    "Mysterious Mansion Liminal": 60,
    "Mysterious Mansion Attic": 61,
    "Mysterious Mansion Cryptic": 62, //Hero
    "Ominous Occult": 16,
    "Ominous Occult Hard": 16,
    "Peculiar Pyramid Inner": 29,
    "Peculiar Pyramid Perimeter": 31,
    "Peculiar Pyramid Inner Hard": 29,
    "Peculiar Pyramid Perimeter Hard": 31,
    "Quiet Quarry": 40,
    "Quiet Quarry Hard": 40,
    "Restless Ridge": 43,
    "Restless Ridge Hard": 47,
    "Shifting Sands": 47,
    "Toxic Territory": 20,
    "Toxic Territory Hard": 20,
    "Vicious Valley": 40,
    "Vicious Valley Hard": 40,
    "Wacky Wonderland": 80,
    "Wacky Wonderland Hard": 80,
    "Withering Wasteland": 40,
    "Terrifying Temple": 40,
    "Lonely Laboratory": 40,
    "Ancient Abyss": 40,
    "Vast Void": 50,
    "Pristine Purgatory": 20,
}

const MULTIPLE_WIN_REGIONS = { // Key: area number, Value: Specified map end point
    "Monumental Migration": {
        120: "Monumental Migration 120",
        480: "Monumental Migration 480"
    },
    "Magnetic Monopole": {
        35: "Magnetic Monopole Dipole",
        36: "Magnetic Monopole"
    },
    "Magnetic Monopole Hard": {
        35: "Magnetic Monopole Dipole Hard",
        36: "Magnetic Monopole Hard"
    },
    "Mysterious Mansion": {
        59: "Mysterious Mansion Hedge", //Hat
        60: "Mysterious Mansion Liminal",
        61: "Mysterious Mansion Attic",
        62: "Mysterious Mansion Cryptic" //Hero
    },
    "Peculiar Pyramid": {
        29: "Peculiar Pyramid Inner",
        31: "Peculiar Pyramid Perimeter"
    },
    "Peculiar Pyramid Hard": {
        29: "Peculiar Pyramid Inner Hard",
        31: "Peculiar Pyramid Perimeter Hard"
    },
    "Haunted Halls": {
        16: "Haunted Halls",
        25: "Haunted Halls Deep Woods"
    },
}

// ===== Utilities =====


function isPlayerAlive() {
    if (!self) return
    return self.deathTimer === -1
}

function getHeroColors() {
    try {
        let heroes = {}
        for (const obj of window.heroConfig) {
            heroes[obj.name] = window.getHeroColor(obj.name)
        }

        return heroes
    }
    catch (e) {
        // window.heroConfig doesn't exist
        console.warn("heroConfig doesn't exist: ", e.message)
        return {
            "Magmax": "#ff0000",
            "Rime":  "#3333ff", //"#3377ff",
            "Morfe": "#00dd00",
            "Aurora": "#ff7f00",
            "Necro": "#FF00FF",
            "Brute": "#9b5800",
            "Nexus": "#29FFC6",
            "Shade": "#826565",
            "Euclid": "#5e4d66",
            "Chrono": "#00b270",
            "Reaper":  "#424a59", //"#787b81",
            "Rameses": "#989b4a",
            "Jolt": "#e1e100",
            "Ghoul": "#bad7d8",
            "Cent": "#727272",
            "Jötunn": "#5cacff",
            "Candy": "#ff80bd",
            "Mirage": "#020fa2",
            "Boldrock": "#a18446",
            "Glob": "#14a300",
            "Magno": "#ff005d",
            "Ignis": "#cd501f",
            "Stella": "#fffa86",
            "Viola": "#d9b130",
            "Mortuus": "#7fb332",
            "Cybot": "#926be3",
            "Echelon": "#5786de",
            "Demona": "#7d3c9e",
            "Stheno": "#cfa6ec",
            "Factorb": "#6e391e",
            "Leono": "#820b0d",
            "Veydris": "#752656"
        }
    }
}

function clearLastSave() {
    bingoSaveData.lastSave = {};
}

function clearBingoSaveData() {
    bingoSaveData = { board: [], lastSave: {} };
}


// Server connection part

function handleServerMessage(message) {
    switch (message.type) {
        case 'registered':
            handleRegistered(message.data);
            break;
        case 'room_created':
            handleRoomCreation(message.data);
            break;
        case 'room_joined':
            handleRoomJoined(message.data);
            break;
        case 'left_room':
            handleLeftRoom(message.message);
            break;
        case 'game_started':
            handleGameStarted(message.data);
            break;
        case 'update_board':
            handleUpdateBoard(message.data);
            break;
        case 'game_ended':
            handleGameEnded(message.data);
            break;
        case 'player_left':
            showMessage(`Player ${message.data.user_id} left the room`);
            break;
        case 'new_admin':
            handleNewAdmin(message.data);
            break;
        case 'game_info':
            showMessage(message.message);
            break;
        case 'mark_attempt':
            showMessage(message.message);
            clearLastSave();
            break;
        case 'update_teams':
            handleUpdateTeams(message.data);
            break;
        case 'error': {
            const msg = `Error: ${message.message}`
            showMessage(msg, MESSAGE_TYPES.ERROR);
            console.error(msg);
            break;
        }
        default:
            showMessage(`Something broke! Check Console!`, MESSAGE_TYPES.ERROR);
            console.warn('Unknown message type:', message.type);
    }
}

function handleUpdateTeams(data) {
    showMessage('Teams have been updated');

    BingoClient.current.teams = data.teams;
    updateBingoTeams();
}

function handleNewAdmin(data) {
    showMessage(`New admin is: ${data.user_id}`);
    BingoClient.admin = data.user_id;
}

function handleGameEnded(data) {
    showMessage(`Game Ended!`);
    showMessage(`Winning is Team ${data.winner}`, MESSAGE_TYPES.WINNER);

    BingoClient.inBingoGame = false;
    updateServerInformation(SERVER_INFO_SCENES.IN_ROOM);
}

function handleUpdateBoard(data) {
    BingoClient.board[data.row][data.col] = data.cell;
    updateBoard(data.cell, data.row, data.col);

    showBingoBoardUI();
}

function handleGameStarted(data) {
    BingoClient.board = data.board;
    BingoClient.inBingoGame = true;

    if (BingoClient.hasBoardUI)
        updateWholeBoard();

    else
        addBingoBoardUI(BingoClient.board);

    showBingoBoardUI();

    clearBingoSaveData();
    createSaveDataReserves(data.board);
    updateServerInformation(SERVER_INFO_SCENES.GAME_STARTED);
}

function handleLeftRoom(message) {
    showMessage(message, MESSAGE_TYPES.ROOM_INFO);

    clearClient();
    updateServerInformation(SERVER_INFO_SCENES.CONNECTED);
}

function handleRoomJoined(data) {
    showMessage('Joined Room', MESSAGE_TYPES.ROOM_INFO);

    BingoClient.roomId = data.id;
    BingoClient.admin = data.admin;
    BingoClient.current.maxPlayerCount = data.max_player_count;
    BingoClient.current.boardSize = data.board.length;

    if (BingoClient.current.boardSize > 0)
        handleGameStarted(data)
    else {
        BingoClient.board = message.data.board;
        updateServerInformation(SERVER_INFO_SCENES.IN_ROOM);
    }
}

function handleRoomCreation(data) {
    showMessage(`Room created with ID: ${data.id}`);

    BingoClient.roomId = data.id;
    BingoClient.admin = BingoClient.userId;
    BingoClient.current.maxPlayerCount = BingoClient.settings.maxPlayerCount;
    BingoClient.current.boardSize = BingoClient.settings.boardSize;

    updateServerInformation(SERVER_INFO_SCENES.IN_ROOM);
}

function handleRegistered(data) {
    console.log(`Registered with ID: ${data.id}`);
    BingoClient.isConnected = true;

    updateServerInformation(SERVER_INFO_SCENES.CONNECTED);
}

function connectToServer() {
    if (!self) { showMessage('Please enter a server on evades'); return; }

    const server = 'wss://evades-bingo.onrender.com'; //'http://localhost:10000'
    const ws = new WebSocket(server);

    BingoClient.socket = ws;
    BingoClient.userId = self.name;

    ws.addEventListener('open', () => {
        showMessage('Connected to the server');
        hb = setInterval(()=> sendData('ping', Date.now()), 60 * 1000);
        ws.send(JSON.stringify({ type: 'register', data: { user_id: BingoClient.userId } }));
    });

    ws.addEventListener('message', (event) => {
        try {
            //sanitiseData(event.data)
            handleServerMessage(JSON.parse(event.data));
        }
        catch (e) { console.error('Bad WS message', e); showMessage("Something Broke! Check Console!", MESSAGE_TYPES.ERROR); }
    });

    ws.addEventListener('close', () => {
        showMessage('Disconnected from the server');

        clearInterval(hb);

        updateServerInformation(SERVER_INFO_SCENES.NOT_CONNECTED);

        clearClient();
        BingoClient.isConnected = false;
        BingoClient.socket = null;
    });
}

function disconnectFromServer() {
    if (BingoClient.socket) {
        BingoClient.socket.close();
    }
    else {
        showMessage('No active connection to disconnect');
        console.log('No active connection to disconnect');
    }
}

function clearClient() {
    BingoClient.maxPlayerCount = null;
    BingoClient.inBingoGame = false;
    BingoClient.boardSize = null;
    BingoClient.roomId = null;
    BingoClient.admin = null;
    BingoClient.team = null;
    BingoClient.teams = {};
    BingoClient.board = [];

    clearBingoSaveData();
    hideBingoBoardUI();
}

function sendData(type, data) {
    if (!BingoClient.socket) {
        showMessage("Not connected!", MESSAGE_TYPES.ERROR);
        return;
    }

    try {
        BingoClient.socket.send(JSON.stringify({ type: type, data: data }))
    } catch (error) {
        showMessage("Something Broke! Check console!", MESSAGE_TYPES.ERROR);
        console.error(error.message);
    }
}

function createRoom(team, maxPlayerCount) {
    sendData(CLIENT_MESSAGE_TYPES.CREATE_ROOM, { team: team, max_player_count: maxPlayerCount })
}

function joinRoom(roomId, team) {
    sendData(CLIENT_MESSAGE_TYPES.JOIN_ROOM, { room_id: roomId, team: team })
}

function leaveRoom(roomId) {
    sendData(CLIENT_MESSAGE_TYPES.LEAVE_ROOM, { room_id: roomId })
}

function startGame(roomId, boardSize) {
    sendData(CLIENT_MESSAGE_TYPES.START_GAME, { room_id: roomId, board_size: boardSize })
}

function restartGame(roomId, boardSize) {
    sendData(CLIENT_MESSAGE_TYPES.RESTART_GAME, { room_id: roomId, board_size: boardSize })
}

function makeMove(roomId, cell) {
    sendData(CLIENT_MESSAGE_TYPES.MAKE_MOVE, { room_id: roomId, cell: cell })
}

function joinTeam(roomId, team) {
    sendData(CLIENT_MESSAGE_TYPES.JOIN_TEAM, { room_id: roomId, team: team })
}

function leaveTeam(roomId, team) {
    sendData(CLIENT_MESSAGE_TYPES.LEAVE_TEAM, { room_id: roomId, team: team })
}

function changeTeam(roomId, team) {
    sendData(CLIENT_MESSAGE_TYPES.CHANGE_TEAM, { room_id: roomId, team: team })
}

window.BingoClient = {
    socket: null,
    userId: null,
    roomId: null,
    admin: null,
    isConnected: false,
    inBingoGame: false,
    hasBoardUI: false,
    isShowingBoard: false,
    board: [],
    settings: {
        maxPlayerCount: 8,
        boardSize: 3,
        team: 'red'
    },
    current: {
        maxPlayerCount: null,
        boardSize: null,
        team: null,
        teams: {},
        scene: SERVER_INFO_SCENES.NOT_CONNECTED,
    },
    bindings: {
        sendRecentRun: '-',
        sendAllRuns: '+',
        toggleBoardVisibility: '.',
    },

    connectToServer,
    disconnectFromServer,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    restartGame,
    joinTeam,
    leaveTeam,
    changeTeam,
    updateWholeBoard,
};

BingoClient.connectToServer = () => {
    showMessage('Connecting...');
    updateServerInformation(SERVER_INFO_SCENES.CONNECTING);

    connectToServer();
}

BingoClient.disconnectFromServer = () => {
    disconnectFromServer();
}

BingoClient.createRoom = () => {
    createRoom(BingoClient.settings.team, BingoClient.settings.maxPlayerCount);
}

BingoClient.joinRoom = () => {
    const roomId = prompt('Enter room ID');
    joinRoom(roomId, BingoClient.settings.team);
}

BingoClient.leaveRoom = () => {
    leaveRoom(BingoClient.roomId)
}

BingoClient.startGame = () => {
    startGame(BingoClient.roomId, BingoClient.current.boardSize);
}

BingoClient.restartGame = () => {
    restartGame(BingoClient.roomId, BingoClient.current.boardSize);
}

BingoClient.joinTeam = (newTeam) => {
    joinTeam(BingoClient.roomId, newTeam)
}

BingoClient.leaveTeam = () => {
    leaveTeam(BingoClient.roomId, BingoClient.current.team)
}

BingoClient.changeTeam = (newTeam) => {
    changeTeam(BingoClient.roomId, newTeam)
}

BingoClient.updateWholeBoard = () => {
    updateWholeBoard();
}

BingoClient.sendRecentRun = () => {
    showMessage("Sending Recent Run")
    makeMarkAttempt();
}

BingoClient.sendAllRuns = () => {
    showMessage("Sending All Runs")
    attemptMarkEachCell();
}

BingoClient.toggleBoardVisibility = () => {
    if (BingoClient.isShowingBoard)
        hideBingoBoardUI();
    else
        showBingoBoardUI();
}


function saveSettings() {
    localStorage.setItem(LS_KEY, JSON.stringify({ settings: BingoClient.settings, bindings: BingoClient.bindings }));
}

function loadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem(LS_KEY));
        if (s) {
            Object.assign(BingoClient.settings, s.settings || {});
            Object.assign(BingoClient.bindings, s.bindings || {});
            Object.assign(BingoClient.bindings, s.bindings || {});
        }
    } catch { }
}

function findUserTeam(userId) {
    for (const [teamName, teamList] of Object.entries(BingoClient.current.teams)) {
        const playerIndex = teamList.indexOf(userId);

        if (playerIndex === -1) continue;
        return teamName
    }

    return undefined
}

function updateBingoTeams() {
    BingoClient.current.team = findUserTeam(BingoClient.userId)
    updateSettingsTeams()
    updateWholeBoard();
}

function getCellInfo() {
    return {
        time: bingoSaveData.lastSave.time || self.survivalTime,
        index: bingoSaveData.lastSave.areaNumber,
        team: BingoClient.current.team,
        row: bingoSaveData.lastSave.row,
        col: bingoSaveData.lastSave.col,
    };
}

function attemptMarkEachCell() {
    if (!self) return;

    bingoSaveData.board.forEach((row) => {
        row.forEach((cell) => {
            if (cell.time === null || cell.index === null || cell.row === null || cell.col === null) return;

            const cellInfo = {
                time: cell.time,
                index: cell.areaNumber,
                team: BingoClient.current.team,
                row: cell.row,
                col: cell.col,
            }

            makeMove(BingoClient.roomId, cellInfo)
        })
    })
}

function makeMarkAttempt() {
    if (!self) return;

    const cell = getCellInfo();
    makeMove(BingoClient.roomId, cell);
}

function createSaveDataReserves(board) {
    board.forEach((row) => {
        const saveDataRow = [];
        row.forEach((_) => {
            const data = { region: null, hero: null, time: null, areaNumber: null, row: null, col: null, }
            saveDataRow.push(data);
        })

        bingoSaveData.board.push(saveDataRow);
    })

    bingoSaveData.lastSave = { region: null, hero: null, time: null, areaNumber: null, row: null, col: null, }
}

function getHero() {
    if (!heroes)
        heroes = getHeroColors();

    // TSMOD switch statement does not work between strokeColor and foregroundColor
    if (self.color === "#3377ff" || self.color === "#3333ff")
        return "Rime";
    else if (self.color === "#424a59" || self.color === "#787b81")
        return "Reaper";

    return Object.entries(heroes).find(([_, color]) => color === self.color)?.[0];
}

function regionNameFilter(currentRegion) { // e.g. Turn MM480 into MM
    for (const [region, subRegions] of Object.entries(MULTIPLE_WIN_REGIONS)) {
        if (Object.values(subRegions).includes(currentRegion)) {
            return region;
        }
    }
    return currentRegion;
}

function getHalfAreaNumber(regionName, divisible = 2) {
    if (!Number.isInteger(divisible) || divisible <= 0) divisible = 2;

    const areaNumber = REGIONS[regionName];

    if (areaNumber > 40)
        return 20
    return Math.floor(areaNumber / divisible)
}

function findCurrentCellAttempt() {
    for (let rowIndex = 0; rowIndex < BingoClient.board.length; rowIndex++) {
        const row = BingoClient.board[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const cell = row[colIndex];
            const { hero, region } = cell.game_info;

            if ((hero === getHero() || hero === "ANY") && regionNameFilter(region.name) === self.regionName) {
                // Found cell user is attempting

                const currentCellData = bingoSaveData.board[rowIndex][colIndex]
                currentCellData.row = rowIndex;
                currentCellData.col = colIndex;
                currentCellData.region = region.name;

                return [true, rowIndex, colIndex];
            }
        }
    }

    return [false, null, null];
}

function saveAttempt() {
    if (!self) return;
    if (self.areaNumber < getHalfAreaNumber(self.regionName) || self.survivalTime < 40) return;
    if (!Number.isNaN(bingoSaveData.lastSave.areaNumber)) { // Don't enter if not started
        if (self.areaNumber <= bingoSaveData.lastSave.areaNumber
            && regionNameFilter(bingoSaveData.lastSave.region.name) === self.regionName
            && isPlayerAlive()
        ) return;
    }

    // Check if still attempting on a map with a better attempt
    let found, row, col;
    if (bingoSaveData.lastSave.region === null ||
        self.regionName !== bingoSaveData.lastSave.region ||
        (self.regionName === bingoSaveData.lastSave.region && self.areaNumber > bingoSaveData.lastSave.areaNumber)
    ) {
        [found, row, col] = findCurrentCellAttempt();
    }

    if (found !== true) return; // false means player attempt not found on bingo board, undefined means that player has not started yet
    const currentCellData = bingoSaveData.board[row][col];
    const lastSave = bingoSaveData.lastSave

    // Check if the current area number is higher or if the same area number is reached with a lower survival time
    if (
        currentCellData.areaNumber !== null &&
        (self.areaNumber < currentCellData.areaNumber ||
            (self.areaNumber === currentCellData.areaNumber && self.survivalTime >= currentCellData.time))
    ) {
        return;
    }

    showMessage(`Saving Data: Region: ${self.regionName}, Time: ${self.survivalTime}, Area: ${self.areaNumber}`);

    //currentCellData.region = self.regionName;
    currentCellData.hero = getHero();
    currentCellData.time = self.survivalTime;
    currentCellData.areaNumber = self.areaNumber;

    Object.assign(lastSave, currentCellData);
}

function trackBingoProgress() { // Being checked every frame
    if (!BingoClient.isConnected || !BingoClient.inBingoGame || !self) return;
    saveAttempt();

    //makeMarkAttempt()
}


// Global Entities and Self Interceptor


const nameMap = new WeakMap();

const override = (name, get, set) => {
    const desc = { get, configurable: true };
    desc.set = function (to) {
        let nameArray = nameMap.get(this);
        if (!nameArray) {
            nameArray = [];
            nameMap.set(this, nameArray);
        }
        nameArray.push(name);
        return set.call(this, to);
    };
    Object.defineProperty(Object.prototype, name, desc);
};

const proxy = (obj, prop, app) => {
    obj[prop] = new Proxy(obj[prop], { apply: app });
};

const direct_proxy = (func, app) => new Proxy(func, { apply: app });

proxy(Object.prototype, "hasOwnProperty", (to, what, args) => {
    const nameArray = nameMap.get(what);
    if (nameArray?.includes(args[0])) {
        return true;
    }
    return to.apply(what, args);
});

const get = (name, cb) => {
    override(name, () => void 0, function (to) {
        delete Object.prototype[name];
        this[name] = to;
        cb(this);
        return to;
    });
};

override("self", function () {
    return this._self;
}, function (to) {
    self = to?.entity;
    return this._self = to;
});

win.WebSocket = class extends win.WebSocket {
    constructor(...args) {
        super(...args);
        proxy(this, "addEventListener", (to, what, args) => {
            if (args[0] == "message") {
                args[1] = direct_proxy(args[1], (to, what, args) => {
                    const ret = to.apply(what, args);

                    trackBingoProgress();

                    return ret;
                });
            }
            return to.apply(what, args);
        });
    }
};

document.addEventListener('keydown', handleKey);

function handleKey(e) {
    // Function callback shenanigans?

    if (e.key === BingoClient.bindings.sendRecentRun)
        BingoClient.sendRecentRun();
    if (e.key === BingoClient.bindings.sendAllRuns)
        BingoClient.sendAllRuns();
    if (e.key === BingoClient.bindings.toggleBoardVisibility)
        BingoClient.toggleBoardVisibility()
}


// Message Handler


function setMessageColor(msg, type) {
    switch (type) {
        case MESSAGE_TYPES.ERROR:
            msg.style.color = "#d33";
            break;
        case MESSAGE_TYPES.UNKNOWN:
            msg.style.color = "#d3d";
            break;
        case MESSAGE_TYPES.WINNER:
            msg.style.color = "#3d3";
            break;
        case MESSAGE_TYPES.ROOM_INFO:
            msg.style.color = "#33d";
            break;
        case MESSAGE_TYPES.DEFAULT:
        default:
            break;
    }
}

function showMessage(text, type = MESSAGE_TYPES.DEFAULT) {
    const container = document.getElementById('message-container');
    const msg = document.createElement('div');
    msg.className = 'message';
    msg.textContent = text;

    setMessageColor(msg, type)

    container.appendChild(msg);

    // Fade in after adding to DOM
    requestAnimationFrame(() => {
        msg.classList.add('show');
    });

    // Fade out after 5 seconds
    setTimeout(() => {
        msg.classList.remove('show');
        msg.classList.add('hide');
    }, 5000);

    // Remove after animation ends
    msg.addEventListener('transitionend', () => {
        if (msg.classList.contains('hide')) {
            msg.remove();
        }
    });
}

function addMessageHandler() {
    const div = document.createElement('div');
    div.id = 'message-container';
    const css = document.createElement('style');

    css.innerHTML = `#message-container {
  background: #111;
  color: white;
  font-family: sans-serif;
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 9999;
}

.message {
  border: 1px solid white;
  border-radius: 8px;
  padding: 10px 15px;
  min-width: 200px;
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.message.show {
  opacity: 1;
  transform: translateY(0);
}

.message.hide {
  opacity: 0;
  transform: translateY(10px);
}`;

    document.body.appendChild(div);
    document.body.appendChild(css);
}


// Bingo Board UI

function secondsToMinutes(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function updateMiniHoverArea() {
  const rect = miniBoardEl.getBoundingClientRect();
  const extra = 20;
  miniHoverArea.style.position = 'fixed';
  miniHoverArea.style.top  = `${rect.top}px`;
  miniHoverArea.style.left = `${rect.left}px`;
  miniHoverArea.style.width  = `${rect.width + extra}px`;
  miniHoverArea.style.height = `${rect.height + extra}px`;
}

function addTeamClass(div, cell) {
    if (cell.marked_info.is_marked) {
        div.classList.add(`team-${cell.marked_info.team || 'none'}`);
    } else {
        div.classList.add('team-none');
    }
}

function createMiniBoard(boardData, element) {
    element.innerHTML = '';

    // Dynamically set number of columns
    const cols = boardData[0].length || 1;
    element.style.gridTemplateColumns = `repeat(${cols}, 20px)`;

    boardData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const div = document.createElement('div');
            div.id = `mini-cell-${rowIndex}-${colIndex}`;

            addTeamClass(div, cell);

            element.appendChild(div);
        });
    });
}

function addMarkedInfo(div, cell) {
    // Add region and hero info
    const region = document.createElement('strong');
    region.textContent = cell.game_info.region.name;

    const hero = document.createElement('span');
    hero.textContent = `Hero: ${cell.game_info.hero || 'N/A'}`;

    div.appendChild(region);
    div.appendChild(hero);
}

function addTooltipInfo(div, cell) {
    // Tooltip events

    const onEnter = (e) => {
        const { game_info, marked_info } = cell;

        tooltipEl.replaceChildren();

        // mini sanitizer, i should do a full update in the future lol...
        const addLine = (label, value, strong = false) => {
            const line = document.createElement("div");

            if (strong) {
                const s = document.createElement("strong");
                s.textContent = value ?? "N/A";
                line.appendChild(s);
            } else {
                line.textContent = `${label}${value ?? "N/A"}`;
            }

            tooltipEl.appendChild(line);
        };

        addLine("", game_info?.region?.name, true);
        addLine("Hero: ", game_info?.hero || "N/A");

        if (marked_info?.is_marked) {
            addLine("Marked by: ", marked_info.player || "Unknown");
            addLine("Team: ", marked_info.team || "None");
            addLine("Time: ", secondsToMinutes(marked_info.time) || "N/A");
            addLine("Area Number: ", marked_info.reached_index || "N/A");
        } else {
            addLine("", "Not marked");
        }

        tooltipEl.style.opacity = "1";
    };

    const onMove = (e) => {
        tooltipEl.style.left = e.pageX + 15 + 'px';
        tooltipEl.style.top = e.pageY + 15 + 'px';
    };
    const onLeave = () => {
        tooltipEl.style.opacity = '0';
    };

    div.addEventListener('mouseenter', onEnter);
    div.addEventListener('mousemove', onMove);
    div.addEventListener('mouseleave', onLeave);
    div._tipHandlers?.forEach(([t, fn]) => div.removeEventListener(t, fn));
    div._tipHandlers = [['mouseenter', onEnter], ['mousemove', onMove], ['mouseleave', onLeave]];
    div._tipHandlers.forEach(([t, fn]) => div.addEventListener(t, fn));
}

function createBigBoard(boardData, element) {
    element.innerHTML = '';

    // Dynamically set number of columns
    const cols = boardData[0].length || 1;
    element.style.gridTemplateColumns = `repeat(${cols}, 120px)`;

    boardData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const div = document.createElement('div');
            div.id = `big-cell-${rowIndex}-${colIndex}`;

            addTeamClass(div, cell);
            addMarkedInfo(div, cell);
            addTooltipInfo(div, cell);

            element.appendChild(div);
        });
    });
}

function updateTeamClass(div, cell) {
    TEAMS.forEach(teamColor => {
        div.classList.remove(`team-${teamColor}`)
    });

    div.classList.remove('team-none');

    if (cell.marked_info.is_marked) {
        div.classList.add(`team-${cell.marked_info.team || 'none'}`);
    } else {
        div.classList.add('team-none');
    }
}

function updateCellMiniBoard(targetCell, row, col) {
    const div = document.getElementById(`mini-cell-${row}-${col}`)
    if (!div) return;

    updateTeamClass(div, targetCell)
}

function updateMarkedInfo(div, cell) {
    const region = div.querySelector('strong');
    region.textContent = cell.game_info.region.name;

    const hero = div.querySelector('span');
    hero.textContent = `Hero: ${cell.game_info.hero || 'N/A'}`;
}

function updateCellBigBoard(targetCell, row, col) {
    const div = document.getElementById(`big-cell-${row}-${col}`);
    if (!div) return;

    updateTeamClass(div, targetCell)
    updateMarkedInfo(div, targetCell)
    addTooltipInfo(div, targetCell)
}

function updateTeamCell(row, col) {
    const cell = BingoClient.board[row][col];
    const newTeam = findUserTeam(cell.marked_info.player);

    if (!newTeam) return;

    cell.marked_info.team = newTeam;
}

function updateBoard(targetCell, row, col) {
    // Use updateTeamCell(row, col); to match cell to player team even upon changes
    updateCellMiniBoard(targetCell, row, col);
    updateCellBigBoard(targetCell, row, col);
}

function updateWholeBoard() {
    if (!BingoClient.hasBoardUI || !BingoClient.inBingoGame) return;

    const board = BingoClient.board;
    const newSize = board.length;
    const currentSize = Math.round(Math.sqrt(miniBoardEl.querySelectorAll('div').length));

    if (currentSize !== newSize) {
        miniBoardEl.innerHTML = '';
        bigBoardEl.innerHTML = '';
        createMiniBoard(board, miniBoardEl);
        createBigBoard(board, bigBoardEl);
        updateMiniHoverArea();
        return;
    }

    board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            updateBoard(cell, rowIndex, colIndex);
        });
    });
}

function showBigBoard() {
    bigBoardEl.classList.add('visible');
}

function hideBigBoard() {
    bigBoardEl.classList.remove('visible');
}

function hideBingoBoardUI() {
    const bingoBoardUI = document.getElementById('boardsWrapper');

    if (!bingoBoardUI) return;
    bingoBoardUI.style.display = 'none';
    BingoClient.isShowingBoard = false;
}

function showBingoBoardUI() {
    const bingoBoardUI = document.getElementById('boardsWrapper');

    if (!bingoBoardUI) return;
    bingoBoardUI.style.display = 'flex';
    BingoClient.isShowingBoard = true;
}

function addBingoBoardUI(board) {
    const divHTML = document.createElement('div');
    const cssHTML = document.createElement('style');

    divHTML.innerHTML = `<div class="boards-wrapper" id="boardsWrapper">
    <div class="mini-hover-area" id="miniHoverArea"></div>
    <div id="miniBoard" class="board mini"></div>
    <div id="bigBoard" class="board big"></div>
</div>

<div id="tooltip" class="tooltip"></div>`

    cssHTML.innerHTML = `.boards-wrapper {
    position: fixed;
    color:white;
    top: 35%;
    left: 2%;
    display: flex;
    align-items: flex-start;
}

.mini-hover-area {
    position: absolute;
}

/* Mini board */
.board.mini {
    display: grid;
    grid-gap: 2px;
    cursor: pointer;
}

.board.mini div {
    width: 20px;
    height: 20px;
    border: 1px solid #777;
    border-radius: 3px;
}

/* Big board (hidden at start) */
.board.big {
    display: grid;
    grid-gap: 5px;
    margin-left: 10px;
    overflow: hidden;
    max-width: 0;
    opacity: 0;
    transform: scale(0.95);
    transform-origin: left top;
    transition: all 0.3s ease;
}

.board.big.visible {
    max-width: 10000px;
    opacity: 1;
    transform: scale(1);
}

/* Big board base cell style */
.board.big div {
    border: 1px solid #777;
    border-radius: 5px;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
    padding: 8px;
    position: relative;
    transition: transform 0.15s ease;
}

/* Keep team color but add darkening tint on hover */
.board.big div::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0); /* no tint by default */
    transition: background 0.15s ease;
    border-radius: 5px;
}

.board.big div:hover::after {
    background: rgba(0, 0, 0, 0.4);
}

/* Team colors */
.team-red {
    background-color: #d33;
}
.team-blue {
    background-color: #33d;
}
.team-green {
    background-color: #3d3;
}
.team-orange {
    background-color: rgb(255, 123, 0);
}
.team-none {
    background-color: #555;
}

/* Tooltip styling */
.tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 10px;
    border-radius: 5px;
    font-size: 12px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    max-width: 250px;
}`

    document.body.appendChild(divHTML);
    document.body.appendChild(cssHTML);

    miniBoardEl = document.getElementById('miniBoard');
    bigBoardEl = document.getElementById('bigBoard');
    tooltipEl = document.getElementById('tooltip');
    miniHoverArea = document.getElementById('miniHoverArea');

    miniHoverArea.addEventListener('mouseenter', showBigBoard);
    bigBoardEl.addEventListener('mouseleave', hideBigBoard);

    // Keep big board open while hovering mini-hover-area
    miniHoverArea.addEventListener('mouseleave', () => {
        if (!bigBoardEl.matches(':hover')) hideBigBoard();
    });

    createMiniBoard(board, miniBoardEl);
    createBigBoard(board, bigBoardEl);
    updateMiniHoverArea();

    window.addEventListener('resize', updateMiniHoverArea);

    BingoClient.hasBoardUI = true;
}


// Settings Replacement UI


// Settings Helpers
function updateSettingsContainerDisplay(displayStyle, targetSubClasses, filterBingo = false) {
    if (!displayStyle) return;

    const settingsContainer = document.querySelector('.settings-container');

    if (!settingsContainer) {
        console.log('Settings container not found');
        return;
    }

    if (targetSubClasses) {
        const subClass = settingsContainer.querySelectorAll(targetSubClasses);

        if (!subClass) {
            console.log(`Sub Class ${targetSubClasses} not found`)
            return;
        }

        subClass.forEach((label) => {
            if (filterBingo && label.className.includes('bingo')) return;

            label.style.display = displayStyle;
        });
    }
    else {
        settingsContainer.childNodes.forEach((child) => {
            if (!child.className) return;
            if (filterBingo && child.className.includes('bingo')) return;

            child.style.display = displayStyle;
        });
    }
}

function hideSettingsCategoryActive() {
    const settingsCategories = document.querySelector('.settings-categories');
    if (!settingsCategories) {
        console.log('Settings categories not found');
        return;
    }

    const activeCategory = settingsCategories.querySelector('.settings-category.active');
    if (activeCategory) {
        activeCategory.classList.remove('active');
    }
}

function addLabel(labelAddedClass, labelText, labelId) {
    if (!labelAddedClass || !labelText) {
        console.log("Missing label params")
        return;
    }

    const label = document.createElement('label');
    label.style.display = 'none';
    label.classList.add('settings-label', labelAddedClass);

    if (labelId)
        label.id = labelId;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'settings-setting';
    labelDiv.textContent = labelText;

    label.appendChild(labelDiv);

    return label;
}

function addCheckboxSetting(labelAddedClass, labelText, checkboxId) {
    if (!labelAddedClass || !labelText || !checkboxId) {
        console.log("Missing checkbox params")
        return;
    }

    const label = addLabel(labelAddedClass, labelText);
    const labelDiv = label.querySelector('.settings-setting');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'settings-checkbox';
    input.id = checkboxId;

    labelDiv.appendChild(input);

    return label;
}

function addSliderSetting(labelAddedClass, labelText, sliderId, min, max, value = undefined, functionCallBack = undefined) {
    if (!labelAddedClass || !labelText || !sliderId || !min || !max || (!value && value !== 0)) {
        console.log("Missing slider params")
        return;
    }

    const label = addLabel(labelAddedClass, labelText);
    const labelDiv = label.querySelector('.settings-setting');

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'settings-slider';
    input.id = sliderId;
    input.min = min;
    input.max = max;
    input.step = 1;
    input.value = value;

    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = `: ${input.value}`;

    input.addEventListener('input', (event) => {
        valueDisplay.textContent = `: ${event.target.value}`;
    });

    if (functionCallBack) {
        input.addEventListener('change', (event) => {
            functionCallBack(event.target.value);
        })
    }

    labelDiv.appendChild(input);
    labelDiv.appendChild(valueDisplay);

    return label;
}

function addSelectSetting(labelAddedClass, labelText, selectId, options, selectedIndex = 0, functionCallback = undefined) {
    if (!labelAddedClass || !labelText || !selectId || !options) {
        console.log("Missing select params")
        return;
    }

    const label = addLabel(labelAddedClass, labelText);
    const labelDiv = label.querySelector('.settings-setting');

    const input = document.createElement('select');
    input.className = 'settings-select';
    input.id = selectId; // Later Br1h realised, why did I add this as an ID???? why not class??? am i bugging????
    // New br1h here that woke up, that guy b4 was coding at 3am, he was bugging
    // 2026 here, no clue wtf they're talking about

    for (const option of options) {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        input.appendChild(optionElement);
    }

    input.value = selectedIndex;

    if (functionCallback) {
        input.addEventListener('change', (event) => {
            functionCallback(event.target.value);
        });
    }

    labelDiv.appendChild(input);

    return label;
}

function addButtonSetting(labelAddedClass, labelText, buttonId, functionCallBack, labelId) {
    if (!labelAddedClass || !labelText || !buttonId) {
        console.log("Missing Button params")
        return;
    }

    const label = addLabel(labelAddedClass, labelText, labelId);
    const labelDiv = label.querySelector('.settings-setting');

    const input = document.createElement('button');
    input.type = 'checkbox';
    input.className = 'settings-checkbox';
    input.id = buttonId;
    input.textContent = 'Click Me!';

    input.addEventListener('click', (event) => {
        functionCallBack(event)
    });

    labelDiv.appendChild(input);

    return label;
}

function setKeyBinding(event, targetObj, keyName, labelId) {
    const key = event.key;

    if (key === 'Escape' || key === 'Enter' || key === "Backspace") {
        targetObj[keyName] = null;
    } else {
        targetObj[keyName] = key;
    }

    showMessage(`Key binding set to: ${targetObj[keyName] || 'None'}`);

    const labelDiv = document.querySelector(`#${labelId} .settings-setting`);
    const textNode = Array.from(labelDiv.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
    textNode.textContent = textNode.textContent.replace(/\((.*?)\)/, `(${targetObj[keyName] || 'None'})`);
}

function setVariableKeyBind(targetObj, keyName, labelId) {
    showMessage('Press a key to set the binding (Escape/Enter/Backspace will remove the binding).');

    const handler = (event) => {
        setKeyBinding(event, targetObj, keyName, labelId);
        document.removeEventListener('keydown', handler);
        saveSettings();
    };

    document.addEventListener('keydown', handler);
}

function addBingoSettingsTab(div, id, classLabel, tabText, addLabelsCallback, updateLabelsCallback, saveButtonCallback) {
    const settingsCategories = div.querySelector('.settings-categories');

    // Adding Tab Button
    const bingoButton = document.createElement('button');
    bingoButton.id = id;
    bingoButton.classList.add('settings-category');
    bingoButton.textContent = tabText;

    // Handling switching onto Bingo Tab
    bingoButton.addEventListener('click', () => {
        // Hide other settings
        hideSettingsCategoryActive();
        updateSettingsContainerDisplay('none');

        // Show Bingo settings
        bingoButton.classList.add('active');
        updateSettingsContainerDisplay('block', `.${classLabel}`);
        updateLabelsCallback()
    });

    settingsCategories.append(bingoButton);
    addLabelsCallback(classLabel);


    // Handling switching off Bingo Tab, bro i really thought it'd be free but it got so complicated
    settingsCategories.addEventListener('click', (event) => {
        // If clicking on same button or empty space around it or a different bingo tab
        if (event.target.id === id ||
            event.target.className.includes('settings-categories') ||
            (event.target.id !== id && event.target.id.includes('bingo'))
        ) return;

        // Show all Settings
        // Don't show if clicking on another bingo tab 
        if (!event.target.id.includes('bingo')) {
            updateSettingsContainerDisplay('block', undefined, true);
        }

        // Hide Bingo settings
        document.getElementById(id).classList.remove('active');
        updateSettingsContainerDisplay('none', `.${classLabel}`);
    });

    //Handling Save Button Update
    const saveButton = div.querySelector('input.settings-button[value="Save"]');
    saveButton.addEventListener('click', event => saveButtonCallback(event))
}

// Bingo Server Settings
function updateSettingsTeams() {
    const teamInformationLabel = document.getElementById('teamInformationLabel')

    if (!teamInformationLabel) return;
    if (!(BingoClient.current.scene === SERVER_INFO_SCENES.IN_ROOM || BingoClient.current.scene === SERVER_INFO_SCENES.GAME_STARTED)) return 'No teams';

    teamInformationLabel.textContent = '';

    Object.entries(BingoClient.current.teams).forEach(([teamName, teamList]) => {
        const players = teamList.join(', ') || '—';

        teamInformationLabel.textContent += `Team ${teamName}: [${players}] `;
    })
}

function isSceneValid(givenScene) {
    for (const scene of Object.values(SERVER_INFO_SCENES)) {
        if (scene === givenScene) return true;
    }
    return false;
}

function updateServerInformation(scene) {
    if (isSceneValid(scene)) BingoClient.current.scene = scene;
    if (document.getElementById('bingo-server-button') === null) return; // Settings is not open
    if (!document.getElementById('bingo-server-button').className.includes('active')) return 'just not null'; // Not Chosen Tab or connected

    const serverInfoLabel = document.getElementById('bingoServerInfo');

    updateSettingsContainerDisplay('none');
    serverInfoLabel.style.display = 'block';

    switch (scene) {
        case SERVER_INFO_SCENES.NOT_CONNECTED:
            serverInfoLabel.textContent = 'Not Connected To Server.';

            document.getElementById('connectToServerLabel').style.display = 'block';
            document.getElementById('bingoServerWaitMsg').style.display = 'block';
            break;
        case SERVER_INFO_SCENES.CONNECTING:
            serverInfoLabel.textContent = 'Connecting To Server...';

            document.getElementById('bingoServerWaitMsg2').style.display = 'block';
            break;
        case SERVER_INFO_SCENES.CONNECTED:
            serverInfoLabel.textContent = 'Connected To Server';

            document.getElementById('createRoomLabel').style.display = 'block';
            document.getElementById('joinRoomLabel').style.display = 'block';
            document.getElementById('disconnectFromServerLabel').style.display = 'block';
            break;
        case SERVER_INFO_SCENES.IN_ROOM:
            serverInfoLabel.textContent = `RoomId: ${BingoClient.roomId}, Admin: ${BingoClient.admin}`;

            document.getElementById('startGameLabel').style.display = 'block';
            document.getElementById('restartGameLabel').style.display = 'block';
            document.getElementById('leaveRoomLabel').style.display = 'block';
            document.getElementById('disconnectFromServerLabel').style.display = 'block';
            break;
        case SERVER_INFO_SCENES.GAME_STARTED:
            serverInfoLabel.textContent = `RoomId: ${BingoClient.roomId}, Admin: ${BingoClient.admin}`;

            document.getElementById('restartGameLabel').style.display = 'block';
            document.getElementById('refreshBoardLabel').style.display = 'block';
            document.getElementById('sendRecentRunLabel').style.display = 'block';
            document.getElementById('sendAllRunsLabel').style.display = 'block';
            document.getElementById('toggleBoardVisibilityLabel').style.display = 'block';
            document.getElementById('leaveRoomLabel').style.display = 'block';
            document.getElementById('disconnectFromServerLabel').style.display = 'block';
            break;
        default:
            break;
    }
}

function updateBingoServerSettingsLabels() {
    updateServerInformation(BingoClient.current.scene);
}

function addBingoServerSettingsLabels(labelAddedClass) {
    const settingsContainer = document.querySelector('.settings-container');

    if (!settingsContainer) {
        console.log('Settings container not found');
        return;
    }

    const fragment = document.createDocumentFragment();

    const elements = [
        addLabel(labelAddedClass, updateServerInformation(), 'bingoServerInfo'),
        addLabel(labelAddedClass, '(If ID already on server and not connected, wait 30 seconds)', 'bingoServerWaitMsg'),
        addLabel(labelAddedClass, '(Give the server time to turn on)', 'bingoServerWaitMsg2'),
        addButtonSetting(labelAddedClass, 'Connect to Server', 'connectToServerBtn', BingoClient.connectToServer, 'connectToServerLabel'),
        addButtonSetting(labelAddedClass, 'Create Room', 'createRoomBtn', BingoClient.createRoom, 'createRoomLabel'),
        addButtonSetting(labelAddedClass, 'Join a room', 'joinRoomBtn', BingoClient.joinRoom, 'joinRoomLabel'),
        addButtonSetting(labelAddedClass, 'Start Game', 'startGameBtn', BingoClient.startGame, 'startGameLabel'),
        addButtonSetting(labelAddedClass, 'Reset Board', 'restartGameBtn', BingoClient.restartGame, 'restartGameLabel'),
        addButtonSetting(labelAddedClass, 'Send Recent Goal Attempt', 'sendRecentRunBtn', BingoClient.sendRecentRun, 'sendRecentRunLabel'),
        addButtonSetting(labelAddedClass, 'Send All Attempted Goals', 'sendAllRunsBtn', BingoClient.sendAllRuns, 'sendAllRunsLabel'),
        addButtonSetting(labelAddedClass, "Toggle board Visibility", 'toggleBoardVisibilityBtn', BingoClient.toggleBoardVisibility, 'toggleBoardVisibilityLabel'),
        addButtonSetting(labelAddedClass, 'Refresh Board UI', 'updateWholeBoardBtn', BingoClient.updateWholeBoard, 'refreshBoardLabel'),      
        addButtonSetting(labelAddedClass, 'Leave Room', 'leaveRoomBtn', BingoClient.leaveRoom, 'leaveRoomLabel'),
        addButtonSetting(labelAddedClass, 'Disconnect from server', 'disconnectFromServerBtn', BingoClient.disconnectFromServer, 'disconnectFromServerLabel'),

    ];

    fragment.append(...elements);
    settingsContainer.appendChild(fragment);
}

function addBingoServerSettingsSave() {
    saveSettings();
}

function addBingoServerSettings(div) {
    addBingoSettingsTab(div, 'bingo-server-button', 'bingo-server-label', 'Bingo Server', addBingoServerSettingsLabels, updateBingoServerSettingsLabels, addBingoServerSettingsSave);
}

// Bingo Client Settings
function generateTeamsSelect() {
    let teams = [];
    TEAMS.forEach((team) => {
        teams.push({ value: team, label: team })
    })

    return teams
}

function showAllTeamsMsg() {
    Object.entries(BingoClient.current.teams).forEach(([teamName, teamList]) => {
        let players = ""
        teamList.forEach((player) => {
            players += `${player}, `

        })

        showMessage(`Team ${teamName}: ${players}`);
    })
}

function findTeamSelectedIndex(currentTeam) {
    let selectedIndex = -1;

    TEAMS.forEach((team, index) => {
        if (team === currentTeam) {
            selectedIndex = index;
        }
    });

    return selectedIndex;
}

function updateBingoClientSettingsLabels() {
    const maxPlayerCount = document.getElementById('max-player-count');
    const boardSize = document.getElementById("board-size");

    if (BingoClient.current.scene === SERVER_INFO_SCENES.IN_ROOM || BingoClient.current.scene === SERVER_INFO_SCENES.GAME_STARTED) {
        document.getElementById('room-label').textContent = 'Room settings';
        
        maxPlayerCount.value = BingoClient.current.maxPlayerCount;
        maxPlayerCount.disabled = true;

        boardSize.value = BingoClient.current.boardSize;
        boardSize.style.display = (BingoClient.admin === BingoClient.userId) ? 'block' : 'none';
    }
    else {
        document.getElementById('room-label').textContent = 'Preset settings';

        maxPlayerCount.value = BingoClient.settings.maxPlayerCount;
        maxPlayerCount.disabled = false;
        
        boardSize.value = BingoClient.settings.boardSize;
        boardSize.style.display = 'block';
    }
    
    if (updateSettingsTeams() !== 'No teams') return;
    document.getElementById('teamInformationLabel').style.display = 'none';
    document.getElementById('current-team').value = findTeamSelectedIndex(BingoClient.settings.team);
}

function handleTeamSelectLabel(newTeam) {
    if (BingoClient.isConnected && BingoClient.roomId !== null) {
        BingoClient.current.team = newTeam;
        BingoClient.changeTeam(newTeam);
    }
    else {
        BingoClient.settings.team = newTeam;
    }
}

function handleMaxPlayerSettings(event) {
    if (BingoClient.isConnected && BingoClient.roomId !== null)
        BingoClient.current.maxPlayerCount = Number.parseInt(event);
    else
        BingoClient.settings.maxPlayerCount = Number.parseInt(event);
}

function handleBoardSizeSliderSettings(event) {
    if (BingoClient.isConnected && BingoClient.roomId !== null)
        BingoClient.current.boardSize = Number.parseInt(event);
    else
        BingoClient.settings.boardSize = Number.parseInt(event);
}

function addBingoClientSettingsLabels(labelAddedClass) {
    const settingsContainer = document.querySelector('.settings-container');

    if (!settingsContainer) {
        console.log('Settings container not found');
        return;
    }

    const fragment = document.createDocumentFragment();

    const elements = [
        addLabel(labelAddedClass, 'No teams', 'teamInformationLabel'),
        ...(BingoClient.isConnected && BingoClient.roomId !== null
            ? [
                addLabel(labelAddedClass, 'Room settings', 'room-label'),
                addSelectSetting(labelAddedClass, 'Your Team', 'current-team', generateTeamsSelect(), findTeamSelectedIndex(BingoClient.current.team), handleTeamSelectLabel),
                addSliderSetting(labelAddedClass, 'Max Player Count', 'max-player-count', 2, 20, BingoClient.current.maxPlayerCount, handleMaxPlayerSettings),
                addSliderSetting(labelAddedClass, 'Board Size', 'board-size', 1, 6, BingoClient.current.boardSize, handleBoardSizeSliderSettings),
            ]
            : [
                addLabel(labelAddedClass, 'Preset settings', 'room-label'),
                addSelectSetting(labelAddedClass, 'Your Team', 'current-team', generateTeamsSelect(), findTeamSelectedIndex(BingoClient.settings.team), (event) => { handleTeamSelectLabel(event); saveSettings();}),
                addSliderSetting(labelAddedClass, 'Max Player Count', 'max-player-count', 2, 20, BingoClient.settings.maxPlayerCount, (event) => {handleMaxPlayerSettings(event); saveSettings();}),
                addSliderSetting(labelAddedClass, 'Board Size', 'board-size', 1, 6, BingoClient.settings.boardSize, (event) =>  {handleBoardSizeSliderSettings(event); saveSettings();}),
            ]),
        addButtonSetting(labelAddedClass, `Send Recent Run Button Keybind (${BingoClient.bindings.sendRecentRun || 'None'})`, 'sendRecentRunKeybindBtn', () => { setVariableKeyBind(BingoClient.bindings, 'sendRecentRun', 'sendRecentRunKeybindLabel'); }, 'sendRecentRunKeybindLabel'),
        addButtonSetting(labelAddedClass, `Send All Runs Button Keybind (${BingoClient.bindings.sendAllRuns || 'None'})`, 'sendAllRunsKeybindBtn', () => { setVariableKeyBind(BingoClient.bindings, 'sendAllRuns', 'sendAllRunsKeybindLabel'); }, 'sendAllRunsKeybindLabel'),
        addButtonSetting(labelAddedClass, `Toggle Board Visibility (${BingoClient.bindings.toggleBoardVisibility || 'None'})`, 'toggleBoardVisibilityBtn', () => { setVariableKeyBind(BingoClient.bindings, 'toggleBoardVisibility', 'toggleBoardVisibilityKeybindLabel')}, 'toggleBoardVisibilityKeybindLabel')
    ];

    fragment.append(...elements);
    settingsContainer.appendChild(fragment);
}

function addBingoClientSettingsSave() {
    saveSettings();
}

function addBingoClientSettings(div) {
    addBingoSettingsTab(div, 'bingo-client-button', 'bingo-client-label', 'Bingo Client', addBingoClientSettingsLabels, updateBingoClientSettingsLabels, addBingoClientSettingsSave);
}

// Detect settings popup

const targetNode = document.body;
const settingsObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
            // Check if a new node with class "settings" is added
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('settings')) {
                    node.childNodes[3].style.display = 'block'; // I think this looks better fr

                    addBingoServerSettings(node);
                    addBingoClientSettings(node);
                }
            });
        }
    }
});

// Start things
function evadesBingoInit() {
    addMessageHandler();
    showMessage('Client working!!!');
    loadSettings();
    settingsObserver.observe(targetNode, { childList: true, subtree: true });
}

evadesBingoInit();