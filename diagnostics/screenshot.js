const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = [
  { name: 'iphone-se',        w: 375,  h: 667  },
  { name: 'iphone-14',        w: 390,  h: 844  },
  { name: 'iphone-14-max',    w: 430,  h: 932  },
  { name: 'ipad',             w: 768,  h: 1024 },
  { name: 'laptop-1280',      w: 1280, h: 800  },
  { name: 'desktop-1440',     w: 1440, h: 900  },
];

const OUT = path.join(__dirname, 'screens');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 2 });
    await page.goto('http://localhost:8888', { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));

    // Full page
    const full = path.join(OUT, `${vp.name}-full.png`);
    await page.screenshot({ path: full, fullPage: true });
    console.log(`✓ ${vp.name} full`);

    // Fold (above-the-fold only)
    const fold = path.join(OUT, `${vp.name}-fold.png`);
    await page.screenshot({ path: fold, fullPage: false });
    console.log(`✓ ${vp.name} fold`);

    await page.close();
  }

  await browser.close();
  console.log('Done. Screenshots in diagnostics/screens/');
})();
