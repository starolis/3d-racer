// ============================================================
// 3D Racer - Game Engine
// A first-person racing game with car selection and AI opponents
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// HiDPI canvas scaling
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    ctx.scale(dpr, dpr);
}
setupCanvas();

// Delta-time
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

// Road rendering constants
const HORIZON_Y = Math.floor(GAME_HEIGHT * 0.4);
const CAM_DEPTH = 120;
const ROAD_WIDTH = 2200;
const SEG_FREQ = 0.12;
const SCROLL_RATE = 0.15;

// Car type definitions
const carTypes = {
    speedster: {
        name: 'Speedster',
        color: '#ff0000',
        maxSpeed: 14,
        acceleration: 0.25,
        turnSpeed: 3.5,
        friction: 0.04,
    },
    balanced: {
        name: 'All-Rounder',
        color: '#00aa00',
        maxSpeed: 11,
        acceleration: 0.3,
        turnSpeed: 4.5,
        friction: 0.05,
    },
    accelerator: {
        name: 'Rocket',
        color: '#ffdd00',
        maxSpeed: 10,
        acceleration: 0.45,
        turnSpeed: 4,
        friction: 0.06,
    },
    handler: {
        name: 'Drifter',
        color: '#0066ff',
        maxSpeed: 11,
        acceleration: 0.28,
        turnSpeed: 6,
        friction: 0.055,
    }
};

const track = {
    width: 600,
    centerX: GAME_WIDTH / 2,
};

const LAP_LENGTH = 6000;
const CHECKPOINT_COUNT = 4;
const CHECKPOINT_DISTANCE = LAP_LENGTH / CHECKPOINT_COUNT;
const TOTAL_LAPS = 3;

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

const opponents = [
    {
        x: GAME_WIDTH / 2 - 80, y: GAME_HEIGHT - 250,
        width: 40, height: 70, speed: 9.5, color: '#0066ff',
        lane: -1, laps: 0, checkpoints: [false, false, false, false],
        maxSpeed: 11, acceleration: 0.28, carType: 'handler',
        trackPosition: 150, lastTrackPosition: 150
    },
    {
        x: GAME_WIDTH / 2 + 80, y: GAME_HEIGHT - 350,
        width: 40, height: 70, speed: 11, color: '#ff0000',
        lane: 1, laps: 0, checkpoints: [false, false, false, false],
        maxSpeed: 14, acceleration: 0.25, carType: 'speedster',
        trackPosition: 300, lastTrackPosition: 300
    },
    {
        x: GAME_WIDTH / 2, y: GAME_HEIGHT - 450,
        width: 40, height: 70, speed: 8.5, color: '#ffdd00',
        lane: 0, laps: 0, checkpoints: [false, false, false, false],
        maxSpeed: 10, acceleration: 0.45, carType: 'accelerator',
        trackPosition: 450, lastTrackPosition: 450
    }
];

const keys = { up: false, down: false, left: false, right: false };

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

// Touch controls
function setupTouchControls() {
    const tc = document.getElementById('touchControls');
    if (!tc) return;
    if (window.matchMedia('(pointer: coarse)').matches) tc.classList.remove('hidden');
    const map = { touchUp: 'up', touchDown: 'down', touchLeft: 'left', touchRight: 'right' };
    Object.entries(map).forEach(([id, key]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
        btn.addEventListener('touchcancel', (e) => { e.preventDefault(); keys[key] = false; });
    });
}
setupTouchControls();

// Car selection
document.querySelectorAll('.car-option').forEach(option => {
    option.addEventListener('click', function () {
        document.querySelectorAll('.car-option').forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
        selectedCarType = this.dataset.car;
        const btn = document.getElementById('confirmCarButton');
        btn.disabled = false;
        btn.textContent = 'Race with ' + carTypes[selectedCarType].name + '!';
    });
});

