const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data');

function ensureDir() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
}

function read(name) {
  ensureDir();
  const file = path.join(DB_PATH, `${name}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function write(name, data) {
  ensureDir();
  const file = path.join(DB_PATH, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function readLeague(leagueId, type) {
  return read(`${leagueId}_${type}`);
}

function writeLeague(leagueId, type, data) {
  write(`${leagueId}_${type}`, data);
}

function appendHistory(matches) {
  if (!matches || !matches.length) return;
  const existing = read('history') || { matches: [] };
  const seen = new Set(existing.matches.map(m => m.id));
  const finished = matches
    .filter(m => m.status === 'finished' && m.homeTeam.score != null && m.awayTeam.score != null)
    .filter(m => !seen.has(m.id));
  if (!finished.length) return;
  finished.forEach(m => {
    existing.matches.push({
      id: m.id,
      leagueId: m.leagueId,
      league: m.league,
      leagueCountry: m.leagueCountry,
      date: m.date,
      homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, logo: m.homeTeam.logo },
      awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, logo: m.awayTeam.logo },
      homeScore: m.homeTeam.score,
      awayScore: m.awayTeam.score,
      status: 'finished'
    });
  });
  existing.count = existing.matches.length;
  write('history', existing);
}

function getTeamHistory(teamId, limit = 10) {
  const data = read('history');
  if (!data) return [];
  return data.matches
    .filter(m => m.homeTeam.id === teamId || m.awayTeam.id === teamId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

module.exports = { read, write, readLeague, writeLeague, appendHistory, getTeamHistory };
