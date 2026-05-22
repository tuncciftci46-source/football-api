const axios = require('axios');
const { LEAGUES } = require('../config/leagues');

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const axiosConfig = { timeout: 10000 };

const formMap = { W: 'win', D: 'draw', L: 'loss' };

function parseForm(str) {
  if (!str) return [];
  return str.split('').map(f => formMap[f.toUpperCase()] || 'draw');
}

function parseOdds(odds) {
  if (!odds || !odds.length) return null;
  const ml = odds[0]?.moneyline || {};
  const toDec = (v) => {
    const n = parseInt(v);
    if (!n) return null;
    return n > 0 ? (n / 100) + 1 : (100 / -n) + 1;
  };
  return {
    home: toDec(ml.home?.close?.odds),
    away: toDec(ml.away?.close?.odds),
    draw: toDec(ml.draw?.close?.odds),
  };
}

function parseStatus(comp) {
  const state = comp?.status?.type?.state || 'pre';
  if (state === 'in') return 'live';
  if (state === 'post') return 'finished';
  return 'upcoming';
}

function parseTime(event, comp) {
  const state = comp?.status?.type?.state || 'pre';
  if (state === 'in') return comp?.status?.displayClock || 'LIVE';
  if (state === 'post') return 'FT';
  const d = new Date(event.date);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

async function fetchLeagueScoreboard(leagueId) {
  const { data } = await axios.get(`${BASE}/${leagueId}/scoreboard`, axiosConfig);
  const events = data.events || [];
  const leagueInfo = LEAGUES[leagueId] || { name: leagueId, country: '' };

  return events.map(event => {
    const comp = event.competitions?.[0] || {};
    const comps = comp.competitors || [];
    const home = comps[0] || {};
    const away = comps[1] || {};
    const ht = home.team || {};
    const at = away.team || {};
    const statusData = comp.status || event.status || {};
    const venue = comp.venue || {};

    return {
      id: event.id,
      uid: event.uid,
      date: event.date,
      leagueId,
      league: leagueInfo.name,
      leagueCountry: leagueInfo.country,
      season: data.season?.year,
      week: comp.matchNumber,
      status: parseStatus(comp),
      time: parseTime(event, comp),
      clock: statusData.displayClock || '',
      period: statusData.period || 0,
      homeTeam: {
        id: ht.id,
        name: ht.displayName || ht.name || '',
        shortName: ht.shortDisplayName || ht.abbreviation || '',
        logo: ht.logo || '',
        record: home.records?.[0]?.summary || '',
        score: home.score != null ? parseInt(home.score) : null,
        winner: home.winner || false,
        form: parseForm(home.form),
      },
      awayTeam: {
        id: at.id,
        name: at.displayName || at.name || '',
        shortName: at.shortDisplayName || at.abbreviation || '',
        logo: at.logo || '',
        record: away.records?.[0]?.summary || '',
        score: away.score != null ? parseInt(away.score) : null,
        winner: away.winner || false,
        form: parseForm(away.form),
      },
      odds: parseOdds(comp.odds),
      venue: {
        name: venue.fullName || venue.name || '',
        city: venue.address?.city || '',
      },
      broadcast: comp.broadcasts?.[0]?.names || [],
      series: comp.series ? {
        type: comp.series.type,
        title: comp.series.title,
      } : null,
    };
  });
}

async function fetchLeagueStandings(leagueId) {
  const { data } = await axios.get(`https://site.web.api.espn.com/apis/v2/sports/soccer/${leagueId}/standings`, axiosConfig);
  const entries = [];
  const leagueInfo = LEAGUES[leagueId] || { name: leagueId, country: '' };

  const groups = data.children || [];
  groups.forEach(group => {
    const groupName = group.name || '';
    const standingsObj = group.standings || {};
    const standingEntries = standingsObj.entries || [];
    standingEntries.forEach(entry => {
      const team = entry.team || {};
      const stats = {};
      (entry.stats || []).forEach(s => {
        const key = s.displayName || s.name || '';
        const val = parseInt(s.displayValue) || parseInt(s.value);
        if (key === 'Games Played') stats.played = val;
        else if (key === 'Wins') stats.won = val;
        else if (key === 'Draws') stats.drawn = val;
        else if (key === 'Losses') stats.lost = val;
        else if (key === 'Goals For') stats.goalsFor = val;
        else if (key === 'Goals Against') stats.goalsAgainst = val;
        else if (key === 'Goal Difference') stats.goalDiff = val;
        else if (key === 'Points') stats.points = val;
        else if (key === 'Rank') stats.rank = val;
      });
      entries.push({
        position: stats.rank || entry.position,
        teamId: team.id,
        teamName: team.displayName || team.name || '',
        teamLogo: team.logo || '',
        teamAbbr: team.abbreviation || '',
        group: groupName,
        played: stats.played,
        won: stats.won,
        drawn: stats.drawn,
        lost: stats.lost,
        goalsFor: stats.goalsFor,
        goalsAgainst: stats.goalsAgainst,
        goalDiff: stats.goalDiff,
        points: stats.points,
        form: [],
      });
    });
  });

  return {
    leagueId,
    league: leagueInfo.name,
    leagueCountry: leagueInfo.country,
    season: data.season?.year,
    standings: entries.sort((a, b) => (a.position || 99) - (b.position || 99)),
  };
}

async function fetchLeagueTeams(leagueId) {
  const { data } = await axios.get(`${BASE}/${leagueId}/teams`, axiosConfig);
  return (data.sports?.[0]?.leagues?.[0]?.teams || []).map(t => {
    const team = t.team || {};
    return {
      id: team.id,
      uid: team.uid,
      name: team.displayName || team.name || '',
      shortName: team.shortDisplayName || team.abbreviation || '',
      logo: team.logo || '',
      venue: team.venue?.fullName || '',
      city: team.venue?.address?.city || '',
      color: team.color,
      alternateColor: team.alternateColor,
    };
  });
}

async function fetchEventDetails(leagueId, eventId) {
  const { data } = await axios.get(`${BASE}/${leagueId}/events/${eventId}`, axiosConfig);
  const comp = data.competitions?.[0] || {};
  const comps = comp.competitors || [];
  const home = comps[0] || {};
  const away = comps[1] || {};

  const detail = {
    id: data.id,
    date: data.date,
    status: data.status?.type?.name || '',
    homeTeam: home.team?.displayName || '',
    awayTeam: away.team?.displayName || '',
    homeScore: home.score,
    awayScore: away.score,
    homeStats: {},
    awayStats: {},
    lineups: [],
    goals: [],
    cards: [],
    substitutions: [],
  };

  if (comp.odds?.length) {
    detail.odds = parseOdds(comp.odds);
  }

  if (comp.venue) {
    detail.venue = {
      name: comp.venue.fullName || '',
      city: comp.venue.address?.city || '',
    };
  }

  const homeStats = home.statistics || [];
  const awayStats = away.statistics || [];
  const statNames = [
    'ballPossession', 'shotsOnGoal', 'shotsOffGoal',
    'totalShots', 'blockedShots', 'goalkeeperSaves',
    'cornerKicks', 'fouls', 'offsides', 'yellowCards',
    'redCards', 'passes', 'passAccuracy'
  ];
  [homeStats, awayStats].forEach((arr, i) => {
    arr.forEach(s => {
      const key = statNames.find(k => k === s.name) || s.name;
      if (i === 0) detail.homeStats[key] = s.value;
      else detail.awayStats[key] = s.value;
    });
  });

  const leaders = data.leaders || [];
  leaders.forEach(leader => {
    const category = leader.abbreviation || leader.name;
    (leader.leaders || []).forEach(l => {
      const athlete = l.athlete || {};
      detail.lineups.push({
        category,
        name: athlete.displayName || '',
        teamId: athlete.team?.id || '',
        jersey: athlete.jersey,
        position: athlete.position?.name || '',
        stat: l.value,
      });
    });
  });

  const commentary = data.commentary || [];
  commentary.forEach(c => {
    const item = c.commentaryItem || c;
    const type = item.type || 'general';
    if (item.pin && item.pin.text && item.pin.text.includes('Gol')) {
      detail.goals.push({
        text: item.pin.text,
        time: item.pin.time || '',
        team: item.pin.team?.displayName || '',
      });
    }
    if (type === 'card') {
      detail.cards.push({
        text: item.text || '',
        time: item.time || '',
        cardType: item.cardType || '',
      });
    }
    if (type === 'substitution') {
      detail.substitutions.push({
        text: item.text || '',
        time: item.time || '',
      });
    }
  });

  return detail;
}

async function fetchAllScoreboards() {
  const results = {};
  for (const [id] of Object.entries(LEAGUES)) {
    try {
      const matches = await fetchLeagueScoreboard(id);
      results[id] = { leagueId: id, count: matches.length, matches };
      console.log(`  ✓ ${id} (${matches.length} maç)`);
    } catch (e) {
      console.log(`  ✗ ${id} - ${e.message}`);
    }
  }
  return results;
}

async function fetchAllStandings() {
  const results = {};
  for (const [id] of Object.entries(LEAGUES)) {
    try {
      const data = await fetchLeagueStandings(id);
      results[id] = data;
      console.log(`  ✓ ${id} (${data.standings.length} takım)`);
    } catch (e) {
      console.log(`  ✗ ${id} - ${e.message}`);
    }
  }
  return results;
}

async function fetchAllTeams() {
  const results = {};
  for (const [id] of Object.entries(LEAGUES)) {
    try {
      const teams = await fetchLeagueTeams(id);
      results[id] = { leagueId: id, count: teams.length, teams };
      console.log(`  ✓ ${id} (${teams.length} takım)`);
    } catch (e) {
      console.log(`  ✗ ${id} - ${e.message}`);
    }
  }
  return results;
}

module.exports = {
  fetchLeagueScoreboard,
  fetchLeagueStandings,
  fetchLeagueTeams,
  fetchEventDetails,
  fetchAllScoreboards,
  fetchAllStandings,
  fetchAllTeams,
};
