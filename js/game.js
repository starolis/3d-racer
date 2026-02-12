// ============================================================
// 3D Racer - Game Engine
// A first-person racing game with car selection and AI opponents
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Internal resolution (game always renders at this size)
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// HiDPI canvas scaling for sharp rendering on retina screens
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
    // CSS size stays at container size (set in CSS)
}
setupCanvas();

// Target frame rate for physics normalization (60 FPS baseline)
const TARGET_DT = 1000 / 60;
let lastFrameTime = 0;

// Game state
let gameStarted = false;
let gameEnded = false;
let selectedCarType = null;
let trackOffset = 0;
let countdownActive = false;
let countdownNumber = 3;
let trackCurve = 0;
let trackCurveTarget = 0;

// Car type definitions with different stats
const carTypes = {
    speedster: {
        name: 'Speedster',
        color: '#ff0000',
        maxSpeed: 14,
        acceleration: 0.25,
        turnSpeed: 3.5,
        friction: 0.04,
        advantage: 'Highest top speed for long straightaways'
    },
    balanced: {
        name: 'All-Rounder',
        color: '#00aa00',
        maxSpeed: 11,
        acceleration: 0.3,
        turnSpeed: 4.5,
        friction: 0.05,
        advantage: 'Well-balanced for all situations'
    },
    accelerator: {
        name: 'Rocket',
        color: '#ffdd00',
        maxSpeed: 10,
        acceleration: 0.45,
        turnSpeed: 4,
        friction: 0.06,
        advantage: 'Quick off the line, great for overtaking'
    },
    handler: {
        name: 'Drifter',
        color: '#0066ff',
        maxSpeed: 11,
        acceleration: 0.28,
        turnSpeed: 6,
        friction: 0.055,
        advantage: 'Superior control for tight maneuvering'
    }
};

// Track properties
const track = {
    width: 600,
    centerX: GAME_WIDTH / 2,
    roadColor: '#404040',
    grassColor: '#2d5016',
    lineColor: '#ffffff'
};

// Lap / checkpoint config
const LAP_LENGTH = 6000;
const CHECKPOINT_COUNT = 4;
const CHECKPOINT_DISTANCE = LAP_LENGTH / CHECKPOINT_COUNT;
const TOTAL_LAPS = 3;

// Player car (initialized after selection)
let player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 80,
    width: 40,
    height: 70,
    speed: 0,
    maxSpeed: 12,
    acceleration: 0.3,
    friction: 0.05,
    turnSpeed: 4,
    color: '#ff0000',
    lane: 0,
    laps: 0,
    checkpoints: [false, false, false, false],
    trackPosition: 0,
    lastTrackPosition: 0
};

// AI opponents with different car types
const opponents = [
    {
        x: GAME_WIDTH / 2 - 80,
        y: GAME_HEIGHT - 250,
        width: 40,
        height: 70,
        speed: 9.5,
        color: '#0066ff',
        lane: -1,
        laps: 0,
        checkpoints: [false, false, false, false],
        maxSpeed: 11,
        acceleration: 0.28,
        carType: 'handler',
        trackPosition: 150,
        lastTrackPosition: 150
    },
    {
        x: GAME_WIDTH / 2 + 80,
        y: GAME_HEIGHT - 350,
        width: 40,
        height: 70,
        speed: 11,
        color: '#ff0000',
        lane: 1,
        laps: 0,
        checkpoints: [false, false, false, false],
        maxSpeed: 14,
        acceleration: 0.25,
        carType: 'speedster',
        trackPosition: 300,
        lastTrackPosition: 300
    },
    {
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT - 450,
        width: 40,
        height: 70,
        speed: 8.5,
        color: '#ffdd00',
        lane: 0,
        laps: 0,
        checkpoints: [false, false, false, false],
        maxSpeed: 10,
        acceleration: 0.45,
        carType: 'accelerator',
        trackPosition: 450,
        lastTrackPosition: 450
    }
];

// Road lines for perspective effect
const roadLines = [];
const vanishingY = GAME_HEIGHT * 0.35;
for (let i = 0; i < 15; i++) {
    roadLines.push({
        y: vanishingY + i * 50,
        height: 30
    });
}

// Input state
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

// ============================================================
// Event Listeners
// ============================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { keys.up = true; e.preventDefault(); }
    if (e.key === 'ArrowDown') { keys.down = true; e.preventDefault(); }
    if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'ArrowDown') keys.down = false;
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
});

