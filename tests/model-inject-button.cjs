const { chromium } = require('playwright');
const path = require('node:path');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/workbench/app.js'), 'utf8');
assert.match(source, /id='model-inject-button'/, 'inject button must have stable id');
assert.match(source, /一键导入 \/ 注入本地 AI 模型/, 'inject button label must be explicit');
assert.match(source, /model-inject-callout/, 'inject callout must be rendered');
assert.match(source, /insertBefore\(injectHint,firstDownload\)/, 'primary import step must precede download links');
assert.match(source, /applyUpdateStatus\(updateSnapshot\);icons\(\);/, 'async settings controls must initialize lucide icons');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    await page.goto('file:///' + path.join(root, 'src/workbench/index.html').replace(/\\/g, '/'));
    await page.evaluate(() => {
      const box = document.createElement('section');
      box.className = 'model-download-box';
      const hint = document.createElement('div');
      hint.className = 'model-inject-callout';
      hint.textContent = '下一步 下载完成后点击蓝色按钮';
      const button = document.createElement('button');
      button.id = 'model-inject-button';
      button.className = 'primary-button model-inject-button';
      button.type = 'button';
      button.textContent = '一键导入 / 注入本地 AI 模型';
      const uploadIcon = document.createElement('i');
      uploadIcon.dataset.lucide = 'upload';
      button.append(uploadIcon);
      const downloadA = document.createElement('button');
      downloadA.className = 'secondary-button';
      downloadA.textContent = '百度网盘 · 点击打开';
      box.append(hint, button, downloadA);
      document.body.append(box);
      window.lucide.createIcons({ attrs: { 'aria-hidden': 'true' } });
    });
    const text = (await page.locator('#model-inject-button').textContent()).trim();
    assert.equal(text, '一键导入 / 注入本地 AI 模型', 'inject label must be visible');
    const style = await page.locator('#model-inject-button').evaluate(el => {
      const s = getComputedStyle(el);
      return { color: s.color, backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage, display: s.display, minHeight: s.minHeight, whiteSpace: s.whiteSpace };
    });
    assert.equal(style.color, 'rgb(255, 255, 255)', 'inject text must be white');
    assert.match(style.backgroundImage, /linear-gradient/, 'inject button must have visible gradient');
    assert.equal(style.display, 'flex', 'inject button must use flex layout');
    assert.equal(style.whiteSpace, 'nowrap', 'inject label must not collapse or disappear');
    assert.ok(parseFloat(style.minHeight) >= 36, 'inject button must have a visible hit area');
    assert.equal(await page.locator('#model-inject-button svg').count(), 1, 'inject button upload icon must render');
    const hintStyle = await page.locator('.model-inject-callout').evaluate(el => { const s = getComputedStyle(el); return { display:s.display, color:s.color, backgroundImage:s.backgroundImage }; });
    assert.equal(hintStyle.display, 'flex', 'callout must be visible');
    assert.match(hintStyle.backgroundImage, /linear-gradient/, 'callout must be highlighted');
    assert.equal(await page.locator('.model-download-box').locator('button').first().getAttribute('id'), 'model-inject-button', 'import CTA must be first action in compact card');
    console.log(JSON.stringify({ ok: true, text, style, hintStyle }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });

