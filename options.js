const searchInput = document.getElementById('searchInput');
const wordListEl = document.getElementById('wordList');
const countText = document.getElementById('countText');
const emptyState = document.getElementById('emptyState');
const checkAllVisibleBtn = document.getElementById('checkAllVisible');
const uncheckAllVisibleBtn = document.getElementById('uncheckAllVisible');

let excludedSet = new Set();
let currentFiltered = [];
let allDict = []; // loadRubyDict() で非同期に取得する

function normalize(s) {
  return (s || '').toLowerCase();
}

function matchesQuery(entry, query) {
  if (!query) return true;
  const q = normalize(query);
  if (entry.jp.includes(query)) return true;
  if (normalize(entry.en).includes(q)) return true;
  if (entry.kana && entry.kana.includes(query)) return true;
  if (entry.synonyms && entry.synonyms.some((s) => normalize(s).includes(q))) return true;
  if (String(entry.priority).includes(query)) return true;
  return false;
}

function render() {
  const query = searchInput.value.trim();
  currentFiltered = allDict.filter((e) => matchesQuery(e, query))
    .sort((a, b) => a.priority - b.priority);

  countText.textContent = `${currentFiltered.length} / ${allDict.length} 語を表示中`;
  wordListEl.innerHTML = '';

  if (currentFiltered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  const frag = document.createDocumentFragment();
  currentFiltered.forEach((entry) => {
    const row = document.createElement('div');
    row.className = 'word-row';
    const isExcluded = excludedSet.has(entry.jp);
    if (isExcluded) row.classList.add('excluded');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !isExcluded;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        excludedSet.delete(entry.jp);
      } else {
        excludedSet.add(entry.jp);
      }
      row.classList.toggle('excluded', !checkbox.checked);
      saveExcluded();
    });

    const main = document.createElement('div');
    main.className = 'word-main';

    const jpLine = document.createElement('div');
    const numText = document.createElement('span');
    numText.className = 'word-num';
    numText.textContent = `#${entry.priority}`;
    const jpText = document.createElement('span');
    jpText.className = 'word-jp';
    jpText.textContent = entry.jp;
    const enText = document.createElement('span');
    enText.className = 'word-en';
    enText.textContent = entry.en;
    jpLine.appendChild(numText);
    jpLine.appendChild(jpText);
    jpLine.appendChild(enText);

    const metaLine = document.createElement('div');
    metaLine.className = 'word-meta';
    metaLine.textContent = `${entry.pos} ・ ${entry.category} ・ ${entry.kana || ''}`;

    main.appendChild(jpLine);
    main.appendChild(metaLine);

    row.appendChild(checkbox);
    row.appendChild(main);
    frag.appendChild(row);
  });
  wordListEl.appendChild(frag);
}

function saveExcluded() {
  chrome.storage.local.set({ rbv_excluded_words: Array.from(excludedSet) });
}

checkAllVisibleBtn.addEventListener('click', () => {
  currentFiltered.forEach((e) => excludedSet.delete(e.jp));
  saveExcluded();
  render();
});

uncheckAllVisibleBtn.addEventListener('click', () => {
  currentFiltered.forEach((e) => excludedSet.add(e.jp));
  saveExcluded();
  render();
});

searchInput.addEventListener('input', render);

async function init() {
  const [dict, storageRes] = await Promise.all([
    loadRubyDict(),
    new Promise((resolve) => chrome.storage.local.get({ rbv_excluded_words: [] }, resolve))
  ]);
  allDict = dict;
  excludedSet = new Set(storageRes.rbv_excluded_words);
  render();
}

init();
