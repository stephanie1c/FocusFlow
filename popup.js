// Popup script for FocusFlow
// Handles UI interactions and displays timer/stats data

// State
let currentTab = 'timer';
let timerState = {
  isRunning: false,
  isPaused: false,
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  completedPomodoros: 0
};
let statsData = null;
let statsPeriod = 'day';
let chartInstance = null;

// DOM Elements
const timerTab = document.getElementById('timer-tab');
const statsTab = document.getElementById('stats-tab');
const navBtns = document.querySelectorAll('.nav-btn');
const timeDisplay = document.querySelector('.time');
const statusDisplay = document.querySelector('.status');
const progressRing = document.querySelector('.progress-ring-fill');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const durationBtns = document.querySelectorAll('.duration-btn');
const periodBtns = document.querySelectorAll('.period-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  updateDate();
  await loadTimerState();
  await loadStats();
  setupEventListeners();
  updateTimerDisplay();
  startPeriodicUpdate();
});

// ==================== Event Listeners ====================

function setupEventListeners() {
  // Tab navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Timer controls
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);
  
  // Duration selector
  durationBtns.forEach(btn => {
    btn.addEventListener('click', () => setDuration(parseInt(btn.dataset.duration)));
  });
  
  // Period selector
  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => switchPeriod(btn.dataset.period));
  });
}

// ==================== Tab Navigation ====================

function switchTab(tab) {
  currentTab = tab;
  
  // Update nav buttons
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  // Update tab content
  timerTab.classList.toggle('active', tab === 'timer');
  statsTab.classList.toggle('active', tab === 'stats');
  
  if (tab === 'stats') {
    loadStats();
  }
}

function switchPeriod(period) {
  statsPeriod = period;
  
  periodBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });
  
  renderStats();
}

// ==================== Timer Functions ====================

async function loadTimerState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTimerState' });
    if (response) {
      timerState = response.timerState;
      updateTimerDisplay();
      updateStatsSummary(response.todayStats);
    }
  } catch (e) {
    console.error('Failed to load timer state:', e);
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerState.remainingSeconds / 60);
  const seconds = timerState.remainingSeconds % 60;
  timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Update progress ring
  const circumference = 2 * Math.PI * 90;
  const progress = (timerState.totalSeconds - timerState.remainingSeconds) / timerState.totalSeconds;
  const offset = circumference * progress;
  progressRing.style.strokeDashoffset = offset;
  
  // Update status
  if (timerState.isRunning && !timerState.isPaused) {
    statusDisplay.textContent = '专注中...';
    document.body.classList.add('timer-running');
    startBtn.disabled = true;
    pauseBtn.disabled = false;
  } else if (timerState.isPaused) {
    statusDisplay.textContent = '已暂停';
    document.body.classList.remove('timer-running');
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  } else {
    statusDisplay.textContent = '准备专注';
    document.body.classList.remove('timer-running');
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  }
  
  // Update duration buttons
  const currentDuration = timerState.totalSeconds / 60;
  durationBtns.forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.duration) === currentDuration);
  });
}

async function startTimer() {
  await chrome.runtime.sendMessage({ action: 'startTimer' });
  await loadTimerState();
}

async function pauseTimer() {
  await chrome.runtime.sendMessage({ action: 'pauseTimer' });
  await loadTimerState();
}

async function resetTimer() {
  await chrome.runtime.sendMessage({ action: 'resetTimer' });
  await loadTimerState();
}

async function setDuration(minutes) {
  await chrome.runtime.sendMessage({ action: 'setDuration', minutes });
  await loadTimerState();
}

function updateStatsSummary(todayStats) {
  document.getElementById('today-pomodoros').textContent = todayStats.pomodoros || 0;
  const focusHours = ((todayStats.focusMinutes || 0) / 60).toFixed(1);
  document.getElementById('total-focus-time').textContent = focusHours + 'h';
}

function startPeriodicUpdate() {
  setInterval(async () => {
    if (currentTab === 'timer') {
      await loadTimerState();
    }
  }, 1000);
}

// ==================== Stats Functions ====================

