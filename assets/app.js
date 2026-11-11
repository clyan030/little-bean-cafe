/* Browser UI only: business rules belong in engine.js. See AGENTS.md. */
(function () {
  'use strict';
  const D = window.CafeData;
  const E = window.CafeEngine;
  const STORAGE_KEY = 'little-bean-cafe-save-v1';
  const names = { game: '咖啡館前台', menu: '菜單與定價', stock: '進貨與庫存', upgrades: '店鋪升級', report: '營業日記' };
  const root = document.getElementById('view-root');
  const toast = document.getElementById('toast');
  const helpDialog = document.getElementById('help-dialog');
  let view = 'game';
  let state;
  let hideToastTimer = null;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return E.restoreState(saved);
    } catch (err) { return E.createInitialState(); }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (err) { notify('瀏覽器無法儲存進度，請確認儲存空間或隱私模式。', true); }
  }
  state = load();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  const getDrink = id => D.drinks.find(d => d.id === id);
  const getCustomer = id => D.customers.find(c => c.id === id);
  const money = v => `NT$ ${Number(v).toLocaleString('zh-TW')}`;
  const pct = (score, count) => count ? Math.round(score / count) : 0;
  const tag = (text, orange = false) => `<span class="small-tag${orange ? ' orange' : ''}">${escapeHtml(text)}</span>`;
  const progress = (n, max) => `<div class="progress-track" role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${max}"><div class="progress-fill" style="width:${max ? n / max * 100 : 0}%"></div></div>`;

  function notify(message, error = false) {
    if (hideToastTimer) clearTimeout(hideToastTimer);
    toast.textContent = message;
    toast.className = `toast show${error ? ' error' : ''}`;
    hideToastTimer = setTimeout(() => { toast.className = 'toast'; }, 3600);
  }
  function viewTo(newView) { view = newView; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function run(result, options = {}) {
    if (result.ok) {
      state = result.state;
      save();
      render();
      if (!options.silent) notify(result.message);
    } else notify(result.message, true);
  }

  function statCard(title, number, icon, caption) {
    return `<div class="stat-card"><div class="stat-top"><span>${title}</span><span class="stat-icon" aria-hidden="true">${icon}</span></div><div class="stat-number">${number}</div><div class="stat-caption">${caption}</div></div>`;
  }
  function metrics() {
    return `<section class="stats-grid" aria-label="咖啡館經營數據">
      ${statCard('目前現金', money(state.cash), '＄', '可用於進貨與升級')}
      ${statCard('今日營收', money(state.dayStats.revenue + state.dayStats.tips), '↗', '包含顧客小費')}
      ${statCard('今日出餐', `${state.dayStats.served} <span style="font-size:14px;color:#a3afa5">/ ${state.phase === 'ready' ? E.orderCount(state) : state.orders.length}</span>`, '☕', '每杯都是一次新挑戰')}
      ${statCard('平均滿意度', `${E.averageScore(state)}<span style="font-size:14px"> / 100</span>`, '♡', '累積所有已出餐評分')}
    </section>`;
  }

  function hero() {
    const slogan = state.phase === 'ended' ? '今天也辛苦了。' : '把每一杯，<em>變成好心情。</em>';
    return `<section class="hero" aria-label="咖啡館歡迎區"><div><p class="eyebrow">✦ WELCOME TO LITTLE BEAN CAFÉ</p><h1>${slogan}</h1><p>一間小小的咖啡館，從一杯香濃拿鐵開始。<br>準備好經營自己的溫暖日常了嗎？</p></div><div class="hero-art" aria-hidden="true"><div class="sun"></div><i class="steam steam-a"></i><i class="steam steam-b"></i><i class="steam steam-c"></i><div class="handle"></div><div class="cup-body"></div><div class="saucer"></div><span class="leaf">🌿</span></div></section>`;
  }
  function recipeCard(drink) {
    const active = state.brew.drinkId === drink.id;
    return `<button type="button" class="recipe-card${active ? ' selected' : ''}" data-action="select" data-id="${drink.id}" ${state.phase !== 'serving' ? 'disabled' : ''} aria-pressed="${active}" aria-label="選擇${escapeHtml(drink.name)}，售價${state.prices[drink.id]}元">
      ${active ? '<span class="selected-tick" aria-hidden="true">✓</span>' : ''}
      <span class="drink-circle" style="background:${drink.color}55">${drink.icon}</span><strong>${escapeHtml(drink.name)}</strong><small>${money(state.prices[drink.id])}</small></button>`;
  }
  function ingredientStepper(i) {
    const n = state.brew.ingredients[i.id] || 0;
    return `<div class="ingredient-stepper"><span class="ingredient-name" title="${escapeHtml(i.name)}">${i.emoji} ${escapeHtml(i.name)}</span><div class="stepper-controls"><button type="button" class="stepper-button" data-action="adjust" data-id="${i.id}" data-step="-1" aria-label="減少${escapeHtml(i.name)}" ${!state.brew.drinkId || !n ? 'disabled' : ''}>−</button><span class="ingredient-count" aria-label="${n} 份">${n}</span><button type="button" class="stepper-button" data-action="adjust" data-id="${i.id}" data-step="1" aria-label="增加${escapeHtml(i.name)}" ${!state.brew.drinkId || n >= 9 ? 'disabled' : ''}>+</button></div></div>`;
  }
  function lastFeedback() {
    const f = state.lastFeedback;
    if (!f) return '';
    const newAchievements = (f.unlocked || []).map(id => D.achievements.find(a => a.id === id)).filter(Boolean);
    return `<div class="last-feedback" aria-live="polite"><div class="feedback-score${f.score < 75 ? ' low' : ''}">${f.score}分</div><div class="feedback-details"><strong>${f.score >= 90 ? '漂亮出餐，客人很開心！' : f.score >= 70 ? '順利出餐！' : '這杯還有進步空間'}</strong><p>${f.notes.map(escapeHtml).join('、')} · 小費 ${money(f.tip)}${newAchievements.length ? `<br>🏅 解鎖成就：${newAchievements.map(a => escapeHtml(a.title)).join('、')}` : ''}</p></div></div>`;
  }
  function station() {
    return `<section class="panel panel-pad" aria-labelledby="station-title"><div class="panel-heading"><div><h2 id="station-title" class="panel-title">☕　Barista 工作台</h2><p class="panel-subtitle">先選飲品，再依顧客喜好調整食材比例</p></div>${tag('STEP 01 / 調製')}</div>
      <div class="recipe-list">${D.drinks.map(recipeCard).join('')}</div>
      <hr class="divider-line">
      <div class="mix-title-row"><strong class="mix-title">🥄　調整飲品配方</strong><span class="hint-inline">每項食材 0–9 份</span></div>
      <div class="mix-grid">${D.ingredients.map(ingredientStepper).join('')}</div>
      <div class="mix-foot"><span class="stock-note">${state.upgrades.machine ? `⚙️ 咖啡機 Lv.${state.upgrades.machine}：咖啡類出餐可節省咖啡豆。` : '💡 選擇飲品會自動帶入標準配方，記得確認客製需求！'}</span><button type="button" class="primary-button" data-action="serve" ${!state.brew.drinkId || state.phase !== 'serving' ? 'disabled' : ''}>送出這杯飲品　→</button></div>
      ${lastFeedback()}
    </section>`;
  }
  function ticket() {
    const current = E.currentOrder(state);
    if (state.phase === 'ready') {
      return `<section class="panel panel-pad"><div class="panel-heading"><div><h2 class="panel-title">今日接單窗口</h2><p class="panel-subtitle">新的一天準備開始</p></div>${tag('未開店')}</div><div class="empty-panel"><span class="empty-illustration" aria-hidden="true">🏡</span><h3>開門迎接第一位客人</h3><p>今天預計有 ${E.orderCount(state)} 位客人來訪。確認庫存和菜單後，就可以開始營業囉！</p><button class="primary-button wide" data-action="start" type="button">✦ 開始第 ${state.day} 天營業　→</button></div></section>`;
    }
    if (state.phase === 'day_complete') {
      return `<section class="panel panel-pad"><div class="completion"><div class="completion-icon">🎉</div><strong>今日訂單全部完成！</strong><p>辛苦了！記得打烊，查看今天的營業小日記。</p></div><div class="end-day-stats"><div class="end-day-stat"><span>營收與小費</span><strong>${money(state.dayStats.revenue + state.dayStats.tips)}</strong></div><div class="end-day-stat"><span>顧客滿意度</span><strong>${pct(state.dayStats.totalScore,state.dayStats.served)} 分</strong></div></div><button class="primary-button wide" data-action="close" type="button">打烊，完成今日結算　→</button></section>`;
    }
    if (state.phase === 'ended') {
      const todayNet = state.dayStats.revenue + state.dayStats.tips - state.dayStats.expenses;
      return `<section class="panel panel-pad"><div class="completion"><div class="completion-icon">🌙</div><strong>第 ${state.day} 天，營業結束</strong><p>每一天的努力，都讓小小咖啡館更有模樣。</p></div><div class="end-day-stats"><div class="end-day-stat"><span>今日淨現金流</span><strong>${todayNet < 0 ? '−' : ''}${money(Math.abs(todayNet))}</strong></div><div class="end-day-stat"><span>服務客人</span><strong>${state.dayStats.served} 位</strong></div></div><button class="primary-button wide" data-action="next" type="button">迎接第 ${state.day + 1} 天　→</button><button class="ghost-button" type="button" data-action="report" style="width:100%;margin-top:11px">查看營業日記</button></section>`;
    }
    if (!current) return '';
    const customer = getCustomer(current.customerId);
    const drink = getDrink(current.drinkId);
    return `<section class="panel ticket" aria-label="目前的顧客訂單"><div class="ticket-top"><div class="panel-heading"><div><h2 class="panel-title">🧾　今日客人的點單</h2><p class="panel-subtitle">留意客人的客製需求喔</p></div>${tag('ORDER 0' + (state.orderIndex + 1),true)}</div>
      <div class="customer-profile"><div class="customer-avatar" style="background:${customer.color}" aria-hidden="true">${customer.avatar}</div><div><strong>${escapeHtml(customer.name)} <span style="font-weight:400;color:#a4afa5">｜今天的客人</span></strong><p>「${escapeHtml(customer.line)}」</p></div></div>
      <div class="order-paper"><p class="ticket-label">TODAY'S ORDER</p><div class="order-main"><div class="order-drink">${escapeHtml(drink.name)}</div><span class="order-emoticon" aria-hidden="true">${drink.icon}</span></div><div class="order-mod">✦ ${escapeHtml(current.modifier.label)}</div><div class="order-budget"><span>顧客可接受的最高售價</span><b>${money(current.budget)}</b></div></div>
      </div><div class="ticket-progress"><div class="progress-top"><span>今日服務進度</span><strong>${state.orderIndex} / ${state.orders.length} 杯</strong></div>${progress(state.orderIndex,state.orders.length)}<button class="ghost-button" data-action="skip" type="button" style="margin-top:14px;padding-left:0">食材不夠？可以先到「進貨與庫存」補貨 →</button></div></section>`;
  }
  function game() {
    return hero() + metrics() + `<div class="game-grid">${station()}<div class="side-stack">${ticket()}<section class="mini-tip"><h3>🌿 小豆經營筆記</h3><p>好喝的配方、合理的價格、充足的庫存，是讓客人開心的關鍵。提高評分可收到更多小費；完成一天後記得查看營業日記。</p></section></div></div>`;
  }
  function pageHeading(label, title, desc, extra = '') {
    return `<header class="page-head"><div><p class="eyebrow">${label}</p><h1 class="page-title">${title}</h1><p class="section-lead">${desc}</p></div>${extra}</header>`;
  }
  function menu() {
    const cards = D.drinks.map(d => {
      const ingredients = Object.entries(d.recipe).map(([id, q]) => {
        const i = D.ingredients.find(x => x.id === id);
        return `<span>${escapeHtml(i.name)} × ${q}</span>`;
      }).join('');
      const price = state.prices[d.id];
      return `<article class="menu-item-card"><div class="menu-item-top"><div class="menu-emoji" style="background:${d.color}55">${d.icon}</div><div><h3>${escapeHtml(d.name)}</h3><span class="en">${escapeHtml(d.english)}</span></div></div><p class="card-description">${escapeHtml(d.description)}</p><div class="ingredients-pills" aria-label="標準食材比例">${ingredients}</div><div class="price-control"><label>販售價格<br><span style="color:#b1b8ad">${money(d.minPrice)}～${money(d.maxPrice)}</span></label><div class="price-buttons"><button data-action="price" data-id="${d.id}" data-step="-5" ${price <= d.minPrice ? 'disabled' : ''} aria-label="降低${escapeHtml(d.name)}價格">−</button><strong>${money(price)}</strong><button data-action="price" data-id="${d.id}" data-step="5" ${price >= d.maxPrice ? 'disabled' : ''} aria-label="提高${escapeHtml(d.name)}價格">+</button></div></div></article>`;
    }).join('');
    return `${pageHeading('OUR MENU / 設定售價','一杯咖啡的價值，由你決定。','價格越高不一定越好；超出客人預算會降低滿意度。所有價格以 NT$5 為單位調整。',tag('共 ' + D.drinks.length + ' 款飲品'))}<section class="content-grid">${cards}</section><p class="note-box">☕　配方從飲品卡片自動載入；每位顧客可能提出不同需求，請在前台調整。調高售價可以增加單筆收入，但也可能讓顧客不滿意。</p>`;
  }
  function stock() {
    const cards = D.ingredients.map(i => {
      const count = state.inventory[i.id];
      const pack = i.pack + Math.floor(i.pack * 0.25 * state.upgrades.storage);
      const low = count < 8;
      return `<article class="stock-card"><div class="stock-heading"><div class="stock-emoji" style="background:${i.color}25">${i.emoji}</div><div><h3>${escapeHtml(i.name)}</h3><div class="stock-count">剩餘 <strong>${count} 份</strong> ${low ? ' · 庫存偏低' : ''}</div></div></div><div class="stock-track" aria-label="${escapeHtml(i.name)}庫存參考比例"><span class="${low ? 'low-stock' : ''}" style="width:${Math.min(100,count / Math.max(18,i.initial) * 100)}%"></span></div><div class="stock-bottom"><small>補貨 +${pack} 份</small><button type="button" class="buy-button" data-action="buy" data-id="${i.id}" ${state.cash < i.price || state.phase === 'ended' ? 'disabled' : ''}>進貨 ${money(i.price)}</button></div></article>`;
    }).join('');
    return `${pageHeading('PANTRY / 經營你的庫存','新鮮食材，幸福補給。','每次製作都會消耗食材。庫存不足時請補貨，咖啡館才能繼續出餐。',tag('目前現金 ' + money(state.cash)))}<section class="stock-grid">${cards}</section><div class="note-box">💡　升級「大容量原料櫃」可以讓相同進貨價格買到更多食材；「專業咖啡機」則能節省咖啡豆消耗。</div>`;
  }
  function upgrades() {
    const cards = D.upgrades.map(u => {
      const level = state.upgrades[u.id];
      const maxed = level >= u.max;
      const price = u.price * (level + 1);
      return `<article class="upgrade-card"><div class="upgrade-head"><div class="upgrade-emoji">${u.icon}</div><div><h3 class="upgrade-title">${escapeHtml(u.title)}</h3><div class="level-row" aria-label="等級 ${level}，最高 ${u.max}">${Array.from({ length: u.max }, (_, j) => `<span class="level-dot${j < level ? ' on' : ''}"></span>`).join('')}</div></div></div><p>${escapeHtml(u.description)}</p><div class="upgrade-foot"><span>${maxed ? '已達 MAX LEVEL' : money(price)}</span><button type="button" class="${maxed ? 'secondary-button' : 'buy-button'}" data-action="upgrade" data-id="${u.id}" ${maxed || state.cash < price || state.phase === 'ended' ? 'disabled' : ''}>${maxed ? '已升級完成 ✓' : `升級到 Lv.${level + 1} →`}</button></div></article>`;
    }).join('');
    return `${pageHeading('GROW YOUR CAFÉ / 擴大經營','讓這間小店，慢慢變得更好。','升級設備與服務，提升咖啡館的經營效率。每項最多可升級兩次。',tag('可用資金 ' + money(state.cash)))}<section class="upgrade-grid">${cards}</section><div class="note-box">📣　人氣計畫增加的來客數會在下一個營業日生效；其他升級購買後立即生效。</div>`;
  }
  function report() {
    const achievements = D.achievements.map(a => `<div class="achievement${state.unlocked.includes(a.id) ? '' : ' locked'}" title="${escapeHtml(a.description)}"><div class="achievement-icon">${a.icon}</div><div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.description)}</small></div></div>`).join('');
    const records = [...state.history].reverse().map(h => `<tr><td>DAY ${String(h.day).padStart(2,'0')}</td><td>${h.served} 杯</td><td>${money(h.revenue + h.tips)}</td><td>${money(h.expenses)}</td><td>${h.revenue + h.tips - h.expenses < 0 ? '−' : ''}${money(Math.abs(h.revenue + h.tips - h.expenses))}</td><td>${h.satisfaction} 分</td></tr>`).join('');
    const best = state.history.length ? Math.max(...state.history.map(h => h.satisfaction)) : 0;
    return `${pageHeading('CAFÉ DIARY / 你的店長日記','每一段努力，都值得記住。','記錄每天的經營表現，看看你的咖啡館變得多厲害。','<button class="secondary-button" data-action="export" type="button">↓ 匯出存檔 JSON</button>')}
      ${metrics()}<h2 class="report-section-title">🏅　收集咖啡館成就 <span class="report-subtitle">已獲得 ${state.unlocked.length} / ${D.achievements.length}</span></h2><section class="achievements">${achievements}</section>
      <h2 class="report-section-title">📖　每日營業紀錄 <span class="report-subtitle">最高單日滿意度 ${best} 分</span></h2><section class="panel panel-pad"><div class="table-scroll"><table class="report-table"><thead><tr><th>營業日</th><th>出餐量</th><th>營收＋小費</th><th>當日支出</th><th>淨現金流</th><th>平均滿意度</th></tr></thead><tbody>${records || '<tr><td colspan="6" class="report-empty">目前沒有完成的營業日。先到前台迎接你的第一位客人吧 ☕</td></tr>'}</tbody></table></div></section>
      <div class="note-box">📌　「當日支出」包含該營業日的補貨與升級費用。「淨現金流」＝營收＋小費－當日支出；它不是扣除所有食材成本後的會計利潤。所有資料只存在這台裝置的瀏覽器。</div>`;
  }

  function render() {
    document.getElementById('page-name').textContent = names[view];
    document.getElementById('day-label').textContent = `DAY ${String(state.day).padStart(2,'0')}`;
    const phase = document.getElementById('phase-label');
    phase.className = 'status-pill' + (state.phase === 'serving' ? ' running' : ['ended','day_complete'].includes(state.phase) ? ' ended' : '');
    phase.innerHTML = `<span class="live-dot"></span>${({ ready: '營業準備中', serving: '營業中', day_complete: '等待打烊', ended: '今日已打烊' })[state.phase]}`;
    document.querySelectorAll('[data-view]').forEach(b => {
      const current = b.dataset.view === view;
      b.classList.toggle('active', current);
      if (current) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    root.innerHTML = ({ game, menu, stock, upgrades, report })[view]();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), game: 'Little Bean Café', save: state }, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `little-bean-cafe-day-${state.day}-save.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('已匯出遊戲紀錄 JSON！');
  }

  root.addEventListener('click', event => {
    const target = event.target.closest('button[data-action]');
    if (!target || target.disabled) return;
    const { action, id } = target.dataset;
    const step = Number(target.dataset.step || '0');
    switch (action) {
      case 'start': run(E.startDay(state)); break;
      case 'select': run(E.selectDrink(state, id), { silent: true }); break;
      case 'adjust': run(E.adjustIngredient(state, id, step), { silent: true }); break;
      case 'serve': run(E.serve(state)); break;
      case 'buy': run(E.buyIngredient(state, id)); break;
      case 'price': run(E.updatePrice(state, id, state.prices[id] + step), { silent: true }); break;
      case 'upgrade': run(E.upgradeShop(state, id)); break;
      case 'close': run(E.closeDay(state)); break;
      case 'next': run(E.nextDay(state)); break;
      case 'report': viewTo('report'); break;
      case 'skip': viewTo('stock'); break;
      case 'export': exportData(); break;
    }
  });
  document.getElementById('nav').addEventListener('click', event => {
    const button = event.target.closest('button[data-view]');
    if (button) viewTo(button.dataset.view);
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (window.confirm('確定清除所有進度、資金、升級與歷史紀錄，重新開店嗎？這個動作無法復原。')) {
      state = E.createInitialState();
      save();
      viewTo('game');
      notify('遊戲進度已重設，歡迎再次開店！');
    }
  });
  document.getElementById('help-btn').addEventListener('click', () => helpDialog.showModal());
  document.getElementById('close-help').addEventListener('click', () => helpDialog.close());
  document.getElementById('got-it').addEventListener('click', () => helpDialog.close());
  helpDialog.addEventListener('click', event => { if (event.target === helpDialog) helpDialog.close(); });
  render();
})();
