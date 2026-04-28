// 获取 HTML 元素
const startButton = document.getElementById('startButton');
const gameCanvas = document.getElementById('gameCanvas');
const gameStatusDisplay = document.getElementById('gameStatus');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time');
const comboDisplay = document.getElementById('combo');
const gameOverScreen = document.querySelector('.game-over-screen');
const finalScoreDisplay = document.getElementById('finalScore');
const maxComboDisplay = document.getElementById('maxCombo');
const restartButton = document.getElementById('restartButton');

const ctx = gameCanvas.getContext('2d');

// 游戏配置
const GAME_DURATION = 60; // 游戏时长 60 秒
const CAT_SPEED = 3; // 小猫移动速度
const TARGET_RADIUS = 10; // 逗猫目标半径
const CAT_PURSUIT_DISTANCE = 80; // 小猫开始扑跃的距离
const CAT_POUNCE_DURATION = 300; // 扑跃动画时长 (ms)
const COMBO_THRESHOLD = 700; // 连击判定时间 (ms)
const FATIGUE_DURATION = 3000; // 疲劳状态时长 (ms)
const FATIGUE_THRESHOLD_TIME = 5000; // 追逐超过此时间未命中则疲劳 (ms)

// 游戏状态变量
let gameRunning = false;
let score = 0;
let combo = 0;
let maxCombo = 0;
let timeLeft = GAME_DURATION;
let gameTimer;
let lastHitTime = 0; // 上次击中时间，用于判断连击
let catFatigued = false; // 小猫是否疲劳

// 鼠标/逗猫目标位置
let targetX = gameCanvas.width / 2;
let targetY = gameCanvas.height / 2;

// 小猫状态
const cat = {
    x: gameCanvas.width / 2,
    y: gameCanvas.height / 2,
    radius: 25,
    color: '#FFDDC1', // 奶白色
    eyeColor: '#444',
    pupilColor: '#000',
    noseColor: '#FFA07A', // 浅橙色
    earColor: '#FFC0CB',
    dx: 0,
    dy: 0,
    isPouncing: false,
    pounceStartTime: 0,
    pounceTargetX: 0,
    pounceTargetY: 0,
    animationFrame: 0, // 用于待机动画
    yOffset: 0, // 用于待机时的上下浮动
    lastPounceSuccessTime: 0, // 上次成功扑跃时间
    fatigueTimer: null,
};

