const puppeteer = require('puppeteer-core');
const { LEAGUES } = require('../config/leagues');

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const COUNTRY_SLUGS = {
  'Türkiye': 'turkey', 'Finlandiya': 'finland', 'Belarus': 'belarus',
  'Portekiz': 'portugal', 'Belçika': 'belgium', 'Yunanistan': 'greece',
  'Hırvatistan': 'croatia', 'Çekya': 'czech-republic', 'Ukrayna': 'ukraine',
  'Rusya': 'russia', 'Polonya': 'poland', 'Romanya': 'romania',
  'Bulgaristan': 'bulgaria', 'Sırbistan': 'serbia', 'Çin': 'china',
  'Japonya': 'japan', 'Suudi Arabistan': 'saudi-arabia', 'İsveç': 'sweden',
  'Norveç': 'norway', 'Avusturya': 'austria', 'İsviçre': 'switzerland',
  'Danimarka': 'denmark',
};

function getExtraLeagues() {
  return Object.entries(LEAGUES)
    .filter(([_, info]) => info.source === 'flashscore')
    .map(([id, info]) => ({ id, name: info.name, slug: COUNTRY_SLUGS[info.country] || info.country.toLowerCase() }));
}

class FlashScoreScraper {
  constructor() {
    this.browser = null;
    this._queue = [];
    this._running = false;
  }

  async _getBrowser() {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }
    return this.browser;
  }

  async close() {
    if (this.browser) { await this.browser.close(); this.browser = null; }
  }

  async scrapeCountry(countrySlug, waitMs = 4000) {
    const browser = await this._getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

    try {
      await page.goto(`https://www.flashscore.com/football/${countrySlug}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await new Promise(r => setTimeout(r, waitMs));

      const text = await page.evaluate(() => document.body.innerText);
      return this._parseText(text, countrySlug);
    } finally {
      await page.close();
    }
  }

  _parseText(text, countrySlug) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const matches = [];
    let currentLeague = '';
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (['LATEST SCORES', 'SCHEDULED', 'SCORES', 'NEWS', 'FAVORITES', 'FOOTBALL', 'TENNIS', 'BASKETBALL', 'HOCKEY', 'GOLF', 'HANDBALL', 'BASEBALL', 'SNOOKER', 'AD'].includes(line)) {
        i++; continue;
      }

      if (line.match(/^\d{2}\.\s*\d{2}\./) || line.match(/^\d{2}\.\d{2}\./)) {
        const rawDate = line.replace(/\s+/g, '');
        i++;
        if (i >= lines.length) break;

        let time = '';
        if (lines[i].match(/^\d{2}:\d{2}$/)) {
          time = lines[i];
          i++;
        }

        if (i + 3 < lines.length) {
          const home = lines[i];
          const away = lines[i + 1];
          const hs = lines[i + 2];
          const as = lines[i + 3];

          if (home && away && hs && as &&
              hs.match(/^\d+$/) && as.match(/^\d+$/)) {
            matches.push({
              date: rawDate.replace(/\./g, '-'),
              time,
              homeTeam: this._cleanName(home),
              awayTeam: this._cleanName(away),
              homeScore: parseInt(hs),
              awayScore: parseInt(as),
              status: 'finished',
              league: currentLeague,
            });
            i += 4;
            continue;
          }
        }
      }

      if (line.match(/^[A-ZÖÜĞİŞÇ]/) && line.length > 2 && !line.match(/^\d/) &&
          line !== countrySlug.toUpperCase() && !line.match(/^FINLAND:|Standings$/)) {
        const cleaned = line.replace(/FINLAND:|BELARUS:|Standings$/g, '').replace(/^\s*:\s*/, '').trim();
        if (cleaned.length > 1) currentLeague = cleaned;
      }
      i++;
    }

    return { country: countrySlug, count: matches.length, matches };
  }

  _cleanName(name) {
    return name.replace(/^\d+\.\s*/, '').trim();
  }

  async scrapeAllExtra() {
    const leagues = getExtraLeagues();
    const results = {};
    for (const league of leagues) {
      try {
        console.log(`  📡 ${league.name}...`);
        if (!league.slug) { console.log(`    ✗ slug bulunamadı`); continue; }
        const data = await this.scrapeCountry(league.slug);
        results[league.id] = { ...data, league: league.name };
        console.log(`    ✓ ${data.count} maç`);
      } catch (e) {
        console.log(`    ✗ ${league.id}: ${e.message}`);
      }
    }
    return results;
  }
}

module.exports = new FlashScoreScraper();
