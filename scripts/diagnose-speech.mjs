// Real Chrome / OS speech probe. Uses a fresh profile and a fixed sample, never saved passages.
// Usage: node scripts/diagnose-speech.mjs [site URL]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://srcole.github.io/chinese_reading_aid/';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
try {
  console.log(JSON.stringify({ chrome: browser.version(), url }));
  for (const kind of ['native-device', 'app-device', 'native-google']) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForFunction(() => speechSynthesis.getVoices().length > 0, { timeout: 10000 });
    const result = await page.evaluate(kind => {
      const voices = speechSynthesis.getVoices();
      const mandarin = voices.filter(v => /^(zh[-_](CN|TW|SG|Hans|Hant)|cmn)/i.test(v.lang));
      const voice = kind === 'native-google' ? mandarin.find(v => /Google/.test(v.name)) : mandarin.find(v => v.localService);
      window.probe = { events: [], kind, voice: voice ? { name: voice.name, lang: voice.lang, local: voice.localService } : null, allVoices: mandarin.map(v => ({ name: v.name, lang: v.lang, local: v.localService })) };
      if (!voice) return window.probe;
      if (kind === 'app-device') {
        const speak = speechSynthesis.speak.bind(speechSynthesis);
        speechSynthesis.speak = utterance => {
          for (const event of ['start', 'end', 'error']) utterance.addEventListener(event, e => window.probe.events.push({ event, error: e.error, at: Math.round(performance.now()) }));
          speak(utterance);
        };
        document.querySelector('#chinese').value = '你好。这是一段中文语音测试。';
        document.querySelector('#english').value = '';
        document.querySelector('#chinese').dispatchEvent(new Event('input'));
        document.querySelector('#prepare').click();
        document.querySelector('#voice').value = voice.voiceURI;
      } else {
        const button = document.createElement('button');
        button.id = 'native-probe'; button.textContent = 'Test native Mandarin speech';
        button.style.cssText = 'position:fixed;top:10px;left:10px;z-index:99999';
        button.onclick = () => {
          const utterance = new SpeechSynthesisUtterance('你好。这是一段中文语音测试。');
          utterance.voice = voice; utterance.lang = voice.lang;
          window.probeUtterance = utterance;
          for (const event of ['start', 'end', 'error', 'pause', 'resume', 'boundary']) utterance.addEventListener(event, e => window.probe.events.push({ event, error: e.error, at: Math.round(performance.now()) }));
          speechSynthesis.speak(utterance);
        };
        document.body.append(button);
      }
      return window.probe;
    }, kind);
    if (result.voice) {
      await page.locator(kind === 'app-device' ? '#play' : '#native-probe').click();
      await page.waitForTimeout(10000);
    }
    console.log(JSON.stringify(await page.evaluate(() => ({ ...window.probe, status: document.querySelector('#status')?.textContent, engine: { speaking: speechSynthesis.speaking, pending: speechSynthesis.pending, paused: speechSynthesis.paused }, userAgent: navigator.userAgent }))));
    await context.close();
  }
} finally { await browser.close(); }
