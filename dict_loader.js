// DICT_FILES(dict_manifest.js)に列挙されたCSVを取得し、辞書配列を組み立てる共通処理。
// content.js / options.js の両方から呼び出す。
//
// パーサーは「ヘッダー行に書かれた列名」を見て各値の位置を判断する(固定の列位置に依存しない)。
// これにより、将来「過去形」「過去分詞」のような新しい列を追加したいbatchが出てきても、
// そのファイルのヘッダーに列名を1つ足すだけで対応でき、既存の(その列を持たない)CSVは
// 変更不要のまま動き続ける(該当フィールドはundefinedとして扱われるだけ)。
// 「類義語」列だけは可変長(そこから行末までを全部類義語として扱う)という扱いを維持している。

function parseDictCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map((h) => h.trim());
  const colIndex = (name) => header.indexOf(name);

  const priorityIdx = colIndex('優先度');
  const jpIdx = colIndex('日本語');
  const posIdx = colIndex('品詞');
  const categoryIdx = colIndex('カテゴリ');
  const enIdx = colIndex('英単語');
  const kanaIdx = colIndex('カタカナ読み');
  const pastTenseIdx = colIndex('過去形');
  const pastParticipleIdx = colIndex('過去分詞');
  const synIdx = colIndex('類義語'); // ここから行末までが可変長の類義語

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const get = (i) => (i >= 0 && i < cols.length ? cols[i].trim() : '');

    const synonyms = synIdx >= 0
      ? cols.slice(synIdx).map((s) => s.trim()).filter((s) => s.length > 0)
      : [];

    return {
      priority: parseInt(get(priorityIdx), 10),
      jp: get(jpIdx),
      pos: get(posIdx),
      category: get(categoryIdx),
      en: get(enIdx),
      kana: get(kanaIdx),
      pastTense: pastTenseIdx >= 0 ? (get(pastTenseIdx) || undefined) : undefined,
      pastParticiple: pastParticipleIdx >= 0 ? (get(pastParticipleIdx) || undefined) : undefined,
      synonyms
    };
  });
}

async function loadRubyDict() {
  const all = [];
  for (const file of DICT_FILES) {
    try {
      const url = chrome.runtime.getURL(file);
      const res = await fetch(url);
      const text = await res.text();
      all.push(...parseDictCSV(text));
    } catch (e) {
      console.error(`[rooby] 辞書CSVの読み込みに失敗しました: ${file}`, e);
    }
  }
  return all;
}
