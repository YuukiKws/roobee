const toggleEnabled = document.getElementById('toggleEnabled');
const modeEnBtn = document.getElementById('modeEn');
const modeKanaBtn = document.getElementById('modeKana');
const excludeSuruCheckbox = document.getElementById('excludeSuru');

function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, message, () => {
        void chrome.runtime.lastError; // content scriptが無いページ(chrome://等)では無視
      });
    }
  });
}

function renderLabelMode(mode) {
  modeEnBtn.classList.toggle('active', mode === 'en');
  modeKanaBtn.classList.toggle('active', mode === 'kana');
}

chrome.storage.local.get(
  {
    rbv_enabled: false,
    rbv_label_mode: 'en',
    rbv_exclude_suru_after_noun: true
  },
  (res) => {
    toggleEnabled.checked = res.rbv_enabled;
    renderLabelMode(res.rbv_label_mode);
    excludeSuruCheckbox.checked = res.rbv_exclude_suru_after_noun;
  }
);

toggleEnabled.addEventListener('change', () => {
  const enabled = toggleEnabled.checked;
  chrome.storage.local.set({ rbv_enabled: enabled });
  sendToActiveTab({ type: 'RBV_TOGGLE', enabled });
});

modeEnBtn.addEventListener('click', () => {
  renderLabelMode('en');
  chrome.storage.local.set({ rbv_label_mode: 'en' });
  sendToActiveTab({ type: 'RBV_LABEL_MODE', mode: 'en' });
});

modeKanaBtn.addEventListener('click', () => {
  renderLabelMode('kana');
  chrome.storage.local.set({ rbv_label_mode: 'kana' });
  sendToActiveTab({ type: 'RBV_LABEL_MODE', mode: 'kana' });
});

excludeSuruCheckbox.addEventListener('change', () => {
  const value = excludeSuruCheckbox.checked;
  chrome.storage.local.set({ rbv_exclude_suru_after_noun: value });
  sendToActiveTab({ type: 'RBV_EXCLUDE_SURU', value });
});

document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// --- アップデート告知機能 ---
const LATEST_JSON_URL = 'https://raw.githubusercontent.com/YuukiKws/roobee/main/latest.json';

function isNewerVersion(remote, local) {
  const r = String(remote).split('.').map(Number);
  const l = String(local).split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

async function checkForUpdate() {
  try {
    const res = await fetch(LATEST_JSON_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const currentVersion = chrome.runtime.getManifest().version;

    if (data.latest && isNewerVersion(data.latest, currentVersion)) {
      document.getElementById('updateVersionText').textContent = `ver${data.latest}`;
      document.getElementById('updateLink').href = data.url || '#';
      document.getElementById('updateBanner').style.display = 'block';
    }
  } catch (e) {
    // オフライン・取得失敗時は何もしない(ポップアップの他の機能に影響させない)
  }
}

checkForUpdate();
