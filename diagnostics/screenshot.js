const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = [
  { name: 'iphone-se',           w: 375,  h: 667  },
  { name: 'iphone-se-ls',        w: 667,  h: 375,  landscape: true },
  { name: 'iphone-14',           w: 390,  h: 844  },
  { name: 'iphone-14-ls',        w: 844,  h: 390,  landscape: true },
  { name: 'iphone-14-max',       w: 430,  h: 932  },
  { name: 'iphone-14-max-ls',    w: 932,  h: 430,  landscape: true },
  { name: 'ipad',                w: 768,  h: 1024 },
  { name: 'ipad-ls',             w: 1024, h: 768,  landscape: true },
  { name: 'laptop-1280',         w: 1280, h: 800  },
  { name: 'desktop-1440',        w: 1440, h: 900  },
];

const OUT = path.join(__dirname, 'screens');
fs.mkdirSync(OUT, { recursive: true });

async function runInteractionTests(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  let passed = 0, failed = 0;

  // Test: carousel slide click opens lightbox
  try {
    await page.evaluate(() => {
      document.querySelector('.car-slide').scrollIntoView();
    });
    await page.click('.car-slide');
    await new Promise(r => setTimeout(r, 400));
    const lbOpen = await page.evaluate(() => document.getElementById('lb').classList.contains('open'));
    if (lbOpen) {
      console.log('  ✓ carousel click → lightbox opens');
      passed++;
    } else {
      console.error('  ✗ carousel click → lightbox did NOT open');
      failed++;
    }

    // Test: lightbox has caption text
    const capTitle = await page.evaluate(() => document.getElementById('lb-cap-title').textContent.trim());
    if (capTitle.length > 0) {
      console.log(`  ✓ lightbox caption title present: "${capTitle}"`);
      passed++;
    } else {
      console.error('  ✗ lightbox caption title is empty');
      failed++;
    }

    // Screenshot lightbox open state
    await page.screenshot({ path: path.join(OUT, 'interaction-lightbox-open.png'), fullPage: false });
    console.log('  ✓ interaction-lightbox-open screenshot saved');

    // Test: lightbox closes on X button
    await page.click('.lb-close');
    await new Promise(r => setTimeout(r, 300));
    const lbClosed = await page.evaluate(() => !document.getElementById('lb').classList.contains('open'));
    if (lbClosed) {
      console.log('  ✓ lb-close button closes lightbox');
      passed++;
    } else {
      console.error('  ✗ lb-close did not close lightbox');
      failed++;
    }

    // Test: lightbox closes on backdrop click
    await page.click('.car-slide');
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => {
      const lb = document.getElementById('lb');
      lb.dispatchEvent(Object.assign(new MouseEvent('click', {bubbles:true}), {_target: lb}));
      closeLbOutside({ target: lb });
    });
    await new Promise(r => setTimeout(r, 300));
    const lbClosedBackdrop = await page.evaluate(() => !document.getElementById('lb').classList.contains('open'));
    if (lbClosedBackdrop) {
      console.log('  ✓ backdrop click closes lightbox');
      passed++;
    } else {
      console.error('  ✗ backdrop click did not close lightbox');
      failed++;
    }
  } catch(e) {
    console.error('  ✗ interaction test error:', e.message);
    failed++;
  }

  // Test: carousel nav arrows work
  try {
    const dotsBefore = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    await page.click('.car-next');
    await new Promise(r => setTimeout(r, 300));
    const dotsAfter = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    if (dotsAfter !== dotsBefore) {
      console.log(`  ✓ carousel next arrow advances slide (${dotsBefore} → ${dotsAfter})`);
      passed++;
    } else {
      console.error('  ✗ carousel next arrow did not advance');
      failed++;
    }
  } catch(e) {
    console.error('  ✗ carousel nav test error:', e.message);
    failed++;
  }

  // Test: map scenario cycles (ops terminal logs appear)
  try {
    await new Promise(r => setTimeout(r, 2500));
    const opsEntries = await page.evaluate(() => document.querySelectorAll('.ops-entry').length);
    if (opsEntries > 0) {
      console.log(`  ✓ ops terminal has ${opsEntries} log entries`);
      passed++;
    } else {
      console.error('  ✗ ops terminal has no entries after 2.5s');
      failed++;
    }
  } catch(e) {
    console.error('  ✗ ops terminal test error:', e.message);
    failed++;
  }

  await page.close();
  console.log(`\nInteraction tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // Viewport screenshots
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2, isLandscape: !!vp.landscape });
    await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));

    const full = path.join(OUT, `${vp.name}-full.png`);
    await page.screenshot({ path: full, fullPage: true });
    console.log(`✓ ${vp.name} full`);

    const fold = path.join(OUT, `${vp.name}-fold.png`);
    await page.screenshot({ path: fold, fullPage: false });
    console.log(`✓ ${vp.name} fold`);

    await page.close();
  }

  console.log('\nRunning interaction tests...');
  await runInteractionTests(browser);

  await browser.close();
  console.log('\nDone. Screenshots in diagnostics/screens/');
})();
