export class LinePlayer {
  constructor(synth, Utterance, onChange, clock = globalThis) {
    this.synth = synth;
    this.Utterance = Utterance;
    this.onChange = onChange;
    this.clock = clock;
    this.state = 'idle';
    this.index = -1;
    this.generation = 0;
    this.readyAt = 0;
  }
  clearTimers() {
    this.clock.clearTimeout(this.startTimer);
    this.clock.clearTimeout(this.watchdog);
  }
  cancel(force = false) {
    this.generation++;
    this.clearTimers();
    if (this.synth && (force || this.utterance || this.synth.speaking || this.synth.pending || this.synth.paused)) {
      // Allow cancellation to settle before submitting a replacement utterance.
      this.readyAt = this.clock.Date.now() + 150;
      try { this.synth.cancel(); this.synth.resume(); } catch { /* A later play can retry. */ }
    }
    this.utterance = null;
  }
  stop() {
    this.cancel();
    this.state = 'idle';
    this.index = -1;
    this.onChange(this);
  }
  reset() {
    this.cancel(true);
    this.state = this.index >= 0 ? 'paused' : 'idle';
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
  fail(message) {
    this.cancel();
    this.state = 'paused';
    this.onChange(this, `${message} Choose a device voice and tap Resume, or use Reset audio. If silence continues, reload this page.`);
  }
  speak() {
    const generation = ++this.generation;
    this.state = 'loading';
    this.onChange(this);
    const start = () => {
      if (generation !== this.generation) return;
      try {
        const utterance = new this.Utterance(this.lines[this.index].chinese);
        this.utterance = utterance;
        utterance.lang = this.options.voice?.lang || 'zh-CN';
        if (this.options.voice) utterance.voice = this.options.voice;
        utterance.rate = this.options.rate || 0.85;
        const current = () => generation === this.generation && this.utterance === utterance;
        utterance.onstart = () => {
          if (!current()) return;
          this.clock.clearTimeout(this.watchdog);
          this.state = 'playing';
          this.onChange(this);
          // Some engines emit start but never end. Use a generous length-based limit.
          const maxDuration = Math.max(30000, utterance.text.length * 1000 / utterance.rate + 15000);
          this.watchdog = this.clock.setTimeout(() => {
            if (current()) this.fail('The voice stopped responding.');
          }, maxDuration);
        };
        utterance.onend = () => {
          if (!current()) return;
          this.clock.clearTimeout(this.watchdog);
          this.utterance = null;
          if (++this.index < this.lines.length) this.speak();
          else this.stop();
        };
        utterance.onerror = event => {
          if (!current()) return;
          this.fail(`Audio could not play (${event.error || 'speech error'}).`);
        };
        this.watchdog = this.clock.setTimeout(() => {
          if (current()) this.fail('The selected voice did not start within 8 seconds.');
        }, 8000);
        this.synth.resume();
        this.synth.speak(utterance);
      } catch {
        if (generation === this.generation) this.fail('Audio could not start.');
      }
    };
    const delay = this.readyAt - this.clock.Date.now();
    if (delay > 0) this.startTimer = this.clock.setTimeout(start, delay);
    else start(); // Keep the initial speak in the user's click handler on mobile.
  }
  pause() {
    if (!['playing', 'loading'].includes(this.state)) return;
    // Cancel and restart the current line: native pause is inconsistent on Android.
    this.cancel();
    this.state = 'paused';
    this.onChange(this);
  }
  resume(options = this.options) {
    if (this.state === 'paused') {
      this.options = options;
      this.speak();
    }
  }
}
