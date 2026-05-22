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

module.exports = { read, write, readLeague, writeLeague };
