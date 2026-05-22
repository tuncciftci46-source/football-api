const express = require('express');
const router = express.Router();
const { LEAGUES } = require('../config/leagues');

router.get('/', (req, res) => {
  const list = Object.entries(LEAGUES).map(([id, info]) => ({ id, ...info }));
  res.json({ count: list.length, leagues: list });
});

router.get('/:leagueId', (req, res) => {
  const info = LEAGUES[req.params.leagueId];
  if (!info) return res.status(404).json({ error: 'Lig bulunamadı' });
  res.json({ id: req.params.leagueId, ...info });
});

module.exports = router;
