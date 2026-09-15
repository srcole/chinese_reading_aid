const $ = selector => document.querySelector(selector);
const synth = window.speechSynthesis;
const supported = !!synth && !!window.SpeechSynthesisUtterance;
let active;
let timeout;
let generation = 0;
const report = { userAgent: navigator.userAgent, supported, voices: [], attempts: [] };
const engine = () => supported ? { speaking: synth.speaking, pending: synth.pending, paused: synth.paused } : null;
function render() { $('#report').textContent = JSON.stringify({ ...report, engine: engine() }, null, 2); }
function voicesChanged() {
  const selected = $('#check-voice').value;
  const voices = synth.getVoices().filter(v => /^(zh|cmn)(-|_|$)/i.test(v.lang) && !/cantonese|粤|粵/i.test(v.name));
  report.voices = voices.map(v => ({ name: v.name, lang: v.lang, local: v.localService, id: v.voiceURI }));
  $('#check-voice').replaceChildren(new Option('Default Mandarin', ''));
  voices.forEach(v => $('#check-voice').add(new Option(`${v.name} · ${v.localService ? 'Device' : 'Online'}`, v.voiceURI)));
  if (voices.some(v => v.voiceURI === selected)) $('#check-voice').value = selected;
  render();
}
function stop() {
  generation++;
  clearTimeout(timeout);
  synth?.cancel();
  active = null;
  $('#check-mandarin').disabled = !supported;
  $('#check-english').disabled = !supported;
}
function test(english) {
  // Intentionally no cancel/resume/delay before speak: isolate basic native synthesis.
  const attempt = { language: english ? 'en-US' : 'zh-CN', voice: null, activated: navigator.userActivation?.isActive, initialEngine: engine(), events: [] };
  report.attempts.push(attempt);
  const run = ++generation;
  const utterance = new SpeechSynthesisUtterance(english ? 'Hello. This is a voice test.' : '你好，欢迎。');
  active = utterance;
  utterance.lang = attempt.language;
  if (!english && $('#check-voice').value) {
    const voice = synth.getVoices().find(v => v.voiceURI === $('#check-voice').value);
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; attempt.voice = voice.name; }
  }
  const startedAt = performance.now();
  let started = false;
  const finish = message => {
    if (run !== generation) return;
    clearTimeout(timeout);
    $('#result').textContent = message;
    stop(); render();
  };
  for (const event of ['start', 'boundary', 'end', 'error', 'pause', 'resume']) {
    utterance.addEventListener(event, e => {
      if (run !== generation) return;
      attempt.events.push({ event, afterMs: Math.round(performance.now() - startedAt), ...(e.error ? { error: e.error } : {}), engine: engine() });
      if (event === 'start') {
        started = true;
        $('#result').textContent = 'The browser reports speech started. Can you hear the phrase?';
      }
      if (event === 'end') finish('The browser reports the test completed. If you heard it, this voice works in a direct test. If it was silent, check Chrome’s sound setting and your Mac’s audio output.');
      if (event === 'error') finish(`The browser reported a speech error: ${e.error}. Copy the diagnostic report to help investigate.`);
      render();
    });
  }
  $('#check-mandarin').disabled = true;
  $('#check-english').disabled = true;
  $('#result').textContent = 'Waiting for the browser to speak…';
  timeout = setTimeout(() => {
    attempt.events.push({ event: 'timeout', afterMs: Math.round(performance.now() - startedAt), engine: engine() });
    finish(started ? 'The browser started speech but did not finish within 15 seconds. Copy the diagnostic report.' : 'The direct browser test did not start within 15 seconds. This test bypasses the reading app’s playback logic. Copy the diagnostic report so we can investigate.');
  }, 15000);
  render();
  try { synth.speak(utterance); } catch (error) {
    attempt.events.push({ event: 'exception', name: error.name, message: error.message });
    finish('The browser could not accept the speech request. Copy the diagnostic report.');
  }
}
$('#check-mandarin').onclick = () => test(false);
$('#check-english').onclick = () => test(true);
$('#check-stop').onclick = () => { stop(); $('#result').textContent = 'Stopped. Choose a voice and test again.'; render(); };
$('#copy-report').onclick = async () => {
  render();
  try { await navigator.clipboard.writeText($('#report').textContent); $('#copy-report').textContent = 'Report copied'; }
  catch { $('details').open = true; $('#copy-report').textContent = 'Select and copy the report above'; }
};
window.addEventListener('pagehide', stop);
if (supported) { voicesChanged(); synth.addEventListener('voiceschanged', voicesChanged); }
else { stop(); $('#result').textContent = 'Speech synthesis is unavailable in this browser.'; render(); }
