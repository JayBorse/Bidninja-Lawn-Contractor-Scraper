# 🥷 BidNinja Lead Scout & Contractor Acquisition Platform

An autonomous B2B lead generation, enrichment, and sales-enablement platform built to recruit **50 lawn care & outdoor service contractors** in target US cities (**Dallas, TX Suburbs & Great Falls, VA**).

---

## 🚀 Quick Start

The platform is running locally on:
**[http://localhost:3000](http://localhost:3000)**

To run it anytime manually:
```bash
npm start
# or
node src/server.js
```

---

## 🎯 What the Platform Does

1. **City Lead Scout (Agent 1):**
   * Enter any US city or suburb (e.g. `Frisco, TX`, `Plano, TX`, `Dallas, TX`, `Great Falls, VA`, `Tampa, FL`).
   * Scrapes Google Maps in real-time via headless Puppeteer browser for lawn care & mowing businesses.

2. **Lead Cleaner & Ranker (Agent 2):**
   * **Franchise Filter:** Detects and flags national corporations (TruGreen, Lawn Doctor, The Grounds Guys) with low conversion rates.
   * **Opportunity Scoring (0–100):** Prioritizes independent 1–3 truck crews with 15–120 reviews and 4.4+ stars who benefit most from route density and zero site visits.
   * **Website Crawler:** Automatically crawls contractor sites to extract owner names, emails, and direct phones.

3. **Message & Script Writer (Agent 3):**
   * Generates tailored **45-Second Phone Call Scripts**, **1-on-1 SMS drafts**, and **Day 1 Intro Emails** featuring the **"90 Days Free"** offer and **Google Reviews Sync**.

4. **Objection Handling Concierge (Agent 5):**
   * Built-in objection killer. Type in what a contractor texted (e.g. *"Is this like Angi? Do I pay for leads?"*) to get instant battle-tested rebuttals.

5. **Milestone Tracker (0/50 Goal):**
   * Live progress bar counting up to your **50 Onboarded Contractors** milestone.
   * One-click status updates (`New` ➔ `Assigned` ➔ `Contacted` ➔ `Replied` ➔ `Onboarded`).
   * One-click **Export to CSV** for your outreach rep's dialer.
