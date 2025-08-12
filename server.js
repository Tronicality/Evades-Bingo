// Server Logic
const WebSocket = require('ws');

const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT });

let roomPool = {};
let userIds = new Set([]);

const minMarkAttemptTime = 40; // seconds
const TEAMS = new Set(['red', 'green', 'blue']);

const SERVER_MESSAGES = {
    TYPES: {
        REGISTERED: 'registered',
        GAME_INFO: 'game_info',
        ERROR: 'error',
        CREATE_ROOM: 'create_room',
        ROOM_CREATED: 'room_created',
        ROOM_JOINED: 'room_joined',
        LEFT_ROOM: 'left_room',
        GAME_STARTED: 'game_started',
        GAME_RESTARTED: 'game_restarted',
        GAME_END: 'game_ended',
        UPDATE_BOARD: 'update_board',
        UPDATE_TEAMS: 'update_teams',
        MARK_ATTEMPT: 'mark_attempt',
        PLAYER_LEFT: 'player_left',
        NEW_ADMIN: 'new_admin',
    },
    ERROR: {
        USER_ID_EXISTS: 'User ID already exists',
        USER_ID_NOT_FOUND: 'User ID not found, please register.',
        ROOM_NOT_FOUND: 'Room not found',
        ROOM_FULL: 'Room is full',
        NOT_IN_ROOM: 'You are not in this room',
        NOT_ROOM_ADMIN: 'Only the room admin can perform this action',
        GAME_ALREADY_STARTED: 'Game already started',
        NOT_ENOUGH_PLAYERS: 'Not enough players to start the game',
        GAME_NOT_STARTED: 'Game has not started yet',
        TEAM_NOT_FOUND: 'Your team does not exist',
        INVALID_CELL_COORDINATES: 'Invalid cell coordinates',
        MARK_ATTEMPT: 'Cell already marked with a better score or time',
        GAME_ENDED: 'Game has ended',
        TEAM_ALREADY_EXISTS: 'You are already on a team',
        ROOM_ALREADY_EXISTS: 'Room already exists',
    },
    GAME: {
        STARTED: 'Game has started!',
        RESTARTED: 'Game has been restarted!',
    },
    MARK: {
        AREA: 'Cell already marked with a better area number',
        TIME: 'Cell already marked with a better time earlier',
    },
    ROOM: {
        LEFT: 'You have left the room',
        CLOSED: 'Room has closed',
    },
    TEAM: {
        JOINED: 'You have joined a team',
        CHANGED: 'You have changed teams',
        LEFT: 'You have left a team',
    },
    RULES: {
        MIN_TIME: `You can't post with a time less than ${minMarkAttemptTime}s`,
        CELL_ALREADY_MARKED: 'Cell already marked',
    },
};

// Generates a random number between 0 and max (inclusive)
function randomNumber(max) {
    return Math.floor(Math.random() * (max + 1));
}

wss.on('connection', (ws) => {
    console.log(`${ws.id || "Client"} connected`);

    ws.on('message', (message) => {
        handleMessage(JSON.parse(message), ws)
    })

    ws.on('close', () => {
        handleGameDisconnect(ws.id)
        console.log(`${ws.id || "Client"} disconnected`);
    })
})

function validateSendMessage(type, message) {
    // doesn't exist in server_messages.type 
    if (true) {
        console.error(`Failed to send. Type: ${type}, Message: ${message}`)
        return false;
    }
    return true;
}

function validateSendData(type, data) {
    // doesn't exist in server_messages.type

    if (true) {
        console.error(`Failed to send. Type: ${type}, Message: ${data}`)
        return false;
    }
    return true;
}

function sendMessage(ws, type, message) {
    //if (!validateSendMessage(type, message)) return;

    ws.send(JSON.stringify({ type: type, message: message }))
}

function sendData(ws, type, data) {
    //if (!validateSendData(type, data)) return;

    ws.send(JSON.stringify({ type: type, data: data }))
}