document.getElementById('confirmCarButton').addEventListener('click', () => {
    if (selectedCarType) {
        const c = carTypes[selectedCarType];
        player.color = c.color;
        player.maxSpeed = c.maxSpeed;
        player.acceleration = c.acceleration;
        player.turnSpeed = c.turnSpeed;
        player.friction = c.friction;

        opponents.forEach(opp => {
            if (opp.carType === selectedCarType) {
                const alt = Object.keys(carTypes).filter(t => t !== selectedCarType);
                const used = opponents.map(o => o.carType);
                const avail = alt.filter(t => !used.includes(t) || t === opp.carType);
                opp.color = carTypes[avail[0] || alt[0]].color;
            }
        });

        document.getElementById('carSelection').classList.add('hidden');
        document.getElementById('instructions').classList.remove('hidden');
    }
});

document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('instructions').classList.add('hidden');
    document.getElementById('gameWrapper').classList.remove('hidden');
    startCountdown();
});

document.getElementById('restartButton').addEventListener('click', () => location.reload());

// ============================================================
// Drawing - Road (pseudo-3D segment rendering)
// ============================================================

function getRoadProps(y) {
    // Returns road center X, half-width, and segment phase at screen row y
    const dy = y - HORIZON_Y;
    if (dy <= 0) return null;
    const perspective = CAM_DEPTH / dy;
    const halfWidth = (ROAD_WIDTH * perspective) / 2;
    const progress = dy / (GAME_HEIGHT - HORIZON_Y);
    // Curve: strongest at horizon, fades to zero near camera
    const curveX = trackCurve * 250 * (1 - progress) * (1 - progress);
    const cx = GAME_WIDTH / 2 + curveX;
    const z = perspective * 10;
    const seg = Math.floor(z * SEG_FREQ + trackOffset * SCROLL_RATE) % 2;
    return { cx, halfWidth, seg, perspective, progress, z };
}

function drawSky() {
    // Sky gradient - warm sunset tones
    const grad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.3, '#2d1b69');
    grad.addColorStop(0.6, '#5c3d99');
    grad.addColorStop(0.85, '#e87d5a');
    grad.addColorStop(1, '#ffc67d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, HORIZON_Y + 2);

    // Sun glow
    const sun = ctx.createRadialGradient(GAME_WIDTH / 2, HORIZON_Y - 10, 5, GAME_WIDTH / 2, HORIZON_Y - 10, 160);
    sun.addColorStop(0, 'rgba(255, 230, 150, 0.8)');
    sun.addColorStop(0.3, 'rgba(255, 200, 100, 0.3)');
    sun.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, HORIZON_Y - 160, GAME_WIDTH, 180);

    // Distant mountains
    ctx.fillStyle = '#3d1f6d';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    const seed = 42;
    for (let x = 0; x <= GAME_WIDTH; x += 20) {
        const h = Math.sin(x * 0.008 + seed) * 30 + Math.sin(x * 0.015 + seed * 2) * 15;
        ctx.lineTo(x, HORIZON_Y - Math.max(0, h));
    }
    ctx.lineTo(GAME_WIDTH, HORIZON_Y);
    ctx.closePath();
    ctx.fill();

    // Nearer hills
    ctx.fillStyle = '#2a1550';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON_Y);
    for (let x = 0; x <= GAME_WIDTH; x += 15) {
        const h = Math.sin(x * 0.012 + 1.5) * 18 + Math.sin(x * 0.025 + 3) * 10;
        ctx.lineTo(x, HORIZON_Y - Math.max(0, h));
    }
    ctx.lineTo(GAME_WIDTH, HORIZON_Y);
    ctx.closePath();
    ctx.fill();
}

