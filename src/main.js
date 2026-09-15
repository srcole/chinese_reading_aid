import './style.css';
import { makeLines, splitText, matchTranslations } from './text.js';
import { LinePlayer } from './player.js';

const $ = selector => document.querySelector(selector);
const sample = {
  chinese: '慢慢来，比较快。\n学习中文，就像走一条很长的路。\n每天读一点，每天听一点。\n不用着急，享受沿途的风景。',
  english: 'Take your time; you will get there faster.\nLearning Chinese is like walking a very long road.\nRead a little every day, and listen a little every day.\nThere is no need to rush. Enjoy the scenery along the way.',
};
let lines = [];
let voices = [];
let saved;
try { saved = JSON.parse(localStorage.getItem('slowly-draft')); } catch { /* Storage is optional. */ }

$('#app').innerHTML = `
  <header class="site-header"><a class="brand" href="./"><img class="brand-logo" src="./images/slowly-paper-mouth.png" width="60" height="60" alt="A cheerful paper mascot reading aloud"> slowly<span class="brand-note">CHINESE READING COMPANION</span></a><span class="header-note">A little practice, every day.</span></header>
  <main>
    <section class="intro"><div class="eyebrow">YOUR WORDS. YOUR PACE.</div><h1>Make room for <em>reading.</em></h1><p>Chinese, pinyin, and meaning. Follow along, one line at a time.</p></section>
    <div class="workspace">
      <section class="panel input-panel" aria-labelledby="input-title">
        <div class="section-heading"><h2 id="input-title"><span class="step">01</span> Your passage</h2><button id="example" class="text-button">Try an example ↗</button></div>
        <label for="chinese">Chinese text <span>简体 / 繁體</span></label>
        <textarea id="chinese" lang="zh" rows="7" placeholder="Paste something you’d like to read…"></textarea>
        <div class="split-row"><label for="split">Split into</label><select id="split"><option value="sentences">Sentences</option><option value="newlines">Existing lines</option></select></div>
        <p class="hint">Sentences split at 。！？!? and ellipses, keeping existing line breaks.</p>
        <label for="english">English translation <span>OPTIONAL</span></label>
        <textarea id="english" rows="6" placeholder="Paste an English paragraph, or one translation per Chinese line."></textarea>
        <div class="split-row"><label for="english-split">Match English by</label><select id="english-split"><option value="auto">Auto-detect</option><option value="sentences">Sentences</option><option value="newlines">Existing lines</option></select></div>
        <p class="hint">Auto-detect keeps lines that already match, otherwise tries English sentences. Blank lines preserve skipped translations. Check the preview: matching follows order, not meaning.</p>
        <details><summary>Preview line matching <span id="counts"></span></summary><ol id="alignment"></ol></details>
        <p id="alignment-note" class="hint" role="status"></p>
        <button id="prepare" class="primary wide">Prepare reading <span>→</span></button>
        <p class="small-note">Preparing again replaces edits made in the reading cards.</p>
        <p id="draft-note" class="small-note">Your draft is saved in this browser.</p>
      </section>
      <section class="reader" aria-labelledby="reader-title">
        <div class="section-heading"><h2 id="reader-title"><span class="step">02</span> Read & listen</h2><span id="line-count" class="pill">0 lines</span></div>
        <div class="toolbar">
          <div class="playback"><button id="play" class="primary" disabled>▶ Read from start</button><button id="pause" disabled>Pause</button><button id="stop" disabled>Stop</button><button id="reset-audio">Reset audio</button></div>
          <div class="audio-settings"><label for="voice">Mandarin voice<select id="voice"><option value="">Device default Mandarin</option></select></label><label for="speed">Speed<select id="speed"><option value="0.65">0.65× · Slow</option><option value="0.85" selected>0.85× · Gentle</option><option value="1">1× · Normal</option><option value="1.2">1.2× · Fast</option></select></label></div>
          <p class="hint">Tap a Chinese line to read from there. Changing voice or speed pauses reading; tap Resume to restart that line. Reset audio clears playback and selects a device voice when available.</p>
          <p id="voice-note" class="hint"></p>
          <p class="hint">Still silent? <a href="./speech-check.html" style="text-decoration:underline">Open the browser voice check</a> to test a short phrase and get a diagnostic report.</p>
        </div>
        <div class="reading-meta"><span id="status" role="status" aria-live="polite">Ready when you are</span><label class="check"><input type="checkbox" id="follow" checked> Follow along</label></div>
        <div id="cards"><div class="empty"><span lang="zh">读</span><h3>A little reading goes a long way.</h3><p>Paste your passage or try the example,<br>then prepare your reading.</p></div></div>
        <p class="small-note">Pinyin is generated automatically and can be edited. Edits change the display; audio reads the Chinese text.</p>
      </section>
    </div>
  </main>
  <footer><span lang="zh">慢慢来 · Take your time.</span><span>No account. No translation API. Just practice.</span></footer>`;

