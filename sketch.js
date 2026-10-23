/* ==========================================================================
   班級經營工具箱 (Classroom Management Suite) - p5.js Fullscreen Edition
   包含：小組計時器、考試時鐘（含指針鐘面）、上下課鐘 & 番茄鐘（含鐘面）、課堂抽籤與隨機分組
   ========================================================================== */

// --- 全域狀態變數 ---
let currentTab = 'panel-timer'; // 當前頁籤
let audioCtx = null;
let mainContainer;
let isFullscreenMode = false;
let confettiParticles = [];

// --- 1. 小組計時器狀態 ---
let tMinInput, tSecInput, tStartBtn, tResetBtn;
let tInitialSeconds = 300;
let tRemainingSeconds = 300;
let tDeadline = null;
let tInterval = null;
let tIsRunning = false;
let tAlarmInterval = null;

// --- 2. 考試時鐘狀態 ---
let exSubjectInp, exTeacherInp, exStartInp, exEndInp, exExpInp, exPreInp, exAbsInp;
let examData = { subject: '', teacher: '', start: '', end: '', exp: 0, pre: 0 };

// --- 3. 上下課鐘 & 番茄鐘狀態 ---
let bellSchedule = [];
let lastRungMinute = '';
let autoBellCheckbox;

let pomoFocusInp, pomoBreakInp, pomoStartBtn;
let pomoState = { mode: 'focus', round: 1, remainingMs: 25 * 60 * 1000, deadline: null, running: false };

// --- 4. 抽籤與隨機分組狀態 ---
let pkModeSelect, pkStartInp, pkEndInp, pkCountInp, pkNameTextarea, pkExcludeInp, pkAllowRepeatCheck;
let drawHistory = [];
let groupHistory = [];
let currentGroups = [];
let isDrawing = false;
let gpNameTextarea, gpSizeInp, gpStrategySelect, gpExcludeInp;

// ==========================================================================
// p5.js 生命週期函式
// ==========================================================================

function setup() {
  // 建立填滿視窗的 Canvas（作為鐘面繪製與背景使用）
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '0');
  canvas.style('pointer-events', 'none');
  textFont('system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", sans-serif');

  // 初始化 AudioContext (初次點擊或按鍵時啟用)
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('keydown', initAudio, { once: true });

  // 讀取歷史資料
  loadAllStoredData();

  // 注入動態 CSS 樣式與建立 DOM 佈局
  injectStylesheet();
  createAppLayout();

  // 預設啟用小組計時器
  switchTab('panel-timer');

  // 定時檢測
  setInterval(checkAutoBellLoop, 250);
  setInterval(updatePomodoroLoop, 200);

  // 監聽鍵盤與全螢幕切換
  window.addEventListener('keydown', handleGlobalHotkeys);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
}

function draw() {
  // 繪製微藍淺灰背景
  background(241, 245, 249);

  // 依據當前頁籤由 p5.js 動態繪製對應工具的「鐘面」與數據視覺化
  if (currentTab === 'panel-timer') {
    drawTimerClockFace();
  } else if (currentTab === 'panel-exam') {
    drawExamClockFace();
  } else if (currentTab === 'panel-bell') {
    drawPomodoroClockFace();
  }

  // 繪製彩帶慶祝粒子
  updateAndRenderConfetti();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ==========================================================================
// Web Audio API 免音檔聲音合成器
// ==========================================================================

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playAlarmTone(freq = 660, duration = 0.4) {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function playSchoolBell(type = 'start') {
  initAudio();
  if (!audioCtx) return;
  const notes = type === 'start' ? [880, 660, 880, 660] : [660, 880, 660, 523];
  const now = audioCtx.currentTime;
  notes.forEach((freq, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const startAt = now + idx * 0.45;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startAt);
    osc.stop(startAt + 0.42);
  });
}

function playBeep() {
  initAudio();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400 + Math.random() * 250, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playFanfare() {
  initAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const notes = [261.6, 329.6, 392.0, 523.2, 659.2, 783.9];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const startAt = now + i * 0.07;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startAt);
    osc.stop(startAt + 0.35);
  });
}

// ==========================================================================
// 全螢幕控管與動態 CSS 注入
// ==========================================================================

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error("全螢幕請求失敗:", err);
    });
  } else {
    document.exitFullscreen().catch(err => {
      console.error("退出全螢幕失敗:", err);
    });
  }
}

function handleFullscreenChange() {
  isFullscreenMode = Boolean(document.fullscreenElement);
  if (isFullscreenMode) {
    document.body.classList.add('is-fullscreen');
  } else {
    document.body.classList.remove('is-fullscreen');
  }
  resizeCanvas(windowWidth, windowHeight);
}