function drawRoad() {
    for (let y = HORIZON_Y; y < GAME_HEIGHT; y++) {
        const r = getRoadProps(y);
        if (!r) continue;

        // Grass - alternating shades
        ctx.fillStyle = r.seg ? '#1d6b11' : '#17570e';
        ctx.fillRect(0, y, GAME_WIDTH, 1);

        // Road shoulder / rumble strips
        const rumbleW = Math.max(2, r.halfWidth * 0.06);
        ctx.fillStyle = r.seg ? '#e02020' : '#f0f0f0';
        ctx.fillRect(r.cx - r.halfWidth - rumbleW, y, rumbleW, 1);
        ctx.fillRect(r.cx + r.halfWidth, y, rumbleW, 1);

        // Road surface
        ctx.fillStyle = r.seg ? '#6e6e6e' : '#616161';
        ctx.fillRect(r.cx - r.halfWidth, y, r.halfWidth * 2, 1);

        // Lane lines (dashed) - left lane and right lane dividers
        const lineW = Math.max(1, 1 + r.progress * 3);
        if (r.seg) {
            ctx.fillStyle = '#ffffff';
            // Center line
            ctx.fillRect(r.cx - lineW / 2, y, lineW, 1);
            // Left lane divider
            ctx.fillRect(r.cx - r.halfWidth / 3 - lineW / 2, y, lineW * 0.7, 1);
            // Right lane divider
            ctx.fillRect(r.cx + r.halfWidth / 3 - lineW / 2, y, lineW * 0.7, 1);
        }
    }
}

function drawRoadsidePosts() {
    const postSpacing = 30;
    const numPosts = 15;
    const scrollPos = trackOffset * SCROLL_RATE;

    for (let i = 0; i < numPosts; i++) {
        const worldZ = (i * postSpacing + 5) - (scrollPos * postSpacing / SEG_FREQ) % postSpacing;
        if (worldZ <= 2) continue;

        const screenDy = CAM_DEPTH / (worldZ * 0.1);
        const y = HORIZON_Y + screenDy;
        if (y >= GAME_HEIGHT - 5 || y <= HORIZON_Y + 2) continue;

        const r = getRoadProps(Math.floor(y));
        if (!r) continue;

        // Post height scales with perspective
        const postH = Math.max(3, 35 * (1 - r.progress));
        const postW = Math.max(1, 3 * (1 - r.progress * 0.5));

        // Left post
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(r.cx - r.halfWidth - 12 * (1 - r.progress), y - postH, postW, postH);
        // Red reflector
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(r.cx - r.halfWidth - 12 * (1 - r.progress), y - postH, postW, Math.max(1, postW));

        // Right post
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(r.cx + r.halfWidth + 8 * (1 - r.progress), y - postH, postW, postH);
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(r.cx + r.halfWidth + 8 * (1 - r.progress), y - postH, postW, Math.max(1, postW));
    }
}

// ============================================================
// Drawing - Cars
// ============================================================

function getCarScreenPos(car) {
    if (car.y < HORIZON_Y || car.y > GAME_HEIGHT + car.height) return null;
    const r = getRoadProps(Math.max(HORIZON_Y + 1, Math.floor(car.y)));
    if (!r) return null;
    const laneOffset = car.lane * (r.halfWidth * 2 / 3);
    const sx = r.cx + laneOffset;
    // progress: 0 = horizon (far), 1 = bottom (near). Scale bigger when closer.
    const scale = Math.max(0.08, 0.08 + r.progress * 1.0);
    return { sx, scale, progress: r.progress };
}