function registerUser(ws, userId) {
    if (userIds.has(userId)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_EXISTS);
        return;
    }

    userIds.add(userId);
    ws.id = userId; // Assign user ID to the WebSocket
    sendData(ws, SERVER_MESSAGES.TYPES.REGISTERED, { id: ws.id })
}

function generateStringPassword(length = 6) {
    // So secure :o

    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';

    for (let i = 0; i < length; i++) {
        password += characters.charAt(randomNumber(characters.length - 1));
    }

    return password;
}

function updateRoomActionTimer(room) {
    room.last_action = Date.now();
}

function validateTeamRequest(data, ws) {
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }

    if (!data.room_id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    if (!roomPool[data.room_id]) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    if (!data.team) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.TEAM_NOT_FOUND);
        return false;
    }

    if (!TEAMS.has(data.team)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.TEAM_NOT_FOUND);
        return false;
    }

    return true;
}

function isPlayerInTeam(room, ws, isJoining = true) {
    let found = false;

    Object.values(room.teams).forEach((teamList) => {
        const teamIndex = teamList.findIndex((userId) => userId === ws.id);

        if (teamIndex === -1) return;
        found = true;
    })

    if (found && isJoining) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.TEAM_ALREADY_EXISTS)
    }
    else if (!found && !isJoining) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.TEAM_NOT_FOUND)
    }

    return found
}

function teamUpdate(room) {
    updateRoomActionTimer(room);
    room.players.forEach((player) => {
        sendData(player, SERVER_MESSAGES.TYPES.UPDATE_TEAMS, { teams: room.teams });
    })
}

function joinTeam(data, ws, changeTeam = false) {
    if (!changeTeam) {
        if (!validateTeamRequest(data, ws)) return;
    }

    const room = roomPool[data.room_id];

    if (isPlayerInTeam(room, ws)) return;

    Object.entries(room.teams).forEach(([teamName, teamList]) => {
        if (data.team === teamName) {
            teamList.push(ws.id);
        }
    })

    if (!changeTeam) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.GAME_INFO, SERVER_MESSAGES.TEAM.JOINED);
        teamUpdate(room);
        //sendData(ws, SERVER_MESSAGES.TYPES.UPDATE_TEAMS, { teams: room.teams });
    }
}

function leaveTeam(data, ws, changeTeam = false) {
    if (!changeTeam) {
        if (!validateTeamRequest(data, ws)) return;
    }

    const room = roomPool[data.room_id];

    if (!isPlayerInTeam(room, ws, false)) return;

    Object.entries(room.teams).forEach(([teamName, teamList]) => {
        const playerIndex = teamList.findIndex(playerId => playerId === ws.id);

        if (playerIndex === -1) return;

        room.teams[teamName].splice(playerIndex, 1);
    });

    if (!changeTeam) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.GAME_INFO, SERVER_MESSAGES.TEAM.LEFT);
        teamUpdate(room);
        //sendData(ws, SERVER_MESSAGES.TYPES.UPDATE_TEAMS, { teams: room.teams });
    }
}

function changeTeam(data, ws) {
    if (!validateTeamRequest(data, ws)) return;

    const room = roomPool[data.room_id]

    leaveTeam(data, ws, true);
    joinTeam(data, ws, true);

    sendMessage(ws, SERVER_MESSAGES.TYPES.GAME_INFO, SERVER_MESSAGES.TEAM.CHANGED);
    teamUpdate(room);
    //sendData(ws, SERVER_MESSAGES.TYPES.UPDATE_TEAMS, { teams: room.teams });
}

function createTeams() {
    const teamStorage = {};
    TEAMS.forEach((teamName) => {
        teamStorage[teamName] = [];
    })

    return teamStorage; // { 'red': [], 'blue': [] }
}

function isPlayerInARoom(ws) {
    let found = false;

    Object.values(roomPool).forEach((room) => {
        const playerIndex = room.players.findIndex((player) => player.id === ws.id);

        if (playerIndex === -1) return;
        found = true;
    })

    return found
}

function validateCreateRoom(ws) {
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }
    
    if (isPlayerInARoom(ws)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_ALREADY_EXISTS)
        return false;
    }

    return true;
}