// Mobile touch controls
function setupTouchControls() {
    const touchControls = document.getElementById('touchControls');
    if (!touchControls) return;

    // Show touch controls only on actual touch screens (not Mac trackpads)
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (isCoarsePointer) {
        touchControls.classList.remove('hidden');
    }

    const buttons = {
        'touchUp': 'up',
        'touchDown': 'down',
        'touchLeft': 'left',
        'touchRight': 'right'
    };

    Object.entries(buttons).forEach(([id, key]) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[key] = true;
        });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[key] = false;
        });
        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys[key] = false;
        });
    });
}
setupTouchControls();

// Car selection
document.querySelectorAll('.car-option').forEach(option => {
    option.addEventListener('click', function () {
        document.querySelectorAll('.car-option').forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
        selectedCarType = this.dataset.car;
        document.getElementById('confirmCarButton').disabled = false;
    });
});

document.getElementById('confirmCarButton').addEventListener('click', () => {
    if (selectedCarType) {
        const carStats = carTypes[selectedCarType];
        player.color = carStats.color;
        player.maxSpeed = carStats.maxSpeed;
        player.acceleration = carStats.acceleration;
        player.turnSpeed = carStats.turnSpeed;
        player.friction = carStats.friction;

        // Swap AI opponent colors so they don't match the player's car
        opponents.forEach(opp => {
            if (opp.carType === selectedCarType) {
                // Find a car type that isn't selected and isn't this opponent's type
                const altTypes = Object.keys(carTypes).filter(t => t !== selectedCarType);
                // Pick one that another AI isn't already using
                const usedTypes = opponents.map(o => o.carType);
                const available = altTypes.filter(t => !usedTypes.includes(t) || t === opp.carType);
                const altType = available[0] || altTypes[0];
                opp.color = carTypes[altType].color;
            }
        });

        document.getElementById('carSelection').classList.add('hidden');
        document.getElementById('instructions').classList.remove('hidden');
    }
});

document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('instructions').classList.add('hidden');
    startCountdown();
});

document.getElementById('restartButton').addEventListener('click', () => {
    location.reload();
});

// ============================================================
// Drawing Functions
// ============================================================

function drawTrack() {
    // Sky gradient
    const skyGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT * 0.35);
    skyGradient.addColorStop(0, '#87CEEB');
    skyGradient.addColorStop(1, '#E0F6FF');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.35);

    // Grass
    ctx.fillStyle = track.grassColor;
    ctx.fillRect(0, GAME_HEIGHT * 0.35, GAME_WIDTH, GAME_HEIGHT * 0.65);

    // 3D perspective road with curves
    const vanishingPoint = GAME_WIDTH / 2;
    const horizonY = GAME_HEIGHT * 0.35;
    const roadWidthBottom = track.width;
    const roadWidthTop = 80;

    const curveOffset = trackCurve * 100;

    // Road body
    ctx.fillStyle = track.roadColor;
    ctx.beginPath();
    ctx.moveTo(vanishingPoint - roadWidthTop / 2 + curveOffset, horizonY);
    ctx.lineTo(vanishingPoint + roadWidthTop / 2 + curveOffset, horizonY);
    ctx.lineTo(track.centerX + roadWidthBottom / 2, GAME_HEIGHT);
    ctx.lineTo(track.centerX - roadWidthBottom / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Road center lines with perspective
    roadLines.forEach((line) => {
        const lineProgress = (line.y - horizonY) / (GAME_HEIGHT - horizonY);
        if (lineProgress < 0 || lineProgress > 1) return;

        const roadWidthAtY = roadWidthTop + (roadWidthBottom - roadWidthTop) * lineProgress;
        const curveAtY = curveOffset * (1 - lineProgress);
        const lineWidth = 3 + lineProgress * 7;

        ctx.fillStyle = track.lineColor;
        ctx.globalAlpha = 0.5 + lineProgress * 0.5;

        const centerX = vanishingPoint + curveAtY;
        ctx.fillRect(centerX - lineWidth / 2, line.y, lineWidth, line.height * lineProgress);
    });
    ctx.globalAlpha = 1.0;

    // Road edges
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vanishingPoint - roadWidthTop / 2 + curveOffset, horizonY);
    ctx.lineTo(track.centerX - roadWidthBottom / 2, GAME_HEIGHT);
    ctx.moveTo(vanishingPoint + roadWidthTop / 2 + curveOffset, horizonY);
    ctx.lineTo(track.centerX + roadWidthBottom / 2, GAME_HEIGHT);
    ctx.stroke();

    // Depth segments
    const numSegments = 25;
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i < numSegments; i++) {
        const segmentY = horizonY + (GAME_HEIGHT - horizonY) * (i / numSegments);
        const segmentProgress = (segmentY - horizonY) / (GAME_HEIGHT - horizonY);
        const segmentWidth = roadWidthTop + (roadWidthBottom - roadWidthTop) * segmentProgress;
        const segmentCurve = curveOffset * (1 - segmentProgress);

        ctx.globalAlpha = 0.3 + segmentProgress * 0.4;
        ctx.beginPath();
        ctx.moveTo(vanishingPoint - segmentWidth / 2 + segmentCurve, segmentY);
        ctx.lineTo(vanishingPoint + segmentWidth / 2 + segmentCurve, segmentY);
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Background hills
    ctx.fillStyle = '#4a7c4e';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x < GAME_WIDTH; x += 50) {
        const hillHeight = Math.sin(x * 0.01 + trackOffset * 0.001) * 30;
        ctx.lineTo(x, horizonY + hillHeight);
    }
    ctx.lineTo(GAME_WIDTH, horizonY);
    ctx.lineTo(GAME_WIDTH, horizonY + 80);
    ctx.lineTo(0, horizonY + 80);
    ctx.closePath();
    ctx.fill();
}

