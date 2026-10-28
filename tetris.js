// 修正後的第一行：確保網頁能正常初始化 socket 連線
const socket = io(window.location.origin);


// 宣告自己的畫布
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

// 宣告對手的畫布
const opponentCanvas = document.getElementById('opponent');
const oppContext = opponentCanvas.getContext('2d');
oppContext.scale(20, 20);

const statusText = document.getElementById('status');
const scoreText = document.getElementById('score');

const arena = createMatrix(12, 20);
let score = 0;
let gameRunning = false;

// 7種方塊的顏色對照表 (1=I, 2=J, 3=L, 4=O, 5=S, 6=T, 7=Z, 8=垃圾塊灰色)
const COLORS = [
    null,
    '#00f0f0', // 1: I (青色)
    '#0000f0', // 2: J (藍色)
    '#f0a000', // 3: L (橘色)
    '#f0f000', // 4: O (黃色)
    '#00f000', // 5: S (綠色)
    '#a000f0', // 6: T (紫色)
    '#f00000', // 7: Z (紅色)
    '#555555'  // 8: 垃圾塊 (灰色)
];

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
};

// 產生 7 種形狀矩陣
function createPiece(type) {
    if (type === 'T') {
        return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
    } else if (type === 'O') {
        return [[2, 2], [2, 2]];
    } else if (type === 'L') {
        return [[0, 0, 3], [3, 3, 3], [0, 0, 0]];
    } else if (type === 'J') {
        return [[4, 0, 0], [4, 4, 4], [0, 0, 0]];
    } else if (type === 'I') {
        return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
    } else if (type === 'S') {
        return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    } else if (type === 'Z') {
        return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
    }
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) { matrix.push(new Array(w).fill(0)); }
    return matrix;
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (arena[y + o.y] &&
                arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function playerReset() {
    const pieces = 'ILJOSTZ';
    player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    
    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        score = 0;
        scoreText.innerText = "分數: " + score;
        statusText.innerText = "你爆掉了！遊戲結束";
        gameRunning = false;
    }
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) { matrix.forEach(row => row.reverse()); } 
    else { matrix.reverse(); }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) { continue outer; }
        }
        const row = arena.splice(y, 1).fill(0);
        arena.unshift(row);
        ++y;
        rowCount++;
    }
    if (rowCount > 0) {
        score += rowCount * 10;
        scoreText.innerText = "分數: " + score;
        if (rowCount >= 2) { socket.emit('sendAttack', rowCount - 1); }
    }
}

function playerDrop() {
    if (!gameRunning) return;
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        playerReset();
    }
    dropCounter = 0;
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = COLORS[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(arena, {x: 0, y: 0}, context);
    if (player.matrix) {
        drawMatrix(player.matrix, player.pos, context);
    }
    
    if (gameRunning) {
        socket.emit('updateBoard', {
            arena: arena,
            playerMatrix: player.matrix,
            playerPos: player.pos
        });
    }
}

let dropCounter = 0;
let dropInterval = 1000; 
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) { playerDrop(); }
    draw();
    requestAnimationFrame(update);
}

socket.on('message', (msg) => { statusText.innerText = msg; });
socket.on('gameStart', (data) => {
    statusText.innerText = data.message;
    arena.forEach(row => row.fill(0)); 
    playerReset();
    gameRunning = true;
});
socket.on('opponentLeft', (msg) => {
    statusText.innerText = msg;
    gameRunning = false;
});

socket.on('getAttacked', (lines) => {
    if (!gameRunning) return;
    for (let i = 0; i < lines; i++) {
        arena.shift();
        const garbageRow = new Array(12).fill(8); 
        const holeIndex = Math.floor(Math.random() * 12);
        garbageRow[holeIndex] = 0;
        arena.push(garbageRow);
    }
    if (collide(arena, player)) {
        statusText.innerText = "你爆掉了！遊戲結束";
        gameRunning = false;
    }
});

socket.on('getOpponentBoard', (data) => {
    oppContext.fillStyle = '#000';
    oppContext.fillRect(0, 0, opponentCanvas.width, opponentCanvas.height);
    drawMatrix(data.arena, {x: 0, y: 0}, oppContext);
    if (data.playerMatrix) {
        drawMatrix(data.playerMatrix, data.playerPos, oppContext);
    }
});

document.addEventListener('keydown', event => {
    if (!gameRunning) return;
    if (event.key === 'ArrowLeft') {
        player.pos.x--;
        if (collide(arena, player)) player.pos.x++;
    } else if (event.key === 'ArrowRight') {
        player.pos.x++;
        if (collide(arena, player)) player.pos.x--;
    } else if (event.key === 'ArrowDown') {
        playerDrop();
    } else if (event.key === 'ArrowUp') {
        playerRotate(1); 
    }
});

update();