async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    if (response) {
      statsData = response;
      renderStats();
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function renderStats() {
  if (!statsData) return;
  
  const { dailyStats, today, week } = statsData;
  let sites = {};
  let totalMinutes = 0;
  let pomodoros = 0;
  
  if (statsPeriod === 'day') {
    const dayData = dailyStats[today] || { sites: {}, pomodoros: 0, focusMinutes: 0 };
    sites = dayData.sites || {};
    totalMinutes = Object.values(sites).reduce((sum, s) => sum + (s.minutes || 0), 0);
    pomodoros = dayData.pomodoros || 0;
  } else {
    // Week view - aggregate last 7 days
    const todayDate = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (dailyStats[key]) {
        pomodoros += dailyStats[key].pomodoros || 0;
        Object.entries(dailyStats[key].sites || {}).forEach(([domain, data]) => {
          if (!sites[domain]) {
            sites[domain] = { minutes: 0, visits: 0 };
          }
          sites[domain].minutes += data.minutes || 0;
          sites[domain].visits += data.visits || 0;
        });
      }
    }
    totalMinutes = Object.values(sites).reduce((sum, s) => sum + (s.minutes || 0), 0);
  }
  
  // Update summary cards
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  document.getElementById('total-time').textContent = 
    hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  
  // Top category/site
  const sortedSites = Object.entries(sites).sort((a, b) => b[1].minutes - a[1].minutes);
  document.getElementById('top-category').textContent = 
    sortedSites.length > 0 ? sortedSites[0][0].split('.')[0] : '-';
  
  document.getElementById('site-count').textContent = Object.keys(sites).length;
  
  // Focus ratio (pomodoro time / total browsing time)
  const focusMinutes = pomodoros * 25;
  const ratio = totalMinutes > 0 ? Math.round((focusMinutes / totalMinutes) * 100) : 0;
  document.getElementById('focus-ratio').textContent = ratio + '%';
  
  // Render chart
  renderChart(sortedSites.slice(0, 5));
  
  // Render site list
  renderSiteList(sortedSites);
}

function renderChart(topSites) {
  const canvas = document.getElementById('usage-chart');
  const ctx = canvas.getContext('2d');
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (topSites.length === 0) {
    renderEmptyChart(ctx, canvas);
    return;
  }
  
  const total = topSites.reduce((sum, [, data]) => sum + data.minutes, 0);
  const colors = ['#ff6b4a', '#4ecdc4', '#ffe66d', '#a78bfa', '#6ee7b7'];
  
  // Draw pie chart
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 30;
  
  let currentAngle = -Math.PI / 2;
  
  topSites.forEach(([domain, data], index) => {
    const sliceAngle = (data.minutes / total) * 2 * Math.PI;
    
    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();
    
    // Draw border
    ctx.strokeStyle = '#151520';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    currentAngle += sliceAngle;
  });
  
  // Draw center hole (donut chart)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#151520';
  ctx.fill();
  
  // Draw legend
  let legendY = 10;
  topSites.forEach(([domain, data], index) => {
    const percentage = Math.round((data.minutes / total) * 100);
    
    // Color box
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(10, legendY, 12, 12);
    
    // Text
    ctx.fillStyle = '#f0f0f5';
    ctx.font = '11px "Space Grotesk"';
    ctx.fillText(`${domain.split('.')[0]} (${percentage}%)`, 28, legendY + 10);
    
    legendY += 18;
  });
}

function renderEmptyChart(ctx, canvas) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  ctx.strokeStyle = '#252535';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 60, 0, 2 * Math.PI);
  ctx.stroke();
  
  ctx.fillStyle = '#5a5a6a';
  ctx.font = '12px "Space Grotesk"';
  ctx.textAlign = 'center';
  ctx.fillText('暂无数据', centerX, centerY + 4);
}

function renderSiteList(sortedSites) {
  const container = document.getElementById('site-list-container');
  
  if (sortedSites.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18"/>
          <path d="M9 21V9"/>
        </svg>
        <p>暂无网站使用数据</p>
      </div>
    `;
    return;
  }
  
  const maxMinutes = sortedSites[0][1].minutes;
  
  container.innerHTML = sortedSites.slice(0, 10).map(([domain, data]) => {
    const percentage = (data.minutes / maxMinutes) * 100;
    const hours = Math.floor(data.minutes / 60);
    const mins = data.minutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    return `
      <div class="site-item">
        <div class="site-icon">${domain.charAt(0).toUpperCase()}</div>
        <div class="site-info">
          <span class="site-name">${domain}</span>
          <span class="site-time">${timeStr} · ${data.visits} 次访问</span>
        </div>
        <div class="site-bar">
          <div class="site-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== Utility Functions ====================

function updateDate() {
  const now = new Date();
  const options = { month: 'short', day: 'numeric', weekday: 'short' };
  document.querySelector('.date').textContent = now.toLocaleDateString('zh-CN', options);
}