function drawCar(car) {
    if (car.y < -car.height || car.y > GAME_HEIGHT + car.height) return;

    const vanishingPoint = GAME_WIDTH / 2;
    const horizonY = GAME_HEIGHT * 0.35;
    const roadWidthTop = 80;
    const roadWidthBottom = track.width;

    const depthFactor = Math.max(0, Math.min(1, (car.y - horizonY) / (GAME_HEIGHT - horizonY)));
    const perspectiveFactor = Math.max(0.15, Math.min(1.0, depthFactor));

    const roadWidthAtY = roadWidthTop + (roadWidthBottom - roadWidthTop) * depthFactor;
    const curveAtY = trackCurve * 100 * (1 - depthFactor);

    const laneOffset = car.lane * (roadWidthAtY / 3);
    const screenX = vanishingPoint + laneOffset + curveAtY;

    const scaledWidth = car.width * perspectiveFactor;
    const scaledHeight = car.height * perspectiveFactor;

    // Car body
    ctx.fillStyle = car.color;
    ctx.fillRect(screenX - scaledWidth / 2, car.y - scaledHeight / 2, scaledWidth, scaledHeight);

    // Windows
    ctx.fillStyle = '#000000';
    ctx.fillRect(
        screenX - scaledWidth / 2 + 5 * perspectiveFactor,
        car.y - scaledHeight / 2 + 10 * perspectiveFactor,
        scaledWidth - 10 * perspectiveFactor,
        15 * perspectiveFactor
    );
    ctx.fillRect(
        screenX - scaledWidth / 2 + 5 * perspectiveFactor,
        car.y + scaledHeight / 2 - 25 * perspectiveFactor,
        scaledWidth - 10 * perspectiveFactor,
        15 * perspectiveFactor
    );

    // Wheels
    ctx.fillStyle = '#222222';
    const wheelWidth = 6 * perspectiveFactor;
    const wheelHeight = 15 * perspectiveFactor;
    ctx.fillRect(screenX - scaledWidth / 2 - 3 * perspectiveFactor, car.y - scaledHeight / 2 + 5 * perspectiveFactor, wheelWidth, wheelHeight);
    ctx.fillRect(screenX + scaledWidth / 2 - 3 * perspectiveFactor, car.y - scaledHeight / 2 + 5 * perspectiveFactor, wheelWidth, wheelHeight);
    ctx.fillRect(screenX - scaledWidth / 2 - 3 * perspectiveFactor, car.y + scaledHeight / 2 - 20 * perspectiveFactor, wheelWidth, wheelHeight);
    ctx.fillRect(screenX + scaledWidth / 2 - 3 * perspectiveFactor, car.y + scaledHeight / 2 - 20 * perspectiveFactor, wheelWidth, wheelHeight);

    // Driver's head
    const headRadius = 12 * perspectiveFactor;
    const headY = car.y - scaledHeight / 2 - headRadius / 2;

    // Head shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(screenX + 1, headY + 1, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#ffdbac';
    ctx.beginPath();
    ctx.arc(screenX, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    const gradient = ctx.createRadialGradient(
        screenX - headRadius * 0.3, headY - headRadius * 0.3, 0,
        screenX, headY, headRadius
    );
    gradient.addColorStop(0, '#444444');
    gradient.addColorStop(1, '#111111');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, headY, headRadius, Math.PI, Math.PI * 2);
    ctx.fill();

    // Goggles
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    const goggleWidth = headRadius * 2.2;
    const goggleHeight = headRadius * 0.5;
    ctx.fillRect(screenX - goggleWidth / 2, headY - goggleHeight / 2, goggleWidth, goggleHeight);

    // Goggle reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(screenX - goggleWidth / 2 + 2, headY - goggleHeight / 2 + 1, goggleWidth * 0.4, goggleHeight * 0.4);
}