function drawCar(car) {
    const pos = getCarScreenPos(car);
    if (!pos) return;

    const { sx, scale } = pos;
    const w = 44 * scale;
    const h = 70 * scale;
    const x = sx - w / 2;
    const y = car.y - h / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, car.y + h * 0.4, w * 0.7, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Car body (rounded shape)
    const radius = 5 * scale;
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    // Darker shade on sides
    ctx.fillStyle = shadeColor(car.color, -30);
    ctx.fillRect(x, y + 2 * scale, 4 * scale, h - 4 * scale);
    ctx.fillRect(x + w - 4 * scale, y + 2 * scale, 4 * scale, h - 4 * scale);

    // Windshield
    ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
    ctx.fillRect(x + 5 * scale, y + 8 * scale, w - 10 * scale, 14 * scale);

    // Rear window
    ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
    ctx.fillRect(x + 6 * scale, y + h - 22 * scale, w - 12 * scale, 10 * scale);

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    const ww = 5 * scale, wh = 12 * scale;
    ctx.fillRect(x - 2 * scale, y + 6 * scale, ww, wh);
    ctx.fillRect(x + w - 3 * scale, y + 6 * scale, ww, wh);
    ctx.fillRect(x - 2 * scale, y + h - 18 * scale, ww, wh);
    ctx.fillRect(x + w - 3 * scale, y + h - 18 * scale, ww, wh);

    // Driver helmet
    if (scale > 0.25) {
        const headR = 9 * scale;
        const headY = y - headR * 0.3;
        // Helmet
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(sx, headY, headR, 0, Math.PI * 2);
        ctx.fill();
        // Visor
        ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
        ctx.fillRect(sx - headR * 0.9, headY - headR * 0.2, headR * 1.8, headR * 0.5);
    }
}

