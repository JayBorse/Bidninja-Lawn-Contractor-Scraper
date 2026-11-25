const fs = require('fs');
const path = require('path');

const LEADS_FILE = path.join(__dirname, '../../data/leads.json');
const SETTINGS_FILE = path.join(__dirname, '../../data/settings.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(LEADS_FILE))) {
  fs.mkdirSync(path.dirname(LEADS_FILE), { recursive: true });
}

function getLeads() {
  try {
    if (!fs.existsSync(LEADS_FILE)) {
      fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(LEADS_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Error reading leads:', err.message);
    return [];
  }
}

function saveLeads(leads) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving leads:', err.message);
    return false;
  }
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|services|service|lawn care|landscaping)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getPhoneDigits(phone) {
  if (!phone || phone.toLowerCase().includes('request')) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function getDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'http://' + url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (['facebook.com', 'instagram.com', 'yelp.com', 'google.com', 'maps.google.com'].includes(host)) {
      return '';
    }
    return host;
  } catch (e) {
    return '';
  }
}

function getState(city) {
  if (!city) return '';
  const parts = city.split(',');
  return (parts[1] || parts[0]).trim().toLowerCase();
}

/**
 * Smart Multi-Index Deduplication:
 * Matches by Place Link, 10-digit Phone, Website Domain, or Normalized Name + State.
 * Merges richer details (higher reviews, real phone, physical address, website).
 */
function deduplicateListings(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  const phoneIndex = new Map();
  const domainIndex = new Map();
  const nameStateIndex = new Map();
  const linkIndex = new Map();

  for (const item of list) {
    if (!item || !item.name) continue;

    const phone = getPhoneDigits(item.phone);
    const domain = getDomain(item.website);
    const normName = normalizeName(item.name);
    const state = getState(item.city);
    const link = (item.mapsLink || '').trim();

    let existing = null;
    if (link && linkIndex.has(link)) {
      existing = linkIndex.get(link);
    } else if (phone && phoneIndex.has(phone)) {
      existing = phoneIndex.get(phone);
    } else if (domain && domainIndex.has(domain)) {
      existing = domainIndex.get(domain);
    } else if (normName && nameStateIndex.has(normName + ':' + state)) {
      existing = nameStateIndex.get(normName + ':' + state);
    }

    if (existing) {
      // Merge best properties
      if ((item.reviewCount || 0) > (existing.reviewCount || 0)) {
        existing.reviewCount = item.reviewCount;
        existing.rating = item.rating || existing.rating;
      }
      if ((!existing.phone || existing.phone.includes('request')) && item.phone && !item.phone.includes('request')) {
        existing.phone = item.phone;
      }
      if (!existing.website && item.website) {
        existing.website = item.website;
      }
      if (!existing.isExactCity && item.isExactCity) {
        existing.address = item.address;
        existing.isExactCity = true;
        existing.locationType = 'Physical Address';
      }
      if (!existing.enrichment && item.enrichment) {
        existing.enrichment = item.enrichment;
      }
      existing.updatedAt = new Date().toISOString();
    } else {
      result.push(item);
      if (link) linkIndex.set(link, item);
      if (phone) phoneIndex.set(phone, item);
      if (domain) domainIndex.set(domain, item);
      if (normName) nameStateIndex.set(normName + ':' + state, item);
    }
  }

  return result;
}

function upsertLeads(newLeads) {
  const existing = getLeads();
  const combined = [...existing, ...newLeads];
  const deduplicated = deduplicateListings(combined);

  // Assign clean IDs to any new records without an ID
  deduplicated.forEach((lead, idx) => {
    if (!lead.id) {
      lead.id = 'lead_' + Date.now() + '_' + idx;
    }
    if (!lead.status) {
      lead.status = 'New';
    }
    if (!lead.createdAt) {
      lead.createdAt = new Date().toISOString();
    }
  });

  saveLeads(deduplicated);
  return { allLeads: deduplicated, count: deduplicated.length };
}

function getLeadsForCity(city) {
  if (!city) return [];
  const cityLower = city.toLowerCase().trim();
  const leads = getLeads();

  const filtered = leads.filter(l => {
    const lCity = (l.city || '').toLowerCase();
    const lAddr = (l.address || '').toLowerCase();
    return (
      lCity.includes(cityLower) ||
      cityLower.includes(lCity.split(',')[0].trim().toLowerCase()) ||
      lAddr.includes(cityLower)
    );
  });

  return deduplicateListings(filtered);
}

function cleanDatabase() {
  const leads = getLeads();
  const before = leads.length;
  const cleaned = deduplicateListings(leads);
  saveLeads(cleaned);
  return { before, after: cleaned.length, removed: before - cleaned.length };
}

function updateLeadStatus(id, status, notes = '') {
  const leads = getLeads();
  const lead = leads.find(l => l.id === id);
  if (lead) {
    lead.status = status;
    if (notes) lead.notes = (lead.notes ? lead.notes + '\n' : '') + notes;
    lead.updatedAt = new Date().toISOString();
    saveLeads(leads);
    return lead;
  }
  return null;
}

/**
 * Persists website enrichment intel onto a contractor record
 */
function updateLeadEnrichment(id, enrichment, fallback = {}) {
  const leads = getLeads();
  let lead = id ? leads.find(l => l.id === id) : null;

  if (!lead && fallback.website) {
    lead = leads.find(l => l.website && l.website.toLowerCase() === fallback.website.toLowerCase());
  }
  if (!lead && fallback.name) {
    const normTarget = normalizeName(fallback.name);
    lead = leads.find(l => normalizeName(l.name) === normTarget);
  }

  if (lead) {
    lead.enrichment = enrichment;
    if (enrichment.emails && enrichment.emails.length > 0) {
      lead.email = enrichment.emails[0];
    }
    if (enrichment.ownerName) {
      lead.ownerName = enrichment.ownerName;
    }
    if (enrichment.services && enrichment.services.length > 0) {
      const existingServices = Array.isArray(lead.services) ? lead.services : [];
      lead.services = Array.from(new Set([...existingServices, ...enrichment.services]));
    }
    lead.updatedAt = new Date().toISOString();
    saveLeads(leads);
    return lead;
  }
  return null;
}

function getSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const defaultSettings = {
        defaultTargetCity: 'Dallas, TX',
        repName: 'Alex (Outreach Rep)'
      };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch (err) {
    return { defaultTargetCity: 'Dallas, TX', repName: 'Alex' };
  }
}

function saveSettings(settings) {
  try {
    const curr = getSettings();
    const updated = { ...curr, ...settings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
  } catch (err) {
    console.error('Error saving settings:', err.message);
    return null;
  }
}

module.exports = {
  getLeads,
  saveLeads,
  upsertLeads,
  updateLeadStatus,
  updateLeadEnrichment,
  getSettings,
  saveSettings,
  deduplicateListings,
  getLeadsForCity,
  cleanDatabase
};
