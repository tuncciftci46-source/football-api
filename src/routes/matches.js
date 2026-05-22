const express = require('express');
const router = express.Router();
const store = require('../db/store');
const espn = require('../scraper/espn');

router.get('/', (req, res) => {
  const data = store.read('scoreboards');
  if (!data) return res.json({ matches: [], updatedAt: null });

  let matches = Object.values(data).flatMap(l => l.matches || []);

  const { league, status, search, date, team } = req.query;
  if (league) matches = matches.filter(m => m.leagueId === league);
  if (status) matches = matches.filter(m => m.status === status);
  if (search) {
    const q = search.toLowerCase();
    matches = matches.filter(m =>
      m.homeTeam.name.toLowerCase().includes(q) ||
      m.awayTeam.name.toLowerCase().includes(q) ||
      m.league.toLowerCase().includes(q)
    );
  }
  if (team) {
    const q = team.toLowerCase();
    matches = matches.filter(m =>
      m.homeTeam.name.toLowerCase().includes(q) ||
      m.awayTeam.name.toLowerCase().includes(q)
    );
  }

  matches.sort((a, b) => a.status === 'live' ? -1 : b.status === 'live' ? 1 : 0);

  res.json({ count: matches.length, updatedAt: data.updatedAt, matches });
});

router.get('/live', (req, res) => {
  const data = store.read('scoreboards');
  if (!data) return res.json({ matches: [] });
  const matches = Object.values(data).flatMap(l => l.matches || []).filter(m => m.status === 'live');
  res.json({ count: matches.length, matches });
});

router.get('/:leagueId', async (req, res) => {
  const { leagueId } = req.params;
  const cached = store.readLeague(leagueId, 'scoreboard');
  if (cached) return res.json(cached);
  try {
    const matches = await espn.fetchLeagueScoreboard(leagueId);
    const result = { leagueId, count: matches.length, matches };
    store.writeLeague(leagueId, 'scoreboard', result);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:leagueId/:eventId', async (req, res) => {
  const { leagueId, eventId } = req.params;
  try {
    const detail = await espn.fetchEventDetails(leagueId, eventId);
    res.json(detail);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
