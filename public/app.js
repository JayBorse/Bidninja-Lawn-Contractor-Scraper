// Minimal Professional Contractor Directory - Puppeteer Scraper Frontend

let currentContractors = [];
let selectedContractor = null;
let activeSuggestionIndex = -1;
let currentSuggestions = [];

// Sorting State: { column: 'rating' | 'reviews' | null, direction: 'asc' | 'desc' | 'none' }
let currentSort = { column: null, direction: 'none' };

// Location Filter State: 'all' | 'exact'
let locationFilter = 'all';

// DOM Elements
const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const suggestionsDropdown = document.getElementById('suggestionsDropdown');
const btnSearch = document.getElementById('btnSearch');
const btnText = document.getElementById('btnText');
const btnReScrape = document.getElementById('btnReScrape');
const btnExportExcel = document.getElementById('btnExportExcel');

const initialState = document.getElementById('initialState');
const resultsHeaderBar = document.getElementById('resultsHeaderBar');
const currentCityLabel = document.getElementById('currentCityLabel');
const resultsEngineBadge = document.getElementById('resultsEngineBadge');
const cacheIndicatorBadge = document.getElementById('cacheIndicatorBadge');
const resultsCount = document.getElementById('resultsCount');
const tableWrapper = document.getElementById('tableWrapper');
const contractorsTableBody = document.getElementById('contractorsTableBody');
const emptyState = document.getElementById('emptyState');
const emptyStateTitle = document.getElementById('emptyStateTitle');
const emptyStateDesc = document.getElementById('emptyStateDesc');
const loadingBox = document.getElementById('loadingBox');
const loadingText = document.getElementById('loadingText');

// Location Filter Elements
const filterAllArea = document.getElementById('filterAllArea');
const filterExactCity = document.getElementById('filterExactCity');
const countAllArea = document.getElementById('countAllArea');
const countExactCity = document.getElementById('countExactCity');

// Sort Headers & Icons
const sortRatingHeader = document.getElementById('sortRatingHeader');
const sortRatingIcon = document.getElementById('sortRatingIcon');
const sortReviewsHeader = document.getElementById('sortReviewsHeader');
const sortReviewsIcon = document.getElementById('sortReviewsIcon');

// Modal Elements
const infoModal = document.getElementById('infoModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnModalClose2 = document.getElementById('btnModalClose2');

const detailBusinessName = document.getElementById('detailBusinessName');
const detailRatingBadge = document.getElementById('detailRatingBadge');
const detailTag = document.getElementById('detailTag');
const detailPhone = document.getElementById('detailPhone');
const detailWebsite = document.getElementById('detailWebsite');
const detailAddress = document.getElementById('detailAddress');
const detailServices = document.getElementById('detailServices');
const detailMapsLink = document.getElementById('detailMapsLink');
const detailSource = document.getElementById('detailSource');

const btnCopyPhone = document.getElementById('btnCopyPhone');

// Enrichment Modal Elements
const btnEnrichLead = document.getElementById('btnEnrichLead');
const enrichBtnIcon = document.getElementById('enrichBtnIcon');
const enrichBtnText = document.getElementById('enrichBtnText');
const enrichSection = document.getElementById('enrichSection');
const enrichLoading = document.getElementById('enrichLoading');
const enrichError = document.getElementById('enrichError');
const enrichResult = document.getElementById('enrichResult');
const enrichMeta = document.getElementById('enrichMeta');
const enrichOwner = document.getElementById('enrichOwner');
const enrichExperience = document.getElementById('enrichExperience');
const enrichEmails = document.getElementById('enrichEmails');
const btnCopyEmail = document.getElementById('btnCopyEmail');
const enrichCrewBox = document.getElementById('enrichCrewBox');
const enrichCrewSignals = document.getElementById('enrichCrewSignals');
const enrichHook = document.getElementById('enrichHook');
const btnCopyHook = document.getElementById('btnCopyHook');
const enrichSummaryBox = document.getElementById('enrichSummaryBox');
const enrichSummary = document.getElementById('enrichSummary');
const enrichSocials = document.getElementById('enrichSocials');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  setupAutocomplete();
  setupSorting();
  setupLocationFilter();
  setupQuickSearchButtons();
  
  // Show clean initial state on page open / refresh (do not load any default city)
  showInitialState();
});

