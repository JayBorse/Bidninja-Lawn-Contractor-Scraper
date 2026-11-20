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

function upsertLeads(newLeads) {
  const existing = getLeads();
  const map = new Map();
  
  // Existing leads indexed by phone or name+city
  for (const lead of existing) {
    const key = lead.phone ? lead.phone.replace(/\D/g, '') : `${lead.name}_${lead.city}`.toLowerCase();
    map.set(key, lead);
  }

  let addedCount = 0;
  let updatedCount = 0;

  for (const lead of newLeads) {
    const key = lead.phone ? lead.phone.replace(/\D/g, '') : `${lead.name}_${lead.city}`.toLowerCase();
    if (map.has(key)) {
      // Merge properties
      const prev = map.get(key);
      map.set(key, { ...prev, ...lead, id: prev.id, createdAt: prev.createdAt, updatedAt: new Date().toISOString() });
      updatedCount++;
    } else {
      map.set(key, {
        id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        status: 'New', // New, Contacted, Interested, Onboarded, Disqualified
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...lead
      });
      addedCount++;
    }
  }

  const result = Array.from(map.values());
  saveLeads(result);
  return { allLeads: result, addedCount, updatedCount };
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
  getSettings,
  saveSettings
};
