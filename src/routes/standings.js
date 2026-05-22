const express = require('express');
const router = express.Router();
const store = require('../db/store');
const espn = require('../scraper/espn');

router.get('/', (req, res) => {
  const data = store.read('standings');
  if (!data) return res.json({ leagues: [] });
  const { league, group } = req.query;
  let list = Object.values(data);
  if (league) list = list.filter(l => l.leagueId === league);
  if (group) list = list.filter(l => l.standings?.some(s => s.group === group));
  res.json({ count: list.length, standings: list });
});

router.get('/:leagueId', async (req, res) => {
  const { leagueId } = req.params;
  const cached = store.readLeague(leagueId, 'standings');
  if (cached) return res.json(cached);
  try {
    const data = await espn.fetchLeagueStandings(leagueId);
    store.writeLeague(leagueId, 'standings', data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:leagueId/refresh', async (req, res) => {
  const { leagueId } = req.params;
  try {
    const data = await espn.fetchLeagueStandings(leagueId);
    store.writeLeague(leagueId, 'standings', data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
