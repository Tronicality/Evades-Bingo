// ==UserScript==
// @name         Evades Bingo Client
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Br1h made evades bingo... no way!
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
let win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
let miniBoardEl, bigBoardEl, tooltipEl, miniHoverArea, settingsStyle, self, state, heroes;
let bingoSaveData = { board: [], lastSave: {} };

const server = 'https://evades-bingo.onrender.com/'

const MESSAGE_TYPES = { // Fake Enum :sob:
    "DEFAULT": "default",
    "ERROR": "error",
    "UNKNOWN": "unknown",
    "WINNER": "winner",
}


// Utilities

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
        return {
            "Magmax": "#ff0000",
            "Rime": "#3377ff",
            "Morfe": "#00dd00",
            "Aurora": "#ff7f00",
            "Necro": "#FF00FF",
            "Brute": "#9b5800",
            "Nexus": "#29FFC6",
            "Shade": "#826565",
            "Euclid": "#5e4d66",
            "Chrono": "#00b270",
            "Reaper": "#787b81",
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
    //bingoSaveData = { region: null, hero: null, time: null, areaNumber: null, row: null, col: null, };
}


// Server connection part


function connectToServer() {
    if (!self) {
        showMessage('Please enter a server on evades')
        return;
    }

    BingoClient.userId = self.name;

    BingoClient.socket = new WebSocket(server);

    // Handle connection open
    BingoClient.socket.addEventListener('open', () => {
        showMessage('Connected to the server')
        BingoClient.socket.send(JSON.stringify({ type: 'register', data: { user_id: BingoClient.userId } }));
    });

    // Handle incoming messages
    BingoClient.socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
            case 'registered':
                console.log(`Registered with ID: ${message.data.id}`);
                BingoClient.isConnected = true;
                break;
            case 'room_created':
                showMessage(`Room created with ID: ${message.data.id}`)
                //console.log(`Room created with ID: ${message.data.id}`);

                BingoClient.roomId = message.data.id;
                break;
            case 'room_joined':
                showMessage('Joined Room')
                console.log(`Joined room with ID: ${message.data.id}`);
                break;
            case 'left_room':
                clearClient();
                break;
            case 'game_started':
                showMessage('Game started!')

                BingoClient.board = message.data.board;

                if (!BingoClient.hasBoardUI) {
                    addBingoBoardUI(BingoClient.board);
                }
                else {
                    updateWholeBoard();
                }

                showBingoBoardUI();
                BingoClient.inBingoGame = true;

                clearBingoSaveData();
                createSaveDataReserves(message.data.board);
                break;
            case 'update_board':
                //console.log('Board updated:', message.data.cell);
                BingoClient.board[message.data.row][message.data.col] = message.data.cell;
                updateBoard(message.data.cell, message.data.row, message.data.col);

                showBingoBoardUI();
                break;
            /*
            case 'game_restarted':
                console.log('Game restarted! Board:', message.data.board);
                break;
            */
            case 'game_ended':
                //console.log('Game ended! Winner:', message.data.winner);
                showMessage(`Game Ended! Winner ${message.data.winner}`)

                BingoClient.inBingoGame = false;
                break;

            case 'bingo':
                showMessage(message.message, MESSAGE_TYPES.WINNER);
                BingoClient.board = message.data.board;
                updateWholeBoard();

                BingoClient.inBingoGame = false;
                break;
            case 'game_info':
                showMessage(message.message);
                console.log('Game info:', message.message);
                break;
            case 'mark_attempt':
                showMessage(message.message);
                console.log('Mark attempt:', message.message);
                clearLastSave();
                break;
            case 'update_teams':
                showMessage('Teams have been updated')
                console.log("New Teams:", message.data.teams)

                BingoClient.current.teams = message.data.teams;
                updateBingoTeams();
                break;
            case 'error':
                const msg = `Error: ${message.message}`
                showMessage(msg, MESSAGE_TYPES.ERROR);
                console.error(msg);
                break;
            default:
                showMessage(`Something broke! Check Console!`, MESSAGE_TYPES.ERROR);
                console.warn('Unknown message type:', message.type);
        }
    });

    // Handle connection close
    BingoClient.socket.addEventListener('close', () => {
        //BingoClient.leaveRoom();
        showMessage('Disconnected from the server')
        console.log('Disconnected from the server');

        clearClient();
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

function clearClient() {
    BingoClient.isConnected = false;
    BingoClient.inBingoGame = false;
    BingoClient.board = [];
    BingoClient.roomId = null;
    BingoClient.socket = null;
    clearBingoSaveData();
    hideBingoBoardUI();
}

function sendData(type, data) {
    BingoClient.socket.send(JSON.stringify({ type: type, data: data }))
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

function startGame(roomId) {
    sendData(CLIENT_MESSAGE_TYPES.START_GAME, { room_id: roomId })
}

function restartGame(roomId) {
    sendData(CLIENT_MESSAGE_TYPES.RESTART_GAME, { room_id: roomId })
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
    isConnected: false,
    inBingoGame: false,
    hasBoardUI: false,
    board: [],
    settings: {
        maxPlayerCount: 4,
        team: 'red'
    },
    current: {
        maxPlayerCount: null,
        team: 'red',
        teams: {},
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
    updateBingoTeams,
    updateWholeBoard,
};

BingoClient.createRoom = () => {
    createRoom(BingoClient.settings.team, BingoClient.settings.maxPlayerCount);
}

BingoClient.joinRoom = () => {
    joinRoom(BingoClient.roomId, BingoClient.settings.team);
}

BingoClient.leaveRoom = () => {
    leaveRoom(BingoClient.roomId)
}

BingoClient.startGame = () => {
    startGame(BingoClient.roomId);
}

BingoClient.restartGame = () => {
    restartGame(BingoClient.roomId);
}

BingoClient.joinTeam = () => {
    joinTeam(BingoClient.roomId, BingoClient.settings.team)
}

BingoClient.leaveTeam = () => {
    leaveTeam(BingoClient.roomId, BingoClient.settings.team)
}

BingoClient.changeTeam = () => {
    changeTeam(BingoClient.roomId, BingoClient.settings.team)
}

function updateBingoTeams() {

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

function getHero(heroType) {
    if (!heroes) {
        heroes = getHeroColors();
    }

    return Object.keys(heroes)[heroType]
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
    "Pristine Purgatory": {
        22: "Pristine Purgatory Eternal",
        23: "Pristine Purgatory Veydris",
    }
}

function regionNameFilter(currentRegion) { // e.g. Turn MM480 into MM
    for (const [region, subRegions] of Object.entries(MULTIPLE_WIN_REGIONS)) {
        if (Object.values(subRegions).includes(currentRegion)) {
            return region;
        }
    }
    return currentRegion;
}

function findCurrentCellAttempt() {
    let found = false;
    let newRow, newCol;

    for (let rowIndex = 0; rowIndex < BingoClient.board.length; rowIndex++) {
        const row = BingoClient.board[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
            const cell = row[colIndex];
            const { hero, region } = cell.game_info;

            if ((hero === getHero(self.heroType) || hero === "ANY") && regionNameFilter(region.name) === self.regionName) {
                const currentCellData = bingoSaveData.board[rowIndex][colIndex]
                currentCellData.row = rowIndex;
                currentCellData.col = colIndex;
                currentCellData.region = region.name;

                newRow = rowIndex;
                newCol = colIndex;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    return [found, newRow, newCol];
}

function saveAttempt() {
    if (!self) return;
    if (self.areaNumber === 1 || self.survivalTime < 40) return;
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
    currentCellData.hero = getHero(self.heroType);
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
    if (nameArray && nameArray.includes(args[0])) {
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

/*
override("globalEntities", function () {
    return this._globalEntities;
}, function (to) {
    if (!(to instanceof Array)) state = this;
    return this._globalEntities = to;
});
*/

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

                    // Per frame
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
    if (e.key === "t") {
        //console.log(state);
        //console.log(self);
    }
    if (e.key === "+") {
        makeMarkAttempt();
    }
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


function updateMiniHoverArea() {
    const rect = miniBoardEl.getBoundingClientRect();

    miniHoverArea.style.width = `${rect.width}px`;

    // Extend downward by extra pixels so the pointer stays inside
    const extraPadding = 20;
    miniHoverArea.style.height = `${rect.height + extraPadding}px`;
    miniHoverArea.style.width = `${rect.width + extraPadding}px`;

    miniHoverArea.style.top = `${miniBoardEl.offsetTop}px`;
    miniHoverArea.style.left = `${miniBoardEl.offsetLeft}px`;
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

    updateMiniHoverArea();
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
    // Tooltip events (extra info on hover)
    div.addEventListener('mouseenter', (e) => {
        tooltipEl.innerHTML = `
                    <strong>${cell.game_info.region.name}</strong><br>
                    Hero: ${cell.game_info.hero || 'N/A'}<br>
                    ${cell.marked_info.is_marked
                ? `Marked by: ${cell.marked_info.player || 'Unknown'}<br>
                           Team: ${cell.marked_info.team || 'None'}<br>
                           Time: ${cell.marked_info.time || 'N/A'}<br>
                           Area Number: ${cell.marked_info.reached_index || 'N/A'}`
                : 'Not marked'}
                `;
        tooltipEl.style.opacity = '1';
    });

    div.addEventListener('mousemove', (e) => {
        tooltipEl.style.left = e.pageX + 15 + 'px';
        tooltipEl.style.top = e.pageY + 15 + 'px';
    });

    div.addEventListener('mouseleave', () => {
        tooltipEl.style.opacity = '0';
    });
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
    div.classList.remove('team-none', 'team-blue', 'team-green', 'team-red');

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

function updateTooltipInfo(div, cell) {
    div.removeEventListener('mouseenter', () => { });
    div.removeEventListener('mousemove', () => { });
    div.removeEventListener('mouseleave', () => { });
    addTooltipInfo(div, cell);
}

function updateCellBigBoard(targetCell, row, col) {
    const div = document.getElementById(`big-cell-${row}-${col}`);
    if (!div) return;

    updateTeamClass(div, targetCell)
    updateMarkedInfo(div, targetCell)
    updateTooltipInfo(div, targetCell)
}

function updateBoard(targetCell, row, col) {
    updateCellMiniBoard(targetCell, row, col);
    updateCellBigBoard(targetCell, row, col);
}

function updateWholeBoard() {
    BingoClient.board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            updateBoard(cell, rowIndex, colIndex);
        });
    })
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
}

function showBingoBoardUI() {
    const bingoBoardUI = document.getElementById('boardsWrapper');

    if (!bingoBoardUI) return;
    bingoBoardUI.style.display = 'flex';
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
    top: 50%;
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
    //const boardsWrapper = document.getElementById('boardsWrapper');
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

addMessageHandler();
//addBingoBoardUI(board);