const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const player = new LinePlayer(window.speechSynthesis, window.SpeechSynthesisUtterance, (state, error) => {
  const active = state.state !== 'idle';
  $('#pause').disabled = !active;
  $('#pause').textContent = state.state === 'paused' ? 'Resume' : 'Pause';
  $('#stop').disabled = !active;
  $('#status').textContent = error || (active ? `${state.state === 'paused' ? 'Paused at' : state.state === 'loading' ? 'Starting' : 'Reading'} line ${state.index + 1} of ${lines.length}` : 'Ready when you are');
  document.querySelectorAll('.reading-card').forEach((card, i) => {
    const selected = i === state.index;
    card.classList.toggle('active', selected);
    if (selected) card.setAttribute('aria-current', 'true');
    else card.removeAttribute('aria-current');
    if (selected && state.state === 'playing' && $('#follow').checked) card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  });
});

function save() {
  try {
    localStorage.setItem('slowly-draft', JSON.stringify({ chinese: $('#chinese').value, english: $('#english').value, mode: $('#split').value, englishMode: $('#english-split').value, lines }));
  } catch { $('#draft-note').textContent = 'Browser storage is unavailable or full. Keep a copy of your text before closing.'; }
}
function preview() {
  const chinese = splitText($('#chinese').value, $('#split').value);
  const { items: english, method } = matchTranslations($('#english').value, chinese.length, $('#english-split').value);
  $('#counts').textContent = ` · ${chinese.length} / ${english.length}`;
  $('#alignment').replaceChildren();
  chinese.forEach((text, i) => {
    const item = document.createElement('li');
    const zh = document.createElement('div'); zh.lang = 'zh'; zh.textContent = text;
    const en = document.createElement('small'); en.textContent = english[i] || '— No translation';
    item.append(zh, en); $('#alignment').append(item);
  });
  const extra = english.length > chinese.length;
  const matching = `Using English ${method}: ${chinese.length} Chinese lines, ${english.length} English entries.`;
  $('#alignment-note').textContent = extra ? `${matching} There are ${english.length - chinese.length} extra English entries. Choose another matching mode or combine translations onto matching lines before preparing.` : english.length && english.length !== chinese.length ? `${matching} Counts differ; check each pair before preparing. Unmatched lines will have empty translations.` : english.length ? `${matching} Paired in order; check that the meanings match.` : `${chinese.length} Chinese lines. Add English now or in the reading cards.`;
  $('#prepare').disabled = !chinese.length || extra;
}
function audioOptions() {
  // Resolve the voice again: browsers may replace voice objects after voiceschanged.
  return { voice: window.speechSynthesis?.getVoices().find(v => v.voiceURI === $('#voice').value), rate: Number($('#speed').value) };
}
function play(index) {
  player.play(lines, index, audioOptions());
}
function fitEditors() {
  document.querySelectorAll('.line-content textarea').forEach(field => {
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + 2}px`;
  });
}
function render() {
  $('#cards').replaceChildren();
  $('#line-count').textContent = `${lines.length} line${lines.length === 1 ? '' : 's'}`;
  $('#play').disabled = !supported || !lines.length;
  lines.forEach((line, i) => {
    const card = document.createElement('article'); card.className = 'reading-card';
    const number = document.createElement('span'); number.className = 'line-number'; number.textContent = String(i + 1).padStart(2, '0');
    const content = document.createElement('div'); content.className = 'line-content';
    const button = document.createElement('button'); button.className = 'chinese-line'; button.lang = 'zh'; button.textContent = line.chinese;
    button.setAttribute('aria-label', `Read from line ${i + 1}: ${line.chinese}`); button.disabled = !supported; button.onclick = () => play(i);
    const pyLabel = document.createElement('label'); pyLabel.className = 'sr-only'; pyLabel.htmlFor = `py-${i}`; pyLabel.textContent = `Pinyin for line ${i + 1}`;
    const py = document.createElement('textarea'); py.id = `py-${i}`; py.className = 'pinyin'; py.rows = 2; py.value = line.pinyin; py.spellcheck = false;
    const enLabel = document.createElement('label'); enLabel.className = 'sr-only'; enLabel.htmlFor = `en-${i}`; enLabel.textContent = `English for line ${i + 1}`;
    const en = document.createElement('textarea'); en.id = `en-${i}`; en.className = 'translation'; en.rows = 2; en.value = line.english; en.placeholder = 'Add an English translation…';
    py.oninput = () => { line.pinyin = py.value; fitEditors(); save(); };
    en.oninput = () => { line.english = en.value; fitEditors(); save(); };
    content.append(button, pyLabel, py, enLabel, en);
    card.append(number, content); $('#cards').append(card);
  });
  fitEditors();
}
function prepare() {
  player.stop();
  lines = makeLines($('#chinese').value, $('#english').value, $('#split').value, $('#english-split').value);
  render(); save();
  $('#status').textContent = 'Reading prepared · pinyin and English are editable below';
}
function updateVoices() {
  const previous = $('#voice').value;
  voices = window.speechSynthesis.getVoices().filter(v => /^(zh(?:[-_](?:CN|TW|SG|Hans|Hant))?|cmn)(?:[-_]|$)/i.test(v.lang) && !/cantonese|粤|粵/i.test(v.name));
  $('#voice').replaceChildren(new Option('Device default Mandarin', ''));
  voices.forEach(v => $('#voice').add(new Option(`${v.name} (${v.lang}) · ${v.localService ? 'Device' : 'Online'}`, v.voiceURI)));
  if (voices.some(v => v.voiceURI === previous)) $('#voice').value = previous;
  $('#voice-note').textContent = voices.length ? 'Voice quality depends on your device. Some voices require an internet connection.' : 'No Mandarin voice is listed yet. Try playback, or install a Mandarin voice in your device’s speech settings and reload.';
}
$('#prepare').onclick = prepare;
$('#example').onclick = () => {
  player.stop(); $('#chinese').value = sample.chinese; $('#english').value = sample.english; $('#split').value = 'sentences'; $('#english-split').value = 'auto'; preview(); prepare();
};
for (const id of ['chinese', 'english', 'split', 'english-split']) $(`#${id}`).addEventListener('input', () => {
  player.stop(); preview(); save();
  if (lines.length) $('#status').textContent = 'Input changed · prepare reading to update these cards';
});
$('#play').onclick = () => play(0);
$('#pause').onclick = () => player.state === 'paused' ? player.resume(audioOptions()) : player.pause();
$('#stop').onclick = () => player.stop();
$('#reset-audio').disabled = !supported;
$('#reset-audio').onclick = () => {
  player.reset();
  updateVoices();
  const local = voices.find(v => v.localService);
  $('#voice').value = local?.voiceURI || '';
  $('#status').textContent = `Audio reset · ${local ? local.name : 'device default Mandarin'} selected. ${player.state === 'paused' ? 'Tap Resume' : 'Tap Read from start'} to try again. If silence continues, reload this page.`;
};
for (const id of ['voice', 'speed']) $(`#${id}`).onchange = () => {
  player.pause();
  $('#status').textContent = player.state === 'paused' ? 'Audio settings changed · tap Resume to restart this line' : 'Audio settings changed · tap a line or Read from start';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
window.addEventListener('pagehide', () => player.stop());
window.addEventListener('resize', fitEditors);
document.fonts?.ready.then(fitEditors);
if (supported) { updateVoices(); window.speechSynthesis.addEventListener('voiceschanged', updateVoices); }
else $('#voice-note').textContent = 'Speech playback is unavailable in this browser. You can still use pinyin and translations.';
if (saved && typeof saved.chinese === 'string' && typeof saved.english === 'string') {
  $('#chinese').value = saved.chinese; $('#english').value = saved.english;
  $('#split').value = saved.mode === 'newlines' ? 'newlines' : 'sentences';
  $('#english-split').value = ['sentences', 'newlines'].includes(saved.englishMode) ? saved.englishMode : 'auto';
  if (Array.isArray(saved.lines) && saved.lines.length && saved.lines.every(line => ['chinese', 'pinyin', 'english'].every(key => typeof line[key] === 'string'))) { lines = saved.lines; render(); }
}
preview();
