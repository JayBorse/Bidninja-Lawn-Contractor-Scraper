const puppeteer = require('puppeteer-core');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function testScrollMaps() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=en-US,en']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigating to Dallas lawn care on Google Maps...');
    await page.goto('https://www.google.com/maps/search/lawn+care+in+Dallas+TX', { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('div[role="feed"]', { timeout: 10000 });

    console.log('Scrolling feed to load more contractors...');
    // Scroll the feed element several times
    await page.evaluate(async () => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return;
      for (let i = 0; i < 6; i++) {
        feed.scrollTop = feed.scrollHeight;
        await new Promise(r => setTimeout(r, 1200));
      }
    });

    // Extract all items
    const contractors = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll('div.Nv2PK');

      cards.forEach(card => {
        const titleEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
        const ratingEl = card.querySelector('.MW4etd');
        const reviewsEl = card.querySelector('.UY7F9');
        const linkEl = card.querySelector('a.hfpxzc');
        const link = linkEl ? linkEl.getAttribute('href') : '';
        const name = (titleEl ? titleEl.innerText : (linkEl ? linkEl.getAttribute('aria-label') : '')).trim();

        if (!name) return;

        // Extract phone number from text lines
        const cardText = card.innerText || '';
        const phoneMatch = cardText.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : '';

        // Extract website button if present
        const websiteEl = card.querySelector('a[data-value="Website"], a[aria-label*="website" i]');
        const website = websiteEl ? websiteEl.getAttribute('href') : '';

        // Address lines
        const lines = Array.from(card.querySelectorAll('.W4Efsd')).map(e => e.innerText.trim()).filter(Boolean);
        const address = lines.length > 1 ? lines[1].split('·')[0].trim() : '';

        results.push({
          name,
          rating: ratingEl ? parseFloat(ratingEl.innerText) : 4.5,
          reviews: reviewsEl ? parseInt(reviewsEl.innerText.replace(/[(),]/g, '')) : 0,
          phone,
          website,
          address,
          link
        });
      });
      return results;
    });

    console.log(`Successfully scraped ${contractors.length} contractors from Dallas!`);
    contractors.slice(0, 5).forEach((c, i) => {
      console.log(`[${i+1}] ${c.name} | Rating: ${c.rating}★ (${c.reviews}) | Phone: ${c.phone || 'N/A'}`);
    });
  } catch (err) {
    console.error('Scrape error:', err.message);
  } finally {
    await browser.close();
  }
}

testScrollMaps();