function createRoom(data, ws) {
    if (!validateCreateRoom(ws)) return;

    let roomId = generateStringPassword();

    while (roomPool[roomId]) {
        roomId = generateStringPassword(); // Ensure unique room ID
    }

    roomPool[roomId] = {
        players: [ws],
        teams: createTeams(),
        //mode: data.mode,
        //lockout: false,
        board: generateBoard(DEFAULT_BOARD_SIZE),
        max_player_count: data.max_player_count || 2,
        game_started: false,
        game_ended: false,
        admin: ws.id,
        time: Date.now(),
        last_action: Date.now(),
    };

    data.room_id = roomId;
    data.team = (data.team) ? data.team : 'red';

    joinTeam(data, ws);

    sendData(ws, SERVER_MESSAGES.TYPES.ROOM_CREATED, { id: roomId }); // SEND IT THROUGH PLAIN TEXT LETS GOOOOOOO
    console.log(`Room ${roomId} created`);
}

function validateJoinRoom(roomId, ws) {
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }

    if (!roomPool[roomId]) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    if (roomPool[roomId].players.length >= roomPool[roomId].max_player_count) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_FULL);
        return false;
    }

    return true;
}

function joinRoom(data, ws) {
    const roomId = data.room_id;

    if (!validateJoinRoom(roomId, ws)) return;

    const room = roomPool[roomId]

    updateRoomActionTimer(room)

    room.players.push(ws);
    sendData(ws, SERVER_MESSAGES.TYPES.ROOM_JOINED, { id: roomId });
    console.log(`User ${ws.id} joined room ${roomId}`);
}

function validateStartGame(room, ws) {
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }

    if (!room) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    if (!room.players.includes(ws)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.NOT_IN_ROOM);
        return false;
    }

    if (room.admin !== ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.NOT_ROOM_ADMIN);
        return false;
    }

    if (room.game_started) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.GAME_ALREADY_STARTED);
        return false;
    }

    /*
    if (room.players.length < 2) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.NOT_ENOUGH_PLAYERS);
        return false;
    }
    */

    return true;
}

function startGame(data, ws) {
    const roomId = data.room_id;
    const room = roomPool[roomId];

    if (!validateStartGame(room, ws)) return;

    updateRoomActionTimer(room)

    room.game_started = true;
    //room.board = generateBoard(DEFAULT_BOARD_SIZE);
    room.game_ended = false;
    room.players.forEach(player => {
        sendData(player, SERVER_MESSAGES.TYPES.GAME_STARTED, { board: room.board });
        sendMessage(player, SERVER_MESSAGES.TYPES.GAME_INFO, SERVER_MESSAGES.GAME.STARTED);
    });

    console.log(`Game started in room ${roomId}`);
}

function validateGameRestart(room, ws) { // I know this is the same function as validateGameStart, in future i'll redo things to prevent repetition
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }

    if (!room) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    if (!room.players.includes(ws)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.NOT_IN_ROOM);
        return false;
    }

    if (room.admin !== ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.NOT_ROOM_ADMIN);
        return false;
    }

    if (room.game_started) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.GAME_ALREADY_STARTED);
        return false;
    }

    return true;
}

function restartGame(data, ws) {
    const roomId = data.room_id;
    const room = roomPool[roomId];

    if (!validateGameRestart(room, ws)) return;

    updateRoomActionTimer(room)

    room.board = generateBoard(DEFAULT_BOARD_SIZE);
    room.game_started = false;
    room.game_ended = false;

    room.players.forEach(player => {
        //sendData(player, SERVER_MESSAGES.TYPES.GAME_RESTARTED, { board: room.board });
        sendMessage(player, SERVER_MESSAGES.TYPES.GAME_INFO, SERVER_MESSAGES.GAME.RESTARTED);
    });

    console.log(`Game restarted in room ${roomId}`);
}

function findUserTeam(userId, room) {
    for (const [_, teamList] of Object.entries(room.teams)) {
        const playerIndex = teamList.findIndex((playerId) => playerId === userId);

        if (playerIndex === -1) continue;
        return true
    }

    return false
}

