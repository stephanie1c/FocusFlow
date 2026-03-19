// Background Service Worker for FocusFlow
// Handles timer, website tracking, and data persistence

const DEFAULT_POMODORO_MINUTES = 25;
const STORAGE_KEY = 'focusflow_data';

// Timer state
let timerState = {
  isRunning: false,
  isPaused: false,
  totalSeconds: DEFAULT_POMODORO_MINUTES * 60,
  remainingSeconds: DEFAULT_POMODORO_MINUTES * 60,
  startTime: null,
  pausedAt: null,
  completedPomodoros: 0
};

// Website tracking state
let trackingState = {
  currentTab: null,
  currentDomain: null,
  tabStartTime: null,
  dailyStats: {},
  isTracking: true
};

// Initialize
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

async function initialize() {
  await loadData();
  setupAlarm();
  setupTabListeners();
  cleanupOldData();
}

// ==================== Timer Functions ====================

function setupAlarm() {
  chrome.alarms.create('timerTick', { periodInMinutes: 1/60 }); // Every second
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timerTick') {
    handleTimerTick();
  }
});

function handleTimerTick() {
  if (!timerState.isRunning || timerState.isPaused) return;
  
  if (timerState.remainingSeconds > 0) {
    timerState.remainingSeconds--;
    updateBadge();
    notifyPopup();
  } else {
    completePomodoro();
  }
  
  saveData();
}

function completePomodoro() {
  timerState.isRunning = false;
  timerState.completedPomodoros++;
  
  // Update today's stats
  const today = getTodayKey();
  if (!trackingState.dailyStats[today]) {
    trackingState.dailyStats[today] = { pomodoros: 0, focusMinutes: 0, sites: {} };
  }
  trackingState.dailyStats[today].pomodoros++;
  trackingState.dailyStats[today].focusMinutes += DEFAULT_POMODORO_MINUTES;
  
  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '番茄钟完成！',
    message: '恭喜你完成了一个番茄钟，休息一下吧。'
  });
  
  resetTimer();
  saveData();
  notifyPopup();
}

function startTimer() {
  if (timerState.isRunning && !timerState.isPaused) return;
  
  timerState.isRunning = true;
  timerState.isPaused = false;
  timerState.startTime = Date.now();
  
  updateBadge();
  saveData();
  notifyPopup();
}

function pauseTimer() {
  if (!timerState.isRunning || timerState.isPaused) return;
  
  timerState.isPaused = true;
  timerState.pausedAt = Date.now();
  
  updateBadge();
  saveData();
  notifyPopup();
}

function resetTimer() {
  timerState.isRunning = false;
  timerState.isPaused = false;
  timerState.remainingSeconds = timerState.totalSeconds;
  timerState.startTime = null;
  timerState.pausedAt = null;
  
  updateBadge();
  saveData();
  notifyPopup();
}

function setTimerDuration(minutes) {
  timerState.totalSeconds = minutes * 60;
  if (!timerState.isRunning) {
    timerState.remainingSeconds = timerState.totalSeconds;
  }
  saveData();
  notifyPopup();
}

function updateBadge() {
  if (!timerState.isRunning || timerState.isPaused) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  const minutes = Math.ceil(timerState.remainingSeconds / 60);
  chrome.action.setBadgeText({ text: minutes.toString() });
  chrome.action.setBadgeBackgroundColor({ color: '#ff6b4a' });
}

// ==================== Website Tracking ====================

function setupTabListeners() {
  // Track active tab changes
  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);
  
  // Start tracking current tab
  trackCurrentTab();
}

async function handleTabActivated(activeInfo) {
  await recordCurrentTabTime();
  
  const tab = await chrome.tabs.get(activeInfo.tabId);
  startTrackingTab(tab);
}

async function handleTabUpdated(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete' && tab.active) {
    await recordCurrentTabTime();
    startTrackingTab(tab);
  }
}

