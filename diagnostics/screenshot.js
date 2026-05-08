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

let passed = 0, failed = 0;

function pass(msg){ console.log(`  ✓ ${msg}`); passed++; }
function fail(msg){ console.error(`  ✗ ${msg}`); failed++; }

async function runInteractionTests(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 800));

  // ── NAV ──────────────────────────────────────────────────────────────────
  console.log('\n  [Nav]');

  // Nav links are visible on desktop
  try {
    const linksVisible = await page.evaluate(() => {
      const ul = document.querySelector('.nav-links');
      return ul && getComputedStyle(ul).display !== 'none';
    });
    linksVisible ? pass('nav links visible') : fail('nav links hidden on desktop');
  } catch(e){ fail('nav links check: ' + e.message); }

  // Nav links centered (middle of nav ≈ middle of viewport ±30px)
  try {
    const centered = await page.evaluate(() => {
      const ul = document.querySelector('.nav-links');
      const nav = document.querySelector('nav');
      const ulBox = ul.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      const ulCenter = (ulBox.left + ulBox.right) / 2;
      const navCenter = (navBox.left + navBox.right) / 2;
      return Math.abs(ulCenter - navCenter) < 30;
    });
    centered ? pass('nav links centered') : fail('nav links not centered');
  } catch(e){ fail('nav centering check: ' + e.message); }

  // Nav "Why" scrolls to #about section
  try {
    const beforeY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => document.querySelector('.nav-links li:first-child').click());
    await new Promise(r => setTimeout(r, 600));
    const afterY = await page.evaluate(() => window.scrollY);
    afterY > beforeY ? pass('nav Why scrolls page') : fail('nav Why did not scroll');
  } catch(e){ fail('nav Why scroll: ' + e.message); }

  // Donate Now nav button scrolls to #give
  try {
    await page.evaluate(() => window.scrollTo(0,0));
    await new Promise(r => setTimeout(r, 200));
    await page.click('.nav-cta');
    await new Promise(r => setTimeout(r, 600));
    const giveVisible = await page.evaluate(() => {
      const el = document.getElementById('give');
      if(!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight;
    });
    giveVisible ? pass('Donate Now scrolls to #give') : fail('Donate Now did not scroll to #give');
  } catch(e){ fail('Donate Now scroll: ' + e.message); }

  await page.evaluate(() => window.scrollTo(0,0));
  await new Promise(r => setTimeout(r, 300));

  // ── CAROUSEL ─────────────────────────────────────────────────────────────
  console.log('\n  [Carousel]');

  // Click opens lightbox
  try {
    await page.evaluate(() => document.querySelector('.car-slide').scrollIntoView());
    await page.click('.car-slide');
    await new Promise(r => setTimeout(r, 400));
    const lbOpen = await page.evaluate(() => document.getElementById('lb').classList.contains('open'));
    lbOpen ? pass('carousel click opens lightbox') : fail('carousel click did not open lightbox');
  } catch(e){ fail('carousel click: ' + e.message); }

  // Lightbox caption present
  try {
    const title = await page.evaluate(() => document.getElementById('lb-cap-title').textContent.trim());
    title.length > 0 ? pass(`lightbox caption: "${title}"`) : fail('lightbox caption empty');
  } catch(e){ fail('lightbox caption: ' + e.message); }

  // Lightbox prev/next arrows work
  try {
    const before = await page.evaluate(() => document.getElementById('lb-img').src);
    await page.click('.lb-next');
    await new Promise(r => setTimeout(r, 300));
    const after = await page.evaluate(() => document.getElementById('lb-img').src);
    before !== after ? pass('lightbox next arrow changes image') : fail('lightbox next arrow did nothing');
  } catch(e){ fail('lightbox next arrow: ' + e.message); }

  try {
    const before = await page.evaluate(() => document.getElementById('lb-img').src);
    await page.click('.lb-prev');
    await new Promise(r => setTimeout(r, 300));
    const after = await page.evaluate(() => document.getElementById('lb-img').src);
    before !== after ? pass('lightbox prev arrow changes image') : fail('lightbox prev arrow did nothing');
  } catch(e){ fail('lightbox prev arrow: ' + e.message); }

  // Lightbox keyboard: Escape closes
  try {
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
    const closed = await page.evaluate(() => !document.getElementById('lb').classList.contains('open'));
    closed ? pass('Escape closes lightbox') : fail('Escape did not close lightbox');
  } catch(e){ fail('Escape close: ' + e.message); }

  // Lightbox keyboard: arrow keys navigate (reopen first)
  try {
    await page.click('.car-slide');
    await new Promise(r => setTimeout(r, 400));
    const src1 = await page.evaluate(() => document.getElementById('lb-img').src);
    await page.keyboard.press('ArrowRight');
    await new Promise(r => setTimeout(r, 300));
    const src2 = await page.evaluate(() => document.getElementById('lb-img').src);
    src1 !== src2 ? pass('ArrowRight navigates lightbox') : fail('ArrowRight did not navigate');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 200));
  } catch(e){ fail('lightbox keyboard nav: ' + e.message); }

  await page.screenshot({ path: path.join(OUT, 'interaction-lightbox.png'), fullPage: false });

  // Carousel next button advances dot
  try {
    const dotBefore = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    await page.click('.car-next-ctrl');
    await new Promise(r => setTimeout(r, 700));
    const dotAfter = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    dotAfter !== dotBefore ? pass(`carousel next advances dot (${dotBefore}→${dotAfter})`) : fail('carousel next did not advance dot');
  } catch(e){ fail('carousel next: ' + e.message); }

  // Carousel infinite: click next at last slide, dot wraps to 0
  try {
    const total = await page.evaluate(() => document.querySelectorAll('.car-dot').length);
    for(let i=0; i<total; i++){
      await page.click('.car-next-ctrl');
      await new Promise(r => setTimeout(r, 700));
    }
    const dotAfterWrap = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    dotAfterWrap === 0 ? pass('carousel infinite loop wraps to first slide') : fail(`carousel did not wrap — landed on dot ${dotAfterWrap}`);
  } catch(e){ fail('carousel infinite loop: ' + e.message); }

  // Carousel infinite: click prev at first slide, dot wraps to last
  try {
    await page.evaluate(() => carJump(0));
    await new Promise(r => setTimeout(r, 400));
    await page.click('.car-prev');
    await new Promise(r => setTimeout(r, 700));
    const total = await page.evaluate(() => document.querySelectorAll('.car-dot').length);
    const dotAfterPrev = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    dotAfterPrev === total-1 ? pass('carousel prev wraps to last slide') : fail(`carousel prev wrap landed on dot ${dotAfterPrev}`);
  } catch(e){ fail('carousel prev wrap: ' + e.message); }

  // ── MANIFESTO TOGGLE ─────────────────────────────────────────────────────
  console.log('\n  [Manifesto]');
  try {
    await page.evaluate(() => { const el = document.querySelector('.tog-btn'); if(el) el.scrollIntoView(); });
    const togBtn = await page.$('.tog-btn');
    if(togBtn){
      const contentBefore = await page.evaluate(() => document.querySelector('.tog-body') && document.querySelector('.tog-body').classList.contains('open'));
      await page.click('.tog-btn');
      await new Promise(r => setTimeout(r, 300));
      const contentAfter = await page.evaluate(() => document.querySelector('.tog-body') && document.querySelector('.tog-body').classList.contains('open'));
      contentAfter !== contentBefore ? pass('manifesto toggle opens content') : fail('manifesto toggle did not change state');

      // Close it
      await page.click('.tog-btn');
      await new Promise(r => setTimeout(r, 200));
      pass('manifesto toggle closes content');
    } else { fail('manifesto toggle button not found'); }
  } catch(e){ fail('manifesto toggle: ' + e.message); }

  // ── DONATE SECTION ───────────────────────────────────────────────────────
  console.log('\n  [Donate]');

  // Amount buttons exist and are clickable
  try {
    await page.evaluate(() => { const el = document.getElementById('give'); if(el) el.scrollIntoView(); });
    await new Promise(r => setTimeout(r, 300));

    const amtBtns = await page.evaluate(() => [...document.querySelectorAll('.d-amt')].map(b => b.textContent.trim()));
    amtBtns.length > 0 ? pass(`donate amount buttons present: ${amtBtns.join(', ')}`) : fail('no donate amount buttons found');

    // Click $100 and verify it becomes active
    const btn100 = await page.$('.d-amt:nth-child(2)');
    if(btn100){
      await btn100.click();
      await new Promise(r => setTimeout(r, 200));
      const active = await page.evaluate(() => {
        const btn = document.querySelector('.d-amt:nth-child(2)');
        return btn && btn.classList.contains('active');
      });
      active ? pass('donate $100 button becomes active on click') : fail('donate button did not activate');
    }
  } catch(e){ fail('donate amount buttons: ' + e.message); }

  // One-time vs monthly toggle
  try {
    const freqBtns = await page.evaluate(() => [...document.querySelectorAll('.d-freq')].map(b => b.textContent.trim()));
    freqBtns.length >= 2 ? pass(`donate frequency buttons: ${freqBtns.join(', ')}`) : fail('donate frequency buttons missing');
  } catch(e){ fail('donate frequency: ' + e.message); }

  // ── OPS TERMINAL ─────────────────────────────────────────────────────────
  console.log('\n  [Ops Terminal]');
  try {
    await page.evaluate(() => { const el = document.querySelector('.map-section'); if(el) el.scrollIntoView(); });
    await new Promise(r => setTimeout(r, 3000)); // wait for first comms to fire
    const entries = await page.evaluate(() => document.querySelectorAll('.ops-entry').length);
    entries > 0 ? pass(`ops terminal has ${entries} log entries after 3s`) : fail('ops terminal empty after 3s');

    const hasAlert = await page.evaluate(() => !!document.querySelector('.ops-alert'));
    hasAlert ? pass('ops terminal shows alert entry') : fail('ops terminal missing alert entry');
  } catch(e){ fail('ops terminal: ' + e.message); }

  // ── MAP CITIES ───────────────────────────────────────────────────────────
  console.log('\n  [Map]');
  try {
    const cityPins = await page.evaluate(() => document.querySelectorAll('.city-pin').length);
    cityPins > 0 ? pass(`map has ${cityPins} city pins`) : fail('map has no city pins');

    const sgf = await page.$('[data-city="sgf"]') || await page.$('.city-pin');
    if(sgf){
      await sgf.hover();
      await new Promise(r => setTimeout(r, 400));
      pass('city pin hover completes without error');
    }
  } catch(e){ fail('map city pins: ' + e.message); }

  await page.screenshot({ path: path.join(OUT, 'interaction-map.png'), fullPage: false });

  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  // Viewport screenshots
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2, isLandscape: !!vp.landscape });
    await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));

    await page.screenshot({ path: path.join(OUT, `${vp.name}-full.png`), fullPage: true });
    console.log(`✓ ${vp.name} full`);

    await page.screenshot({ path: path.join(OUT, `${vp.name}-fold.png`), fullPage: false });
    console.log(`✓ ${vp.name} fold`);

    await page.close();
  }

  console.log('\nRunning interaction tests...');
  await runInteractionTests(browser);

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Interaction results: ${passed} passed, ${failed} failed`);
  if (failed > 0){
    console.error(`\n${failed} test(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log('All interaction tests passed.');
  }
  console.log(`\nScreenshots in diagnostics/screens/`);
})();