function injectStylesheet() {
  let style = createElement('style');
  style.html(`
    :root {
      --bg-light: #f1f5f9;
      --card-bg: #ffffff;
      --card-border: #cbd5e1;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --accent: #7c3aed;
      --success: #16a34a;
      --danger: #dc2626;
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);
      --shadow-lg: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow-x: hidden; color: var(--text-main); font-family: system-ui, -apple-system, sans-serif; }
    .p5-main-container { position: relative; z-index: 10; width: min(1100px, 92%); margin: 20px auto 40px auto; }
    .nav-tabs-bar { display: flex; justify-content: center; gap: 8px; margin-bottom: 20px; background: #e2e8f0; padding: 6px; border-radius: 16px; flex-wrap: wrap; }
    .nav-tab-btn { padding: 10px 20px; border: 0; border-radius: 12px; background: transparent; color: var(--text-muted); font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .nav-tab-btn:hover { background: rgba(255, 255, 255, 0.6); color: var(--text-main); }
    .nav-tab-btn.active { background: var(--card-bg); color: var(--primary); box-shadow: var(--shadow-md); }
    .tab-panel-card { display: none; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 24px; box-shadow: var(--shadow-lg); width: 100%; flex-direction: column; gap: 20px; position: relative; }
    .tab-panel-card.active { display: flex; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; font-size: 1rem; font-weight: 700; border: 1px solid transparent; border-radius: 12px; cursor: pointer; transition: all 0.18s; gap: 6px; white-space: nowrap; }
    .btn:active { transform: scale(0.97); }
    .btn-primary { background: var(--primary); color: #ffffff; }
    .btn-primary:hover { background: var(--primary-hover); }
    .btn-accent { background: var(--accent); color: #ffffff; }
    .btn-danger { background: #fef2f2; border-color: #fca5a5; color: var(--danger); }
    .btn-secondary { background: #f1f5f9; border-color: #cbd5e1; color: var(--text-main); }
    .btn-secondary:hover { background: #e2e8f0; }
    input, select, textarea { font: inherit; background: #f8fafc; border: 1.5px solid var(--card-border); border-radius: 10px; color: var(--text-main); padding: 10px 14px; outline: none; }
    input:focus, select:focus, textarea:focus { border-color: var(--primary); background: #ffffff; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .winner-tag { background: #eff6ff; border: 3px solid var(--primary); color: var(--primary); padding: 16px 32px; border-radius: 50px; font-size: 2.8rem; font-weight: 900; }
    .member-tag { display: inline-flex; align-items: center; background: #ffffff; border: 1px solid var(--card-border); padding: 6px 12px; border-radius: 20px; font-size: 1rem; font-weight: 700; margin: 4px; }
    .member-tag.leader { background: #fef3c7; border-color: #f59e0b; color: #92400e; }
    .group-card { background: #f8fafc; border: 1px solid var(--card-border); border-top: 5px solid var(--primary); border-radius: 14px; padding: 16px; }
    
    /* 響應式全螢幕簡報樣式 */
    body.is-fullscreen { padding: 0 !important; margin: 0 !important; width: 100vw !important; height: 100vh !important; background: #ffffff !important; overflow: hidden !important; }
    body.is-fullscreen .nav-tabs-bar { display: none !important; }
    body.is-fullscreen .p5-main-container { width: 100vw !important; height: 100vh !important; margin: 0 !important; max-width: none !important; }
    body.is-fullscreen .tab-panel-card { border-radius: 0 !important; border: none !important; box-shadow: none !important; background: transparent !important; height: 100vh !important; justify-content: center; }
    body.is-fullscreen .non-presentation { display: none !important; }
  `);
}

function createAppLayout() {
  mainContainer = createDiv();
  mainContainer.addClass('p5-main-container');

  // 頂部頁籤導覽列
  let nav = createDiv().parent(mainContainer).addClass('nav-tabs-bar');
  let tabs = [
    { id: 'panel-timer', label: '⏱️ 小組計時器' },
    { id: 'panel-exam', label: '🔔 考試時鐘' },
    { id: 'panel-bell', label: '📅 上下課鐘 & 番茄鐘' },
    { id: 'panel-picker', label: '🎲 抽籤與分組' }
  ];

  tabs.forEach(t => {
    let btn = createButton(t.label).parent(nav).addClass('nav-tab-btn');
    btn.attribute('data-id', t.id);
    btn.mousePressed(() => switchTab(t.id));
  });

  // 四大工具面板
  createTimerPanel();
  createExamPanel();
  createBellPanel();
  createPickerPanel();
}

function switchTab(panelId) {
  currentTab = panelId;
  selectAll('.nav-tab-btn').forEach(b => {
    if (b.attribute('data-id') === panelId) b.addClass('active');
    else b.removeClass('active');
  });

  selectAll('.tab-panel-card').forEach(p => {
    if (p.id() === panelId) p.addClass('active');
    else p.removeClass('active');
  });
}

// ==========================================================================
// 1. 小組計時器模組 (含鐘面)
// ==========================================================================