function validateMakeMove(room, ws, cell) { // again in future i'll redo validation (cuz might never come back to it - Bert 12/08/2025 3pm)
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }

    if (!room) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    if (!room.players.includes(ws)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.NOT_IN_ROOM);
        return false;
    }

    if (!room.game_started) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.GAME_NOT_STARTED);
        return false;
    }

    if (room.game_ended) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.GAME_ENDED);
        return false;
    }

    if (!findUserTeam(ws.id, room)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.TEAM_NOT_FOUND);
        return false;
    }

    /*
    if (!TEAMS.has(cell.team)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.TEAM_NOT_FOUND);
        return false;
    }
    */

    if (!cell || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.INVALID_CELL_COORDINATES);
        return false;
    }

    if (cell.row < 0 || cell.row >= room.board.length || cell.col < 0 || cell.col >= room.board.length) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.INVALID_CELL_COORDINATES);
        return false;
    }

    return true;
}

function canMarkCell(oldCell, newCell, ws) {
    /* // Lockout moment
    const targetCell = room.board[cell.row][cell.col];
    if (targetCell.marked_info.is_marked) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.MARK_ATTEMPT, SERVER_MESSAGES.RULES.CELL_ALREADY_MARKED);
        return false;
    }
    */

    if (!oldCell.marked_info.is_marked) {
        return true;
    }

    if (newCell.time < minMarkAttemptTime) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.MARK_ATTEMPT, SERVER_MESSAGES.RULES.MIN_TIME);
        return false; // Player tryna cheat
    }

    if (newCell.index < oldCell.marked_info.reached_index) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.MARK_ATTEMPT, SERVER_MESSAGES.MARK.AREA);
        return false; // Player has not beaten other player area max
    }

    if (newCell.time >= oldCell.marked_info.time && newCell.index === oldCell.marked_info.reached_index) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.MARK_ATTEMPT, SERVER_MESSAGES.MARK.TIME);
        return false; // Player has not beaten other player time
    }

    return true;
}

function makeMove(data, ws) {
    const roomId = data.room_id;
    const newCell = data.cell;

    if (!validateMakeMove(roomPool[roomId], ws, newCell)) return;

    const room = roomPool[roomId];
    const oldCell = room.board[newCell.row][newCell.col];

    updateRoomActionTimer(room)

    if (!canMarkCell(oldCell, newCell, ws)) return;

    oldCell.marked_info.is_marked = true;
    oldCell.marked_info.player = ws.id;
    oldCell.marked_info.reached_index = newCell.index;
    oldCell.marked_info.time = newCell.time;
    oldCell.marked_info.team = newCell.team;

    console.log(`User ${ws.id} marked cell at (${newCell.row}, ${newCell.col}) in room ${roomId}`);
    if (checkBingo(room.board, data.cell.team)) {
        //console.log(`User ${ws.id} won in room ${roomId}`);

        room.game_ended = true;
        room.players.forEach(player => {
            sendData(player, SERVER_MESSAGES.TYPES.GAME_END, { winner: ws.id });
        });
    }

    // Notify players about the move
    room.players.forEach(player => {
        sendMessage(player, SERVER_MESSAGES.TYPES.GAME_INFO, `${ws.id} marked ${room.board[newCell.row][newCell.col].game_info.region.name} at (${newCell.row}, ${newCell.col})`)
        sendData(player, SERVER_MESSAGES.TYPES.UPDATE_BOARD, { cell: oldCell, row: newCell.row, col: newCell.col });
    });
}

function findAndRemovePlayerFromRoom(userId) {
    let found = false;
    Object.values(roomPool).forEach((room) => {
        const playerIndex = room.players.findIndex((ws) => ws.id === userId);

        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            found = true;
        }
    })

    return found;
}

function removeRoom(roomId) {
    const room = roomPool[roomId];

    room.players.forEach((player) => {
        sendMessage(player, SERVER_MESSAGES.TYPES.LEFT_ROOM, SERVER_MESSAGES.ROOM.CLOSED);
    })

    delete roomPool[roomId];
    console.log(`Room ${roomId} deleted`);
}