// --- State Management ---
function showInitialState() {
  if (initialState) initialState.classList.remove('hidden');
  if (resultsHeaderBar) resultsHeaderBar.classList.add('hidden');
  if (tableWrapper) tableWrapper.classList.add('hidden');
  if (emptyState) emptyState.classList.add('hidden');
  if (loadingBox) loadingBox.classList.add('hidden');
  if (cityInput) cityInput.value = '';
  currentContractors = [];
}

function setupQuickSearchButtons() {
  document.querySelectorAll('.quick-city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const city = btn.dataset.city;
      if (city) {
        cityInput.value = city;
        searchContractors(city, false);
      }
    });
  });
}

// --- Browser-Level Cache Utilities ---
function getClientCache(city) {
  try {
    const key = `bn_cache_${city.toLowerCase().trim()}`;
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setClientCache(city, data) {
  try {
    const key = `bn_cache_${city.toLowerCase().trim()}`;
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

function clearClientCache(city) {
  try {
    if (city) {
      const clean = city.toLowerCase().trim();
      sessionStorage.removeItem(`bn_cache_${clean}`);
    } else {
      sessionStorage.clear();
    }
  } catch (e) {}
}

function setupEvents() {
  // Search Form
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideSuggestions();
    const city = cityInput.value.trim();
    if (city) {
      searchContractors(city, false);
    }
  });

  // Re-scrape / Refresh button (Bypasses cache for current engine and forces a fresh query)
  btnReScrape.addEventListener('click', () => {
    const city = cityInput.value.trim() || currentCityLabel.innerText.trim();
    if (city && city !== '—') {
      clearClientCache(city);
      searchContractors(city, true);
    }
  });

  // Export to Excel button
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', exportToExcel);
  }

  // Close Contractor Modal
  btnCloseModal.addEventListener('click', () => infoModal.classList.add('hidden'));
  btnModalClose2.addEventListener('click', () => infoModal.classList.add('hidden'));
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) infoModal.classList.add('hidden');
  });

  // Copy phone button
  btnCopyPhone.addEventListener('click', () => {
    const text = detailPhone.innerText.trim();
    if (text) copyToClipboard(text, btnCopyPhone);
  });

  // On-demand Website Intel Scout button
  if (btnEnrichLead) {
    btnEnrichLead.addEventListener('click', () => {
      enrichSelectedContractor();
    });
  }

  if (btnCopyEmail) {
    btnCopyEmail.addEventListener('click', () => {
      const emailText = enrichEmails.dataset.primaryEmail || '';
      if (emailText) copyToClipboard(emailText, btnCopyEmail);
    });
  }

  if (btnCopyHook) {
    btnCopyHook.addEventListener('click', () => {
      const hookText = enrichHook.innerText.trim();
      if (hookText) copyToClipboard(hookText, btnCopyHook);
    });
  }
}

// --- Location Filter Setup (All vs Exact City) ---
function setupLocationFilter() {
  filterAllArea.addEventListener('click', () => {
    locationFilter = 'all';
    updateFilterButtons();
    renderContractors(currentCityLabel.innerText);
  });

  filterExactCity.addEventListener('click', () => {
    locationFilter = 'exact';
    updateFilterButtons();
    renderContractors(currentCityLabel.innerText);
  });
}

function updateFilterButtons() {
  if (locationFilter === 'all') {
    filterAllArea.className = 'px-3 py-1 rounded-md font-medium text-zinc-900 bg-white shadow-sm transition-all';
    filterExactCity.className = 'px-3 py-1 rounded-md font-medium text-zinc-500 hover:text-zinc-900 bg-transparent transition-all';
  } else {
    filterAllArea.className = 'px-3 py-1 rounded-md font-medium text-zinc-500 hover:text-zinc-900 bg-transparent transition-all';
    filterExactCity.className = 'px-3 py-1 rounded-md font-medium text-zinc-900 bg-white shadow-sm transition-all';
  }
}

