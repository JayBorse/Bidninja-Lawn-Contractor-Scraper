const axios = require('axios');
const cheerio = require('cheerio');

const JUNK_EMAIL_DOMAINS = [
  'wixpress.com', 'sentry.io', 'sentry-next.wixpress.com', 'squarespace.com',
  'godaddy.com', 'example.com', 'domain.com', 'email.com', 'yoursite.com',
  'wordpress.org', 'w3.org', 'schema.org', 'googleapis.com', 'gstatic.com'
];

const JUNK_EMAIL_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js'];

const SERVICE_KEYWORDS = [
  'Lawn Mowing', 'Edging', 'Mulching', 'Aeration', 'Overseeding',
  'Fertilization', 'Weed Control', 'Leaf Removal', 'Shrub Trimming',
  'Hedge Trimming', 'Landscape Design', 'Hardscaping', 'Irrigation',
  'Sprinkler Repair', 'Sod Installation', 'Tree Trimming', 'Commercial Maintenance',
  'Gutter Cleaning', 'Pressure Washing', 'Snow Removal', 'Yard Cleanup'
];

const INVALID_OWNER_WORDS = new Set([
  'lawn', 'care', 'landscaping', 'services', 'service', 'contact', 'about',
  'home', 'free', 'estimate', 'quote', 'request', 'call', 'today', 'our',
  'team', 'story', 'more', 'read', 'view', 'all', 'privacy', 'policy',
  'terms', 'copyright', 'rights', 'reserved', 'get', 'started', 'click', 'here'
]);

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

/**
 * Fetches and parses a single URL safely with timeout
 */
async function fetchPageHtml(url, timeoutMs = 7000) {
  const res = await axios.get(url, {
    headers: HTTP_HEADERS,
    timeout: timeoutMs,
    maxRedirects: 5,
    validateStatus: status => status >= 200 && status < 400
  });
  if (typeof res.data !== 'string') return null;
  return res.data;
}

/**
 * Extracts clean text and structured elements from HTML
 */
function parseHtmlPage(html, baseUrl) {
  const $ = cheerio.load(html);

  // Extract mailto links before stripping tags
  const mailtoEmails = [];
  $('a[href^="mailto:"]').each((_, el) => {
    const raw = ($(el).attr('href') || '').replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
    if (raw) mailtoEmails.push(raw);
  });

  // Extract social links
  const socials = {};
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    if (href.includes('facebook.com/') && !href.includes('sharer') && !socials.facebook) {
      socials.facebook = href;
    } else if (href.includes('instagram.com/') && !socials.instagram) {
      socials.instagram = href;
    } else if (href.includes('linkedin.com/') && !socials.linkedin) {
      socials.linkedin = href;
    }
  });

  // Find candidate About / Contact / Team subpage URLs
  const subpageUrls = new Set();
  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    const linkText = ($(el).text() || '').trim().toLowerCase();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    const lowerHref = href.toLowerCase();
    const isAbout = /about|our-story|story|who-we-are|team|company/.test(lowerHref) ||
                    /about|our story|our team|meet/.test(linkText);
    const isContact = /contact|reach-us|get-in-touch/.test(lowerHref) ||
                      /contact/.test(linkText);

    if (isAbout || isContact) {
      try {
        const resolved = new URL(href, baseUrl);
        const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
        const targetHost = resolved.hostname.replace(/^www\./, '');
        if (targetHost === baseHost && resolved.pathname !== '/') {
          subpageUrls.add(resolved.href);
        }
      } catch (e) {}
    }
  });

  const metaDesc = $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content') || '';

  // Remove script/style/noscript noise before extracting visible text
  $('script, style, noscript, svg').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    text,
    metaDesc: metaDesc.trim(),
    mailtoEmails,
    socials,
    subpageUrls: Array.from(subpageUrls).slice(0, 3)
  };
}

/**
 * Validates and ranks extracted email addresses
 */
