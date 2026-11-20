const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH 
  || (process.platform === 'darwin' 
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
      : '/usr/bin/google-chrome-stable' || '/usr/bin/chromium-browser');

async function testMapsScraper() {
  console.log('Launching headless Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--lang=en-US,en'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const searchUrl = 'https://www.google.com/maps/search/lawn+care+in+Frisco+TX';
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 25000 });

    // Wait for the feed or listings to load
    await page.waitForSelector('div[role="feed"]', { timeout: 10000 }).catch(() => console.log('Feed selector wait timeout'));

    // Check how many items are found
    const items = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll('div.Nv2PK, div[role="article"]');
      cards.forEach(card => {
        const titleEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
        const ratingEl = card.querySelector('.MW4etd');
        const reviewsEl = card.querySelector('.UY7F9');
        const linkEl = card.querySelector('a.hfpxzc');
        const link = linkEl ? linkEl.getAttribute('href') : '';
        const ariaLabel = linkEl ? linkEl.getAttribute('aria-label') : '';

        // Text lines for address, category, phone
        const textLines = Array.from(card.querySelectorAll('.W4Efsd')).map(e => e.innerText.trim()).filter(Boolean);

        if (titleEl || ariaLabel) {
          results.push({
            name: (titleEl ? titleEl.innerText : ariaLabel).trim(),
            rating: ratingEl ? parseFloat(ratingEl.innerText) : null,
            reviews: reviewsEl ? parseInt(reviewsEl.innerText.replace(/[(),]/g, '')) : null,
            link,
            textLines
          });
        }
      });
      return results;
    });

    console.log(`Found ${items.length} contractor items!`);
    if (items.length > 0) {
      console.log('Sample item 0:', JSON.stringify(items[0], null, 2));
    }
  } catch (err) {
    console.error('Error during scraping:', err.message);
  } finally {
    await browser.close();
  }
}

testMapsScraper();
