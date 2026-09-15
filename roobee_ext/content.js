(() => {
  let jpToEntry = new Map(); // loadRubyDict() 完了後に構築される

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'IFRAME', 'CODE', 'PRE']);

  let popupEl = null;
  let popupAnchor = null;
  let enabled = true;
  let excludeSuruAfterNoun = true;
  let labelMode = 'en'; // 'en' | 'kana'
  let excludedWords = new Set();

  const EXTERNAL_ICON_SVG =
    '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  function buildWordLink(word) {
    const a = document.createElement('a');
    a.className = 'rbv-popup-link';
    a.href = `https://www.google.com/search?q=${encodeURIComponent(word + ' 英語 意味')}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.addEventListener('click', (ev) => ev.stopPropagation());

    const text = document.createElement('span');
    text.textContent = word;
    const icon = document.createElement('span');
    icon.className = 'rbv-external-icon';
    icon.innerHTML = EXTERNAL_ICON_SVG;

    a.appendChild(text);
    a.appendChild(icon);
    return a;
  }

  function closePopup() {
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
      popupAnchor = null;
    }
  }

  function showPopup(anchorEl, entry) {
    if (popupAnchor === anchorEl) {
      closePopup();
      return;
    }
    closePopup();

    popupEl = document.createElement('div');
    popupEl.className = 'rbv-popup';
    popupAnchor = anchorEl;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'rbv-popup-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closePopup();
    });

    const headLine = document.createElement('div');
    headLine.className = 'rbv-popup-head';
    const jpSpan = document.createElement('span');
    jpSpan.className = 'rbv-popup-jp';
    jpSpan.textContent = entry.jp;
    headLine.appendChild(jpSpan);
    headLine.appendChild(buildWordLink(entry.en));

    const kanaLine = document.createElement('div');
    kanaLine.className = 'rbv-popup-kana';
    kanaLine.textContent = entry.kana || '';
    // 日本語見出し語とカタカナ読みが完全一致する場合(例: 「シングル」)は、
    // 表示しても意味がないのでカナ行自体を省略する
    const showKana = entry.kana && entry.kana !== entry.jp;

    const synLine = document.createElement('div');
    synLine.className = 'rbv-popup-syn';
    if (entry.synonyms && entry.synonyms.length) {
      const label = document.createElement('span');
      label.className = 'rbv-popup-syn-label';
      label.textContent = '類';
      synLine.appendChild(label);
      entry.synonyms.forEach((syn, idx) => {
        if (idx > 0) synLine.appendChild(document.createTextNode(', '));
        const link = buildWordLink(syn);
        link.classList.add('rbv-popup-link-blue');
        synLine.appendChild(link);
      });
    }

    // 過去形・過去分詞(単純な1語の動詞のみ表示。熟語・句動詞は対象外)
    const isSingleWordVerb = entry.pos === '動詞' && entry.en && !entry.en.includes(' ');
    const hasPastForms = entry.pastTense || entry.pastParticiple;
    let pastLine = null;
    if (isSingleWordVerb && hasPastForms) {
      pastLine = document.createElement('div');
      pastLine.className = 'rbv-popup-syn';
      const pastLabel = document.createElement('span');
      pastLabel.className = 'rbv-popup-syn-label';
      pastLabel.textContent = '過';
      pastLine.appendChild(pastLabel);
      const forms = [entry.pastTense, entry.pastParticiple].filter(Boolean);
      forms.forEach((word, idx) => {
        if (idx > 0) pastLine.appendChild(document.createTextNode(', '));
        const link = buildWordLink(word);
        link.classList.add('rbv-popup-link-blue');
        pastLine.appendChild(link);
      });
    }

    popupEl.appendChild(closeBtn);
    popupEl.appendChild(headLine);
    if (showKana) popupEl.appendChild(kanaLine);
    if (entry.synonyms && entry.synonyms.length) popupEl.appendChild(synLine);
    if (pastLine) popupEl.appendChild(pastLine);

    document.body.appendChild(popupEl);

    const rect = anchorEl.getBoundingClientRect();
    const top = rect.top + window.scrollY - popupEl.offsetHeight - 10;
    const left = rect.left + window.scrollX + rect.width / 2 - popupEl.offsetWidth / 2;
    popupEl.style.top = `${Math.max(top, window.scrollY + 4)}px`;
    popupEl.style.left = `${Math.max(left, 4)}px`;
  }

  document.addEventListener('click', (e) => {
    if (popupEl && !popupEl.contains(e.target) && !e.target.closest('ruby.rbv-ruby')) {
      closePopup();
    }
  });

  function buildRubyElement(surface, entry) {
    const ruby = document.createElement('ruby');
    ruby.className = 'rbv-ruby';
    ruby.dataset.en = entry.en;
    ruby.dataset.kana = entry.kana || entry.en;

    const base = document.createElement('span');
    base.className = 'rbv-jp-base';
    base.textContent = surface;

    const rt = document.createElement('rt');
    rt.className = 'rbv-rt';
    rt.textContent = labelMode === 'kana' ? (entry.kana || entry.en) : entry.en;

    ruby.appendChild(base);
    ruby.appendChild(rt);

    ruby.addEventListener('click', (ev) => {
      if (!enabled) return;
      // aタグ内にある場合、リンク遷移を常にキャンセルして吹き出しを優先する
      if (ev.target.closest('a')) {
        ev.preventDefault();
      }
      ev.stopPropagation();
      showPopup(ruby, entry);
    });

    return ruby;
  }

  const JP_CHAR_RE = /[\u3040-\u30ff\u3400-\u9fff]/; // ひらがな・カタカナ・漢字を含むかの簡易チェック

  const MAX_COMPOUND_TOKENS = 3; // 複合語として辞書引きする際にまとめる名詞・動詞トークンの最大数

  // 連続する名詞・動詞トークンを、長い組み合わせから順に辞書引きする(最長一致)。
  // 「質問」+「する」→「質問する」、「数」+「年」→「数年」のように、
  // Kuromojiが複数トークンに分割してしまう複合語を正しくまとめて拾うためのもの。
  // 長い組み合わせが辞書にヒットすればそちらを優先し(例:「数年」>「年」単体)、
  // ヒットしなければ1トークンずつ短くしていき、最終的にヒットしなければ呼び出し元で単体処理する。
  function findCompoundMatch(tokens, startIndex) {
    const maxLen = Math.min(MAX_COMPOUND_TOKENS, tokens.length - startIndex);
    for (let len = maxLen; len >= 2; len--) {
      let combinedKey = '';
      let combinedSurface = '';
      let valid = true;
      for (let j = 0; j < len; j++) {
        const tok = tokens[startIndex + j];
        if (tok.pos !== '名詞' && tok.pos !== '動詞' && tok.pos !== '形容詞' && tok.pos !== '副詞') { valid = false; break; }
        const k = (tok.basic_form && tok.basic_form !== '*') ? tok.basic_form : tok.surface_form;
        combinedKey += k;
        combinedSurface += tok.surface_form;
      }
      if (!valid) continue;
      const entry = jpToEntry.get(combinedKey);
      if (entry && !excludedWords.has(entry.jp)) {
        return { entry, len, surface: combinedSurface };
      }
    }
    return null;
  }

  function processTextNode(node, tokenizer) {
    const text = node.nodeValue;
    if (!text || !text.trim() || !JP_CHAR_RE.test(text)) return;

    let tokens;
    try {
      tokens = tokenizer.tokenize(text);
    } catch (e) {
      return;
    }
    if (!tokens || !tokens.length) return;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const surface = t.surface_form;
      let entry = null;
      let combinedSurface = null; // 複合語としてまとめてルビ化する場合の表示文字列(例:「質問する」「数年」)
      let skipCount = 0; // 複合語としてまとめた分、後続トークンをこのループでは処理済み扱いにする

      if (t.pos === '名詞' || t.pos === '動詞' || t.pos === '形容詞') {
        const key = (t.basic_form && t.basic_form !== '*') ? t.basic_form : surface;

        // 隣接する名詞・動詞トークンとの複合語(例:「質問する」「数年」)を最長一致で優先チェックする。
        // Kuromojiはこの手の複合語を複数トークンに分割するため、basic_form単体引きだけでは
        // 辞書内の複合語エントリに一切ヒットしない。
        const compound = findCompoundMatch(tokens, i);
        if (compound) {
          entry = compound.entry;
          combinedSurface = compound.surface;
          skipCount = compound.len - 1;
        }

        // 複合語としてヒットしなかった場合は、これまで通りトークン単体で辞書を引く
        if (!entry) {
          entry = jpToEntry.get(key) || null;

          if (entry && excludedWords.has(entry.jp)) {
            entry = null;
          }

          // 「名詞+する」の複合動詞: 複合語としてヒットしなかった「する」単体は除外(設定でON/OFF可能)
          if (entry && key === 'する' && excludeSuruAfterNoun) {
            const prev = tokens[i - 1];
            if (prev && prev.pos === '名詞') {
              entry = null;
            }
          }
        }
      }

      if (entry) {
        frag.appendChild(buildRubyElement(combinedSurface || surface, entry));
      } else {
        frag.appendChild(document.createTextNode(surface));
      }

      i += skipCount; // 複合語としてまとめた分のトークンをスキップ
    }
    node.parentNode.replaceChild(frag, node);
  }

  function walk(root, tokenizer) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('ruby.rbv-ruby')) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => processTextNode(node, tokenizer));
  }

  function applyEnabledState(value) {
    enabled = value;
    document.documentElement.classList.toggle('rbv-disabled', !enabled);
    if (!enabled) closePopup();
  }

  function applyLabelMode(mode) {
    labelMode = mode;
    document.querySelectorAll('ruby.rbv-ruby > rt.rbv-rt').forEach((rt) => {
      const ruby = rt.parentElement;
      rt.textContent = mode === 'kana' ? ruby.dataset.kana : ruby.dataset.en;
    });
  }

  async function init() {
    const dict = await loadRubyDict();
    // 「日本語」と「カタカナ読み」が完全一致する語(例:「シングル」)は、
    // ルビ化・クリック可能化の対象から丸ごと除外する(単体マッチ・複合語マッチどちらにも影響)
    const activeDict = dict.filter((e) => !(e.kana && e.kana === e.jp));
    jpToEntry = new Map(activeDict.map((e) => [e.jp, e]));

    chrome.storage.local.get(
      {
        rbv_enabled: false,
        rbv_exclude_suru_after_noun: true,
        rbv_label_mode: 'en',
        rbv_excluded_words: []
      },
      (res) => {
        applyEnabledState(res.rbv_enabled);
        excludeSuruAfterNoun = res.rbv_exclude_suru_after_noun;
        labelMode = res.rbv_label_mode;
        excludedWords = new Set(res.rbv_excluded_words);

        // OFF状態でページを開いた場合は、形態素解析やDOM書き換え自体を行わない。
        // (ONにした状態でページを再読み込みした時だけ、ルビ用のタグが挿入される)
        if (!res.rbv_enabled) return;

        if (typeof kuromoji === 'undefined') {
          console.warn('[rooby] kuromoji.js が読み込まれていません。ext/kuromoji.js を配置してください。');
          return;
        }

        kuromoji.builder({ dicPath: chrome.runtime.getURL('dict/') }).build((err, tokenizer) => {
          if (err) {
            console.error('[rooby] 辞書の読み込みに失敗しました。ext/dict フォルダを確認してください。', err);
            return;
          }
          walk(document.body, tokenizer);
        });
      }
    );
  }

  init();

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === 'RBV_TOGGLE') applyEnabledState(msg.enabled);
    if (msg.type === 'RBV_LABEL_MODE') applyLabelMode(msg.mode);
    if (msg.type === 'RBV_EXCLUDE_SURU') excludeSuruAfterNoun = msg.value; // 次回のページ読み込みから反映
  });
})();