// --- Sorting Setup (Rating & Reviews Count) ---
function setupSorting() {
  sortRatingHeader.addEventListener('click', () => {
    if (currentSort.column === 'rating') {
      currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
      currentSort.column = 'rating';
      currentSort.direction = 'desc';
    }
    updateSortIcons();
    renderContractors(currentCityLabel.innerText);
  });

  sortReviewsHeader.addEventListener('click', () => {
    if (currentSort.column === 'reviews') {
      currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
    } else {
      currentSort.column = 'reviews';
      currentSort.direction = 'desc';
    }
    updateSortIcons();
    renderContractors(currentCityLabel.innerText);
  });
}

function updateSortIcons() {
  if (currentSort.column === 'rating') {
    sortRatingIcon.innerText = currentSort.direction === 'desc' ? '↓' : '↑';
    sortRatingIcon.className = 'text-zinc-900 font-bold text-xs';
  } else {
    sortRatingIcon.innerText = '↕';
    sortRatingIcon.className = 'text-zinc-400 font-mono text-xs';
  }

  if (currentSort.column === 'reviews') {
    sortReviewsIcon.innerText = currentSort.direction === 'desc' ? '↓' : '↑';
    sortReviewsIcon.className = 'text-zinc-900 font-bold text-xs';
  } else {
    sortReviewsIcon.innerText = '↕';
    sortReviewsIcon.className = 'text-zinc-400 font-mono text-xs';
  }
}

// --- Autocomplete Setup ---
function setupAutocomplete() {
  const cities = window.US_CITIES || [];

  cityInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query || query.length < 1) {
      hideSuggestions();
      return;
    }

    const matched = cities.filter(item => {
      const c = item.city.toLowerCase();
      const s = item.state.toLowerCase();
      const code = item.code.toLowerCase();
      return c.includes(query) || s.includes(query) || code === query;
    });

    matched.sort((a, b) => {
      const aStarts = a.city.toLowerCase().startsWith(query);
      const bStarts = b.city.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.city.localeCompare(b.city);
    });

    currentSuggestions = matched.slice(0, 8);
    activeSuggestionIndex = -1;
    renderSuggestions(currentSuggestions, query);
  });

  cityInput.addEventListener('keydown', (e) => {
    if (suggestionsDropdown.classList.contains('hidden') || currentSuggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
      updateActiveSuggestion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
      updateActiveSuggestion();
    } else if (e.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestions.length) {
        e.preventDefault();
        selectCitySuggestion(currentSuggestions[activeSuggestionIndex]);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
      hideSuggestions();
    }
  });
}

function renderSuggestions(suggestions, query) {
  if (suggestions.length === 0) {
    hideSuggestions();
    return;
  }

  suggestionsDropdown.innerHTML = suggestions.map((item, index) => {
    const cityHighlighted = highlightMatch(item.city, query);
    const stateHighlighted = highlightMatch(item.state, query);

    return `
      <div 
        class="suggestion-item px-4 py-2.5 hover:bg-zinc-50 cursor-pointer flex items-center justify-between text-xs transition-colors select-none ${index === activeSuggestionIndex ? 'bg-zinc-100 text-zinc-900 font-medium' : 'text-zinc-700'}"
        data-index="${index}"
      >
        <div class="flex items-center gap-2">
          <span class="text-zinc-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </span>
          <div>
            <span class="font-semibold text-zinc-900">${cityHighlighted}</span>, 
            <span class="text-zinc-500">${stateHighlighted}</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono text-[10px] font-semibold border border-zinc-200">
          ${item.code}
        </span>
      </div>
    `;
  }).join('');

  suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      selectCitySuggestion(suggestions[idx]);
    });
  });

  suggestionsDropdown.classList.remove('hidden');
}

function updateActiveSuggestion() {
  const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
  items.forEach((item, idx) => {
    if (idx === activeSuggestionIndex) {
      item.classList.add('bg-zinc-100', 'text-zinc-900');
    } else {
      item.classList.remove('bg-zinc-100', 'text-zinc-900');
    }
  });
}

function selectCitySuggestion(item) {
  const formatted = `${item.city}, ${item.code}`;
  cityInput.value = formatted;
  hideSuggestions();
  searchContractors(formatted, false);
}

