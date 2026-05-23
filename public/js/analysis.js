const Analysis = {
  probToDec(p) { return p > 0 ? 1 / p : 0; },
  decToProb(o) { return o > 0 ? 1 / o : 0; },

  factorial(n) { if (n <= 1) return 1; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; },
  poissonProb(k, l) { return Math.exp(-l) * Math.pow(l, k) / this.factorial(k); },
  poisson(k, l) { let s = 0; for (let i = 0; i <= k; i++) s += Math.exp(-l) * Math.pow(l, i) / this.factorial(i); return s; },
  overProb(xg, t) { return 1 - this.poisson(t, xg); },
  bttsProb(h, a) { return (1 - Math.exp(-h)) * (1 - Math.exp(-a)); },

  estimateXg(st, tid, la = 2.5) {
    if (!st || !st.standings) return { attack: 1, defense: 1, xg: la / 2 };
    const e = st.standings.find(s => s.teamId === tid);
    if (!e) return { attack: 1, defense: 1, xg: la / 2 };
    const avgGF = e.goalsFor / e.played;
    const avgGA = e.goalsAgainst / e.played;
    const laG = la / 2;
    return { attack: laG > 0 ? avgGF / laG : 1, defense: laG > 0 ? avgGA / laG : 1, xg: (avgGF + (laG * 2 - avgGA)) / 2 };
  },

  matchXg(homeStats, awayStats, homeStand, awayStand, homeId, awayId, leagueAvg) {
    const h = this.estimateXg(homeStand, homeId, leagueAvg);
    const a = this.estimateXg(awayStand, awayId, leagueAvg);
    let homeXg = (h.attack * a.defense) * (leagueAvg / 2);
    let awayXg = (a.attack * h.defense) * (leagueAvg / 2);
    if (homeStats) { const sr = homeStats.totalShots || homeStats.shotsOnGoal || 0; if (sr > 0) homeXg = homeXg * 0.7 + (sr / 10) * 0.3; }
    if (awayStats) { const sr = awayStats.totalShots || awayStats.shotsOnGoal || 0; if (sr > 0) awayXg = awayXg * 0.7 + (sr / 10) * 0.3; }
    return { home: Math.round(homeXg * 100) / 100, away: Math.round(awayXg * 100) / 100 };
  },

  htFtProb(hX, aX) {
    let hW = 0, d = 0, aW = 0;
    for (let h = 0; h <= 3; h++) for (let a = 0; a <= 3; a++) {
        const p = this.poissonProb(h, hX * 0.45) * this.poissonProb(a, aX * 0.45);
        if (h > a) hW += p; else if (h === a) d += p; else aW += p;
      }
    return { home: Math.round(hW * 10000) / 100, draw: Math.round(d * 10000) / 100, away: Math.round(aW * 10000) / 100 };
  },

  fullTimeProb(hX, aX) {
    let hW = 0, d = 0, aW = 0;
    for (let h = 0; h <= 8; h++) for (let a = 0; a <= 8; a++) {
        const p = this.poissonProb(h, hX) * this.poissonProb(a, aX);
        if (h > a) hW += p; else if (h === a) d += p; else aW += p;
      }
    return { home: Math.round(hW * 10000) / 100, draw: Math.round(d * 10000) / 100, away: Math.round(aW * 10000) / 100 };
  },

  scoreProb(hX, aX, mG = 5) {
    const p = [];
    for (let h = 0; h <= mG; h++) for (let a = 0; a <= mG; a++) p.push({ home: h, away: a, prob: this.poissonProb(h, hX) * this.poissonProb(a, aX) });
    return p.sort((a, b) => b.prob - a.prob);
  },

  analyzeMatch(match, standingsData, leagueAvg) {
    const homeId = match.homeTeam.id, awayId = match.awayTeam.id, league = match.leagueId;
    const homeName = match.homeTeam.name, awayName = match.awayTeam.name;
    const homeStand = standingsData[league], awayStand = standingsData[league];
    const xg = this.matchXg(null, null, homeStand, awayStand, homeId, awayId, leagueAvg || 2.5);
    const totalXg = xg.home + xg.away;

    const btts = this.bttsProb(xg.home, xg.away);
    const over05 = this.overProb(totalXg, 0.5);
    const over15 = this.overProb(totalXg, 1.5);
    const over25 = this.overProb(totalXg, 2.5);
    const over35 = this.overProb(totalXg, 3.5);

    const ht = this.htFtProb(xg.home, xg.away);
    const ft = this.fullTimeProb(xg.home, xg.away);
    const scores = this.scoreProb(xg.home, xg.away, 4).slice(0, 5);

    const htXg = totalXg * 0.45;
    const htOver05 = this.overProb(htXg, 0.5);
    const htOver15 = this.overProb(htXg, 1.5);

    const odds = match.odds;

    const markets = [
      { id: '1', label: `1 (${homeName})`, prob: ft.home, mo: odds?.home },
      { id: 'X', label: 'X (Beraberlik)', prob: ft.draw, mo: odds?.draw },
      { id: '2', label: `2 (${awayName})`, prob: ft.away, mo: odds?.away },
      { id: '1X', label: `1X (${homeName} veya B.)`, prob: ft.home + ft.draw },
      { id: '12', label: `12 (${homeName} veya ${awayName})`, prob: ft.home + ft.away },
      { id: 'X2', label: `X2 (B. veya ${awayName})`, prob: ft.draw + ft.away },
      { id: 'KG', label: 'KG Var (BTTS)', prob: btts * 100 },
      { id: 'KGY', label: 'KG Yok (BTTS No)', prob: (1 - btts) * 100 },
      { id: 'O05', label: '0.5 Gol Üstü', prob: over05 * 100 },
      { id: 'A05', label: '0.5 Gol Altı', prob: (1 - over05) * 100 },
      { id: 'O15', label: '1.5 Gol Üstü', prob: over15 * 100 },
      { id: 'A15', label: '1.5 Gol Altı', prob: (1 - over15) * 100 },
      { id: 'O25', label: '2.5 Gol Üstü', prob: over25 * 100 },
      { id: 'A25', label: '2.5 Gol Altı', prob: (1 - over25) * 100 },
      { id: 'O35', label: '3.5 Gol Üstü', prob: over35 * 100 },
      { id: 'A35', label: '3.5 Gol Altı', prob: (1 - over35) * 100 },
      { id: 'IY1', label: `İY 1 (${homeName})`, prob: ht.home },
      { id: 'IYX', label: 'İY X (Beraberlik)', prob: ht.draw },
      { id: 'IY2', label: `İY 2 (${awayName})`, prob: ht.away },
      { id: 'IYO05', label: 'İY 0.5 Gol Üstü', prob: htOver05 * 100 },
      { id: 'IYA05', label: 'İY 0.5 Gol Altı', prob: (1 - htOver05) * 100 },
      { id: 'IYO15', label: 'İY 1.5 Gol Üstü', prob: htOver15 * 100 },
      { id: 'IYA15', label: 'İY 1.5 Gol Altı', prob: (1 - htOver15) * 100 },
      { id: 'CSE', label: `CS Ev Gol Yemez (${homeName})`, prob: Math.exp(-xg.home) * 100 },
      { id: 'CSD', label: `CS Dep Gol Yemez (${awayName})`, prob: Math.exp(-xg.away) * 100 },
    ];

    const valueBets = markets
      .filter(m => m.mo != null && m.prob > 0)
      .map(m => {
        const pd = m.prob / 100;
        const implied = 1 / m.mo;
        const edge = ((pd - implied) / implied) * 100;
        const fairOdds = 1 / pd;
        return { market: m.label, id: m.id, odds: m.mo, fairOdds: Math.round(fairOdds * 100) / 100, realProb: Math.round(m.prob * 100) / 100, edge: Math.round(edge * 100) / 100 };
      })
      .filter(v => v.edge > 3)
      .sort((a, b) => b.edge - a.edge);

    return {
      xg, totalXg: Math.round(totalXg * 100) / 100,
      btts: Math.round(btts * 10000) / 100,
      over05: Math.round(over05 * 10000) / 100,
      over15: Math.round(over15 * 10000) / 100,
      over25: Math.round(over25 * 10000) / 100,
      over35: Math.round(over35 * 10000) / 100,
      ht, ft, topScores: scores,
      markets,
      valueBets
    };
  }
};
