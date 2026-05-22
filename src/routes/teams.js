const express = require('express');
const router = express.Router();
const store = require('../db/store');
const espn = require('../scraper/espn');

router.get('/', (req, res) => {
  const data = store.read('teams');
  if (!data) return res.json({ teams: [] });
  const { league, search } = req.query;
  let list = Object.values(data).flatMap(l => l.teams || []);
  if (league) {
    const ld = data[league];
    list = ld?.teams || [];
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(t => t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q));
  }
  res.json({ count: list.length, teams: list });
});

router.get('/:leagueId', async (req, res) => {
  const { leagueId } = req.params;
  const cached = store.readLeague(leagueId, 'teams');
  if (cached) return res.json(cached);
  try {
    const teams = await espn.fetchLeagueTeams(leagueId);
    const result = { leagueId, count: teams.length, teams };
    store.writeLeague(leagueId, 'teams', result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
