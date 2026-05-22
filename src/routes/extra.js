const express = require('express');
const router = express.Router();
const flashscore = require('../scraper/flashscore');
const store = require('../db/store');
const { LEAGUES } = require('../config/leagues');

const COUNTRY_SLUGS = {
  'Türkiye': 'turkey',
  'Finlandiya': 'finland',
  'Belarus': 'belarus',
  'Portekiz': 'portugal',
  'Belçika': 'belgium',
  'Yunanistan': 'greece',
  'Hırvatistan': 'croatia',
  'Çekya': 'czech-republic',
  'Ukrayna': 'ukraine',
  'Rusya': 'russia',
  'Polonya': 'poland',
  'Romanya': 'romania',
  'Bulgaristan': 'bulgaria',
  'Sırbistan': 'serbia',
  'Çin': 'china',
  'Japonya': 'japan',
  'Suudi Arabistan': 'saudi-arabia',
  'İsveç': 'sweden',
  'Norveç': 'norway',
  'Avusturya': 'austria',
  'İsviçre': 'switzerland',
  'Danimarka': 'denmark',
  'İngiltere': 'england',
  'İspanya': 'spain',
  'İtalya': 'italy',
  'Almanya': 'germany',
  'Fransa': 'france',
  'Hollanda': 'netherlands',
  'İskoçya': 'scotland',
  'Meksika': 'mexico',
  'Brezilya': 'brazil',
  'Arjantin': 'argentina',
  'ABD': 'usa',
};

router.get('/', (req, res) => {
  const flashscoreLeagues = Object.entries(LEAGUES)
    .filter(([_, info]) => info.source === 'flashscore')
    .map(([id, info]) => ({ id, ...info, slug: COUNTRY_SLUGS[info.country] || info.country.toLowerCase() }));
  res.json({ count: flashscoreLeagues.length, leagues: flashscoreLeagues });
});

router.get('/:leagueId', async (req, res) => {
  const { leagueId } = req.params;
  const leagueInfo = LEAGUES[leagueId];

  if (!leagueInfo) return res.status(404).json({ error: 'Lig bulunamadı', leagueId });
  if (leagueInfo.source !== 'flashscore') {
    return res.status(400).json({ error: 'Bu lig ESPN kaynağından geliyor', leagueId, source: 'espn' });
  }

  const slug = COUNTRY_SLUGS[leagueInfo.country];
  if (!slug) return res.status(500).json({ error: 'FlashScore ülke kodu bulunamadı', country: leagueInfo.country });

  try {
    const data = await flashscore.scrapeCountry(slug);
    res.json({
      leagueId,
      league: leagueInfo.name,
      country: leagueInfo.country,
      count: data.count,
      matches: data.matches.map(m => ({ ...m, leagueId, league: leagueInfo.name })),
    });
  } catch (e) {
    res.status(500).json({ error: `FlashScore hatası: ${e.message}` });
  }
});

module.exports = router;
