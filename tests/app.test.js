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
  const queue = [];
  const synth = { cancel() {}, resume() {}, speak(item) { queue.push(item); } };
  const player = new LinePlayer(synth, class { constructor(text) { this.text = text; } }, () => {});
  const lines = ['一', '二', '三'].map(chinese => ({ chinese }));
  return { player, queue, lines };
}
test('reading from a selected line continues in sequence and finishes', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 1); assert.equal(queue[0].text, '二');
  queue[0].onstart(); assert.equal(player.state, 'playing');
  queue[0].onend(); assert.equal(queue[1].text, '三');
  queue[1].onend(); assert.equal(player.state, 'idle');
});
test('cancelled utterances cannot advance or interrupt a new reading', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 0); player.play(lines, 2);
  queue[0].onend(); queue[0].onerror({ error: 'interrupted' });
  assert.equal(player.index, 2); assert.equal(queue.length, 2);
});
test('pause and resume restart the current line; stop cancels continuation', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 1); player.pause();
  queue[0].onend(); assert.equal(player.state, 'paused');
  player.resume(); assert.equal(queue[1].text, '二');
  player.stop(); queue[1].onend(); assert.equal(queue.length, 2);
});
test('speech failure returns to idle', () => {
  const { player, queue, lines } = setup();
  player.play(lines, 0); queue[0].onerror({ error: 'voice-unavailable' });
  assert.equal(player.state, 'idle');
});
