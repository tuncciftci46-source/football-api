const API = {
  BASE: '/api',

  async get(endpoint) {
    const res = await fetch(`${this.BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  getLeagues() { return this.get('/leagues'); },
  getMatches(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null) q.set(k, v); });
    const qs = q.toString();
    return this.get(`/matches${qs ? '?' + qs : ''}`);
  },
  getMatchDetail(leagueId, eventId) { return this.get(`/matches/${leagueId}/${eventId}`); },
  getStandings(leagueId) { return this.get(`/standings/${leagueId}`); },
  getTeams(leagueId) { return this.get(`/teams/${leagueId}`); },
  refreshAll() { return this.get('/refresh'); }
};
