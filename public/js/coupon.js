const Coupon = {
  items: [],

  add(match, market, odds, label) {
    if (this.items.find(i => i.matchId === match.id && i.market === market)) {
      this.toast('Bu maç zaten kuponunuzda!', 'error');
      return;
    }
    this.items.push({
      id: Date.now() + Math.random(),
      matchId: match.id,
      league: match.league,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      market, odds, label
    });
    this.render();
    this.toast(`${match.homeTeam.name} - ${match.awayTeam.name}: ${label} eklendi`, 'success');
  },

  remove(id) { this.items = this.items.filter(i => i.id !== id); this.render(); },

  clear() {
    if (!this.items.length) return;
    this.items = [];
    this.render();
    this.toast('Kupon temizlendi', 'info');
  },

  get totalOdds() { return this.items.reduce((p, i) => p * i.odds, 1); },

  render() {
    const body = document.getElementById('couponBody');
    const footer = document.getElementById('couponFooter');
    const count = document.getElementById('couponCount');
    count.textContent = this.items.length;

    if (!this.items.length) {
      body.innerHTML = '<div class="coupon-empty">Kupon boş. Maç eklemek için tıklayın.</div>';
      footer.style.display = 'none';
      return;
    }

    footer.style.display = 'block';
    body.innerHTML = this.items.map(item => `
      <div class="coupon-item">
        <button class="ci-remove" onclick="Coupon.remove(${item.id})">&times;</button>
        <div class="ci-league">${item.league}</div>
        <div class="ci-teams">${item.homeTeam} - ${item.awayTeam}</div>
        <span class="ci-pick">${item.label}</span>
        <span class="ci-odds">${item.odds.toFixed(2)}</span>
      </div>
    `).join('');

    const total = this.totalOdds;
    document.getElementById('totalOdds').textContent = total.toFixed(2);
    const stake = parseFloat(document.getElementById('stakeInput').value) || 100;
    document.getElementById('potentialWin').textContent = (stake * total).toFixed(2) + ' ₺';
  },

  toast(msg, type) {
    const c = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('stakeInput').addEventListener('input', () => Coupon.render());
  document.getElementById('clearCoupon').addEventListener('click', () => Coupon.clear());
});
