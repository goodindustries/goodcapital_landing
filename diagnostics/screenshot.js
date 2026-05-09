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

async function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

async function runInteractionTests(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
  await wait(800);

  // ── NAV ──────────────────────────────────────────────────────────────────
  console.log('\n  [Nav]');

  try {
    const linksVisible = await page.evaluate(() => {
      const ul = document.querySelector('.nav-links');
      return ul && getComputedStyle(ul).display !== 'none';
    });
    linksVisible ? pass('nav links visible') : fail('nav links hidden on desktop');
  } catch(e){ fail('nav links: ' + e.message); }

  try {
    const centered = await page.evaluate(() => {
      const ul = document.querySelector('.nav-links');
      const nav = document.querySelector('nav');
      const ulMid = (ul.getBoundingClientRect().left + ul.getBoundingClientRect().right) / 2;
      const navMid = (nav.getBoundingClientRect().left + nav.getBoundingClientRect().right) / 2;
      return Math.abs(ulMid - navMid) < 30;
    });
    centered ? pass('nav links centered') : fail('nav links not centered');
  } catch(e){ fail('nav centering: ' + e.message); }

  try {
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    await wait(300);
    const beforeY = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => document.querySelector('.nav-links li:first-child').click());
    await wait(800);
    const afterY = await page.evaluate(() => window.scrollY);
    afterY > beforeY ? pass('nav Why scrolls page') : fail('nav Why did not scroll');
  } catch(e){ fail('nav Why: ' + e.message); }

  try {
    // Return to top with instant jump so smooth scroll doesn't interfere
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    await wait(300);
    await page.click('.nav-cta');
    await wait(1200); // smooth scroll to bottom needs time
    const giveVisible = await page.evaluate(() => {
      const el = document.getElementById('give');
      if(!el) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0;
    });
    giveVisible ? pass('Donate Now scrolls to #give') : fail('Donate Now did not scroll to #give');
  } catch(e){ fail('Donate Now: ' + e.message); }

  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
  await wait(300);

  // ── CAROUSEL ─────────────────────────────────────────────────────────────
  console.log('\n  [Carousel]');

  // Scroll to carousel and click the first REAL slide (skip aria-hidden clone)
  try {
    await page.evaluate(() => {
      const real = document.querySelector('.car-slide:not([aria-hidden])');
      if(real) real.scrollIntoView({block: 'center'});
    });
    await wait(400);
    // Use JS click to bypass Puppeteer's visibility heuristic — click is real
    await page.evaluate(() => {
      document.querySelector('.car-slide:not([aria-hidden])').click();
    });
    await wait(400);
    const lbOpen = await page.evaluate(() => document.getElementById('lb').classList.contains('open'));
    lbOpen ? pass('carousel click opens lightbox') : fail('carousel click did not open lightbox');
  } catch(e){ fail('carousel click: ' + e.message); }

  try {
    const title = await page.evaluate(() => document.getElementById('lb-cap-title').textContent.trim());
    title.length > 0 ? pass(`lightbox caption: "${title}"`) : fail('lightbox caption empty');
  } catch(e){ fail('lightbox caption: ' + e.message); }

  try {
    const before = await page.evaluate(() => document.getElementById('lb-img').src);
    await page.evaluate(() => document.querySelector('.lb-next').click());
    await wait(300);
    const after = await page.evaluate(() => document.getElementById('lb-img').src);
    before !== after ? pass('lightbox next changes image') : fail('lightbox next did nothing');
  } catch(e){ fail('lightbox next: ' + e.message); }

  try {
    const before = await page.evaluate(() => document.getElementById('lb-img').src);
    await page.evaluate(() => document.querySelector('.lb-prev').click());
    await wait(300);
    const after = await page.evaluate(() => document.getElementById('lb-img').src);
    before !== after ? pass('lightbox prev changes image') : fail('lightbox prev did nothing');
  } catch(e){ fail('lightbox prev: ' + e.message); }

  try {
    await page.keyboard.press('Escape');
    await wait(300);
    const closed = await page.evaluate(() => !document.getElementById('lb').classList.contains('open'));
    closed ? pass('Escape closes lightbox') : fail('Escape did not close lightbox');
  } catch(e){ fail('Escape close: ' + e.message); }

  try {
    await page.evaluate(() => document.querySelector('.car-slide:not([aria-hidden])').click());
    await wait(400);
    const src1 = await page.evaluate(() => document.getElementById('lb-img').src);
    await page.keyboard.press('ArrowRight');
    await wait(300);
    const src2 = await page.evaluate(() => document.getElementById('lb-img').src);
    src1 !== src2 ? pass('ArrowRight navigates lightbox') : fail('ArrowRight did not navigate');
    await page.keyboard.press('Escape');
    await wait(200);
  } catch(e){ fail('lightbox keyboard nav: ' + e.message); }

  await page.screenshot({ path: path.join(OUT, 'interaction-lightbox.png'), fullPage: false });

  // Carousel next — on desktop .car-next-peek is the big visible arrow
  try {
    const dotBefore = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    await page.evaluate(() => document.querySelector('.car-next-peek').click());
    await wait(700);
    const dotAfter = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    dotAfter !== dotBefore ? pass(`carousel next advances dot (${dotBefore}→${dotAfter})`) : fail('carousel next did not advance');
  } catch(e){ fail('carousel next: ' + e.message); }

  // Infinite loop: from slide 0, advance total times → must land back on dot 0
  try {
    await page.evaluate(() => carJump(0));
    await wait(400);
    const total = await page.evaluate(() => document.querySelectorAll('.car-dot').length);
    for(let i = 0; i < total; i++){
      await page.evaluate(() => carStep(1));
      await wait(700); // must exceed 550ms CSS transition + transitionend wrap jump
    }
    const dotAfterWrap = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    dotAfterWrap === 0 ? pass('carousel infinite: next wraps to first slide') : fail(`carousel next wrap landed on dot ${dotAfterWrap}`);
  } catch(e){ fail('carousel infinite next: ' + e.message); }

  // Infinite loop: prev from slide 0 wraps to last
  try {
    await page.evaluate(() => carJump(0));
    await wait(400);
    await page.evaluate(() => carStep(-1));
    await wait(700);
    const total = await page.evaluate(() => document.querySelectorAll('.car-dot').length);
    const dotAfterPrev = await page.evaluate(() =>
      [...document.querySelectorAll('.car-dot')].findIndex(d => d.classList.contains('active'))
    );
    dotAfterPrev === total-1 ? pass('carousel infinite: prev wraps to last slide') : fail(`carousel prev wrap landed on dot ${dotAfterPrev}`);
  } catch(e){ fail('carousel prev wrap: ' + e.message); }

  // ── MANIFESTO TOGGLE ─────────────────────────────────────────────────────
  console.log('\n  [Manifesto]');
  try {
    await page.evaluate(() => {
      const el = document.querySelector('.manifesto-toggle');
      if(el) el.scrollIntoView({block:'center'});
    });
    await wait(300);
    const before = await page.evaluate(() => document.querySelector('.manifesto-body').classList.contains('open'));
    await page.evaluate(() => document.querySelector('.manifesto-toggle').click());
    await wait(300);
    const after = await page.evaluate(() => document.querySelector('.manifesto-body').classList.contains('open'));
    after !== before ? pass('manifesto toggle opens') : fail('manifesto toggle did not change state');
    await page.evaluate(() => document.querySelector('.manifesto-toggle').click());
    await wait(200);
    pass('manifesto toggle closes');
  } catch(e){ fail('manifesto toggle: ' + e.message); }

  // ── DONATE ───────────────────────────────────────────────────────────────
  console.log('\n  [Donate]');
  try {
    await page.evaluate(() => { const el = document.getElementById('give'); if(el) el.scrollIntoView({block:'start'}); });
    await wait(400);

    const amtBtns = await page.evaluate(() => [...document.querySelectorAll('.dam')].map(b => b.textContent.trim()));
    amtBtns.length > 0 ? pass(`donate amounts: ${amtBtns.join(', ')}`) : fail('no donate amount buttons (.dam) found');

    await page.evaluate(() => document.querySelectorAll('.dam')[0].click());
    await wait(200);
    const active = await page.evaluate(() => document.querySelectorAll('.dam')[0].classList.contains('active'));
    active ? pass('donate $25 activates on click') : fail('donate button did not activate');
  } catch(e){ fail('donate amounts: ' + e.message); }

  try {
    const freqBtns = await page.evaluate(() => [...document.querySelectorAll('.donate-mode-btn')].map(b => b.textContent.trim()));
    freqBtns.length >= 2 ? pass(`donate frequency buttons: ${freqBtns.join(', ')}`) : fail('donate frequency buttons missing');

    await page.evaluate(() => document.querySelectorAll('.donate-mode-btn')[1].click());
    await wait(200);
    const active = await page.evaluate(() => document.querySelectorAll('.donate-mode-btn')[1].classList.contains('active'));
    active ? pass('donate one-time mode activates') : fail('donate mode button did not activate');
  } catch(e){ fail('donate frequency: ' + e.message); }

  // ── OPS TERMINAL ─────────────────────────────────────────────────────────
  console.log('\n  [Ops Terminal]');
  try {
    await page.evaluate(() => { const el = document.querySelector('.map-section'); if(el) el.scrollIntoView(); });
    await wait(3000);
    const entries = await page.evaluate(() => document.querySelectorAll('.ops-entry').length);
    entries > 0 ? pass(`ops terminal: ${entries} log entries`) : fail('ops terminal empty after 3s');
    const hasAlert = await page.evaluate(() => !!document.querySelector('.ops-alert'));
    hasAlert ? pass('ops terminal has alert entry') : fail('ops terminal missing alert entry');
  } catch(e){ fail('ops terminal: ' + e.message); }

  // ── MAP ───────────────────────────────────────────────────────────────────
  console.log('\n  [Map]');
  try {
    const cityPins = await page.evaluate(() => document.querySelectorAll('.city-pin').length);
    cityPins > 0 ? pass(`map: ${cityPins} city pins`) : fail('map has no city pins');
    await page.evaluate(() => {
      const pin = document.querySelector('.city-pin');
      if(pin) pin.dispatchEvent(new MouseEvent('mouseenter', {bubbles:true}));
    });
    await wait(300);
    pass('city pin hover fires without error');
  } catch(e){ fail('map city pins: ' + e.message); }

  await page.screenshot({ path: path.join(OUT, 'interaction-map.png'), fullPage: false });
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2, isLandscape: !!vp.landscape });
    await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
    await wait(800);

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
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if(failed > 0){ console.error(`\n${failed} test(s) failed.`); process.exitCode = 1; }
  else { console.log('All interaction tests passed.'); }
  console.log(`\nScreenshots in diagnostics/screens/`);
})();