function createTimerPanel() {
  let panel = createDiv().parent(mainContainer).id('panel-timer').addClass('tab-panel-card');

  let topBar = createDiv().parent(panel).style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center');
  createElement('h2', '⏱️ 小組倒數計時器').parent(topBar);
  createButton('⛶ 全螢幕簡報').parent(topBar).addClass('btn btn-secondary').mousePressed(toggleFullscreen);

  let layout = createDiv().parent(panel).addClass('grid-2');

  let ctrlCol = createDiv().parent(layout).addClass('non-presentation');

  let timeInputs = createDiv().parent(ctrlCol).style('display', 'flex').style('gap', '10px').style('align-items', 'center').style('margin-bottom', '16px');

  tMinInput = createInput('5', 'number').parent(timeInputs).style('width', '90px').style('text-align', 'center').style('font-weight', 'bold');
  createSpan('分').parent(timeInputs);
  tSecInput = createInput('0', 'number').parent(timeInputs).style('width', '90px').style('text-align', 'center').style('font-weight', 'bold');
  createSpan('秒').parent(timeInputs);

  [tMinInput, tSecInput].forEach(inp => inp.input(() => { if (!tIsRunning) resetTimer(); }));

  let presets = createDiv().parent(ctrlCol).style('display', 'grid').style('grid-template-columns', 'repeat(3, 1fr)').style('gap', '8px').style('margin-bottom', '20px');
  [1, 3, 5, 10, 15, 20].forEach(m => {
    let btn = createButton(`${m} 分`).parent(presets).addClass('btn btn-secondary');
    btn.mousePressed(() => {
      if (tIsRunning) return;
      tMinInput.value(m);
      tSecInput.value(0);
      resetTimer();
    });
  });

  let actions = createDiv().parent(ctrlCol).style('display', 'flex').style('gap', '10px');
  tStartBtn = createButton('開始').parent(actions).addClass('btn btn-primary').style('flex', '2');
  tStartBtn.mousePressed(startOrPauseTimer);

  tResetBtn = createButton('重設').parent(actions).addClass('btn btn-secondary').style('flex', '1');
  tResetBtn.mousePressed(resetTimer);

  createDiv().parent(layout).id('timer-ring-box').style('min-height', '320px');
}

function getTConfiguredSeconds() {
  const m = parseInt(tMinInput.value()) || 0;
  const s = parseInt(tSecInput.value()) || 0;
  return Math.max(0, m * 60 + Math.min(59, s));
}

function stopTAlarm() {
  if (tAlarmInterval) clearInterval(tAlarmInterval);
  tAlarmInterval = null;
}

function startTAlarm() {
  stopTAlarm();
  let high = false;
  tAlarmInterval = setInterval(() => {
    playAlarmTone(high ? 880 : 660, 0.4);
    high = !high;
  }, 600);
}

function updateTimerLoop() {
  if (!tIsRunning || !tDeadline) return;
  const remainingMs = Math.max(0, tDeadline - Date.now());
  tRemainingSeconds = Math.ceil(remainingMs / 1000);

  if (remainingMs <= 0) {
    tIsRunning = false;
    clearInterval(tInterval);
    tInterval = null;
    tDeadline = null;
    tStartBtn.html('再來一次');
    startTAlarm();
    playFanfare();
    triggerConfetti();
  }
}

function startOrPauseTimer() {
  initAudio();
  if (tIsRunning) {
    tIsRunning = false;
    clearInterval(tInterval);
    tInterval = null;
    tStartBtn.html('繼續');
    return;
  }

  if (tRemainingSeconds <= 0) {
    stopTAlarm();
    tInitialSeconds = getTConfiguredSeconds();
    tRemainingSeconds = tInitialSeconds;
  }

  if (tRemainingSeconds <= 0) return;

  tIsRunning = true;
  tDeadline = Date.now() + tRemainingSeconds * 1000;
  tStartBtn.html('暫停');
  updateTimerLoop();
  tInterval = setInterval(updateTimerLoop, 100);
}

function resetTimer() {
  tIsRunning = false;
  clearInterval(tInterval);
  tInterval = null;
  tDeadline = null;
  stopTAlarm();
  tInitialSeconds = getTConfiguredSeconds();
  tRemainingSeconds = tInitialSeconds;
  tStartBtn.html('開始');
}

// 繪製小組計時器「動態進度鐘面」
function drawTimerClockFace() {
  let box = document.getElementById('timer-ring-box');
  if (!box) return;
  let rect = box.getBoundingClientRect();
  let cx = isFullscreenMode ? width / 2 : rect.left + rect.width / 2;
  let cy = isFullscreenMode ? height / 2 : rect.top + rect.height / 2;
  let radius = isFullscreenMode ? Math.min(width, height) * 0.35 : Math.min(rect.width, rect.height) * 0.38;

  push();
  translate(cx, cy);

  // 外層刻度鐘面
  noFill();
  stroke(226, 232, 240);
  strokeWeight(12);
  ellipse(0, 0, radius * 2, radius * 2);

  // 繪製鐘面刻度
  stroke(203, 213, 225);
  strokeWeight(2);
  for (let a = 0; a < 360; a += 30) {
    let angle = radians(a);
    let x1 = (radius - 12) * cos(angle);
    let y1 = (radius - 12) * sin(angle);
    let x2 = (radius - 4) * cos(angle);
    let y2 = (radius - 4) * sin(angle);
    line(x1, y1, x2, y2);
  }

  // 動態進度圓環
  let progress = tInitialSeconds > 0 ? Math.max(0, Math.min(1, tRemainingSeconds / tInitialSeconds)) : 0;
  let angle = map(progress, 0, 1, 0, TWO_PI);

  if (tRemainingSeconds > 0 && tRemainingSeconds <= 10) stroke(220, 38, 38);
  else stroke(37, 99, 235);

  strokeWeight(12);
  strokeCap(ROUND);
  arc(0, 0, radius * 2, radius * 2, -HALF_PI, -HALF_PI + angle);

  // 數字倒數顯示
  noStroke();
  fill(15, 23, 42);
  textAlign(CENTER, CENTER);
  textSize(radius * 0.42);
  textStyle(BOLD);

  const m = Math.floor(tRemainingSeconds / 60);
  const s = tRemainingSeconds % 60;
  text(`${nf(m, 2)}:${nf(s, 2)}`, 0, 0);

  pop();
}

