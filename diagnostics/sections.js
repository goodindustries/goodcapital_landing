const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screens');
fs.mkdirSync(OUT, { recursive: true });

const SECTIONS = [
  { sel: '.prob-row3',   name: 'stats-top' },
  { sel: '.prob-row2',   name: 'stats-mid' },
  { sel: '.what',        name: 'what' },
  { sel: '.carousel-wrap', name: 'carousel' },
  { sel: '#where',       name: 'map' },
  { sel: '.about-tgp',   name: 'about' },
  { sel: '.how',         name: 'how' },
  { sel: '.donate',      name: 'donate' },
];

const VIEWPORTS = [
  { name: 'mobile',   w: 390,  h: 844 },
  { name: 'tablet',   w: 768,  h: 1024 },
  { name: 'desktop',  w: 1440, h: 900 },
];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2 });
    await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 600));

    for (const sec of SECTIONS) {
      try {
        const el = await page.$(sec.sel);
        if (!el) { console.log(`  skip ${sec.name} (not found)`); continue; }
        const box = await el.boundingBox();
        if (!box) continue;
        const clip = {
          x: Math.max(0, box.x - 4),
          y: Math.max(0, box.y - 4),
          width: Math.min(vp.w, box.width + 8),
          height: Math.min(box.height + 8, 1600),
        };
        await page.screenshot({
          path: path.join(OUT, `${vp.name}-${sec.name}.png`),
          clip,
        });
        console.log(`✓ ${vp.name} ${sec.name}`);
      } catch(e) { console.log(`  err ${sec.name}: ${e.message}`); }
    }
    await page.close();
  }

  await browser.close();
  console.log('Done.');
})();