function drawPlayerHood() {
    const vp = GAME_WIDTH / 2;
    const hoodH = 90;
    const hoodBot = 220;
    const hoodTop = 40;

    // Main hood
    const grad = ctx.createLinearGradient(vp, GAME_HEIGHT - hoodH, vp, GAME_HEIGHT);
    grad.addColorStop(0, shadeColor(player.color, 10));
    grad.addColorStop(0.5, player.color);
    grad.addColorStop(1, shadeColor(player.color, -50));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(vp - hoodTop / 2, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp + hoodTop / 2, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp + hoodBot / 2, GAME_HEIGHT);
    ctx.lineTo(vp - hoodBot / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Side panels
    ctx.fillStyle = shadeColor(player.color, -55);
    ctx.beginPath();
    ctx.moveTo(vp - hoodTop / 2, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp - hoodTop / 2 - 22, GAME_HEIGHT - hoodH + 18);
    ctx.lineTo(vp - hoodBot / 2 - 30, GAME_HEIGHT);
    ctx.lineTo(vp - hoodBot / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(vp + hoodTop / 2, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp + hoodTop / 2 + 22, GAME_HEIGHT - hoodH + 18);
    ctx.lineTo(vp + hoodBot / 2 + 30, GAME_HEIGHT);
    ctx.lineTo(vp + hoodBot / 2, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Hood center line
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(vp - 2, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp - 12, GAME_HEIGHT);
    ctx.lineTo(vp + 12, GAME_HEIGHT);
    ctx.lineTo(vp + 2, GAME_HEIGHT - hoodH);
    ctx.closePath();
    ctx.fill();

    // Shine highlight
    const shine = ctx.createLinearGradient(vp - 15, GAME_HEIGHT - hoodH, vp + 15, GAME_HEIGHT - hoodH + 35);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(vp - 18, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp + 18, GAME_HEIGHT - hoodH);
    ctx.lineTo(vp + 12, GAME_HEIGHT - hoodH + 35);
    ctx.lineTo(vp - 12, GAME_HEIGHT - hoodH + 35);
    ctx.closePath();
    ctx.fill();

    // Driver head + helmet
    const headR = 16;
    const headY = GAME_HEIGHT - hoodH - 7;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(vp + 2, headY + 2, headR, 0, Math.PI * 2);
    ctx.fill();

    const hGrad = ctx.createRadialGradient(vp - 4, headY - 4, 3, vp, headY, headR);
    hGrad.addColorStop(0, '#ffecd1');
    hGrad.addColorStop(1, '#d4a574');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(vp, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    const helGrad = ctx.createRadialGradient(vp - 5, headY - 5, 0, vp, headY, headR);
    helGrad.addColorStop(0, '#555');
    helGrad.addColorStop(0.7, '#222');
    helGrad.addColorStop(1, '#000');
    ctx.fillStyle = helGrad;
    ctx.beginPath();
    ctx.arc(vp, headY, headR, Math.PI, Math.PI * 2);
    ctx.fill();

    // Helmet stripe in car color
    ctx.fillStyle = player.color;
    ctx.fillRect(vp - 13, headY - 7, 26, 4);

    // Visor
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(vp - 14, headY - 4, 28, 7);
    const vGrad = ctx.createLinearGradient(vp - 10, headY - 3, vp - 4, headY + 1);
    vGrad.addColorStop(0, 'rgba(150, 220, 255, 0.5)');
    vGrad.addColorStop(1, 'rgba(150, 220, 255, 0)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(vp - 10, headY - 3, 8, 5);
}

// ============================================================
// Drawing - Effects & HUD
// ============================================================

function drawSpeedEffects() {
    const speedRatio = Math.abs(player.speed) / player.maxSpeed;
    if (speedRatio < 0.5) return;

    const intensity = (speedRatio - 0.5) * 2; // 0 to 1

    // Vignette darkening at edges
    const vig = ctx.createRadialGradient(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.35,
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.7
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${intensity * 0.35})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
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

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const text = countdownNumber > 0 ? countdownNumber.toString() : 'GO!';
    const color = countdownNumber > 0 ? '#ffff00' : '#00ff00';

    ctx.font = 'bold 140px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, GAME_WIDTH / 2 + 4, GAME_HEIGHT / 2 - 40 + 4);

    ctx.fillStyle = color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 6;
    ctx.strokeText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
    ctx.fillText(text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);

    // Traffic lights
    const lx = GAME_WIDTH / 2;
    const ly0 = 100;
    const sp = 55;

    // Light housing (rounded rect via arcs)
    ctx.fillStyle = '#1a1a1a';
    const hx = lx - 30, hy = ly0 - 25, hw = 60, hh = sp * 2 + 50, hr = 10;
    ctx.beginPath();
    ctx.moveTo(hx + hr, hy);
    ctx.lineTo(hx + hw - hr, hy);
    ctx.quadraticCurveTo(hx + hw, hy, hx + hw, hy + hr);
    ctx.lineTo(hx + hw, hy + hh - hr);
    ctx.quadraticCurveTo(hx + hw, hy + hh, hx + hw - hr, hy + hh);
    ctx.lineTo(hx + hr, hy + hh);
    ctx.quadraticCurveTo(hx, hy + hh, hx, hy + hh - hr);
    ctx.lineTo(hx, hy + hr);
    ctx.quadraticCurveTo(hx, hy, hx + hr, hy);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 3; i++) {
        const ly = ly0 + i * sp;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(lx, ly, 20, 0, Math.PI * 2);
        ctx.fill();

        if (countdownNumber > 0 && countdownNumber === 3 - i) {
            ctx.fillStyle = '#ff2020';
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 25;
            ctx.beginPath();
            ctx.arc(lx, ly, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    if (countdownNumber === 0) {
        // Green: light up the bottom circle
        ctx.fillStyle = '#20ff20';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.arc(lx, ly0 + 2 * sp, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function startCountdown() {
    countdownActive = true;
    countdownNumber = 3;

    const interval = setInterval(() => {
        countdownNumber--;
        if (countdownNumber < 0) {
            clearInterval(interval);
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
    drawSky();
    drawRoad();
    drawRoadsidePosts();
    opponents.forEach(opp => drawCar(opp));
    drawPlayerHood();
    drawCountdown();
    if (countdownActive) requestAnimationFrame(renderCountdown);
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

    const laneSpeed = player.turnSpeed * 0.015 * dt;
    if (keys.left && player.lane > -1.2) player.lane -= laneSpeed;
    if (keys.right && player.lane < 1.2) player.lane += laneSpeed;
    player.lane = Math.max(-1.2, Math.min(1.2, player.lane));

    document.getElementById('speed').textContent = Math.round(Math.abs(player.speed * 10));
}

function updateOpponents(dt) {
    opponents.forEach(opp => {
        opp.speed += (Math.random() - 0.5) * opp.acceleration * 3 * dt;
        opp.speed = Math.max(opp.maxSpeed * 0.75, Math.min(opp.maxSpeed * 0.95, opp.speed));

        opp.lastTrackPosition = opp.trackPosition;
        opp.trackPosition += opp.speed * dt;
        opp.y = player.y - (opp.trackPosition - player.trackPosition);

        const freq = opp.carType === 'handler' ? 0.02 : 0.01;
        if (Math.random() < freq) opp.targetLane = Math.floor(Math.random() * 3) - 1;
        if (opp.targetLane === undefined) opp.targetLane = opp.lane;

        const ls = (opp.carType === 'handler' ? 0.05 : 0.03) * dt;
        if (Math.abs(opp.lane - opp.targetLane) > 0.01) {
            opp.lane += opp.lane < opp.targetLane ? ls : -ls;
        } else {
            opp.lane = opp.targetLane;
        }
    });
}

function updateRoad(dt) {
    trackOffset += player.speed * dt;
    trackCurve += (trackCurveTarget - trackCurve) * 0.02 * dt;
    if (Math.random() < 0.005) trackCurveTarget = (Math.random() - 0.5) * 2;
    if (Math.random() < 0.003) trackCurveTarget = 0;
}

function updateLaps(car) {
    const pos = ((car.trackPosition % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH;
    const prev = ((car.lastTrackPosition % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH;

    for (let i = 0; i < CHECKPOINT_COUNT; i++) {
        const cp = i * CHECKPOINT_DISTANCE;
        let crossed = false;
        if (prev <= pos) {
            crossed = prev < cp && pos >= cp;
        } else {
            crossed = prev < cp || pos >= cp;
        }

        if (crossed && !car.checkpoints[i]) {
            car.checkpoints[i] = true;
            if (car.checkpoints.every(c => c)) {
                car.laps++;
                car.checkpoints = [false, false, false, false];
                if (car === player) {
                    document.getElementById('lapCounter').textContent =
                        `${Math.min(car.laps + 1, TOTAL_LAPS)}/${TOTAL_LAPS}`;
                }
                if (car.laps >= TOTAL_LAPS && !gameEnded) endGame();
            }
        }
    }
}

function updatePositions() {
    const all = [player, ...opponents].sort((a, b) =>
        b.laps !== a.laps ? b.laps - a.laps : b.trackPosition - a.trackPosition
    );
    const p = all.indexOf(player) + 1;
    const suf = ['st', 'nd', 'rd', 'th'];
    document.getElementById('position').textContent = `${p}${suf[Math.min(p - 1, 3)]}`;
}

function endGame() {
    gameEnded = true;
    const all = [player, ...opponents].sort((a, b) =>
        b.laps !== a.laps ? b.laps - a.laps : b.trackPosition - a.trackPosition
    );
    const p = all.indexOf(player) + 1;
    const suf = ['st', 'nd', 'rd', 'th'];

    document.getElementById('resultText').textContent =
        p === 1 ? '🏆 YOU WIN! 🏆' : 'Race Complete!';
    document.getElementById('finalPosition').textContent =
        `You finished in ${p}${suf[Math.min(p - 1, 3)]} place!`;
    document.getElementById('gameOver').style.display = 'block';
}

// ============================================================
// Main Game Loop
// ============================================================

function gameLoop(timestamp) {
    if (!gameStarted || gameEnded) return;

    const rawDt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;
    const dt = Math.min(rawDt, 50) / TARGET_DT;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Update
    updatePlayer(dt);
    updateOpponents(dt);
    updateRoad(dt);
    updateLaps(player);
    opponents.forEach(opp => updateLaps(opp));
    updatePositions();

    // Draw (back to front)
    drawSky();
    drawRoad();
    drawRoadsidePosts();

    // Sort opponents by depth (far to near) so closer ones draw on top
    const sortedOpps = [...opponents].sort((a, b) => a.y - b.y);
    sortedOpps.forEach(opp => drawCar(opp));

    drawPlayerHood();
    drawSpeedEffects();

    requestAnimationFrame(gameLoop);
}