// ==========================================================================
// 2. 考試時鐘模組 (含指針式真實鐘面)
// ==========================================================================

function createExamPanel() {
  let panel = createDiv().parent(mainContainer).id('panel-exam').addClass('tab-panel-card');

  let topBar = createDiv().parent(panel).style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center');
  createElement('h2', '🔔 考試時鐘').parent(topBar);
  createButton('⛶ 全螢幕簡報').parent(topBar).addClass('btn btn-secondary').mousePressed(toggleFullscreen);

  let formGrid = createDiv().parent(panel).addClass('grid-3 non-presentation');

  exSubjectInp = createInput(examData.subject).parent(createField(formGrid, '考試科目')).attribute('placeholder', '例: 數學');
  exTeacherInp = createInput(examData.teacher).parent(createField(formGrid, '監考老師')).attribute('placeholder', '老師姓名');

  let timeBox = createField(formGrid, '考試時間 (開始 ～ 結束)');
  let timeFlex = createDiv().parent(timeBox).style('display', 'flex').style('gap', '6px').style('align-items', 'center');
  exStartInp = createInput(examData.start, 'time').parent(timeFlex).style('flex', '1');
  createSpan('～').parent(timeFlex);
  exEndInp = createInput(examData.end, 'time').parent(timeFlex).style('flex', '1');

  exExpInp = createInput(examData.exp || '', 'number').parent(createField(formGrid, '應到人數'));
  exPreInp = createInput(examData.pre || '', 'number').parent(createField(formGrid, '實到人數'));
  exAbsInp = createInput('0', 'number').parent(createField(formGrid, '缺考人數 (自動計算)')).attribute('readonly', true).style('opacity', '0.7');

  [exSubjectInp, exTeacherInp, exStartInp, exEndInp, exExpInp, exPreInp].forEach(inp => inp.input(updateExamSummary));

  createDiv().parent(panel).id('exam-overlay-box').style('min-height', '360px');
}

function createField(parent, labelText) {
  let box = createDiv().parent(parent);
  createElement('label', labelText).parent(box).style('display', 'block').style('margin-bottom', '6px').style('font-weight', '600').style('font-size', '0.9rem');
  return box;
}

function updateExamSummary() {
  const exp = Math.max(0, parseInt(exExpInp.value()) || 0);
  const pre = Math.max(0, parseInt(exPreInp.value()) || 0);
  const abs = Math.max(0, exp - pre);
  exAbsInp.value(abs);

  examData = {
    subject: exSubjectInp.value(),
    teacher: exTeacherInp.value(),
    start: exStartInp.value(),
    end: exEndInp.value(),
    exp, pre
  };
  saveData('exam_clock_data_v2', examData);
}