function validateLeaveRoom(data, ws) {
    if (!ws.id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.USER_ID_NOT_FOUND);
        return false;
    }

    if (!data.room_id) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.ERROR, SERVER_MESSAGES.ERROR.ROOM_NOT_FOUND);
        return false;
    }

    return true;
}

function leaveRoom(data, ws) {
    if (!validateLeaveRoom(data, ws)) return;

    const roomId = data.room_id;
    const room = roomPool[roomId];

    updateRoomActionTimer(room)

    if (findAndRemovePlayerFromRoom(ws.id)) {
        sendMessage(ws, SERVER_MESSAGES.TYPES.LEFT_ROOM, SERVER_MESSAGES.ROOM.LEFT);
    }

    //console.log(`User ${ws.id} left room ${roomId}`);

    if (room.players.length === 0) {
        removeRoom(roomId)
    } else {
        // Notify remaining players
        room.players.forEach(player => {
            sendData(player, SERVER_MESSAGES.TYPES.PLAYER_LEFT, { user_id: ws.id });
        });
        console.log(`Remaining players notified in room ${roomId}`);
    }

    if (room.admin === ws.id) {
        // If the admin leaves, assign a new admin
        if (room.players.length > 0) {
            const newAdmin = room.players[0].id // Assign the first player as the new admin
            room.admin = newAdmin; 
            sendData(newAdmin, SERVER_MESSAGES.TYPES.NEW_ADMIN, { user_id: newAdmin });
            console.log(`New admin assigned: ${room.admin}`);
        }
    }
}

function handleMessage(message, ws) {
    switch (message.type) {
        case 'register':
            registerUser(ws, message.data.user_id);
            break;
        case 'make_move':
            makeMove(message.data, ws);
            break;
        case 'create_room':
            createRoom(message.data, ws);
            break;
        case 'join_room':
            joinRoom(message.data, ws);
            break;
        case 'start_game':
            startGame(message.data, ws);
            break;
        case 'restart_game':
            restartGame(message.data, ws);
            break;
        case 'leave_room':
            leaveRoom(message.data, ws);
            break;
        case 'join_team':
            joinTeam(message.data, ws);
            break;
        case 'leave_team':
            leaveTeam(message.data, ws);
            break;
        case 'change_team':
            changeTeam(message.data, ws);
            break;
        default:
            console.error('Unknown message type:', message.type);
    }
}

function handleGameDisconnect(userId) {
    userIds.delete(userId);

    findAndRemovePlayerFromRoom(userId);

    // Maybe add buffer for reconnect chances
}

function checkRoomRemoval() {
    const roomsToRemove = [];
    const TIMER = 600 * 1000 // 10 mins

    Object.entries(roomPool).forEach(([id, room]) => {
        const currentTime = Date.now();

        if (room.players.length === 0 || currentTime - room.last_action > TIMER) {
            roomsToRemove.push(id);
        }
    });

    roomsToRemove.forEach((id) => removeRoom(id));
}

// Game Logic


const DEFAULT_BOARD_SIZE = 5;
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
    "Endless Echo": 0,
    "Endless Echo Hard": 0,
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
    "Pristine Purgatory Eternal": 22,
    "Pristine Purgatory Veydris": 23,
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

const HEROES = [
    "Magmax",
    "Rime",
    "Morfe",
    "Aurora",
    "Necro",
    "Brute",
    "Nexus",
    "Shade",
    "Euclid",
    "Chrono",
    "Reaper",
    "Rameses",
    "Jolt",
    "Ghoul",
    "Cent",
    "Jötunn",
    "Candy",
    "Mirage",
    "Boldrock",
    "Glob",
    "Magno",
    "Ignis",
    "Stella",
    "Viola",
    "Mortuus",
    "Cybot",
    "Echelon",
    "Demona",
    "Stheno",
    "Factorb",
    "Veydris",
];

