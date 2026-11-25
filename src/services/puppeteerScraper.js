const puppeteer = require('puppeteer-core');

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH 
  || (process.platform === 'darwin' 
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
      : '/usr/bin/google-chrome-stable' || '/usr/bin/chromium-browser');

const FRANCHISE_NAMES = [
  'trugreen', 'lawn doctor', 'the grounds guys', 'brightview',
  'weed man', 'u.s. lawns', 'davey tree', 'scotts miracle-gro',
  'yellowstone landscape', 'bartlett tree', 'lawnstarter'
];

function isFranchise(name = '') {
  const lower = name.toLowerCase();
  return FRANCHISE_NAMES.some(f => lower.includes(f));
}

/**
 * Scrapes Google Maps for lawn care contractors in a given city/area
 * @param {string} city - e.g. "Dallas, TX", "Frisco, TX", "Great Falls, VA"
 * @param {number} scrollCount - how many times to scroll (default 7 = ~40-70 contractors)
 */
async function scrapeGoogleMaps(city = 'Dallas, TX', scrollCount = 7) {
  console.log(`[Puppeteer] Starting Google Maps scrape for: "${city}"...`);

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
    await page.setViewport({ width: 1280, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const query = encodeURIComponent(`lawn care in ${city}`);
    const searchUrl = `https://www.google.com/maps/search/${query}`;
    console.log(`[Puppeteer] Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    // Wait for listings feed to appear
    await page.waitForSelector('div[role="feed"]', { timeout: 12000 }).catch(() => {
      console.log('[Puppeteer] Feed container wait timed out, proceeding with available DOM');
    });

    // Auto-scroll the feed to load more contractors
    await page.evaluate(async (maxScrolls) => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return;
      for (let i = 0; i < maxScrolls; i++) {
        feed.scrollTop = feed.scrollHeight;
        await new Promise(r => setTimeout(r, 1200));
      }
    }, scrollCount);

    // Extract all contractor cards
    const rawListings = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const cards = document.querySelectorAll('div.Nv2PK');

      cards.forEach(card => {
        const titleEl = card.querySelector('.qBF1Pd, .fontHeadlineSmall');
        const ratingEl = card.querySelector('.MW4etd');
        const reviewsEl = card.querySelector('.UY7F9');
        const linkEl = card.querySelector('a.hfpxzc');
        const link = linkEl ? linkEl.getAttribute('href') : '';
        const name = (titleEl ? titleEl.innerText : (linkEl ? linkEl.getAttribute('aria-label') : '')).trim();

        if (!name) return;

        // Extract phone number from card text
        const cardText = card.innerText || '';
        const phoneMatch = cardText.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : '';

        // Extract website button if present
        const websiteEl = card.querySelector('a[data-value="Website"], a[aria-label*="website" i]');
        let website = websiteEl ? websiteEl.getAttribute('href') : '';

        // Extract address / text details
        const lines = Array.from(card.querySelectorAll('.W4Efsd')).map(e => e.innerText.trim()).filter(Boolean);
        let address = '';
        for (const l of lines) {
          if (l.includes('·') && !l.includes('Open') && !l.includes('Closed')) {
            address = l.replace(/Lawn care service|Landscaper|Tree service/gi, '')
                       .replace(/[\uE000-\uF8FF]/g, '')
                       .replace(/[·\n]/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
            break;
          }
        }

        // In-feed deduplication by Place Link or clean Name + Phone
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const phoneDigits = phone.replace(/\D/g, '');
        const dedupeKey = link || (phoneDigits.length >= 10 ? phoneDigits : cleanName);
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        results.push({
          name,
          rating: ratingEl ? parseFloat(ratingEl.innerText) : 4.5,
          reviewCount: reviewsEl ? parseInt(reviewsEl.innerText.replace(/[(),]/g, '')) : 0,
          phone,
          website,
          address,
          mapsLink: link
        });
      });

      return results;
    });

    console.log(`[Puppeteer] Scraped ${rawListings.length} raw listings from Google Maps for ${city}.`);

    // Clean, format, and assign IDs
    const rawContractors = rawListings.map((c, idx) => {
      const fran = isFranchise(c.name);
      const rawAddr = c.address ? c.address.replace(/[\uE000-\uF8FF]/g, '').replace(/[·\n]/g, ' ').replace(/\s+/g, ' ').trim() : '';
      const hasStreet = /\d+\s+[A-Za-z]+/.test(rawAddr);
      const isExactCity = hasStreet;

      let formattedAddress = '';
      if (hasStreet) {
        formattedAddress = `${rawAddr}, ${city}`;
      } else {
        formattedAddress = `Serving ${city} & surrounding areas`;
      }

      return {
        id: `pro_${Date.now()}_${idx}`,
        name: c.name,
        ownerName: fran ? 'Branch Dispatch' : `Owner (${c.name.split(' ')[0]})`,
        phone: c.phone || 'Phone upon request',
        email: `contact@${c.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}.com`,
        website: c.website || '',
        address: formattedAddress,
        city: city,
        isExactCity: isExactCity,
        locationType: isExactCity ? 'Physical Address' : 'Service Area',
        rating: c.rating || 4.5,
        reviewCount: c.reviewCount || 0,
        isFranchise: fran,
        crewType: fran ? 'National Franchise' : (c.reviewCount > 150 ? 'Large Local Fleet' : 'Independent Crew'),
        services: ['Lawn Mowing & Edging', 'Yard Cleanup', 'Weed Control'],
        mapsLink: c.mapsLink,
        source: 'scraper',
        scrapedAt: new Date().toISOString()
      };
    });

    // Secondary post-processing deduplication pass
    const contractors = [];
    const seenNames = new Set();
    const seenPhones = new Set();

    for (const item of rawContractors) {
      const normName = item.name.toLowerCase().replace(/\b(llc|inc|corp|co|ltd|services|service)\b/gi, '').replace(/[^a-z0-9]/g, '');
      const phoneDigits = item.phone.replace(/\D/g, '');
      const validPhone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : '';

      if (validPhone && seenPhones.has(validPhone)) continue;
      if (normName && seenNames.has(normName)) continue;

      if (validPhone) seenPhones.add(validPhone);
      if (normName) seenNames.add(normName);
      contractors.push(item);
    }

    return contractors;
  } catch (err) {
    console.error(`[Puppeteer] Error during scrape:`, err.message);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = {
  scrapeGoogleMaps,
  isFranchise
};
