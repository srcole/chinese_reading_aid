import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const synth = new EventTarget();
    synth.getVoices = () => [{ voiceURI: 'test', name: 'Test Mandarin', lang: 'zh-CN' }];
    synth.cancel = () => {};
    synth.resume = () => {};
    synth.speak = utterance => { window.currentUtterance = utterance; utterance.onstart(); };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
  });
  await page.goto('/');
});

test('example, playback, jump, pause, stop, and saved corrections', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await expect(page.locator('.reading-card')).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
  await page.getByRole('button', { name: 'Read from start' }).click();
  await expect(page.locator('.reading-card').nth(0)).toHaveClass(/active/);
  await page.evaluate(() => window.currentUtterance.onend());
  await expect(page.locator('.reading-card').nth(1)).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Read from line 3:' }).click();
  await expect(page.locator('#status')).toHaveText('Reading line 3 of 4');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Paused at line 3 of 4');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('Reading line 3 of 4');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.reading-card.active')).toHaveCount(0);
  await page.getByLabel('English for line 1', { exact: true }).fill('My edited translation');
  await page.getByLabel('Pinyin for line 1', { exact: true }).fill('màn màn lái');
  await page.reload();
  await expect(page.getByLabel('English for line 1', { exact: true })).toHaveValue('My edited translation');
  await expect(page.getByLabel('Pinyin for line 1', { exact: true })).toHaveValue('màn màn lái');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('alignment, traditional input, and safe text rendering', async ({ page }) => {
  await page.getByLabel('Chinese text').fill('學習中文。你好！');
  await page.locator('#english').fill('Learn Chinese\nHello\nExtra');
  await expect(page.getByRole('button', { name: 'Prepare reading' })).toBeDisabled();
  await page.locator('#english').fill('Learn Chinese\n<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Prepare reading' }).click();
  await expect(page.locator('.reading-card')).toHaveCount(2);
  await expect(page.getByLabel('Pinyin for line 1', { exact: true })).toHaveValue(/xué xí zhōng wén/);
  await expect(page.locator('#cards img')).toHaveCount(0);
  await page.getByLabel('Split into').selectOption('newlines');
  await expect(page.getByRole('button', { name: 'Prepare reading' })).toBeDisabled();
  await page.locator('#english').fill('Learn Chinese. Hello!');
  await page.getByRole('button', { name: 'Prepare reading' }).click();
  await expect(page.locator('.reading-card')).toHaveCount(1);
});

test('pasted English paragraph matches sentences; manual mode and saved edits are respected', async ({ page }) => {
  await page.getByLabel('Chinese text').fill('你好。你好吗？我很好！');
  await page.locator('#english').fill('Hello. How are you? I am fine!');
  await page.getByText('Preview line matching').click();
  await expect(page.locator('#alignment li small')).toHaveText(['Hello.', 'How are you?', 'I am fine!']);
  await page.getByRole('button', { name: 'Prepare reading' }).click();
  await expect(page.getByLabel('English for line 2', { exact: true })).toHaveValue('How are you?');
  await page.getByLabel('Match English by').selectOption('newlines');
  await expect(page.locator('#alignment li small').first()).toHaveText('Hello. How are you? I am fine!');
  await page.reload();
  await expect(page.getByLabel('Match English by')).toHaveValue('newlines');
  await expect(page.getByLabel('English for line 2', { exact: true })).toHaveValue('How are you?');
  await page.getByLabel('Match English by').selectOption('auto');
  await page.locator('#english').fill('Hello. Welcome!\nHow are you?\nI am fine!');
  await expect(page.locator('#alignment li small').first()).toHaveText('Hello. Welcome!');
});