function regionNameFilter(currentRegion) {
    for (const [region, subRegions] of Object.entries(MULTIPLE_WIN_REGIONS)) {
        if (Object.values(subRegions).includes(currentRegion)) {
            return region;
        }
    }
    return currentRegion;
}

function generateRegion(usedRegions) {
    let area;
    let areaNumber;

    do {
        area = Object.keys(REGIONS)[randomNumber(Object.keys(REGIONS).length - 1)];
        areaNumber = REGIONS[area];

        /*
        if (MULTIPLE_WIN_REGIONS[area] && MULTIPLE_WIN_REGIONS[area][areaNumber]) {
            area = MULTIPLE_WIN_REGIONS[area][areaNumber];
        }
        */
    } while (usedRegions.has(regionNameFilter(area)));

    usedRegions.add(regionNameFilter(area));
    return { name: area, index: areaNumber };
}

function generateHero(region) {
    let hero = HEROES[randomNumber(HEROES.length - 1)];

    if (region.name.includes("Pristine Purgatory") && region.index === 23) {
        hero = "Veydris";
    }
    else if (region.name.includes("Haunted Halls") && region.index === 25) {
        hero = "Reaper";
    }
    else {
        if (randomNumber(2) === 0) {
            hero = "ANY";
        }
    }

    return hero;
}

function generateGoal(usedRegions) {
    const goal = {};
    const region = generateRegion(usedRegions);
    const hero = generateHero(region);

    goal.region = region;
    goal.hero = hero;
    return goal;
}

function generateCell(usedRegions) {
    const cell = {};

    const markedInfo = {
        is_marked: false,
        player: null,
        reached_index: null,
        time: null,
        team: null,
    }

    cell.game_info = generateGoal(usedRegions);
    cell.marked_info = markedInfo;
    //cell.settings = {};

    return cell;
}

function generateBoard(size) {
    let board = [];
    const usedRegions = new Set();

    for (let i = 0; i < size; i++) {
        let row = [];
        for (let j = 0; j < size; j++) {
            row.push(generateCell(usedRegions));
        }
        board.push(row);
    }

    return board;
}

function checkDirection(board, row, col, direction, team) {
    const size = board.length;

    for (let i = 0; i < size; i++) {
        const r = row + i * direction[0];
        const c = col + i * direction[1];

        // Check if the position is out of bounds or the square is not marked on a certain team
        if (r < 0 || r >= size || c < 0 || c >= size || !board[r][c].marked_info.is_marked || board[r][c].marked_info.team !== team) {
            return false;
        }
    }

    return true; // All squares in the direction are marked
}

function checkHorizontalRow(board, row, team) {
    const size = board.length;
    for (let col = 0; col < size; col++) {
        if (checkDirection(board, row, col, [0, 1], team)) {
            return true;
        }
    }
    return false;
}

function checkHorizontalWin(board, team) {
    const size = board.length;
    for (let row = 0; row < size; row++) {
        if (checkHorizontalRow(board, row, team)) {
            return true;
        }
    }
}
function checkVerticalRow(board, col, team) {
    const size = board.length;
    for (let row = 0; row < size; row++) {
        if (checkDirection(board, row, col, [1, 0], team)) {
            return true;
        }
    }
    return false;
}
function checkVerticalWin(board, team) {
    const size = board.length;
    for (let col = 0; col < size; col++) {
        if (checkVerticalRow(board, col, team)) {
            return true;
        }
    }
}
function checkDiagonalWin(board, team) {
    const size = board.length;
    // Check \
    if (checkDirection(board, 0, 0, [1, 1], team)) {
        return true;
    }

    // Check /
    if (checkDirection(board, 0, size - 1, [1, -1], team)) {
        return true;
    }
    return false;
}

function checkBingo(board, team) {
    return checkHorizontalWin(board, team) || checkVerticalWin(board, team) || checkDiagonalWin(board, team);
}

setInterval(() => {
    checkRoomRemoval();
}, 1 * 1000)

console.log(`WebSocket server is running on https://${process.env.PROJECT_DOMAIN || 'localhost'}:${PORT}`); 