function extractCleanEmails(combinedText, mailtoList, siteHost) {
  const regexMatches = combinedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const candidates = [...mailtoList, ...regexMatches.map(e => e.toLowerCase())];

  const unique = [];
  const seen = new Set();

  for (const raw of candidates) {
    const email = raw.trim().replace(/[.,;:!?)]+$/, '');
    if (!email || seen.has(email) || email.length > 65) continue;

    const domain = email.split('@')[1] || '';
    if (JUNK_EMAIL_DOMAINS.some(d => domain.includes(d))) continue;
    if (JUNK_EMAIL_EXTENSIONS.some(ext => email.endsWith(ext))) continue;

    seen.add(email);
    unique.push(email);
  }

  // Prioritize emails matching the website's own domain
  unique.sort((a, b) => {
    const aMatchesHost = siteHost && a.endsWith(siteHost) ? 1 : 0;
    const bMatchesHost = siteHost && b.endsWith(siteHost) ? 1 : 0;
    return bMatchesHost - aMatchesHost;
  });

  return unique.slice(0, 4);
}

/**
 * Extracts likely owner/founder name from site text
 */
function extractOwnerName(text) {
  const patterns = [
    /(?:owner|founder|president|ceo|started by|founded by|operated by|owned by|meet)\s*(?::|-|is|—)?\s+([A-Z][a-z]{1,15}(?:\s+[A-Z][a-z]{1,15}){1,2})/g,
    /([A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,15})\s*(?:,|\||-|—)\s*(?:Owner|Founder|President|CEO|Owner\s*&\s*Operator)/g
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const candidate = (match[1] || '').trim();
      const words = candidate.toLowerCase().split(/\s+/);
      if (words.length >= 2 && words.every(w => !INVALID_OWNER_WORDS.has(w) && w.length >= 2)) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Extracts crew size, truck count, and operational scale clues
 */
function extractCrewSignals(text) {
  const signals = [];
  const seen = new Set();

  const patterns = [
    /\b(?:\d+|two|three|four|five|six|seven|eight|nine|ten|dozen)\s+(?:trucks?|crews?|teams?|employees?|technicians?|staff\s+members?|lawn\s+pros?|specialists?)\b/gi,
    /\b(?:crew|team|fleet)\s+of\s+(?:\d+|two|three|four|five|six|seven|eight|ten)\b/gi,
    /\b(?:family[- ]owned(?:\s+and\s+operated)?|locally[- ]owned(?:\s+and\s+operated)?|veteran[- ]owned|owner[- ]operated|father[- ]and[- ]son|husband[- ]and[- ]wife|one[- ]man\s+(?:crew|operation)|solo\s+operator)\b/gi
  ];

  for (const regex of patterns) {
    const matches = text.match(regex) || [];
    for (const m of matches) {
      const clean = m.replace(/\s+/g, ' ').trim();
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        signals.push(clean);
      }
    }
  }

  return signals.slice(0, 5);
}

/**
 * Extracts founding year or years in business
 */
function extractExperience(text) {
  const currentYear = new Date().getFullYear();

  const sinceMatch = text.match(/\b(?:since|established(?:\s+in)?|est\.?|founded(?:\s+in)?|serving\s+[\w\s,]{2,30}\s+since)\s+(19[7-9]\d|20[0-2]\d)\b/i);
  if (sinceMatch) {
    const year = parseInt(sinceMatch[1], 10);
    if (year <= currentYear && year >= 1970) {
      const yrs = currentYear - year;
      return yrs > 0 ? `Est. ${year} (${yrs} yrs)` : `Est. ${year}`;
    }
  }

  const yearsMatch = text.match(/\b(?:over\s+|more\s+than\s+)?(\d{1,2}\+?)\s+years?\s+(?:of\s+)?(?:experience|in\s+business|serving)\b/i);
  if (yearsMatch) {
    return `${yearsMatch[1]} years in business`;
  }

  return null;
}

/**
 * Matches lawn & outdoor service keywords mentioned on the site
 */
function extractServices(text) {
  const lower = text.toLowerCase();
  return SERVICE_KEYWORDS.filter(service => lower.includes(service.toLowerCase()));
}

/**
 * Builds a concise, ready-to-use pre-call opener for the outreach rep
 */
function buildPreCallHook({ name, city, ownerName, experience, crewSignals, emails }) {
  const greetingName = ownerName ? ownerName.split(' ')[0] : 'there';
  const shortCity = city ? city.split(',')[0].trim() : 'your area';
  const possessiveName = name.endsWith('s') ? `${name}'` : `${name}'s`;
  const expText = experience ? ` [${experience}]` : '';
  const scaleClue = crewSignals.length > 0 ? ` and saw you're ${crewSignals[0].toLowerCase()}` : '';

  if (ownerName || experience || crewSignals.length > 0) {
    return `Hi ${greetingName}, checked out ${possessiveName} site${expText}${scaleClue}. Quick question — how much time are your crews losing driving across ${shortCity} just to quote $45–$60 lawns?`;
  }

  if (emails.length > 0) {
    return `Hi ${greetingName}, I'm reaching out to ${name} in ${shortCity} — we help local crews quote yards in 30 seconds from their truck using homeowner AR scans instead of driving out for free estimates.`;
  }

  return `Hi ${greetingName}, saw ${name} serving ${shortCity} — quick question on how you handle lawn quotes without burning windshield time.`;
}

/**
 * Crawls a contractor's website (homepage + /about + /contact) and extracts pre-call intel
 */
async function enrichContractorWebsite(websiteUrl, context = {}) {
  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    return {
      success: false,
      error: 'No valid website URL available for this contractor.'
    };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(websiteUrl);
  } catch (e) {
    return { success: false, error: 'Invalid website URL format.' };
  }

  const siteHost = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
  if (['facebook.com', 'instagram.com', 'yelp.com', 'google.com', 'maps.google.com'].some(s => siteHost.includes(s))) {
    return {
      success: false,
      error: `Website points to ${siteHost} rather than a direct company site.`
    };
  }

  try {
    const homeHtml = await fetchPageHtml(websiteUrl, 8000);
    if (!homeHtml) {
      return { success: false, error: 'Website returned empty or non-HTML content.' };
    }

    const homeData = parseHtmlPage(homeHtml, websiteUrl);
    const pagesScanned = [parsedUrl.pathname || '/'];

    const combinedTexts = [homeData.text];
    const allMailtos = [...homeData.mailtoEmails];
    const socials = { ...homeData.socials };

    // Crawl discovered /about and /contact subpages concurrently
    if (homeData.subpageUrls.length > 0) {
      const subResults = await Promise.allSettled(
        homeData.subpageUrls.map(async subUrl => {
          const html = await fetchPageHtml(subUrl, 5500);
          return { subUrl, html };
        })
      );

      for (const res of subResults) {
        if (res.status === 'fulfilled' && res.value.html) {
          const parsed = parseHtmlPage(res.value.html, res.value.subUrl);
          combinedTexts.push(parsed.text);
          allMailtos.push(...parsed.mailtoEmails);
          Object.assign(socials, parsed.socials);
          try {
            pagesScanned.push(new URL(res.value.subUrl).pathname);
          } catch (e) {}
        }
      }
    }

    const fullText = combinedTexts.join(' ');
    const emails = extractCleanEmails(fullText, allMailtos, siteHost);
    const ownerName = extractOwnerName(fullText);
    const crewSignals = extractCrewSignals(fullText);
    const experience = extractExperience(fullText);
    const services = extractServices(fullText);

    const summary = homeData.metaDesc ||
      (fullText.length > 180 ? fullText.slice(0, 220).trim() + '...' : fullText);

    const preCallHook = buildPreCallHook({
      name: context.name || 'your company',
      city: context.city || '',
      ownerName,
      experience,
      crewSignals,
      emails
    });

    return {
      success: true,
      enrichment: {
        emails,
        ownerName,
        crewSignals,
        experience,
        services,
        socials,
        summary,
        preCallHook,
        pagesScanned: Array.from(new Set(pagesScanned)),
        enrichedAt: new Date().toISOString()
      }
    };
  } catch (err) {
    console.error(`[SiteEnricher] Failed to crawl ${websiteUrl}:`, err.message);
    return {
      success: false,
      error: `Could not reach website (${err.code || err.message}).`
    };
  }
}

module.exports = {
  enrichContractorWebsite
};
