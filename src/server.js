const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./services/db');
const { scrapeGoogleMaps } = require('./services/puppeteerScraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Search endpoint using Puppeteer Google Maps Scraper
app.get('/api/search', async (req, res) => {
  try {
    const city = (req.query.city || '').trim();
    if (!city) {
      return res.json({
        success: true,
        city: '',
        count: 0,
        contractors: [],
        fromCache: true
      });
    }

    const forceRefresh = req.query.refresh === 'true';
    const cityLower = city.toLowerCase();

    // 1. Check local database cache for this city
    let existing = db.getLeads().filter(l => {
      const lCity = (l.city || '').toLowerCase();
      const lAddr = (l.address || '').toLowerCase();
      return (
        lCity.includes(cityLower) ||
        cityLower.includes(lCity.split(',')[0].trim().toLowerCase()) ||
        lAddr.includes(cityLower)
      );
    });

    // 2. CACHE HIT: If we have cached leads and forceRefresh is NOT requested
    if (!forceRefresh && existing.length > 0) {
      console.log(`[Cache Hit] Serving ${existing.length} leads for "${city}".`);
      return res.json({
        success: true,
        city,
        count: existing.length,
        contractors: existing,
        fromCache: true,
        engineUsed: 'puppeteer'
      });
    }

    // 3. ENGINE: PUPPETEER GOOGLE MAPS SCRAPER
    console.log(`[Puppeteer] Running headless Google Maps scrape for: "${city}" (forceRefresh: ${forceRefresh})...`);
    const scraped = await scrapeGoogleMaps(city, 8); // 8 scrolls = ~50-80 contractors

    // Tag every lead with source: 'scraper'
    const taggedScraped = scraped.map(c => ({
      ...c,
      source: 'scraper'
    }));

    if (taggedScraped.length > 0) {
      db.upsertLeads(taggedScraped);
      existing = taggedScraped;
    }

    res.json({
      success: true,
      city,
      count: existing.length,
      contractors: existing,
      fromCache: false,
      engineUsed: 'puppeteer'
    });

  } catch (err) {
    console.error('[API] Search error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🥷 BidNinja Puppeteer Scraper running on http://localhost:${PORT}`);
});