// 繪製考試時鐘「指針式與數位雙鐘面」
function drawExamClockFace() {
  let box = document.getElementById('exam-overlay-box');
  if (!box) return;
  let rect = box.getBoundingClientRect();
  let cx = isFullscreenMode ? width / 2 : rect.left + rect.width / 2;
  let startY = isFullscreenMode ? height / 2 - 100 : rect.top + 90;

  const now = new Date();

  push();
  translate(cx, startY);

  // 1. 繪製實體指針鐘面 (Analog Clock Face)
  let clockRadius = isFullscreenMode ? 100 : 70;
  fill(255);
  stroke(203, 213, 225);
  strokeWeight(4);
  ellipse(0, 0, clockRadius * 2, clockRadius * 2);

  // 刻度
  stroke(100, 116, 139);
  strokeWeight(2);
  for (let a = 0; a < 12; a++) {
    let angle = map(a, 0, 12, 0, TWO_PI);
    line((clockRadius - 10) * cos(angle), (clockRadius - 10) * sin(angle), (clockRadius - 4) * cos(angle), (clockRadius - 4) * sin(angle));
  }

  // 計算指針角度
  let secAngle = map(now.getSeconds(), 0, 60, 0, TWO_PI) - HALF_PI;
  let minAngle = map(now.getMinutes() + now.getSeconds() / 60, 0, 60, 0, TWO_PI) - HALF_PI;
  let hourAngle = map((now.getHours() % 12) + now.getMinutes() / 60, 0, 12, 0, TWO_PI) - HALF_PI;

  // 時針
  stroke(15, 23, 42);
  strokeWeight(5);
  line(0, 0, clockRadius * 0.5 * cos(hourAngle), clockRadius * 0.5 * sin(hourAngle));

  // 分針
  stroke(37, 99, 235);
  strokeWeight(3);
  line(0, 0, clockRadius * 0.7 * cos(minAngle), clockRadius * 0.7 * sin(minAngle));

  // 秒針
  stroke(220, 38, 38);
  strokeWeight(1.5);
  line(0, 0, clockRadius * 0.85 * cos(secAngle), clockRadius * 0.85 * sin(secAngle));

  // 中心軸
  fill(15, 23, 42);
  noStroke();
  ellipse(0, 0, 8, 8);

  // 2. 繪製數位大時鐘與考試資訊
  textAlign(CENTER, TOP);
  fill(15, 23, 42);
  textSize(isFullscreenMode ? 72 : 48);
  textStyle(BOLD);
  text(`${nf(now.getHours(), 2)}:${nf(now.getMinutes(), 2)}:${nf(now.getSeconds(), 2)}`, 0, clockRadius + 15);

  // 倒數時間
  textSize(isFullscreenMode ? 28 : 20);
  if (examData.end) {
    const [eH, eM] = examData.end.split(':').map(Number);
    const end = new Date(now);
    end.setHours(eH, eM, 0, 0);

    const diff = end.getTime() - now.getTime();
    if (diff <= 0) {
      fill(220, 38, 38);
      text('考試時間已結束', 0, clockRadius + (isFullscreenMode ? 100 : 75));
    } else {
      fill(124, 58, 237);
      text(`距離考試結束還有 ${Math.ceil(diff / 60000)} 分鐘`, 0, clockRadius + (isFullscreenMode ? 100 : 75));
    }
  } else {
    fill(100, 116, 139);
    text('請設定考試結束時間', 0, clockRadius + (isFullscreenMode ? 100 : 75));
  }

  // 摘要卡片文字
  const abs = Math.max(0, (examData.exp || 0) - (examData.pre || 0));
  textSize(isFullscreenMode ? 20 : 15);
  fill(71, 85, 105);
  text(`科目: ${examData.subject || '未設定'}  |  監考: ${examData.teacher || '未設定'}  |  應到: ${examData.exp || 0}人  |  實到: ${examData.pre || 0}人  |  缺考: ${abs}人`, 0, clockRadius + (isFullscreenMode ? 145 : 110));

  pop();
}

// ==========================================================================
// 3. 上下課鐘 & 番茄鐘模組 (含鐘面)
// ==========================================================================

function createBellPanel() {
  let panel = createDiv().parent(mainContainer).id('panel-bell').addClass('tab-panel-card');

  let topBar = createDiv().parent(panel).style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center');
  createElement('h2', '📅 上下課鐘 & 讀書番茄鐘').parent(topBar);
  createButton('⛶ 全螢幕簡報').parent(topBar).addClass('btn btn-secondary').mousePressed(toggleFullscreen);

  let grid = createDiv().parent(panel).addClass('grid-2');

  // 打鐘欄位
  let bellBox = createDiv().parent(grid).addClass('non-presentation');
  createElement('h3', '🔔 打鐘與課表').parent(bellBox).style('margin-bottom', '12px');

  let bellBtns = createDiv().parent(bellBox).style('display', 'flex').style('gap', '10px').style('margin-bottom', '16px');
  createButton('上課鈴聲').parent(bellBtns).addClass('btn btn-primary').style('flex', '1').mousePressed(() => playSchoolBell('start'));
  createButton('下課鈴聲').parent(bellBtns).addClass('btn btn-accent').style('flex', '1').mousePressed(() => playSchoolBell('end'));

  autoBellCheckbox = createCheckbox(' 啟用課表自動打鐘', false).parent(bellBox).style('font-weight', 'bold').style('margin-bottom', '16px');

  let schedBox = createDiv().parent(bellBox).id('schedule-list-container');
  renderScheduleUI(schedBox);

  createButton('＋ 新增一節課').parent(bellBox).addClass('btn btn-secondary').style('width', '100%').mousePressed(() => {
    bellSchedule.push({ start: '08:10', end: '08:50' });
    saveData('bell_schedule_v2', bellSchedule);
    renderScheduleUI(schedBox);
  });

  // 番茄鐘欄位
  let pomoBox = createDiv().parent(grid);
  createElement('h3', '🍅 讀書番茄鐘').parent(pomoBox).addClass('non-presentation').style('margin-bottom', '12px');

  let pomoInputs = createDiv().parent(pomoBox).addClass('non-presentation').style('display', 'flex').style('gap', '10px').style('margin-bottom', '16px');
  pomoFocusInp = createInput('25', 'number').parent(pomoInputs).style('width', '100px');
  pomoBreakInp = createInput('5', 'number').parent(pomoInputs).style('width', '100px');

  let pomoBtns = createDiv().parent(pomoBox).addClass('non-presentation').style('display', 'flex').style('gap', '10px');
  pomoStartBtn = createButton('開始').parent(pomoBtns).addClass('btn btn-primary').mousePressed(togglePomodoro);
  createButton('重設').parent(pomoBtns).addClass('btn btn-secondary').mousePressed(resetPomodoro);

  createDiv().parent(pomoBox).id('pomodoro-ring-box').style('min-height', '260px');
}

