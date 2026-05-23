let state = { leagues: [], allMatches: [], standings: {}, currentView: 'live' };

const LEAGUE_AVG = {
  'tur.1': 2.8, 'eng.1': 2.6, 'esp.1': 2.5, 'ita.1': 2.6, 'ger.1': 3.0,
  'fra.1': 2.5, 'ned.1': 3.0, 'por.1': 2.5, 'sco.1': 2.7, 'bel.1': 2.6,
  'mex.1': 2.6, 'usa.1': 2.8, 'bra.1': 2.3, 'arg.1': 2.0,
};
const DEFAULT_AVG = 2.6;

function toast(msg, type) { Coupon.toast(msg, type); }

function renderMarketsCompact(markets) {
  const show = markets.filter(m => ['1', 'X', '2', 'KG', 'O25', 'A25', 'O15', 'A15'].includes(m.id));
  return show.map(m => {
    const useOdds = m.mo || (m.prob > 0 ? (1 / (m.prob / 100)) : 0);
    return `<button class="odds-btn market-btn" data-mid="${m.id}" data-odds="${useOdds.toFixed(4)}" data-label="${m.label}" title="%${m.prob.toFixed(0)} - Oran: ${useOdds.toFixed(2)}">
      <span class="ob-label">${m.label.replace(/\(.*\)/, '').trim()}</span>
      ${useOdds.toFixed(2)}
      <span style="color:var(--text-muted);font-size:8px;display:block">%${m.prob.toFixed(0)}</span>
    </button>`;
  }).join('');
}