function hideSuggestions() {
  suggestionsDropdown.classList.add('hidden');
  activeSuggestionIndex = -1;
  currentSuggestions = [];
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return escapeHtml(text);
  const before = escapeHtml(text.slice(0, idx));
  const match = escapeHtml(text.slice(idx, idx + query.length));
  const after = escapeHtml(text.slice(idx + query.length));
  return `${before}<span class="text-zinc-950 font-bold underline underline-offset-2">${match}</span>${after}`;
}

// --- Client-Side Robust Deduplication ---
function deduplicateContractors(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  const seenPhone = new Set();
  const seenDomain = new Set();
  const seenName = new Set();
  const seenLink = new Set();

  for (const c of list) {
    if (!c || !c.name) continue;

    const normName = (c.name || '').toLowerCase()
      .replace(/\b(llc|inc|corp|co|ltd|services|service|lawn care|landscaping)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    const phoneDigits = (c.phone || '').replace(/\D/g, '');
    const validPhone = (!c.phone || c.phone.toLowerCase().includes('request') || phoneDigits.length < 10)
      ? ''
      : phoneDigits.slice(-10);

    let domain = '';
    if (c.website) {
      try {
        const u = new URL(c.website.startsWith('http') ? c.website : 'http://' + c.website);
        const host = u.hostname.replace(/^www\./, '').toLowerCase();
        if (!['facebook.com', 'instagram.com', 'yelp.com', 'google.com'].includes(host)) {
          domain = host;
        }
      } catch (e) {}
    }

    const mapsLink = (c.mapsLink || '').trim();

    let isDupe = false;
    if (mapsLink && seenLink.has(mapsLink)) isDupe = true;
    else if (validPhone && seenPhone.has(validPhone)) isDupe = true;
    else if (domain && seenDomain.has(domain)) isDupe = true;
    else if (normName && seenName.has(normName)) isDupe = true;

    if (isDupe) continue;

    if (mapsLink) seenLink.add(mapsLink);
    if (validPhone) seenPhone.add(validPhone);
    if (domain) seenDomain.add(domain);
    if (normName) seenName.add(normName);
    result.push(c);
  }

  return result;
}

// --- Search / Scrape Function ---
async function searchContractors(city, forceRefresh = false) {
  if (!city || !city.trim()) {
    showInitialState();
    return;
  }

  city = city.trim();
  currentCityLabel.innerText = city;
  resultsCount.innerText = 'Searching Google Maps in real-time...';

  // Reveal UI sections
  if (initialState) initialState.classList.add('hidden');
  if (resultsHeaderBar) resultsHeaderBar.classList.remove('hidden');

  // 1. Check Browser-Level Cache
  if (!forceRefresh) {
    const cached = getClientCache(city);
    if (cached && Array.isArray(cached.contractors) && cached.contractors.length > 0) {
      console.log(`[Browser Cache Hit] Loaded ${cached.contractors.length} contractors for "${city}"`);
      currentContractors = deduplicateContractors(cached.contractors);
      if (cacheIndicatorBadge) cacheIndicatorBadge.classList.remove('hidden');
      renderContractors(city);
      return;
    }
  }

  // 2. Query Server for Puppeteer Scraper dataset
  setLoading(true);

  try {
    const url = `/api/search?city=${encodeURIComponent(city)}${forceRefresh ? '&refresh=true' : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    // Cache Indicator Badge
    if (cacheIndicatorBadge) {
      if (data.fromCache) {
        cacheIndicatorBadge.classList.remove('hidden');
      } else {
        cacheIndicatorBadge.classList.add('hidden');
      }
    }

    if (data.success && data.contractors) {
      currentContractors = deduplicateContractors(data.contractors);
      setClientCache(city, { ...data, contractors: currentContractors, count: currentContractors.length });
      renderContractors(city);
    } else {
      currentContractors = [];
      renderContractors(city);
    }
  } catch (err) {
    console.error('Search error:', err);
    currentContractors = [];
    renderContractors(city);
  } finally {
    setLoading(false);
  }
}

// --- Render Contractors Table Rows with Sorting & Exact Filter ---
function renderContractors(city) {
  // Always filter and display clean deduplicated listings
  currentContractors = deduplicateContractors(currentContractors);
  const totalCount = currentContractors.length;
  const exactCount = currentContractors.filter(c => c.isExactCity).length;

  countAllArea.innerText = totalCount;
  countExactCity.innerText = exactCount;

  // Filter list by Location toggle
  let list = [...currentContractors];
  if (locationFilter === 'exact') {
    list = list.filter(c => c.isExactCity);
  }

  resultsCount.innerText = `${list.length} ${locationFilter === 'exact' ? 'physical businesses located in' : 'contractors serving'} ${city}`;

  if (list.length === 0) {
    contractorsTableBody.innerHTML = '';
    tableWrapper.classList.add('hidden');

    emptyStateTitle.innerText = `No contractors found for ${city}`;
    emptyStateDesc.innerText = 'Try searching another city or clicking "Refresh Data" to scrape Google Maps live.';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tableWrapper.classList.remove('hidden');

  // Apply sorting if active
  if (currentSort.column === 'rating' && currentSort.direction !== 'none') {
    list.sort((a, b) => {
      const valA = parseFloat(a.rating) || 0;
      const valB = parseFloat(b.rating) || 0;
      return currentSort.direction === 'asc' ? valA - valB : valB - valA;
    });
  } else if (currentSort.column === 'reviews' && currentSort.direction !== 'none') {
    list.sort((a, b) => {
      const valA = parseInt(a.reviewCount) || 0;
      const valB = parseInt(b.reviewCount) || 0;
      return currentSort.direction === 'asc' ? valA - valB : valB - valA;
    });
  }

  contractorsTableBody.innerHTML = list.map((c, index) => {
    const rating = c.rating ? parseFloat(c.rating).toFixed(1) : '4.5';
    const reviews = parseInt(c.reviewCount) || 0;
    const phone = c.phone || '—';
    const address = c.address || c.city || city;
    const isFran = c.isFranchise;
    const isExact = c.isExactCity;
    const mapsUrl = c.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + (c.address || c.city || ''))}`;

    return `
      <tr 
        class="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
        onclick="openContractorModalDirect('${c.id || index}')"
      >
        <!-- Business Name -->
        <td class="py-3 px-4">
          <div class="flex items-center gap-1.5">
            <span class="font-medium text-zinc-950 group-hover:text-black transition-colors leading-snug">
              ${escapeHtml(c.name)}
            </span>
            <a 
              href="${mapsUrl}" 
              target="_blank" 
              onclick="event.stopPropagation()" 
              title="Open profile in Google Maps" 
              class="text-zinc-400 hover:text-emerald-700 transition-colors inline-flex items-center p-0.5 rounded hover:bg-zinc-200/60"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>
          </div>
          <div class="text-[11px] ${isExact ? 'text-emerald-700 font-medium' : 'text-zinc-400'} mt-0.5">
            ${isExact ? '📍 Physical Location' : 'Mobile / Service Area'}
          </div>
        </td>

        <!-- Rating -->
        <td class="py-3 px-4 whitespace-nowrap">
          <div class="inline-flex items-center gap-1 font-semibold text-zinc-900">
            <span class="text-amber-500">★</span>
            <span>${rating}</span>
          </div>
        </td>

        <!-- Review Count -->
        <td class="py-3 px-4 whitespace-nowrap font-mono text-zinc-700 font-medium">
          ${reviews.toLocaleString()}
        </td>

        <!-- Phone -->
        <td class="py-3 px-4 whitespace-nowrap font-mono text-zinc-800">
          ${phone !== '—' ? `
            <a href="tel:${phone}" onclick="event.stopPropagation()" class="hover:underline hover:text-zinc-950">
              ${phone}
            </a>
          ` : '<span class="text-zinc-400">—</span>'}
        </td>

        <!-- Location -->
        <td class="py-3 px-4 max-w-[200px] truncate text-zinc-600" title="${escapeHtml(address)}">
          ${escapeHtml(address)}
        </td>

        <!-- Type -->
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[11px] font-medium border ${isFran ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}">
            ${isFran ? 'Franchise' : 'Independent'}
          </span>
        </td>

        <!-- Action -->
        <td class="py-3 px-4 text-right whitespace-nowrap">
          <div class="inline-flex items-center justify-end gap-1.5">
            ${c.website ? (
              c.enrichment ? `
                <button
                  type="button"
                  onclick="event.stopPropagation(); openContractorModalDirect('${c.id || index}')"
                  title="Website intel cached — click to view"
                  class="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors"
                >
                  ✓ Intel
                </button>
              ` : `
                <button
                  type="button"
                  onclick="event.stopPropagation(); scoutContractorFromRow('${c.id || index}')"
                  title="Visit website to extract email, owner & crew info"
                  class="px-2 py-1 text-[11px] font-medium bg-zinc-900 hover:bg-zinc-700 text-white rounded transition-colors"
                >
                  ⚡ Scout
                </button>
              `
            ) : ''}
            <button 
              type="button" 
              class="px-2.5 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
            >
              Details →
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Global modal trigger
window.openContractorModalDirect = function(id) {
  const contractor = currentContractors.find((c, idx) => c.id === id || String(idx) === String(id));
  if (contractor) openContractorModal(contractor);
};

// Trigger website scout directly from table row
window.scoutContractorFromRow = function(id) {
  const contractor = currentContractors.find((c, idx) => c.id === id || String(idx) === String(id));
  if (contractor) {
    openContractorModal(contractor);
    enrichSelectedContractor();
  }
};

// --- Contractor Details Modal Logic ---
function openContractorModal(c) {
  selectedContractor = c;

  detailBusinessName.innerText = c.name || 'Contractor';
  
  const rating = c.rating ? parseFloat(c.rating).toFixed(1) : '4.5';
  const reviews = parseInt(c.reviewCount) || 0;
  detailRatingBadge.innerHTML = `<span class="text-amber-500">★</span> ${rating} (${reviews.toLocaleString()} reviews)`;
  
  detailTag.innerText = c.isFranchise ? 'National Franchise' : 'Independent Contractor';
  detailPhone.innerText = c.phone || 'No phone listed';
  
  const hasWebsite = Boolean(c.website && c.website !== '#' && c.website.startsWith('http'));
  if (hasWebsite) {
    detailWebsite.href = c.website;
    detailWebsite.innerText = c.website;
    detailWebsite.classList.remove('text-zinc-400', 'pointer-events-none');
    if (btnEnrichLead) btnEnrichLead.disabled = false;
  } else {
    detailWebsite.href = '#';
    detailWebsite.innerText = 'No website listed';
    detailWebsite.classList.add('text-zinc-400', 'pointer-events-none');
    if (btnEnrichLead) btnEnrichLead.disabled = true;
  }

  detailAddress.innerText = c.address || c.city || 'Address unavailable';

  const mapsUrl = c.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + (c.address || c.city || ''))}`;
  detailMapsLink.href = mapsUrl;

  // Extraction source
  if (detailSource) {
    detailSource.innerText = 'Google Maps (Puppeteer Scraper)';
  }

  const baseServices = Array.isArray(c.services) ? c.services : ['Lawn Mowing', 'Yard Cleanups', 'Edging'];
  const extraServices = (c.enrichment && Array.isArray(c.enrichment.services)) ? c.enrichment.services : [];
  const mergedServices = Array.from(new Set([...baseServices, ...extraServices]));

  detailServices.innerHTML = mergedServices.map(s => `
    <span class="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 text-[11px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      ${escapeHtml(s)}
    </span>
  `).join('');

  // Render cached enrichment if present, otherwise reset panel
  resetEnrichUI(hasWebsite);
  if (c.enrichment) {
    renderEnrichmentResult(c.enrichment);
  }

  infoModal.classList.remove('hidden');
}

function resetEnrichUI(hasWebsite) {
  if (!enrichSection) return;
  enrichSection.classList.add('hidden');
  enrichLoading.classList.add('hidden');
  enrichError.classList.add('hidden');
  enrichResult.classList.add('hidden');
  if (enrichBtnIcon) enrichBtnIcon.innerText = '⚡';
  if (enrichBtnText) enrichBtnText.innerText = hasWebsite ? 'Scout Website Intel' : 'No Website';
}

function renderEnrichmentResult(intel) {
  if (!intel || !enrichSection) return;
  enrichSection.classList.remove('hidden');
  enrichLoading.classList.add('hidden');
  enrichError.classList.add('hidden');
  enrichResult.classList.remove('hidden');

  if (enrichBtnIcon) enrichBtnIcon.innerText = '↻';
  if (enrichBtnText) enrichBtnText.innerText = 'Refresh Intel';

  const pagesCount = Array.isArray(intel.pagesScanned) ? intel.pagesScanned.length : 1;
  enrichMeta.innerText = `${pagesCount} page${pagesCount === 1 ? '' : 's'} scanned`;

  enrichOwner.innerText = intel.ownerName || 'Not listed on site';
  enrichExperience.innerText = intel.experience || 'Not specified';

  const emails = Array.isArray(intel.emails) ? intel.emails : [];
  if (emails.length > 0) {
    enrichEmails.innerText = emails.join(', ');
    enrichEmails.dataset.primaryEmail = emails[0];
    btnCopyEmail.classList.remove('hidden');
  } else {
    enrichEmails.innerText = 'No public email found (uses contact form)';
    enrichEmails.dataset.primaryEmail = '';
    btnCopyEmail.classList.add('hidden');
  }

  const crewSignals = Array.isArray(intel.crewSignals) ? intel.crewSignals : [];
  if (crewSignals.length > 0) {
    enrichCrewBox.classList.remove('hidden');
    enrichCrewSignals.innerHTML = crewSignals.map(sig => `
      <span class="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
        ${escapeHtml(sig)}
      </span>
    `).join('');
  } else {
    enrichCrewBox.classList.add('hidden');
  }

  enrichHook.innerText = intel.preCallHook || '';

  if (intel.summary) {
    enrichSummaryBox.classList.remove('hidden');
    enrichSummary.innerText = intel.summary;
  } else {
    enrichSummaryBox.classList.add('hidden');
  }

  const socials = intel.socials || {};
  const socialLinks = Object.entries(socials).filter(([, url]) => Boolean(url));
  if (socialLinks.length > 0) {
    enrichSocials.classList.remove('hidden');
    enrichSocials.innerHTML = socialLinks.map(([platform, url]) => `
      <a href="${escapeHtml(url)}" target="_blank" class="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:border-zinc-300 text-[11px] font-medium capitalize transition-colors">
        ${escapeHtml(platform)} ↗
      </a>
    `).join('');
  } else {
    enrichSocials.classList.add('hidden');
  }
}

async function enrichSelectedContractor() {
  if (!selectedContractor || !selectedContractor.website) return;

  const target = selectedContractor;
  btnEnrichLead.disabled = true;
  if (enrichBtnIcon) enrichBtnIcon.innerText = '⏳';
  if (enrichBtnText) enrichBtnText.innerText = 'Scouting...';

  enrichSection.classList.remove('hidden');
  enrichLoading.classList.remove('hidden');
  enrichError.classList.add('hidden');
  enrichResult.classList.add('hidden');

  try {
    const res = await fetch('/api/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: target.id,
        website: target.website,
        name: target.name,
        city: target.city
      })
    });
    const data = await res.json();

    enrichLoading.classList.add('hidden');

    if (data.success && data.enrichment) {
      target.enrichment = data.enrichment;
      if (data.enrichment.emails && data.enrichment.emails.length > 0) {
        target.email = data.enrichment.emails[0];
      }
      if (data.enrichment.ownerName) {
        target.ownerName = data.enrichment.ownerName;
      }
      if (data.enrichment.services && data.enrichment.services.length > 0) {
        const base = Array.isArray(target.services) ? target.services : [];
        target.services = Array.from(new Set([...base, ...data.enrichment.services]));
        detailServices.innerHTML = target.services.map(s => `
          <span class="px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 text-[11px] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            ${escapeHtml(s)}
          </span>
        `).join('');
      }

      // Update browser session cache and table badge
      const city = currentCityLabel.innerText.trim();
      if (city && city !== '—') {
        setClientCache(city, { success: true, city, contractors: currentContractors, count: currentContractors.length, fromCache: true });
        renderContractors(city);
      }

      renderEnrichmentResult(data.enrichment);
    } else {
      enrichError.innerText = data.error || 'Could not extract details from this website.';
      enrichError.classList.remove('hidden');
      if (enrichBtnIcon) enrichBtnIcon.innerText = '⚡';
      if (enrichBtnText) enrichBtnText.innerText = 'Retry Scout';
    }
  } catch (err) {
    enrichLoading.classList.add('hidden');
    enrichError.innerText = 'Network error while scouting website.';
    enrichError.classList.remove('hidden');
    if (enrichBtnIcon) enrichBtnIcon.innerText = '⚡';
    if (enrichBtnText) enrichBtnText.innerText = 'Retry Scout';
  } finally {
    btnEnrichLead.disabled = false;
  }
}

