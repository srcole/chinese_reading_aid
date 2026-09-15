# Slowly · Chinese reading companion

A static web app for reading simplified or traditional Chinese with automatic tone-marked pinyin, your own English translations, and Mandarin speech.

## Run locally

Requires Node.js 22.12+ (or a supported newer version).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm test` checks segmentation, translation alignment, pinyin, and playback state transitions. `npm run build` creates `dist/`; `npm run preview` serves that build.

Browser checks: run `npx playwright install chromium`, then `npm run test:browser`. Alternatively, set `CHROME_PATH` to an installed Chrome executable. These tests cover desktop and phone-sized Chromium with mocked speech; they do not verify real audio or Safari.

## Use

1. Paste Chinese and select sentences (default) or existing lines. Sentence splitting uses Chinese sentence punctuation, `!?`, ellipses, and newlines; commas and semicolons stay within a sentence.
2. Optionally paste an English paragraph or one translation per resulting Chinese line. **Match English by → Auto-detect** preserves already matching lines and blank placeholders; otherwise it tries sentence boundaries when they improve the match. Choose **Sentences** to force sentence splitting or **Existing lines** to keep your exact line arrangement. Open **Preview line matching** to check alignment. Matching uses sentence order and counts, not meaning; one Chinese sentence may translate into multiple English sentences, so manual grouping can still be needed. Extra English entries must be combined or removed before preparation. Your pasted text and existing reading-card edits are not changed by previewing.
3. Click **Prepare reading**. Pinyin and English can be edited in each reading card. Preparing again regenerates the cards from the input boxes and replaces card edits.
4. Read from the beginning, or click a Chinese line to start there and continue to the end. Choose a Mandarin voice and speed. Pause stops speech; Resume restarts the paused line for consistent behavior across mobile browsers.

The input draft and prepared cards are saved locally in this browser, when storage is available. Input changes take effect in the reader after **Prepare reading**. No account, database, or translation API is used. Pinyin generation is local; speech voices may use the device provider’s online service. Fonts load from Google Fonts, with system fallbacks. Pinyin corrections affect the display, not the speech engine’s pronunciation.

## GitHub Pages

The included `.github/workflows/deploy.yml` builds, tests, and deploys pushes to `main` (and supports manual runs).

1. Push this project to your GitHub repository’s `main` branch.
2. In the repository, open **Settings → Pages → Build and deployment**, and set **Source** to **GitHub Actions**.
3. Run **Deploy to GitHub Pages** from the Actions tab, or push another commit.
4. Open the URL shown by the deployment job.

The relative Vite asset base supports repository subpaths such as `/chinese_reading_aid/`. For another default branch, update the workflow’s branch filter. You can also deploy `dist/` to a static host such as Vercel (build: `npm run build`, output: `dist`). Supabase is not required.

## Device verification

Designed for iPhone Safari, desktop Chrome, and Pixel Chrome. Automated playback tests use a fake speech engine; real voice quality and behavior must be checked on devices:

- Load voices, select Mandarin, read the example, and verify highlighting advances through all four lines.
- Jump to another line during playback, pause/resume, stop, and restart.
- Change speed and voice during reading; playback should pause. Tap Resume to restart the current line with the new setting.
- Switch apps or lock the screen: the app pauses when hidden; return and tap Resume.
- Test a long passage, traditional characters, mismatched translations, and refreshing after card edits.
- If no Mandarin voice is listed or playback fails, install/enable a Mandarin voice in device speech settings, reload, and retry. Some voices need internet access. Playback is intended with the page visible.

### Recovering silent audio

Voice choices are marked **Device** or **Online**. If a voice never starts, the player reports a timeout after 8 seconds and keeps your place for retry. It also detects speech that starts but never reports completion, using a generous limit based on text length. **Reset audio** clears pending speech and selects an available device Mandarin voice (or the browser default if none is listed); tap **Resume** or **Read from start** afterward. Changing voices no longer immediately starts speech from the dropdown. Replacement speech waits briefly after cancellation, and late events from an old voice cannot interrupt a new reading.

If the browser's speech service remains silent after resetting, reload the page and choose a Device voice. Drafts and prepared reading edits are saved in browser storage when available. Automated tests simulate an unresponsive online voice and verify recovery; they cannot guarantee a particular provider's voice availability or audible output.

Automatic pinyin may need correction for names, rare characters, and ambiguous pronunciations. Browser speech engines independently choose pronunciations.