async function handleWindowFocusChanged(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus
    await recordCurrentTabTime();
    trackingState.currentTab = null;
    trackingState.currentDomain = null;
  } else {
    // Window gained focus
    await trackCurrentTab();
  }
}

async function trackCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      startTrackingTab(tab);
    }
  } catch (e) {
    console.log('No active tab');
  }
}

function startTrackingTab(tab) {
  if (!tab || !tab.url) return;
  
  const domain = extractDomain(tab.url);
  if (!domain || isInternalUrl(tab.url)) return;
  
  trackingState.currentTab = tab.id;
  trackingState.currentDomain = domain;
  trackingState.tabStartTime = Date.now();
}

async function recordCurrentTabTime() {
  if (!trackingState.currentDomain || !trackingState.tabStartTime) return;
  
  const now = Date.now();
  const durationMs = now - trackingState.tabStartTime;
  const durationMinutes = Math.floor(durationMs / 60000);
  
  if (durationMinutes < 1) return; // Ignore very short visits
  
  const today = getTodayKey();
  if (!trackingState.dailyStats[today]) {
    trackingState.dailyStats[today] = { pomodoros: 0, focusMinutes: 0, sites: {} };
  }
  
  const sites = trackingState.dailyStats[today].sites;
  if (!sites[trackingState.currentDomain]) {
    sites[trackingState.currentDomain] = { minutes: 0, visits: 0 };
  }
  
  sites[trackingState.currentDomain].minutes += durationMinutes;
  sites[trackingState.currentDomain].visits += 1;
  
  await saveData();
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch (e) {
    return null;
  }
}

function isInternalUrl(url) {
  return url.startsWith('chrome://') || 
         url.startsWith('chrome-extension://') ||
         url.startsWith('about:') ||
         url.startsWith('edge://');
}

// ==================== Data Management ====================

async function loadData() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    if (result[STORAGE_KEY]) {
      const data = result[STORAGE_KEY];
      if (data.timerState) {
        timerState = { ...timerState, ...data.timerState };
      }
      if (data.dailyStats) {
        trackingState.dailyStats = data.dailyStats;
      }
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

async function saveData() {
  try {
    const data = {
      timerState: {
        totalSeconds: timerState.totalSeconds,
        remainingSeconds: timerState.remainingSeconds,
        completedPomodoros: timerState.completedPomodoros
      },
      dailyStats: trackingState.dailyStats
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

function cleanupOldData() {
  // Keep only last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const cutoffKey = thirtyDaysAgo.toISOString().split('T')[0];
  
  Object.keys(trackingState.dailyStats).forEach(key => {
    if (key < cutoffKey) {
      delete trackingState.dailyStats[key];
    }
  });
  
  saveData();
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

// ==================== Message Handling ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getTimerState':
      sendResponse({
        timerState: {
          isRunning: timerState.isRunning,
          isPaused: timerState.isPaused,
          totalSeconds: timerState.totalSeconds,
          remainingSeconds: timerState.remainingSeconds,
          completedPomodoros: timerState.completedPomodoros
        },
        todayStats: trackingState.dailyStats[getTodayKey()] || { pomodoros: 0, focusMinutes: 0, sites: {} }
      });
      break;
      
    case 'startTimer':
      startTimer();
      sendResponse({ success: true });
      break;
      
    case 'pauseTimer':
      pauseTimer();
      sendResponse({ success: true });
      break;
      
    case 'resetTimer':
      resetTimer();
      sendResponse({ success: true });
      break;
      
    case 'setDuration':
      setTimerDuration(request.minutes);
      sendResponse({ success: true });
      break;
      
    case 'getStats':
      sendResponse({
        dailyStats: trackingState.dailyStats,
        today: getTodayKey(),
        week: getWeekKey()
      });
      break;
      
    case 'clearStats':
      trackingState.dailyStats = {};
      saveData();
      sendResponse({ success: true });
      break;
  }
  
  return true;
});

function notifyPopup() {
  // Popup will request fresh data when opened
}

// Periodic save every minute
setInterval(saveData, 60000);