// 调整 Canvas 大小以适应父容器
function resizeCanvas() {
    gameCanvas.width = gameCanvas.offsetWidth;
    gameCanvas.height = gameCanvas.offsetHeight;
    // 重新设置小猫和目标位置，避免在调整大小后跑到边界外
    cat.x = gameCanvas.width / 2;
    cat.y = gameCanvas.height / 2;
    targetX = gameCanvas.width / 2;
    targetY = gameCanvas.height / 2;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // 初始化时调用一次

// 游戏开始函数
function startGame() {
    gameRunning = true;
    score = 0;
    combo = 0;
    maxCombo = 0;
    timeLeft = GAME_DURATION;
    catFatigued = false;
    lastHitTime = 0;
    cat.lastPounceSuccessTime = Date.now(); // 游戏开始时重置成功扑跃时间
    cat.yOffset = 0;

    // 隐藏开始按钮和游戏结束屏幕
    startButton.style.display = 'none';
    gameOverScreen.style.display = 'none';
    gameStatusDisplay.textContent = '';

    // 更新 UI
    updateUI();

    // 启动计时器
    gameTimer = setInterval(() => {
        timeLeft--;
        updateUI();
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);

    // 启动游戏循环
    gameLoop();
}

// 游戏结束函数
function endGame() {
    gameRunning = false;
    clearInterval(gameTimer);
    cancelAnimationFrame(animationFrameId); // 停止游戏循环

    gameStatusDisplay.textContent = '游戏结束！';
    finalScoreDisplay.textContent = score;
    maxComboDisplay.textContent = maxCombo;
    gameOverScreen.style.display = 'block';
    restartButton.style.display = 'block'; // 确保重新开始按钮可见
}

// 更新 UI 显示
function updateUI() {
    scoreDisplay.textContent = score;
    timeDisplay.textContent = timeLeft;
    comboDisplay.textContent = combo;
}

// 事件监听
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

gameCanvas.addEventListener('mousemove', (e) => {
    if (gameRunning) {
        // 获取鼠标在 canvas 中的坐标
        const rect = gameCanvas.getBoundingClientRect();
        targetX = e.clientX - rect.left;
        targetY = e.clientY - rect.top;
    }
});

// 游戏主循环 (requestAnimationFrame)
let animationFrameId;
function gameLoop() {
    update();
    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// 更新游戏逻辑
function update() {
    if (!gameRunning) return;

    // 计算小猫到目标的距离
    const distanceToTarget = Math.hypot(targetX - cat.x, targetY - cat.y);

    // 疲劳逻辑
    if (Date.now() - cat.lastPounceSuccessTime > FATIGUE_THRESHOLD_TIME && !catFatigued && distanceToTarget > CAT_PURSUIT_DISTANCE * 2) { // 追逐过久且距离目标远
        catFatigued = true;
        gameStatusDisplay.textContent = '小猫累了，休息一下...';
        setTimeout(() => {
            catFatigued = false;
            gameStatusDisplay.textContent = '';
        }, FATIGUE_DURATION);
    }

    if (cat.isPouncing) {
        const elapsed = Date.now() - cat.pounceStartTime;
        const progress = Math.min(elapsed / CAT_POUNCE_DURATION, 1);

        // 扑跃动画期间，小猫快速移动到扑跃目标点
        cat.x = cat.pounceInitialX + (cat.pounceTargetX - cat.pounceInitialX) * progress;
        cat.y = cat.pounceInitialY + (cat.pounceTargetY - cat.pounceInitialY) * progress;

        if (progress === 1) {
            cat.isPouncing = false;
            // 检查是否命中目标
            if (Math.hypot(cat.x - targetX, cat.y - targetY) < cat.radius + TARGET_RADIUS) {
                handleHit();
            }
        }
    } else if (!catFatigued) {
        // 小猫追逐目标
        const angle = Math.atan2(targetY - cat.y, targetX - cat.x);
        cat.dx = Math.cos(angle) * CAT_SPEED;
        cat.dy = Math.sin(angle) * CAT_SPEED;

        // 如果接近目标，则扑跃
        if (distanceToTarget < CAT_PURSUIT_DISTANCE && !cat.isPouncing) {
            cat.isPouncing = true;
            cat.pounceStartTime = Date.now();
            cat.pounceInitialX = cat.x;
            cat.pounceInitialY = cat.y;
            cat.pounceTargetX = targetX;
            cat.pounceTargetY = targetY;
        } else {
            cat.x += cat.dx;
            cat.y += cat.dy;
        }
    }

    // 边界检测 (防止小猫跑出 Canvas)
    if (cat.x - cat.radius < 0) cat.x = cat.radius;
    if (cat.x + cat.radius > gameCanvas.width) cat.x = gameCanvas.width - cat.radius;
    if (cat.y - cat.radius < 0) cat.y = cat.radius;
    if (cat.y + cat.radius > gameCanvas.height) cat.y = gameCanvas.height - cat.radius;

    // 待机动画更新
    if (!cat.isPouncing && !catFatigued) {
        cat.animationFrame = (cat.animationFrame + 0.05) % (Math.PI * 2); // 0到2PI循环，慢一点
        cat.yOffset = Math.sin(cat.animationFrame) * 2; // 上下浮动2像素
    } else {
        cat.yOffset = 0;
    }
}

// 处理击中逻辑
function handleHit() {
    score++;
    const currentTime = Date.now();
    if (currentTime - lastHitTime < COMBO_THRESHOLD) {
        combo++;
        gameStatusDisplay.textContent = `Combo x${combo}!`;
    } else {
        combo = 1;
        gameStatusDisplay.textContent = ''; // 清除之前的 combo 提示
    }
    maxCombo = Math.max(maxCombo, combo);
    lastHitTime = currentTime;
    cat.lastPounceSuccessTime = currentTime; // 更新成功扑跃时间
    updateUI();
}

// 绘制游戏元素
function draw() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // 绘制逗猫目标 (激光点)
    ctx.beginPath();
    ctx.arc(targetX, targetY, TARGET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#FF4500'; // 橙红色
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 69, 0, 0.7)'; // 柔和的光晕效果
    ctx.fill();
    ctx.shadowBlur = 0; // 重置阴影，避免影响其他绘制

    // 绘制小猫
    drawCat(cat.x, cat.y, cat.radius);
}

// 绘制小猫函数 (Canvas 绘制)
function drawCat(x, y, radius) {
    ctx.save();
    // 应用待机动画的垂直偏移
    ctx.translate(x, y + cat.yOffset);

    // 身体 (大椭圆)
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.2, radius * 1.0, Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.strokeStyle = '#D3D3D3'; // 浅灰色边框
    ctx.lineWidth = 2;
    ctx.stroke();

    // 头部 (圆形)
    ctx.beginPath();
    ctx.arc(0, -radius * 0.8, radius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.stroke();

    // 耳朵
    ctx.beginPath();
    ctx.moveTo(-radius * 0.5, -radius * 1.3);
    ctx.lineTo(-radius * 0.8, -radius * 1.8);
    ctx.lineTo(-radius * 0.2, -radius * 1.7);
    ctx.closePath();
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(radius * 0.5, -radius * 1.3);
    ctx.lineTo(radius * 0.8, -radius * 1.8);
    ctx.lineTo(radius * 0.2, -radius * 1.7);
    ctx.closePath();
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.stroke();

    // 耳朵内侧
    ctx.beginPath();
    ctx.moveTo(-radius * 0.35, -radius * 1.45);
    ctx.lineTo(-radius * 0.6, -radius * 1.65);
    ctx.lineTo(-radius * 0.25, -radius * 1.55);
    ctx.closePath();
    ctx.fillStyle = cat.earColor;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(radius * 0.35, -radius * 1.45);
    ctx.lineTo(radius * 0.6, -radius * 1.65);
    ctx.lineTo(radius * 0.25, -radius * 1.55);
    ctx.closePath();
    ctx.fillStyle = cat.earColor;
    ctx.fill();

    // 眼睛
    ctx.beginPath();
    ctx.arc(-radius * 0.3, -radius * 0.9, radius * 0.15, 0, Math.PI * 2);
    ctx.arc(radius * 0.3, -radius * 0.9, radius * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = cat.eyeColor;
    ctx.fill();

    // 瞳孔 (根据目标方向轻微转动)
    // 计算目标相对于猫眼中心的向量
    const eyeOffsetX = (targetX - x);
    const eyeOffsetY = (targetY - (y + cat.yOffset));
    const eyeAngle = Math.atan2(eyeOffsetY, eyeOffsetX);
    const pupilDistance = radius * 0.05; // 瞳孔移动距离

    const pupilX = Math.cos(eyeAngle) * pupilDistance;
    const pupilY = Math.sin(eyeAngle) * pupilDistance;

    ctx.beginPath();
    ctx.arc(-radius * 0.3 + pupilX, -radius * 0.9 + pupilY, radius * 0.08, 0, Math.PI * 2);
    ctx.arc(radius * 0.3 + pupilX, -radius * 0.9 + pupilY, radius * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = cat.pupilColor;
    ctx.fill();

    // 鼻子
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.6, radius * 0.1, radius * 0.07, 0, 0, Math.PI * 2);
    ctx.fillStyle = cat.noseColor;
    ctx.fill();

    // 嘴巴 (简单的V字形)
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.55);
    ctx.lineTo(-radius * 0.1, -radius * 0.45);
    ctx.lineTo(radius * 0.1, -radius * 0.45);
    ctx.closePath();
    ctx.strokeStyle = cat.pupilColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}
