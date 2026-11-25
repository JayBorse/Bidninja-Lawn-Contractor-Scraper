const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./services/db');
const { scrapeGoogleMaps } = require('./services/puppeteerScraper');
const { enrichContractorWebsite } = require('./services/siteEnricher');

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

    // 1. Check local database cache for this city (strictly deduplicated)
    let existing = db.getLeadsForCity(city);

    // 2. CACHE HIT: If we have cached leads and forceRefresh is NOT requested
    if (!forceRefresh && existing.length > 0) {
      console.log(`[Cache Hit] Serving ${existing.length} deduplicated leads for "${city}".`);
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
    }

    // Return clean, deduplicated listings for the requested city
    existing = db.getLeadsForCity(city);

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

// On-demand website intel enrichment endpoint for a single contractor
app.post('/api/enrich', async (req, res) => {
  try {
    const { id, website, name, city } = req.body || {};
    if (!website) {
      return res.json({ success: false, error: 'No website URL provided for this contractor.' });
    }

    console.log(`[Enrich] Scouting website for "${name || 'Contractor'}": ${website}`);
    const result = await enrichContractorWebsite(website, { name, city });

    if (!result.success) {
      return res.json(result);
    }

    const updatedLead = db.updateLeadEnrichment(id, result.enrichment, { website, name });

    res.json({
      success: true,
      enrichment: result.enrichment,
      contractor: updatedLead || null
    });
  } catch (err) {
    console.error('[API] Enrich error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🥷 BidNinja Puppeteer Scraper running on http://localhost:${PORT}`);
});
