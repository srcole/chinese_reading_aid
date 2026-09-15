import test from 'node:test';
import assert from 'node:assert/strict';
import { splitText, makeLines, translations, englishSentences, matchTranslations } from '../src/text.js';
import { LinePlayer } from '../src/player.js';

test('sentence boundaries retain punctuation, closing quotes, and newlines', () => {
  assert.deepEqual(splitText('他说：“你好！”接着走。\r\n真的？好……再见'), ['他说：“你好！”', '接着走。', '真的？', '好……', '再见']);
  assert.deepEqual(splitText('  你好。再见！\n\n第二行。 ', 'newlines'), ['你好。再见！', '第二行。']);
  assert.deepEqual(splitText(' \n '), []);
});
test('English placeholders do not shift later translations', () => {
  assert.deepEqual(translations('Hello\n\nGoodbye'), ['Hello', '', 'Goodbye']);
  const lines = makeLines('你好。谢谢。再见。', 'Hello\n\nGoodbye');
  assert.equal(lines[1].english, '');
  assert.equal(lines[2].english, 'Goodbye');
});
test('English paragraphs align by sentence in both preview and prepared cards', () => {
  const english = 'Hello. How are you? I am fine!';
  assert.deepEqual(matchTranslations(english, 3), { items: ['Hello.', 'How are you?', 'I am fine!'], method: 'sentences' });
  assert.deepEqual(makeLines('你好。你好吗？我很好！', english).map(line => line.english), ['Hello.', 'How are you?', 'I am fine!']);
});
test('manual matching preserves multiple sentences per line and blank placeholders', () => {
  assert.deepEqual(matchTranslations('Hello. Welcome!\nGoodbye.', 2).items, ['Hello. Welcome!', 'Goodbye.']);
  assert.deepEqual(matchTranslations('Hello. Welcome!\n\nGoodbye.', 4).items, ['Hello. Welcome!', '', 'Goodbye.']);
  assert.deepEqual(matchTranslations('Hello. Goodbye.', 2, 'newlines').items, ['Hello. Goodbye.']);
  assert.deepEqual(matchTranslations('Hello. Welcome!\nGoodbye.', 2, 'sentences').items, ['Hello.', 'Welcome!', 'Goodbye.']);
});
test('English segmentation handles titles, initials, decimals, quotes, and wrapped text', () => {
  assert.deepEqual(englishSentences('Dr. A. Smith paid $3.50. “Really?” Yes!'), ['Dr. A. Smith paid $3.50.', '“Really?”', 'Yes!']);
  assert.deepEqual(matchTranslations('We read a\nlittle every day.\nThen we\nrest.', 2).items, ['We read a little every day.', 'Then we rest.']);
  assert.deepEqual(matchTranslations('First\nSecond\nExtra', 2).items, ['First', 'Second', 'Extra']);
});
test('mismatched sentence counts retain all English for review', () => {
  assert.deepEqual(matchTranslations('Hello. Goodbye. Extra.', 2).items, ['Hello.', 'Goodbye.', 'Extra.']);
  assert.deepEqual(matchTranslations('', 3).items, []);
});
test('English splitting has a fallback for browsers without Intl.Segmenter', () => {
  const original = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined;
    assert.deepEqual(englishSentences('Dr. Smith paid $3.50. “Really?” Yes!'), ['Dr. Smith paid $3.50.', '“Really?”', 'Yes!']);
  } finally { Intl.Segmenter = original; }
});
test('simplified and traditional generate Mandarin pinyin', () => {
  const a = makeLines('学习中文。', '')[0];
  const b = makeLines('學習中文。', '')[0];
  assert.equal(a.pinyin, b.pinyin);
  assert.match(a.pinyin, /xué xí zhōng wén/);
  assert.equal(b.chinese, '學習中文。');
});
function setup() {
  let time = 1000;
  let nextId = 0;
  const tasks = new Map();
  const clock = {
    Date: { now: () => time },
    setTimeout(fn, delay) { const id = ++nextId; tasks.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { tasks.delete(id); },
  };
  function tick(ms = 150) {
    const end = time + ms;
    while (true) {
      const next = [...tasks.entries()].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      time = next[1].at; tasks.delete(next[0]); next[1].fn();
    }
    time = end;
  }
  const queue = [];
  const messages = [];
  const synth = { cancel() {}, resume() {}, speak(item) { queue.push(item); } };
  const player = new LinePlayer(synth, class { constructor(text) { this.text = text; } }, (_, error) => { if (error) messages.push(error); }, clock);
  const lines = ['一', '二', '三'].map(chinese => ({ chinese }));
  return { player, queue, lines, tick, synth, messages, tasks };
}
test('reading from a selected line continues in sequence and finishes', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 1); assert.equal(queue[0].text, '二');
  queue[0].onstart(); assert.equal(player.state, 'playing');
  queue[0].onend(); assert.equal(queue[1].text, '三');
  queue[1].onend(); assert.equal(player.state, 'idle');
});
test('cancelled utterances cannot advance or interrupt a new reading', () => {
  const { player, queue, lines, tick } = setup();
  player.play(lines, 0); player.play(lines, 2); tick();
  queue[0].onend(); queue[0].onerror({ error: 'interrupted' });
  assert.equal(player.index, 2); assert.equal(queue.length, 2);
});
test('pause and resume restart the current line; stop cancels continuation', () => {
  const { player, queue, lines, tick } = setup();
  player.play(lines, 1); player.pause();
  queue[0].onend(); assert.equal(player.state, 'paused');
  player.resume(); tick(); assert.equal(queue[1].text, '二');
  player.stop(); queue[1].onend(); assert.equal(queue.length, 2);
});
test('speech failure preserves the line for retry', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 0); queue[0].onerror({ error: 'voice-unavailable' });
  assert.equal(player.state, 'paused');
  assert.equal(player.index, 0);
});
test('silent startup times out and another voice can resume the same line', () => {
  const { player, queue, lines, tick, messages } = setup();
  player.play(lines, 1, { voice: { name: 'Online', lang: 'zh-CN' } });
  tick(8000);
  assert.equal(player.state, 'paused');
  assert.equal(player.index, 1);
  assert.match(messages[0], /did not start/);
  const voice = { name: 'Device', lang: 'zh-TW' };
  player.resume({ voice });
  assert.equal(queue.length, 1, 'do not speak during cancellation');
  tick();
  assert.equal(queue[1].voice, voice);
  queue[1].onstart();
  queue[0].onstart(); queue[0].onerror({ error: 'network' }); queue[0].onend();
  assert.equal(player.state, 'playing');
  assert.equal(player.index, 1);
  queue[1].onend();
  assert.equal(queue[2].text, '三');
});
test('rapid changes cancel delayed starts; only the latest request speaks', () => {
  const { player, queue, lines, tick } = setup();
  player.play(lines, 0); player.play(lines, 1); player.play(lines, 2);
  tick();
  assert.deepEqual(queue.map(item => item.text), ['一', '三']);
  player.play(lines, 0); player.stop(); tick(10000);
  assert.equal(queue.length, 2);
  assert.equal(player.state, 'idle');
});
test('completed utterance callbacks cannot skip the next line', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 0); queue[0].onend(); queue[0].onend();
  queue[0].onerror({ error: 'interrupted' });
  assert.equal(player.index, 1);
  assert.equal(queue.length, 2);
});
test('started speech that never ends times out; reset and stop clear timers', () => {
  const { player, queue, lines, tick, tasks, messages } = setup();
  player.play(lines, 0); queue[0].onstart(); tick(30000);
  assert.equal(player.state, 'paused');
  assert.match(messages[0], /stopped responding/);
  player.reset();
  assert.equal(tasks.size, 0);
  player.resume(); player.pause(); tick();
  assert.equal(queue.length, 1);
  player.stop();
  assert.equal(tasks.size, 0);
});
test('a thrown speech error remains recoverable', () => {
  const { player, synth, lines, tick, queue } = setup();
  const speak = synth.speak;
  synth.speak = () => { throw new Error('engine unavailable'); };
  player.play(lines, 0);
  assert.equal(player.state, 'paused');
  synth.speak = speak;
  player.resume(); tick(); queue[0].onstart();
  assert.equal(player.state, 'playing');
});
