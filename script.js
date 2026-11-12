"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const livesDisplay = document.getElementById("lives");
const overlay = document.getElementById("overlay");
const message = document.getElementById("message");
const gameButton = document.getElementById("game-button");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const paddle = { width: 120, height: 12, x: (WIDTH - 120) / 2, y: HEIGHT - 34, speed: 7 };
const ball = { radius: 8, x: WIDTH / 2, y: HEIGHT - 54, dx: 3.2, dy: -3.8, speed: 5, maxSpeed: 8, penetrating: false, paddleContact: false };
const brickConfig = { rows: 6, columns: 12, width: 52, height: 18, gap: 10, top: 48, left: 18 };
const keys = { left: false, right: false };

let bricks = [];
let score = 0;
let lives = 3;
let state = "ready";
let animationId = null;
let lastFrame = 0;

function resetBricks() {
  bricks = [];
  for (let row = 0; row < brickConfig.rows; row += 1) {
    for (let column = 0; column < brickConfig.columns; column += 1) {
      bricks.push({
        x: brickConfig.left + column * (brickConfig.width + brickConfig.gap),
        y: brickConfig.top + row * (brickConfig.height + brickConfig.gap),
        width: brickConfig.width,
        height: brickConfig.height,
        alive: true,
      });
    }
  }
}

function resetBallAndPaddle() {
  paddle.x = (WIDTH - paddle.width) / 2;
  ball.x = WIDTH / 2;
  ball.y = HEIGHT - 54;
  ball.dx = 3.2;
  ball.dy = -3.8;
  ball.speed = 5;
  ball.penetrating = false;
  ball.paddleContact = false;
}

function updateStatus() {
  scoreDisplay.textContent = String(score);
  livesDisplay.textContent = String(lives);
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#123b68";
  for (const brick of bricks) {
    if (brick.alive) ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
  }
  ctx.fillStyle = "#111";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  // 貫通中は輪を描かず、ボール本体を赤寄りの色にして状態を示す。
  ctx.fillStyle = ball.penetrating ? "#c43b32" : "#123b68";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

function showOverlay(text, buttonText) {
  message.textContent = text;
  gameButton.textContent = buttonText;
  overlay.hidden = false;
}

function startGame() {
  if (state === "over" || state === "won") {
    score = 0;
    lives = 3;
    resetBricks();
  }
  resetBallAndPaddle();
  updateStatus();
  state = "playing";
  overlay.hidden = true;
  lastFrame = 0;
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function finishGame(won) {
  state = won ? "won" : "over";
  showOverlay(won ? "ゲームクリア" : "ゲームオーバー", "リスタート");
}

function movePaddle() {
  if (keys.left) paddle.x -= paddle.speed;
  if (keys.right) paddle.x += paddle.speed;
  paddle.x = Math.max(0, Math.min(WIDTH - paddle.width, paddle.x));
}

function updateBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= WIDTH) ball.dx *= -1;
  if (ball.y - ball.radius <= 0) ball.dy = Math.abs(ball.dy);

  const touchingPaddle = ball.y + ball.radius >= paddle.y &&
    ball.y - ball.radius <= paddle.y + paddle.height &&
    ball.x + ball.radius >= paddle.x && ball.x - ball.radius <= paddle.x + paddle.width;

  if (!touchingPaddle) ball.paddleContact = false;

  if (ball.dy > 0 && touchingPaddle && !ball.paddleContact) {
    ball.paddleContact = true;
    const offset = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const wasPenetrating = ball.penetrating;
    // 貫通状態はブロックにだけ適用する。パドル接触では必ず反射する。
    if (wasPenetrating) ball.penetrating = false;
    else if (Math.abs(offset) <= 0.18) ball.penetrating = true;
    ball.speed = Math.min(ball.speed + 0.25, ball.maxSpeed);
    ball.dx = offset * ball.speed * 0.84;
    ball.dy = -Math.sqrt(ball.speed ** 2 - ball.dx ** 2);
    ball.y = paddle.y - ball.radius;
  }

  for (const brick of bricks) {
    if (!brick.alive) continue;
    if (ball.x + ball.radius > brick.x && ball.x - ball.radius < brick.x + brick.width &&
        ball.y + ball.radius > brick.y && ball.y - ball.radius < brick.y + brick.height) {
      brick.alive = false;
      score += 10;
      updateStatus();
      // 直前の位置から、衝突した面を推定して跳ね返す。
      const previousX = ball.x - ball.dx;
      const previousY = ball.y - ball.dy;
      if (!ball.penetrating) {
        if (previousY + ball.radius <= brick.y || previousY - ball.radius >= brick.y + brick.height) ball.dy *= -1;
        else ball.dx *= -1;
        break;
      }
    }
  }
  if (bricks.every((brick) => !brick.alive)) {
    finishGame(true);
    return;
  }

  if (ball.y - ball.radius > HEIGHT) {
    lives -= 1;
    ball.penetrating = false;
    ball.paddleContact = false;
    ball.speed = 5;
    updateStatus();
    if (lives <= 0) finishGame(false);
    else resetBallAndPaddle();
  }
}

function loop(timestamp) {
  if (state !== "playing") return;
  // フレームレート差で速度が大きく変わらないよう、時間差を上限付きで補正する。
  const step = lastFrame ? Math.min((timestamp - lastFrame) / 16.67, 2) : 1;
  lastFrame = timestamp;
  const oldSpeed = paddle.speed;
  paddle.speed = 7 * step;
  movePaddle();
  paddle.speed = oldSpeed;
  const speed = ball.speed;
  ball.dx *= step;
  ball.dy *= step;
  updateBall();
  if (state === "playing") {
    const currentSpeed = Math.hypot(ball.dx, ball.dy);
    if (currentSpeed > 0) {
      const adjustedSpeed = Math.min(ball.speed, ball.maxSpeed);
      ball.dx *= adjustedSpeed / currentSpeed;
      ball.dy *= adjustedSpeed / currentSpeed;
    }
    draw();
    animationId = requestAnimationFrame(loop);
  } else {
    draw();
  }
}

function setPaddleFromPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = WIDTH / bounds.width;
  paddle.x = (event.clientX - bounds.left) * scaleX - paddle.width / 2;
  paddle.x = Math.max(0, Math.min(WIDTH - paddle.width, paddle.x));
  if (state !== "playing") draw();
}

canvas.addEventListener("pointermove", setPaddleFromPointer);
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.preventDefault();
  if (event.key === "ArrowLeft") keys.left = true;
  if (event.key === "ArrowRight") keys.right = true;
});
document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") keys.left = false;
  if (event.key === "ArrowRight") keys.right = false;
});
gameButton.addEventListener("click", startGame);

resetBricks();
updateStatus();
draw();