function renderScheduleUI(container) {
  container.html('');
  bellSchedule.forEach((period, idx) => {
    let row = createDiv().parent(container).style('display', 'flex').style('gap', '8px').style('align-items', 'center').style('margin-bottom', '8px');
    createSpan(`第 ${idx + 1} 節`).parent(row).style('font-weight', 'bold');
    let sInp = createInput(period.start, 'time').parent(row);
    sInp.change(() => { period.start = sInp.value(); saveData('bell_schedule_v2', bellSchedule); });
    createSpan('～').parent(row);
    let eInp = createInput(period.end, 'time').parent(row);
    eInp.change(() => { period.end = eInp.value(); saveData('bell_schedule_v2', bellSchedule); });

    let delBtn = createButton('刪除').parent(row).addClass('btn btn-danger').style('padding', '4px 8px').style('font-size', '0.85rem');
    delBtn.mousePressed(() => {
      bellSchedule.splice(idx, 1);
      saveData('bell_schedule_v2', bellSchedule);
      renderScheduleUI(container);
    });
  });
}

function checkAutoBellLoop() {
  if (!autoBellCheckbox.checked()) return;
  const now = new Date();
  if (now.getSeconds() !== 0) return;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (timeStr === lastRungMinute) return;

  const isStart = bellSchedule.some(p => p.start === timeStr);
  const isEnd = bellSchedule.some(p => p.end === timeStr);

  if (isStart || isEnd) {
    lastRungMinute = timeStr;
    playSchoolBell(isStart ? 'start' : 'end');
  }
}

function togglePomodoro() {
  initAudio();
  if (pomoState.running) {
    pomoState.remainingMs = Math.max(0, pomoState.deadline - Date.now());
    pomoState.running = false;
    pomoState.deadline = null;
    pomoStartBtn.html('開始');
  } else {
    pomoState.deadline = Date.now() + pomoState.remainingMs;
    pomoState.running = true;
    pomoStartBtn.html('暫停');
  }
}

function resetPomodoro() {
  pomoState = { mode: 'focus', round: 1, remainingMs: (parseInt(pomoFocusInp.value()) || 25) * 60 * 1000, deadline: null, running: false };
  pomoStartBtn.html('開始');
}

function updatePomodoroLoop() {
  if (!pomoState.running) return;
  pomoState.remainingMs = Math.max(0, pomoState.deadline - Date.now());
  if (pomoState.remainingMs <= 0) {
    playSchoolBell('end');
    if (pomoState.mode === 'focus') {
      pomoState.mode = 'break';
      pomoState.remainingMs = (parseInt(pomoBreakInp.value()) || 5) * 60 * 1000;
    } else {
      pomoState.mode = 'focus';
      pomoState.round += 1;
      pomoState.remainingMs = (parseInt(pomoFocusInp.value()) || 25) * 60 * 1000;
    }
    pomoState.deadline = Date.now() + pomoState.remainingMs;
  }
}