function drawPlayerHood() {
    const vanishingPoint = GAME_WIDTH / 2;
    const hoodHeight = 80;
    const hoodWidthBottom = 200;
    const hoodWidthTop = 35;

    // Hood gradient
    const hoodGradient = ctx.createLinearGradient(vanishingPoint, GAME_HEIGHT - hoodHeight, vanishingPoint, GAME_HEIGHT);
    hoodGradient.addColorStop(0, player.color);
    hoodGradient.addColorStop(0.5, player.color);
    hoodGradient.addColorStop(1, shadeColor(player.color, -40));

    // Main hood body
    ctx.fillStyle = hoodGradient;
    ctx.beginPath();
    ctx.moveTo(vanishingPoint - hoodWidthTop / 2, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint + hoodWidthTop / 2, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint + hoodWidthBottom / 2, GAME_HEIGHT);
    ctx.lineTo(vanishingPoint - hoodWidthBottom / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Left side panel
    ctx.fillStyle = shadeColor(player.color, -50);
    ctx.beginPath();
    ctx.moveTo(vanishingPoint - hoodWidthTop / 2, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint - hoodWidthTop / 2 - 20, GAME_HEIGHT - hoodHeight + 15);
    ctx.lineTo(vanishingPoint - hoodWidthBottom / 2 - 25, GAME_HEIGHT);
    ctx.lineTo(vanishingPoint - hoodWidthBottom / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Right side panel
    ctx.fillStyle = shadeColor(player.color, -50);
    ctx.beginPath();
    ctx.moveTo(vanishingPoint + hoodWidthTop / 2, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint + hoodWidthTop / 2 + 20, GAME_HEIGHT - hoodHeight + 15);
    ctx.lineTo(vanishingPoint + hoodWidthBottom / 2 + 25, GAME_HEIGHT);
    ctx.lineTo(vanishingPoint + hoodWidthBottom / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Hood center line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(vanishingPoint - 2, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint - 10, GAME_HEIGHT);
    ctx.lineTo(vanishingPoint + 10, GAME_HEIGHT);
    ctx.lineTo(vanishingPoint + 2, GAME_HEIGHT - hoodHeight);
    ctx.closePath();
    ctx.fill();

    // Hood shine
    const shineGradient = ctx.createLinearGradient(
        vanishingPoint - 15, GAME_HEIGHT - hoodHeight,
        vanishingPoint + 15, GAME_HEIGHT - hoodHeight + 30
    );
    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGradient;
    ctx.beginPath();
    ctx.moveTo(vanishingPoint - 18, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint + 18, GAME_HEIGHT - hoodHeight);
    ctx.lineTo(vanishingPoint + 12, GAME_HEIGHT - hoodHeight + 30);
    ctx.lineTo(vanishingPoint - 12, GAME_HEIGHT - hoodHeight + 30);
    ctx.closePath();
    ctx.fill();

    // Driver's head
    const headRadius = 16;
    const headY = GAME_HEIGHT - hoodHeight - 6;

    // Head shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(vanishingPoint + 2, headY + 2, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Head with gradient
    const headGradient = ctx.createRadialGradient(vanishingPoint - 4, headY - 4, 3, vanishingPoint, headY, headRadius);
    headGradient.addColorStop(0, '#ffecd1');
    headGradient.addColorStop(1, '#d4a574');
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(vanishingPoint, headY, headRadius, 0, Math.PI * 2);
    ctx.fill();

    // Helmet
    const helmetGradient = ctx.createRadialGradient(vanishingPoint - 5, headY - 5, 0, vanishingPoint, headY, headRadius);
    helmetGradient.addColorStop(0, '#555555');
    helmetGradient.addColorStop(0.7, '#222222');
    helmetGradient.addColorStop(1, '#000000');
    ctx.fillStyle = helmetGradient;
    ctx.beginPath();
    ctx.arc(vanishingPoint, headY, headRadius, Math.PI, Math.PI * 2);
    ctx.fill();

    // Helmet stripe
    ctx.fillStyle = player.color;
    ctx.fillRect(vanishingPoint - 13, headY - 7, 26, 4);

    // Goggles
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(vanishingPoint - 14, headY - 4, 28, 7);

    // Goggle reflection
    const goggleGradient = ctx.createLinearGradient(vanishingPoint - 10, headY - 3, vanishingPoint - 4, headY + 1);
    goggleGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    goggleGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = goggleGradient;
    ctx.fillRect(vanishingPoint - 10, headY - 3, 8, 5);
}

function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// ============================================================
// Countdown
// ============================================================

function drawCountdown() {
    if (!countdownActive) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const text = countdownNumber > 0 ? countdownNumber.toString() : 'GO!';
    const color = countdownNumber > 0 ? '#ffff00' : '#00ff00';

    ctx.font = 'bold 150px Arial';
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
    ctx.fillText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);

    // Traffic light
    const lightX = GAME_WIDTH / 2;
    const lightStartY = 120;
    const lightSpacing = 60;

    for (let i = 0; i < 3; i++) {
        const lightY = lightStartY + i * lightSpacing;

        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.arc(lightX, lightY, 25, 0, Math.PI * 2);
        ctx.fill();

        if (countdownNumber === 3 - i) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(lightX, lightY, 20, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (countdownNumber < 3 - i) {
            ctx.fillStyle = '#660000';
            ctx.beginPath();
            ctx.arc(lightX, lightY, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // GO green light
    if (countdownNumber === 0) {
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(lightX, lightStartY + 3 * lightSpacing, 25, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 30;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function startCountdown() {
    countdownActive = true;
    countdownNumber = 3;

    const countdownInterval = setInterval(() => {
        countdownNumber--;

        if (countdownNumber < 0) {
            clearInterval(countdownInterval);
            setTimeout(() => {
                countdownActive = false;
                gameStarted = true;
                lastFrameTime = performance.now();
                gameLoop(lastFrameTime);
            }, 500);
        }
    }, 1000);

    renderCountdown();
}

function renderCountdown() {
    if (!countdownActive && !gameStarted) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawTrack();
    opponents.forEach(opp => drawCar(opp));
    drawPlayerHood();
    drawCountdown();

    if (countdownActive) {
        requestAnimationFrame(renderCountdown);
    }
}

// ============================================================
// Game Logic
// ============================================================

function updatePlayer(dt) {
    if (keys.up && player.speed < player.maxSpeed) {
        player.speed += player.acceleration * dt;
    } else if (keys.down && player.speed > -player.maxSpeed / 2) {
        player.speed -= player.acceleration * 1.5 * dt;
    } else {
        if (player.speed > 0) {
            player.speed -= player.friction * dt;
            if (player.speed < 0) player.speed = 0;
        } else if (player.speed < 0) {
            player.speed += player.friction * dt;
            if (player.speed > 0) player.speed = 0;
        }
    }

    player.lastTrackPosition = player.trackPosition;
    player.trackPosition += player.speed * dt;

    // Lane-based turning
    const laneSpeed = player.turnSpeed * 0.015 * dt;

    if (keys.left && player.lane > -1.2) {
        player.lane -= laneSpeed;
    }
    if (keys.right && player.lane < 1.2) {
        player.lane += laneSpeed;
    }

    player.lane = Math.max(-1.2, Math.min(1.2, player.lane));

    document.getElementById('speed').textContent = Math.round(Math.abs(player.speed * 10));
}

function updateOpponents(dt) {
    opponents.forEach(opp => {
        const speedVariation = opp.acceleration * 3;
        opp.speed += (Math.random() - 0.5) * speedVariation * dt;

        const minSpeed = opp.maxSpeed * 0.75;
        const maxSpeed = opp.maxSpeed * 0.95;
        opp.speed = Math.max(minSpeed, Math.min(maxSpeed, opp.speed));

        opp.lastTrackPosition = opp.trackPosition;
        opp.trackPosition += opp.speed * dt;

        // Screen Y relative to player
        const relativePosition = opp.trackPosition - player.trackPosition;
        opp.y = player.y - relativePosition;

        // Lane changing behavior
        const laneChangeFrequency = opp.carType === 'handler' ? 0.02 : 0.01;
        const targetLane = Math.floor(Math.random() * 3) - 1;

        if (Math.random() < laneChangeFrequency) {
            opp.targetLane = targetLane;
        }

        if (opp.targetLane === undefined) {
            opp.targetLane = opp.lane;
        }

        const laneSpeed = (opp.carType === 'handler' ? 0.05 : 0.03) * dt;
        if (Math.abs(opp.lane - opp.targetLane) > 0.01) {
            opp.lane += opp.lane < opp.targetLane ? laneSpeed : -laneSpeed;
        } else {
            opp.lane = opp.targetLane;
        }
    });
}

function updateRoad(dt) {
    const scrollSpeed = player.speed * 5 * dt;

    roadLines.forEach(line => {
        line.y += scrollSpeed;
        if (line.y > GAME_HEIGHT) {
            line.y = vanishingY - line.height;
        }
        if (line.y < vanishingY - line.height) {
            line.y = GAME_HEIGHT;
        }
    });

    trackOffset += player.speed * dt;

    // Smooth curve transitions
    trackCurve += (trackCurveTarget - trackCurve) * 0.02 * dt;

    if (Math.random() < 0.005) {
        trackCurveTarget = (Math.random() - 0.5) * 2;
    }
    if (Math.random() < 0.003) {
        trackCurveTarget = 0;
    }
}

function updateLaps(car) {
    const positionInLap = ((car.trackPosition % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH;
    const prevPositionInLap = ((car.lastTrackPosition % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH;

    for (let i = 0; i < CHECKPOINT_COUNT; i++) {
        const checkpointPos = i * CHECKPOINT_DISTANCE;

        // Check if car crossed this checkpoint between last frame and this frame
        let crossed = false;
        if (prevPositionInLap <= positionInLap) {
            // Normal case: no wrap
            crossed = prevPositionInLap < checkpointPos && positionInLap >= checkpointPos;
        } else {
            // Wrapped around lap boundary
            crossed = prevPositionInLap < checkpointPos || positionInLap >= checkpointPos;
        }

        if (crossed && !car.checkpoints[i]) {
            car.checkpoints[i] = true;

            // Check if all checkpoints passed
            if (car.checkpoints.every(c => c === true)) {
                car.laps++;
                car.checkpoints = [false, false, false, false];

                if (car === player) {
                    document.getElementById('lapCounter').textContent =
                        `${Math.min(car.laps + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`;
                }

                // Any car finishing triggers end of race
                if (car.laps >= TOTAL_LAPS && !gameEnded) {
                    endGame();
                }
            }
        }
    }
}

function updatePositions() {
    const allCars = [player, ...opponents];
    allCars.sort((a, b) => {
        if (b.laps !== a.laps) return b.laps - a.laps;
        return b.trackPosition - a.trackPosition;
    });

    const playerPosition = allCars.indexOf(player) + 1;
    const suffix = ['st', 'nd', 'rd', 'th'];
    const suffixIndex = playerPosition > 3 ? 3 : playerPosition - 1;
    document.getElementById('position').textContent = `${playerPosition}${suffix[suffixIndex]}`;
}

function endGame() {
    gameEnded = true;
    const allCars = [player, ...opponents];
    allCars.sort((a, b) => {
        if (b.laps !== a.laps) return b.laps - a.laps;
        return b.trackPosition - a.trackPosition;
    });

    const playerPosition = allCars.indexOf(player) + 1;
    const suffix = ['st', 'nd', 'rd', 'th'];
    const suffixIndex = playerPosition > 3 ? 3 : playerPosition - 1;

    document.getElementById('resultText').textContent =
        playerPosition === 1 ? '🏆 YOU WIN! 🏆' : 'Race Complete!';
    document.getElementById('finalPosition').textContent =
        `You finished in ${playerPosition}${suffix[suffixIndex]} place!`;
    document.getElementById('gameOver').style.display = 'block';
}

// ============================================================
// Main Game Loop
// ============================================================

function gameLoop(timestamp) {
    if (!gameStarted || gameEnded) return;

    // Calculate delta-time normalized to 60fps baseline
    const rawDt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    // Clamp dt to avoid spiral of death on tab switch (max ~3 frames)
    const dt = Math.min(rawDt, 50) / TARGET_DT;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    drawTrack();
    updatePlayer(dt);
    updateOpponents(dt);
    updateRoad(dt);
    updateLaps(player);
    opponents.forEach(opp => updateLaps(opp));
    updatePositions();

    // Draw opponents
    opponents.forEach(opp => drawCar(opp));

    // Draw player's hood (first-person view)
    drawPlayerHood();

    requestAnimationFrame(gameLoop);
}