function renderMarketsFull(markets) {
  const groups = [
    { title: '1X2 (Maç Sonucu)', filter: ['1', 'X', '2'] },
    { title: 'Çifte Şans', filter: ['1X', '12', 'X2'] },
    { title: 'KG Var/Yok (BTTS)', filter: ['KG', 'KGY'] },
    { title: 'Gol Sayısı', filter: ['O05', 'A05', 'O15', 'A15', 'O25', 'A25', 'O35', 'A35'] },
    { title: 'İlk Yarı', filter: ['IY1', 'IYX', 'IY2', 'IYO05', 'IYA05', 'IYO15', 'IYA15'] },
    { title: 'Clean Sheet', filter: ['CSE', 'CSD'] },
  ];
  return groups.map(g => {
    const items = markets.filter(m => g.filter.includes(m.id));
    if (!items.length) return '';
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px">
      <span style="font-size:11px;color:var(--text-muted);font-weight:600;min-width:140px;flex-shrink:0">${g.title}</span>
      ${items.map(m => {
        const useOdds = m.mo || (m.prob > 0 ? (1 / (m.prob / 100)) : 0);
        const barColor = m.prob > 60 ? 'var(--green)' : m.prob > 40 ? 'var(--yellow)' : m.prob > 20 ? 'var(--orange)' : 'var(--red)';
        const moStr = m.mo ? `<span style="font-size:9px;color:var(--yellow)">${m.mo.toFixed(2)}</span>` : '';
        return `<button class="odds-btn market-btn" data-mid="${m.id}" data-odds="${useOdds.toFixed(4)}" data-label="${m.label}" style="min-width:80px;padding:6px 8px;position:relative;overflow:hidden">
          <span class="ob-label" style="font-size:9px;white-space:normal;line-height:1.1">${m.label}</span>
          <span style="font-size:13px;font-weight:700">${useOdds.toFixed(2)}</span>
          <span style="font-size:9px;color:var(--text-muted)">%${m.prob.toFixed(1)}</span>
          ${moStr}
          <div style="position:absolute;bottom:0;left:0;height:2px;width:${Math.min(m.prob, 100)}%;background:${barColor};border-radius:0 2px 0 0"></div>
        </button>`;
      }).join('')}
    </div>`;
  }).filter(Boolean).join('');
}

async function loadAll() {
  try {
    const [leaguesData, matchesData] = await Promise.all([API.getLeagues(), API.getMatches()]);
    state.leagues = leaguesData.leagues || [];
    state.allMatches = matchesData.matches || [];
    renderView(state.currentView);
  } catch (e) {
    console.error('Load error:', e);
    toast('Veri yüklenirken hata oluştu', 'error');
  }
}

async function getStandings(leagueId) {
  if (state.standings[leagueId]) return state.standings[leagueId];
  try {
    const data = await API.getStandings(leagueId);
    if (data) state.standings[leagueId] = data;
    return data;
  } catch (e) { return null; }
}

function getAnalysis(match) {
  const la = LEAGUE_AVG[match.leagueId] || DEFAULT_AVG;
  return Analysis.analyzeMatch(match, state.standings, la);
}

function trDateStr(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

function filterMatches(status) {
  const now = new Date();
  const today = trDateStr(now);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tStr = trDateStr(tomorrow);
  if (status === 'live') return state.allMatches.filter(m => m.status === 'live');
  if (status === 'today') return state.allMatches.filter(m => m.status === 'live' || (m.status === 'upcoming' && new Date(m.date).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) === today));
  if (status === 'tomorrow') return state.allMatches.filter(m => m.status === 'upcoming' && new Date(m.date).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }) === tStr);
  if (status === 'finished') return state.allMatches.filter(m => m.status === 'finished');
  return state.allMatches;
}

function groupLeague(matches) {
  const g = {};
  matches.forEach(m => {
    const k = m.leagueId || m.league;
    if (!g[k]) g[k] = { league: m.league, leagueId: m.leagueId, country: m.leagueCountry, matches: [] };
    g[k].matches.push(m);
  });
  return Object.entries(g);
}

function renderView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  const container = document.getElementById(`view-${view}`);
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><div>Yükleniyor...</div></div>';

  if (view === 'valuebets') { renderValueBets(container); return; }

  const filtered = filterMatches(view);
  if (!filtered.length) {
    container.innerHTML = '<div class="loading-spinner" style="color:var(--text-muted)">Bu bölümde maç bulunamadı.</div>';
    return;
  }

  const labels = { live: 'Canlı Maçlar', today: 'Bugünkü Maçlar', tomorrow: 'Yarının Maçları', finished: 'Bitmiş Maçlar' };
  let html = `<div class="section-header"><h2>${labels[view] || view} <span class="count">(${filtered.length} maç)</span></h2></div>`;

  groupLeague(filtered).forEach(([key, group]) => {
    const li = state.leagues.find(l => l.id === key);
    const logo = li?.logo || '';
    const country = group.country || li?.country || '';
    const liveCount = group.matches.filter(m => m.status === 'live').length;
    html += `<div class="league-group">
      <div class="league-group-header">
        ${logo ? `<img class="lg-logo" src="${logo}" onerror="this.style.display='none'">` : '<span style="width:24px;text-align:center">⚽</span>'}
        <span class="lg-name">${group.league}</span>
        <span class="lg-country">${country}</span>
        <span class="lg-count">${group.matches.length} maç${liveCount ? `<span style="color:var(--red);margin-left:6px">🔴 ${liveCount}</span>` : ''}</span>
      </div>
      <div class="league-matches">${group.matches.map(m => renderMatchCard(m)).join('')}</div>
    </div>`;
  });

  container.innerHTML = html;
  attachEvents(container);
}

function renderMatchCard(m) {
  const isLive = m.status === 'live';
  const isFinished = m.status === 'finished';
  const hasScore = m.homeTeam.score != null && m.awayTeam.score != null;
  const scoreStr = hasScore ? `${m.homeTeam.score}-${m.awayTeam.score}` : '-';
  const timeStr = isLive ? m.time || 'LIVE' : (isFinished ? 'FT' : (m.time || ''));
  const a = getAnalysis(m);
  const marketsHtml = a ? renderMarketsCompact(a.markets) : '';

  return `<div class="match-card ${m.status}" data-id="${m.id}" data-lid="${m.leagueId}">
    <div class="mc-status">
      <span class="status-badge ${m.status}">${isLive ? 'CANLI' : isFinished ? 'FT' : timeStr}</span>
    </div>
    <div class="mc-teams">
      <div class="mc-team home">
        ${m.homeTeam.logo ? `<img class="mc-team-logo" src="${m.homeTeam.logo}" onerror="this.style.display='none'">` : ''}
        <span class="mc-team-name">${m.homeTeam.name}</span>
      </div>
      <div class="mc-team away">
        ${m.awayTeam.logo ? `<img class="mc-team-logo" src="${m.awayTeam.logo}" onerror="this.style.display='none'">` : ''}
        <span class="mc-team-name">${m.awayTeam.name}</span>
      </div>
    </div>
    <div class="mc-score">
      <span class="score-main ${hasScore ? 'live-score' : 'no-score'}">${scoreStr}</span>
    </div>
    ${marketsHtml ? `<div class="mc-odds">${marketsHtml}</div>` : ''}
    ${isLive ? `<div class="mc-time">${timeStr}</div>` : ''}
  </div>`;
}

function attachEvents(container) {
  container.querySelectorAll('.match-card').forEach(c => {
    c.addEventListener('click', e => {
      if (e.target.closest('.market-btn')) return;
      openDetail(c.dataset.lid, c.dataset.id);
    });
  });
  container.querySelectorAll('.market-btn').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const card = b.closest('.match-card');
      const match = state.allMatches.find(m => m.id === card.dataset.id);
      if (!match) return;
      const mid = b.dataset.mid;
      const odds = parseFloat(b.dataset.odds);
      if (odds && !isNaN(odds)) {
        Coupon.add(match, mid, odds, b.dataset.label);
        b.classList.toggle('selected');
        toast(`Eklendi: ${b.dataset.label} @ ${odds.toFixed(2)}`, 'success');
      }
    });
  });
}

function findMatch(id) { return state.allMatches.find(m => m.id === id); }

async function openDetail(leagueId, matchId) {
  const modal = document.getElementById('matchModal');
  const detail = document.getElementById('matchDetail');
  modal.classList.add('open');
  detail.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><div>Analiz yükleniyor...</div></div>';

  try {
    const [md, sd] = await Promise.all([
      API.getMatchDetail(leagueId, matchId).catch(() => null),
      getStandings(leagueId)
    ]);
    const match = findMatch(matchId);
    if (!match) { detail.innerHTML = '<div class="loading-spinner">Maç bulunamadı</div>'; return; }

    const la = LEAGUE_AVG[leagueId] || DEFAULT_AVG;
    const analysis = Analysis.analyzeMatch(match, { [leagueId]: sd }, la);
    const a = analysis;

    const m = match;
    const homeLogo = m.homeTeam.logo || '';
    const awayLogo = m.awayTeam.logo || '';
    const homeForm = m.homeTeam.form || [];
    const awayForm = m.awayTeam.form || [];
    const hasScore = m.homeTeam.score != null && m.awayTeam.score != null;
    const scoreStr = hasScore ? `${m.homeTeam.score} - ${m.awayTeam.score}` : '-';
    const formHtml = f => f.map(f => `<span class="form-badge ${f}">${f === 'win' ? 'G' : f === 'draw' ? 'B' : 'M'}</span>`).join('');
    const xgHP = a.totalXg > 0 ? (a.xg.home / a.totalXg) * 100 : 50;
    const xgAP = a.totalXg > 0 ? (a.xg.away / a.totalXg) * 100 : 50;

    const homeStats = md?.homeStats || null;
    const awayStats = md?.awayStats || null;

    let html = `<div class="md-header">
      <div class="md-league">${m.league} / ${m.leagueCountry || ''}</div>
      <div class="md-teams">
        <div class="md-team">
          ${homeLogo ? `<img class="md-team-logo" src="${homeLogo}" onerror="this.style.display='none'">` : '<div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:28px">🏠</div>'}
          <div class="md-team-name">${m.homeTeam.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${m.homeTeam.record || ''}</div>
        </div>
        <div class="md-vs">VS</div>
        <div class="md-team">
          ${awayLogo ? `<img class="md-team-logo" src="${awayLogo}" onerror="this.style.display='none'">` : '<div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:28px">✈️</div>'}
          <div class="md-team-name">${m.awayTeam.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${m.awayTeam.record || ''}</div>
        </div>
      </div>
      <div class="md-score-main ${hasScore ? 'live-score' : 'no-score'}" style="margin-top:12px">${scoreStr}</div>
      <div class="md-time">${m.status === 'live' ? '🔴 CANLI ' + m.time : m.status === 'finished' ? 'MAÇ SONU' : new Date(m.date).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</div>
    </div>
    <div class="md-body">`;

    html += `<div class="md-section"><h4>📊 Tüm Piyasalar</h4>${renderMarketsFull(a.markets)}</div>`;

    if (m.status === 'live' || m.status === 'finished') {
      html += `<div class="md-section"><h4>📊 İstatistikler</h4><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:13px">`;
      ['ballPossession', 'totalShots', 'shotsOnGoal', 'shotsOffGoal', 'cornerKicks', 'fouls', 'yellowCards', 'redCards', 'passes', 'passAccuracy'].forEach(key => {
        if (homeStats && homeStats[key] != null && awayStats && awayStats[key] != null) {
          const h = parseFloat(homeStats[key]), aw = parseFloat(awayStats[key]);
          const t = h + aw, hp = t > 0 ? (h / t) * 100 : 50;
          const lb = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          html += `<div style="background:var(--bg-card);border-radius:6px;padding:8px;grid-column:span 3">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span>${typeof h === 'number' ? h.toFixed(1) : h}</span><span style="color:var(--text-muted);font-size:11px">${lb}</span><span>${typeof aw === 'number' ? aw.toFixed(1) : aw}</span>
            </div>
            <div style="height:6px;background:var(--bg-primary);border-radius:3px;overflow:hidden;display:flex">
              <div style="width:${hp}%;background:var(--blue);height:100%"></div><div style="width:${100 - hp}%;background:var(--orange);height:100%"></div>
            </div>
          </div>`;
        }
      });
      html += `</div></div>`;
    }

    html += `<div class="md-section"><h4>⚡ xG Analizi</h4>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:var(--blue);font-weight:700">${m.homeTeam.name}: ${a.xg.home.toFixed(2)}</span>
        <span style="color:var(--orange);font-weight:700">${m.awayTeam.name}: ${a.xg.away.toFixed(2)}</span>
      </div>
      <div class="xg-bar"><div class="xg-home" style="width:${xgHP}%">${a.xg.home.toFixed(2)}</div><div class="xg-away" style="width:${xgAP}%">${a.xg.away.toFixed(2)}</div></div>
      <div style="text-align:center;color:var(--text-muted);font-size:13px">Toplam xG: ${a.totalXg.toFixed(2)}</div>
    </div>`;

    html += `<div class="md-section"><h4>📈 Olasılıklar</h4><div class="analysis-grid">
      <div class="analysis-item"><div class="ai-label">KG Var (BTTS)</div><div class="ai-value">%${a.btts.toFixed(1)}</div><div class="ai-bar"><div class="ai-bar-fill ${a.btts > 50 ? 'green' : 'red'}" style="width:${a.btts}%"></div></div></div>
      <div class="analysis-item"><div class="ai-label">0.5 Gol Üstü</div><div class="ai-value">%${a.over05.toFixed(1)}</div><div class="ai-bar"><div class="ai-bar-fill blue" style="width:${a.over05}%"></div></div></div>
      <div class="analysis-item"><div class="ai-label">1.5 Gol Üstü</div><div class="ai-value">%${a.over15.toFixed(1)}</div><div class="ai-bar"><div class="ai-bar-fill ${a.over15 > 50 ? 'yellow' : 'red'}" style="width:${a.over15}%"></div></div></div>
      <div class="analysis-item"><div class="ai-label">2.5 Gol Üstü</div><div class="ai-value">%${a.over25.toFixed(1)}</div><div class="ai-bar"><div class="ai-bar-fill ${a.over25 > 50 ? 'yellow' : 'red'}" style="width:${a.over25}%"></div></div></div>
      <div class="analysis-item"><div class="ai-label">3.5 Gol Üstü</div><div class="ai-value">%${a.over35.toFixed(1)}</div><div class="ai-bar"><div class="ai-bar-fill ${a.over35 > 40 ? 'yellow' : 'red'}" style="width:${a.over35}%"></div></div></div>
      <div class="analysis-item"><div class="ai-label">Maç Oranı (1-X-2)</div><div class="ai-value" style="font-size:13px">${m.odds?.home?.toFixed(2) || '-'} / ${m.odds?.draw?.toFixed(2) || '-'} / ${m.odds?.away?.toFixed(2) || '-'}</div></div>
    </div></div>`;

    html += `<div class="md-section"><h4>🔮 Skor Tahmini</h4><table class="odds-table">
      <tr><th>Skor</th><th>Olasılık</th><th>1X2</th></tr>
      ${a.topScores.map(s => `<tr><td style="font-weight:600">${s.home}-${s.away}</td><td>%${(s.prob * 100).toFixed(2)}</td><td style="color:${s.home > s.away ? 'var(--green)' : s.home === s.away ? 'var(--yellow)' : 'var(--red)'}">${s.home > s.away ? 'Ev' : s.home === s.away ? 'Beraberlik' : 'Dep'}</td></tr>`).join('')}
    </table></div>`;

    html += `<div class="md-section"><h4>📋 Form (Son 5 Maç)</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div><div style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--blue)">${m.homeTeam.name}</div><div class="form-container">${formHtml(homeForm)}</div></div>
      <div><div style="font-size:13px;font-weight:600;margin-bottom:4px;color:var(--orange)">${m.awayTeam.name}</div><div class="form-container">${formHtml(awayForm)}</div></div>
    </div></div>`;

    html += `<div class="md-section"><h4>🏆 1X2 Karşılaştırma</h4><table class="odds-table">
      <tr><th>Market</th><th>Olasılık</th><th>Fair Oran</th><th>Piyasa</th><th>Edge</th></tr>
      ${[['1', `1 (${m.homeTeam.name})`, a.ft.home], ['X', 'X (Beraberlik)', a.ft.draw], ['2', `2 (${m.awayTeam.name})`, a.ft.away]].map(([id, label, prob]) => {
        const vb = a.valueBets.find(v => v.id === id);
        return `<tr><td>${label}</td><td>%${prob.toFixed(1)}</td><td>${(100 / prob).toFixed(2)}</td><td>${m.odds?.[id === '1' ? 'home' : id === 'X' ? 'draw' : 'away']?.toFixed(2) || '-'}</td>
          <td>${vb ? `<span class="value-badge ev">%${vb.edge.toFixed(1)}</span>` : '<span class="value-badge no">—</span>'}</td></tr>`;
      }).join('')}
    </table></div>`;

    html += `<div class="md-section"><h4>🔄 İY/MS</h4><table class="odds-table">
      <tr><th>Periyot</th><th>Ev</th><th>Beraberlik</th><th>Deplasman</th></tr>
      <tr><td>İlk Yarı</td><td style="color:var(--blue)">%${a.ht.home.toFixed(1)}</td><td style="color:var(--yellow)">%${a.ht.draw.toFixed(1)}</td><td style="color:var(--orange)">%${a.ht.away.toFixed(1)}</td></tr>
      <tr><td>Maç Sonu</td><td style="color:var(--blue)">%${a.ft.home.toFixed(1)}</td><td style="color:var(--yellow)">%${a.ft.draw.toFixed(1)}</td><td style="color:var(--orange)">%${a.ft.away.toFixed(1)}</td></tr>
    </table></div>`;

    if (md && md.goals && md.goals.length > 0) {
      html += `<div class="md-section"><h4>⚽ Goller</h4>${md.goals.map(g => `<div style="padding:4px 0;font-size:13px;color:var(--text-secondary)">${g.time}' - ${g.text}</div>`).join('')}</div>`;
    }

    if (a.valueBets.length > 0) {
      html += `<div class="md-section"><h4>💰 Value Bet</h4>${a.valueBets.slice(0, 3).map(vb => `
        <div style="background:var(--green-bg);border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:12px;margin-bottom:6px">
          <div style="font-weight:600;color:var(--green)">${vb.market}</div>
          <div style="font-size:13px;color:var(--text-secondary)">Piyasa: ${vb.odds.toFixed(2)} | Fair: ${vb.fairOdds.toFixed(2)} | Edge: %${vb.edge.toFixed(1)}</div>
        </div>`).join('')}</div>`;
    }

    html += `</div>`;
    detail.innerHTML = html;

    detail.querySelectorAll('.market-btn').forEach(b => {
      b.addEventListener('click', () => {
        const odds = parseFloat(b.dataset.odds);
        if (odds && !isNaN(odds)) {
          Coupon.add(match, b.dataset.mid, odds, b.dataset.label);
          b.classList.toggle('selected');
          toast(`Eklendi: ${b.dataset.label} @ ${odds.toFixed(2)}`, 'success');
        }
      });
    });

  } catch (e) {
    console.error('Detail error:', e);
    detail.innerHTML = '<div class="loading-spinner" style="color:var(--red)">Analiz yüklenirken hata oluştu</div>';
  }
}

function renderValueBets(container) {
  const matches = state.allMatches.filter(m => (m.status === 'upcoming' || m.status === 'live') && m.odds);
  if (!matches.length) {
    container.innerHTML = '<div class="section-header"><h2>💰 Value Bet</h2></div><div class="loading-spinner" style="color:var(--text-muted)">Değerlendirilecek maç bulunamadı.</div>';
    return;
  }

  const allVB = [];
  matches.forEach(m => {
    const a = getAnalysis(m);
    if (a.valueBets && a.valueBets.length) a.valueBets.forEach(vb => allVB.push({ ...vb, match: m }));
  });

  allVB.sort((a, b) => b.edge - a.edge);
  const topVB = allVB.slice(0, 30);

  let html = `<div class="section-header"><h2>💰 Value Bet <span class="count">(${topVB.length} fırsat)</span></h2></div>`;
  if (!topVB.length) {
    html += '<div class="loading-spinner" style="color:var(--text-muted)">Şu anda uygun value bet bulunamadı.</div>';
    container.innerHTML = html;
    return;
  }

  topVB.forEach(vb => {
    html += `<div class="valuebet-card" style="cursor:pointer" onclick="openDetail('${vb.match.leagueId}','${vb.match.id}')">
      <div class="vb-league">${vb.match.league}</div>
      <div class="vb-teams">${vb.match.homeTeam.name} - ${vb.match.awayTeam.name}</div>
      <div class="vb-detail">${vb.market} | Piyasa: <span class="vb-odds">${vb.odds.toFixed(2)}</span> | Fair: ${vb.fairOdds.toFixed(2)} | Edge: <span class="vb-value">%${vb.edge.toFixed(1)}</span>
        <button class="odds-btn" style="float:right;padding:2px 8px" onclick="event.stopPropagation();Coupon.add(findMatch('${vb.match.id}'),'${vb.id}',${vb.odds},'${vb.market}');toast('Eklendi','success')">+</button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  loadAll();

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderView(tab.dataset.view);
    });
  });

  document.getElementById('btnCoupon').addEventListener('click', () => {
    document.getElementById('couponPanel').classList.toggle('open');
    document.querySelector('.main-content').classList.toggle('shrink');
  });
  document.getElementById('closeCoupon').addEventListener('click', () => {
    document.getElementById('couponPanel').classList.remove('open');
    document.querySelector('.main-content').classList.remove('shrink');
  });

  document.getElementById('btnRefresh').addEventListener('click', async () => {
    const btn = document.getElementById('btnRefresh');
    btn.classList.add('loading');
    toast('Veriler tazeleniyor...', 'info');
    try {
      state.standings = {};
      await API.refreshAll();
      await loadAll();
      toast('Veriler güncellendi!', 'success');
    } catch (e) { toast('Güncelleme hatası: ' + e.message, 'error'); }
    btn.classList.remove('loading');
  });

  document.getElementById('matchModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) document.getElementById('matchModal').classList.remove('open');
  });
  document.querySelector('.modal-close')?.addEventListener('click', () => {
    document.getElementById('matchModal').classList.remove('open');
  });
});