// 繪製番茄鐘「圓環鐘面」
function drawPomodoroClockFace() {
  let box = document.getElementById('pomodoro-ring-box');
  if (!box) return;
  let rect = box.getBoundingClientRect();
  let cx = isFullscreenMode ? width / 2 : rect.left + rect.width / 2;
  let cy = isFullscreenMode ? height / 2 : rect.top + rect.height / 2;
  let radius = isFullscreenMode ? Math.min(width, height) * 0.35 : Math.min(rect.width, rect.height) * 0.38;

  push();
  translate(cx, cy);

  // 鐘面外環
  noFill();
  stroke(226, 232, 240);
  strokeWeight(10);
  ellipse(0, 0, radius * 2, radius * 2);

  // 計算進度
  let totalDuration = (pomoState.mode === 'focus' ? (parseInt(pomoFocusInp.value()) || 25) : (parseInt(pomoBreakInp.value()) || 5)) * 60 * 1000;
  let progress = totalDuration > 0 ? Math.max(0, Math.min(1, pomoState.remainingMs / totalDuration)) : 0;
  let angle = map(progress, 0, 1, 0, TWO_PI);

  if (pomoState.mode === 'focus') stroke(37, 99, 235);
  else stroke(22, 163, 74); // 休息階段翡翠綠

  strokeWeight(10);
  strokeCap(ROUND);
  arc(0, 0, radius * 2, radius * 2, -HALF_PI, -HALF_PI + angle);

  // 鐘面中心文字
  noStroke();
  fill(15, 23, 42);
  textAlign(CENTER, CENTER);
  textSize(radius * 0.22);
  textStyle(BOLD);
  text(pomoState.mode === 'focus' ? '🎯 專注時間' : '☕ 休息時間', 0, -radius * 0.3);

  textSize(radius * 0.38);
  const totalSec = Math.ceil(pomoState.remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  text(`${nf(m, 2)}:${nf(s, 2)}`, 0, radius * 0.1);

  textSize(radius * 0.18);
  fill(100, 116, 139);
  text(`第 ${pomoState.round} 輪`, 0, radius * 0.45);

  pop();
}

// ==========================================================================
// 4. 課堂抽籤與隨機分組模組
// ==========================================================================

function createPickerPanel() {
  let panel = createDiv().parent(mainContainer).id('panel-picker').addClass('tab-panel-card');

  let topBar = createDiv().parent(panel).style('display', 'flex').style('justify-content', 'space-between').style('align-items', 'center');
  createElement('h2', '🎲 課堂抽籤與隨機分組').parent(topBar);
  createButton('⛶ 全螢幕簡報').parent(topBar).addClass('btn btn-secondary').mousePressed(toggleFullscreen);

  let subNav = createDiv().parent(panel).addClass('non-presentation').style('display', 'flex').style('gap', '10px');
  let drawTabBtn = createButton('🎲 抽籤模式').parent(subNav).addClass('btn btn-accent');
  let groupTabBtn = createButton('🧩 隨機分組').parent(subNav).addClass('btn btn-secondary');

  let drawSec = createDiv().parent(panel);
  let groupSec = createDiv().parent(panel).style('display', 'none');

  drawTabBtn.mousePressed(() => {
    drawTabBtn.addClass('btn-accent').removeClass('btn-secondary');
    groupTabBtn.addClass('btn-secondary').removeClass('btn-accent');
    drawSec.style('display', 'block');
    groupSec.style('display', 'none');
  });

  groupTabBtn.mousePressed(() => {
    groupTabBtn.addClass('btn-accent').removeClass('btn-secondary');
    drawTabBtn.addClass('btn-secondary').removeClass('btn-accent');
    groupSec.style('display', 'block');
    drawSec.style('display', 'none');
  });

  // 抽籤 UI
  let pkGrid = createDiv().parent(drawSec).addClass('grid-3 non-presentation').style('margin-bottom', '16px');
  pkModeSelect = createSelect().parent(createField(pkGrid, '抽籤類型'));
  pkModeSelect.option('號碼模式 (1~N)', 'number');
  pkModeSelect.option('姓名模式 (自行貼上)', 'name');

  pkStartInp = createInput('1', 'number').parent(createField(pkGrid, '起始號碼'));
  pkEndInp = createInput('30', 'number').parent(createField(pkGrid, '結束號碼'));
  pkCountInp = createInput('1', 'number').parent(createField(pkGrid, '一次抽取人數'));

  pkNameTextarea = createElement('textarea').parent(drawSec).addClass('non-presentation').attribute('placeholder', '貼上學生名單 (每行一名)').style('width', '100%').style('height', '80px').style('margin-bottom', '16px');
  pkExcludeInp = createInput('').parent(drawSec).addClass('non-presentation').attribute('placeholder', '排除對象 (例: 5, 12 或 張三)').style('width', '100%').style('margin-bottom', '16px');

  pkAllowRepeatCheck = createCheckbox(' 允許重複抽籤', false).parent(drawSec).addClass('non-presentation').style('margin-bottom', '16px').style('font-weight', 'bold');

  createButton('🚀 開始抽籤 (空白鍵)').parent(drawSec).addClass('btn btn-primary').style('width', '100%').style('padding', '14px').mousePressed(startDrawProcess);

  let resultBox = createDiv().parent(drawSec).id('draw-result-box').style('min-height', '140px').style('margin', '20px 0').style('display', 'flex').style('align-items', 'center').style('justify-content', 'center').style('border', '2px dashed #2563eb').style('border-radius', '16px');
  createSpan('點擊「開始抽籤」進行抽取').parent(resultBox).style('color', '#64748b');

  // 分組 UI
  gpNameTextarea = createElement('textarea').parent(groupSec).addClass('non-presentation').attribute('placeholder', '分組名單 (每行一名)').style('width', '100%').style('height', '100px').style('margin-bottom', '16px');

  let gpGrid = createDiv().parent(groupSec).addClass('grid-3 non-presentation').style('margin-bottom', '16px');
  gpSizeInp = createInput('4', 'number').parent(createField(gpGrid, '每組人數'));
  gpStrategySelect = createSelect().parent(createField(gpGrid, '分組方式'));
  gpStrategySelect.option('🎲 純隨機分組', 'random');
  gpStrategySelect.option('⚖️ 男女混合 (平均)', 'gender-mix');
  gpExcludeInp = createInput('').parent(createField(gpGrid, '排除名單'));

  let gpBtns = createDiv().parent(groupSec).style('display', 'flex').style('gap', '10px').style('margin-bottom', '20px');
  createButton('🧩 開始分組').parent(gpBtns).addClass('btn btn-accent').style('flex', '2').mousePressed(startGroupingProcess);
  createButton('👑 各組抽組長').parent(gpBtns).addClass('btn btn-primary').style('flex', '1').mousePressed(drawAllGroupLeaders);

  createDiv().parent(groupSec).id('groups-container-box').addClass('grid-2');
}

function cleanName(str) { return String(str).replace(/\s*\([男女]\)\s*/g, '').trim(); }

function getCandidatePool() {
  let pool = [];
  if (pkModeSelect.value() === 'number') {
    const start = parseInt(pkStartInp.value()) || 1;
    const end = parseInt(pkEndInp.value()) || 30;
    for (let i = start; i <= end; i++) pool.push(String(i));
  } else {
    pool = pkNameTextarea.value().split('\n').map(s => s.trim()).filter(Boolean);
  }

  const excludes = pkExcludeInp.value().split(/[,，\s]+/).map(cleanName).filter(Boolean);
  pool = pool.filter(item => !excludes.includes(cleanName(item)));

  if (!pkAllowRepeatCheck.checked()) {
    pool = pool.filter(item => !drawHistory.includes(cleanName(item)));
  }
  return pool;
}

function startDrawProcess() {
  if (isDrawing) return;
  const pool = getCandidatePool();
  const count = parseInt(pkCountInp.value()) || 1;

  if (pool.length === 0) return alert('沒有可抽的對象！');

  isDrawing = true;
  const resultBox = select('#draw-result-box');
  let elapsed = 0;

  const timer = setInterval(() => {
    elapsed += 50;
    playBeep();
    let tempPool = [...pool];
    let tempWinners = [];
    for (let i = 0; i < count; i++) {
      if (!tempPool.length) break;
      const idx = Math.floor(Math.random() * tempPool.length);
      tempWinners.push(tempPool.splice(idx, 1)[0]);
    }
    resultBox.html(tempWinners.map(w => `<div class="winner-tag">${cleanName(w)}</div>`).join(''));

    if (elapsed >= 1800) {
      clearInterval(timer);
      let finalWinners = [];
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        finalWinners.push(pool.splice(idx, 1)[0]);
      }
      resultBox.html(finalWinners.map(w => `<div class="winner-tag">${cleanName(w)}</div>`).join(''));

      finalWinners.forEach(w => {
        const cName = cleanName(w);
        if (!pkAllowRepeatCheck.checked()) drawHistory.push(cName);
        else drawHistory.unshift(cName);
      });

      playFanfare();
      triggerConfetti();
      isDrawing = false;
    }
  }, 50);
}

