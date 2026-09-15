export class LinePlayer {
  constructor(synth, Utterance, onChange) {
    this.synth = synth;
    this.Utterance = Utterance;
    this.onChange = onChange;
    this.state = 'idle';
    this.index = -1;
    this.generation = 0;
  }
  stop() {
    this.generation++;
    this.synth?.cancel();
    this.utterance = null;
    this.state = 'idle';
    this.index = -1;
    this.onChange(this);
  }
  play(lines, index, options = {}) {
    this.stop();
    if (!this.synth || !lines[index]) return;
    this.lines = lines;
    this.options = options;
    this.index = index;
    this.speak();
  }
  speak() {
    const generation = this.generation;
    const utterance = new this.Utterance(this.lines[this.index].chinese);
    this.utterance = utterance;
    utterance.lang = this.options.voice?.lang || 'zh-CN';
    if (this.options.voice) utterance.voice = this.options.voice;
    utterance.rate = this.options.rate || 0.85;
    this.state = 'loading';
    this.onChange(this);
    utterance.onstart = () => {
      if (generation !== this.generation) return;
      this.state = 'playing';
      this.onChange(this);
    };
    utterance.onend = () => {
      if (generation !== this.generation) return;
      if (++this.index < this.lines.length) this.speak();
      else this.stop();
    };
    utterance.onerror = event => {
      if (generation !== this.generation) return;
      this.stop();
      this.onChange(this, `Audio could not play (${event.error || 'speech error'}). Try another Mandarin voice or tap a line to retry.`);
    };
    try {
      this.synth.resume();
      this.synth.speak(utterance);
    } catch {
      this.stop();
      this.onChange(this, 'Audio could not start. Choose a Mandarin voice and try again.');
    }
  }
  pause() {
    if (!['playing', 'loading'].includes(this.state)) return;
    // Cancel and restart the current line: native pause is inconsistent on Android.
    this.generation++;
    this.synth.cancel();
    this.state = 'paused';
    this.onChange(this);
  }
  resume() {
    if (this.state === 'paused') this.speak();
  }
}
