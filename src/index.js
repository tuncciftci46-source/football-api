process.env.TZ = 'Europe/Istanbul';

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const store = require('./db/store');
const espn = require('./scraper/espn');
const flashscore = require('./scraper/flashscore');
const { LEAGUES } = require('./config/leagues');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve static webapp
app.use(express.static(path.join(__dirname, '..', 'public')));

const apiKeyAuth = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const key = req.headers['x-rapidapi-key'] || req.headers['x-api-key'] || req.query.apiKey;
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Geçersiz API anahtarı' });
  }
  next();
};

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT) || 120,
  message: { error: 'Çok fazla istek, lütfen bekleyin' },
});
app.use('/api/', limiter);

app.use('/api/leagues', apiKeyAuth, require('./routes/leagues'));
app.use('/api/matches', apiKeyAuth, require('./routes/matches'));
app.use('/api/standings', apiKeyAuth, require('./routes/standings'));
app.use('/api/teams', apiKeyAuth, require('./routes/teams'));
app.use('/api/extra', apiKeyAuth, require('./routes/extra'));

// History
app.get('/api/history', apiKeyAuth, (req, res) => {
  const { team, league, limit } = req.query;
  const data = store.read('history');
  if (!data) return res.json({ count: 0, matches: [] });
  let matches = data.matches;
  if (team) matches = matches.filter(m => m.homeTeam.id === team || m.awayTeam.id === team || m.homeTeam.name?.toLowerCase().includes(team.toLowerCase()) || m.awayTeam.name?.toLowerCase().includes(team.toLowerCase()));
  if (league) matches = matches.filter(m => m.leagueId === league);
  matches.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (limit) matches = matches.slice(0, parseInt(limit));
  res.json({ count: matches.length, total: data.count, matches });
});

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.0.0',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    leagues: Object.keys(LEAGUES).length,
    history: store.read('history')?.count || 0,
    mode: process.env.NODE_ENV || 'development',
  });
});

// Refresh all data
app.get('/api/refresh', apiKeyAuth, async (req, res) => {
  const start = Date.now();
  try {
    console.log('\n🔄 Tüm veriler tazeleniyor...\n');

    console.log('📊 Puan durumları...');
    const standings = await espn.fetchAllStandings();
    store.write('standings', standings);

    console.log('⚽ Maç skorları...');
    const scoreboards = await espn.fetchAllScoreboards();
    store.write('scoreboards', scoreboards);
    const allMatches = Object.values(scoreboards).flatMap(l => l.matches || []);
    store.appendHistory(allMatches);
    const total = allMatches.length;

    console.log('🏷️ Takımlar...');
    const teams = await espn.fetchAllTeams();
    store.write('teams', teams);

    console.log('🌍 FlashScore ekstra ligler...');
    const extra = await flashscore.scrapeAllExtra();
    store.write('extra', extra);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const extraTotal = Object.values(extra).reduce((s, l) => s + (l.count || 0), 0);

    console.log(`\n✅ Güncelleme tamam (${elapsed}s)`);
    console.log(`   • ${Object.keys(LEAGUES).length} lig`);
    console.log(`   • ${total} ESPN maçı`);
    console.log(`   • ${extraTotal} ekstra maç`);
    const histCount = store.read('history')?.count || 0;
    console.log(`   • ${histCount} geçmiş maç`);

    res.json({ success: true, elapsed, stats: { leagues: Object.keys(LEAGUES).length, matches: total, extra: extraTotal, history: histCount } });
  } catch (e) {
    console.error('✗ Hata:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Cron jobs
if (process.env.CRON_ENABLED !== 'false') {
  cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Otomatik tazeleme (15dk)...');
    try {
      const scoreboards = await espn.fetchAllScoreboards();
      store.write('scoreboards', scoreboards);
      const allMatches = Object.values(scoreboards).flatMap(l => l.matches || []);
      store.appendHistory(allMatches);
      const count = allMatches.length;
      console.log(`✓ ${count} maç güncellendi, geçmiş kaydedildi`);
    } catch (e) { console.error('✗', e.message); }
  });

  cron.schedule('0 */6 * * *', async () => {
    console.log('🔄 Puan durumu tazeleme (6saat)...');
    try {
      const standings = await espn.fetchAllStandings();
      store.write('standings', standings);
    } catch (e) { console.error('✗', e.message); }
  });
}

// Start
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`
╔══════════════════════════════════╗
║     FOOTBALL API v2.0           ║
║     Port: ${PORT}                   ║
║     Mode: ${process.env.NODE_ENV || 'development'}
╚══════════════════════════════════╝
    `);

    if (process.env.SKIP_INITIAL_FETCH !== 'true') {
      console.log('📡 İlk yükleme başlıyor...\n');
      try {
        const scoreboards = await espn.fetchAllScoreboards();
        store.write('scoreboards', scoreboards);
        const total = Object.values(scoreboards).reduce((s, l) => s + (l.count || 0), 0);
        console.log(`\n✅ ${total} ESPN maçı hazır`);

        console.log('\n📊 Puan durumları...');
        const standings = await espn.fetchAllStandings();
        store.write('standings', standings);

        console.log('\n🏷️ Takımlar...');
        const teams = await espn.fetchAllTeams();
        store.write('teams', teams);

        console.log('');
      } catch (e) { console.error('✗ İlk yükleme hatası:', e.message); }
    }
  });
}

module.exports = app;