function startGroupingProcess() {
  const rawText = gpNameTextarea.value();
  const size = parseInt(gpSizeInp.value()) || 4;
  const excludes = gpExcludeInp.value().split(/[,，\s]+/).map(cleanName).filter(Boolean);

  let list = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  list = list.filter(item => !excludes.includes(cleanName(item)));

  if (!list.length) return alert('名單為空或全被排除！');

  const shuffled = [...list].sort(() => Math.random() - 0.5);
  const count = Math.ceil(shuffled.length / size);
  let groups = Array.from({ length: count }, () => []);
  shuffled.forEach((item, i) => groups[i % count].push({ name: item, isLeader: false }));

  currentGroups = groups;
  renderGroupsUI();
  playFanfare();
  triggerConfetti();
}

function renderGroupsUI() {
  const container = select('#groups-container-box');
  container.html('');
  currentGroups.forEach((group, idx) => {
    let card = createDiv().parent(container).addClass('group-card');
    let header = createDiv().parent(card).style('display', 'flex').style('justify-content', 'space-between').style('margin-bottom', '8px');
    createElement('strong', `第 ${idx + 1} 組`).parent(header).style('color', '#2563eb');

    let membersBox = createDiv().parent(card);
    group.forEach(m => {
      createSpan(`${m.isLeader ? '👑 ' : ''}${cleanName(m.name)}`).parent(membersBox).addClass(`member-tag ${m.isLeader ? 'leader' : ''}`);
    });
  });
}

function drawAllGroupLeaders() {
  currentGroups.forEach(g => {
    if (g.length) {
      const lIdx = Math.floor(Math.random() * g.length);
      g.forEach((m, i) => m.isLeader = (i === lIdx));
    }
  });
  renderGroupsUI();
  playFanfare();
  triggerConfetti();
}

// ==========================================================================
// 5. 彩帶慶祝粒子與資料儲存
// ==========================================================================

function triggerConfetti() {
  confettiParticles = [];
  const colors = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626'];
  for (let i = 0; i < 100; i++) {
    confettiParticles.push({
      x: width / 2,
      y: height / 2,
      vx: random(-10, 10),
      vy: random(-12, -2),
      size: random(6, 12),
      color: random(colors),
      life: 255
    });
  }
}

function updateAndRenderConfetti() {
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    let p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.35;
    p.life -= 4;

    push();
    noStroke();
    fill(red(p.color), green(p.color), blue(p.color), p.life);
    rect(p.x, p.y, p.size, p.size);
    pop();

    if (p.life <= 0) confettiParticles.splice(i, 1);
  }
}

function saveData(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(e);
  }
}

function loadAllStoredData() {
  try {
    const savedExam = JSON.parse(localStorage.getItem('exam_clock_data_v2'));
    if (savedExam) examData = savedExam;

    const savedSched = JSON.parse(localStorage.getItem('bell_schedule_v2'));
    if (Array.isArray(savedSched)) bellSchedule = savedSched;
  } catch (e) {
    console.error(e);
  }
}

// 全域鍵盤快捷鍵 (Space / R / Esc)
function handleGlobalHotkeys(e) {
  const activeTag = document.activeElement.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(activeTag)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    if (currentTab === 'panel-timer') startOrPauseTimer();
    else if (currentTab === 'panel-picker') startDrawProcess();
  } else if (e.key.toLowerCase() === 'r') {
    if (currentTab === 'panel-timer') resetTimer();
  }
}