// --- Loading State Utility ---
function setLoading(isLoading) {
  if (isLoading) {
    btnSearch.disabled = true;
    btnText.innerText = 'Searching...';
    tableWrapper.classList.add('hidden');
    emptyState.classList.add('hidden');
    loadingBox.classList.remove('hidden');
    if (loadingText) {
      loadingText.innerText = 'Running headless browser search on Google Maps with Puppeteer...';
    }
  } else {
    btnSearch.disabled = false;
    btnText.innerText = 'Search';
    loadingBox.classList.add('hidden');
  }
}

// --- Clipboard Copy Helper ---
function copyToClipboard(text, buttonElement) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = buttonElement.innerText;
    buttonElement.innerText = 'Copied!';
    buttonElement.classList.add('bg-zinc-900', 'text-white');
    setTimeout(() => {
      buttonElement.innerText = originalText;
      buttonElement.classList.remove('bg-zinc-900', 'text-white');
    }, 1500);
  }).catch(() => {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    buttonElement.innerText = 'Copied!';
    setTimeout(() => { buttonElement.innerText = 'Copy'; }, 1500);
  });
}

// --- Export to Excel (.xlsx) Feature ---
function exportToExcel() {
  let list = deduplicateContractors([...currentContractors]);
  if (locationFilter === 'exact') {
    list = list.filter(c => c.isExactCity);
  }

  if (list.length === 0) {
    alert('No contractors to export.');
    return;
  }

  const originalHtml = btnExportExcel.innerHTML;
  btnExportExcel.innerText = 'Exporting...';
  btnExportExcel.disabled = true;

  const currentCity = currentCityLabel.innerText || 'Contractors';
  const sanitizedCity = currentCity.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const baseName = `BidNinja_${sanitizedCity}_${dateStr}`;

  const rows = list.map((c, idx) => {
    const intel = c.enrichment || {};
    const directEmail = (intel.emails && intel.emails.length > 0) ? intel.emails.join('; ') : '';
    return {
      'ID': idx + 1,
      'Business Name': c.name || '',
      'Phone': c.phone || '',
      'Direct Email': directEmail,
      'Owner / Contact': intel.ownerName || '',
      'Experience': intel.experience || '',
      'Crew & Scale Clues': (intel.crewSignals && intel.crewSignals.length > 0) ? intel.crewSignals.join('; ') : '',
      'Rating': c.rating ? parseFloat(c.rating) : '',
      'Reviews Count': parseInt(c.reviewCount) || 0,
      'Physical Storefront': c.isExactCity ? 'Yes' : 'No',
      'Address': c.address || '',
      'City': c.city || currentCity,
      'Category': c.category || 'Lawn Care',
      'Website': c.website || '',
      'Google Maps Link': c.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.name + ' ' + (c.address || ''))}`,
      'Business Type': c.isFranchise ? 'Franchise' : 'Independent',
      'Data Source': 'Google Maps (Puppeteer)'
    };
  });

  try {
    if (typeof XLSX !== 'undefined') {
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 32 },
        { wch: 18 },
        { wch: 28 },
        { wch: 22 },
        { wch: 20 },
        { wch: 28 },
        { wch: 8 },
        { wch: 14 },
        { wch: 18 },
        { wch: 38 },
        { wch: 20 },
        { wch: 20 },
        { wch: 30 },
        { wch: 45 },
        { wch: 14 },
        { wch: 22 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contractors');
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    } else {
      exportCsvFallback(rows, `${baseName}.csv`);
    }

    btnExportExcel.innerText = '✓ Exported!';
    setTimeout(() => {
      btnExportExcel.innerHTML = originalHtml;
      btnExportExcel.disabled = false;
    }, 1800);
  } catch (err) {
    console.error('Export error:', err);
    exportCsvFallback(rows, `${baseName}.csv`);
    btnExportExcel.innerHTML = originalHtml;
    btnExportExcel.disabled = false;
  }
}

function exportCsvFallback(rows, filename) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
    )
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
