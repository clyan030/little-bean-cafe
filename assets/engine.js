/* Game rules: pure, testable functions. No DOM and no network requests. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./data.js') : root.CafeData);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CafeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (data) {
  'use strict';
  const byId = (items, id) => items.find(item => item.id === id);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const blankDay = () => ({ revenue: 0, tips: 0, served: 0, totalScore: 0, expenses: 0, feedbacks: [] });
  const defaultBrew = () => ({ drinkId: null, ingredients: {} });
  const result = (state, ok, message, extra = {}) => ({ state, ok, message, ...extra });

  function createInitialState() {
    return {
      version: data.stateVersion,
      day: 1,
      phase: 'ready', // ready | serving | day_complete | ended
      cash: 1000,
      inventory: Object.fromEntries(data.ingredients.map(i => [i.id, i.initial])),
      prices: Object.fromEntries(data.drinks.map(d => [d.id, d.price])),
      upgrades: Object.fromEntries(data.upgrades.map(u => [u.id, 0])),
      orders: [],
      orderIndex: 0,
      brew: defaultBrew(),
      dayStats: blankDay(),
      totalServed: 0,
      totalRevenue: 0,
      totalTips: 0,
      totalScore: 0,
      history: [],
      unlocked: [],
      lastFeedback: null
    };
  }

  function restoreState(value) {
    const fresh = createInitialState();
    if (!value || typeof value !== 'object' || value.version !== data.stateVersion) return fresh;
    const numeric = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
    if (!Number.isInteger(value.day) || value.day < 1 || value.day > 100000) return fresh;
    if (!['ready', 'serving', 'day_complete', 'ended'].includes(value.phase)) return fresh;
    if (!numeric(value.cash) || !Number.isInteger(value.orderIndex)) return fresh;
    if (!value.inventory || !value.prices || !value.upgrades || !Array.isArray(value.orders) || !value.dayStats) return fresh;
    if (data.ingredients.some(i => !Number.isInteger(value.inventory[i.id]) || value.inventory[i.id] < 0)) return fresh;
    if (data.drinks.some(d => !Number.isInteger(value.prices[d.id]) || value.prices[d.id] < d.minPrice || value.prices[d.id] > d.maxPrice)) return fresh;
    if (data.upgrades.some(u => !Number.isInteger(value.upgrades[u.id]) || value.upgrades[u.id] < 0 || value.upgrades[u.id] > u.max)) return fresh;
    if (value.orderIndex < 0 || value.orderIndex > value.orders.length) return fresh;
    if (!Array.isArray(value.history) || !Array.isArray(value.unlocked)) return fresh;
    const s = { ...fresh, ...clone(value) };
    if (!s.brew || !s.brew.ingredients || (s.brew.drinkId && !byId(data.drinks, s.brew.drinkId))) s.brew = defaultBrew();
    for (const id of Object.keys(s.brew.ingredients)) {
      if (!byId(data.ingredients, id) || !Number.isInteger(s.brew.ingredients[id]) || s.brew.ingredients[id] < 0 || s.brew.ingredients[id] > 9) s.brew = defaultBrew();
    }
    if (!Number.isInteger(s.totalServed) || !numeric(s.totalRevenue) || !numeric(s.totalTips) || !numeric(s.totalScore)) return fresh;
    if (!Number.isInteger(s.dayStats.served) || !numeric(s.dayStats.revenue) || !numeric(s.dayStats.tips) || !numeric(s.dayStats.totalScore) || !numeric(s.dayStats.expenses) || !Array.isArray(s.dayStats.feedbacks)) return fresh;
    if (s.orders.some(o => !byId(data.customers, o.customerId) || !byId(data.drinks, o.drinkId) || !o.modifier || !Number.isInteger(o.budget))) return fresh;
    return s;
  }

  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function orderCount(state) { return 4 + state.upgrades.promotion; }
  function makeOrders(state) {
    const rng = random(98127 + state.day * 8713 + state.upgrades.promotion * 53);
    const n = orderCount(state);
    const orders = [];
    for (let index = 0; index < n; index++) {
      const drink = state.day === 1 && index === 0 ? byId(data.drinks, 'latte') : data.drinks[Math.floor(rng() * data.drinks.length)];
      const customer = data.customers[Math.floor(rng() * data.customers.length)];
      const choices = Object.entries(drink.recipe).filter(([, amount]) => amount >= 1);
      let modifier = { ingredient: null, delta: 0, label: '正常配方' };
      if (!(state.day === 1 && index === 0) && rng() > 0.34) {
        const [ingredient, amount] = choices[Math.floor(rng() * choices.length)];
        const delta = rng() > 0.45 || amount === 1 ? 1 : -1;
        const label = (delta > 0 ? '多加一份' : '少放一份') + byId(data.ingredients, ingredient).name;
        modifier = { ingredient, delta, label };
      }
      const willingness = (state.day === 1 && index === 0) ? 15 : [-5, 0, 5, 10, 15][Math.floor(rng() * 5)];
      orders.push({ id: `${state.day}-${index}`, customerId: customer.id, drinkId: drink.id, modifier, budget: drink.price + willingness });
    }
    return orders;
  }

  function startDay(state) {
    if (state.phase !== 'ready') return result(state, false, '目前無法開始營業。');
    const s = clone(state);
    s.orders = makeOrders(s);
    s.orderIndex = 0;
    s.phase = 'serving';
    s.brew = defaultBrew();
    s.lastFeedback = null;
    return result(s, true, `第 ${s.day} 天開店！今天有 ${s.orders.length} 位客人。`);
  }

  function currentOrder(state) {
    return state.phase === 'serving' ? state.orders[state.orderIndex] || null : null;
  }

  function targetIngredients(order) {
    if (!order) return {};
    const drink = byId(data.drinks, order.drinkId);
    if (!drink) return {};
    const recipe = { ...drink.recipe };
    const mod = order.modifier;
    if (mod && mod.ingredient && byId(data.ingredients, mod.ingredient)) {
      recipe[mod.ingredient] = clamp((recipe[mod.ingredient] || 0) + mod.delta, 0, 9);
    }
    return recipe;
  }

  function selectDrink(state, drinkId) {
    if (state.phase !== 'serving') return result(state, false, '營業中才能製作飲品。');
    const drink = byId(data.drinks, drinkId);
    if (!drink) return result(state, false, '找不到這款飲品。');
    const s = clone(state);
    s.brew = { drinkId, ingredients: { ...drink.recipe } };
    return result(s, true, `已選擇${drink.name}，可以微調配方。`);
  }

  function adjustIngredient(state, ingredientId, delta) {
    if (state.phase !== 'serving' || !state.brew.drinkId) return result(state, false, '請先選擇飲品。');
    if (!byId(data.ingredients, ingredientId) || ![-1, 1].includes(delta)) return result(state, false, '不支援這項調整。');
    const s = clone(state);
    s.brew.ingredients[ingredientId] = clamp((s.brew.ingredients[ingredientId] || 0) + delta, 0, 9);
    return result(s, true, '已調整配方。');
  }

  function stockRequirements(state) {
    const recipe = { ...state.brew.ingredients };
    const drink = byId(data.drinks, state.brew.drinkId);
    if (drink && drink.category === 'coffee' && recipe.beans) {
      recipe.beans = Math.max(1, recipe.beans - state.upgrades.machine);
    }
    return recipe;
  }

  function missingStock(state) {
    return Object.entries(stockRequirements(state))
      .filter(([id, amount]) => amount > (state.inventory[id] || 0))
      .map(([id, amount]) => ({ id, need: amount, have: state.inventory[id] || 0, name: byId(data.ingredients, id).name }));
  }

  function unlockAchievements(state, score) {
    const possibilities = [
      ['first', state.totalServed >= 1],
      ['perfect', score === 100],
      ['ten', state.totalServed >= 10],
      ['decor', state.upgrades.decor >= 1],
      ['three', state.history.length >= 3],
      ['revenue', state.totalRevenue >= 2500]
    ];
    const newly = possibilities.filter(([id, yes]) => yes && !state.unlocked.includes(id)).map(([id]) => id);
    state.unlocked.push(...newly);
    return newly;
  }

  function serve(state) {
    const order = currentOrder(state);
    if (!order) return result(state, false, '目前沒有待完成的訂單。');
    const selected = byId(data.drinks, state.brew.drinkId);
    if (!selected) return result(state, false, '請先選擇要製作的飲品。');
    const shortages = missingStock(state);
    if (shortages.length) return result(state, false, `食材不足：${shortages.map(x => `${x.name}還需要 ${x.need - x.have} 份`).join('、')}。請到進貨倉庫補貨。`);

    const s = clone(state);
    const expected = targetIngredients(order);
    const actual = s.brew.ingredients;
    let difference = 0;
    for (const item of data.ingredients) difference += Math.abs((expected[item.id] || 0) - (actual[item.id] || 0));
    const chosenPrice = s.prices[selected.id];
    const pricePenalty = chosenPrice > order.budget ? 15 + 3 * Math.floor((chosenPrice - order.budget) / 10) : 0;
    const wrongDrink = selected.id !== order.drinkId;
    const score = clamp(100 - (wrongDrink ? 38 : 0) - difference * 10 - pricePenalty, 0, 100);
    const tip = (score >= 92 ? 20 : score >= 75 ? 10 : 0) + s.upgrades.decor * 4;
    const notes = [];
    if (wrongDrink) notes.push('飲品種類與點單不符');
    if (difference) notes.push(`配方與客製需求相差 ${difference} 份`);
    if (pricePenalty) notes.push('定價超出顧客預算');
    if (!notes.length) notes.push('飲品與客製需求都正確！');

    for (const [id, quantity] of Object.entries(stockRequirements(s))) {
      s.inventory[id] -= quantity;
    }
    s.cash += chosenPrice + tip;
    s.totalServed++;
    s.totalRevenue += chosenPrice;
    s.totalTips += tip;
    s.totalScore += score;
    s.dayStats.served++;
    s.dayStats.revenue += chosenPrice;
    s.dayStats.tips += tip;
    s.dayStats.totalScore += score;
    const feedback = {
      id: order.id, customerId: order.customerId, orderedDrink: order.drinkId,
      servedDrink: selected.id, score, price: chosenPrice, tip, notes
    };
    s.dayStats.feedbacks.push(feedback);
    const unlocked = unlockAchievements(s, score);
    s.lastFeedback = { ...feedback, unlocked };
    s.orderIndex++;
    s.brew = defaultBrew();
    if (s.orderIndex >= s.orders.length) s.phase = 'day_complete';
    return result(s, true, score >= 90 ? '客人很滿意，太棒了！' : score >= 70 ? '順利出餐！下次可以更精準。' : '出餐完成，但客人似乎不太滿意。', { feedback });
  }

  function buyIngredient(state, ingredientId) {
    if (state.phase === 'ended') return result(state, false, '請先迎接下一個營業日，再進行補貨。');
    const ingredient = byId(data.ingredients, ingredientId);
    if (!ingredient) return result(state, false, '查無這項食材。');
    if (state.cash < ingredient.price) return result(state, false, '現金不足，無法補貨。');
    const s = clone(state);
    const quantity = ingredient.pack + Math.floor(ingredient.pack * 0.25 * s.upgrades.storage);
    s.cash -= ingredient.price;
    s.inventory[ingredientId] += quantity;
    s.dayStats.expenses += ingredient.price;
    return result(s, true, `${ingredient.name}補貨成功，增加 ${quantity} 份！`);
  }

  function updatePrice(state, drinkId, price) {
    const drink = byId(data.drinks, drinkId);
    if (!drink || !Number.isInteger(price) || price % 5 || price < drink.minPrice || price > drink.maxPrice) {
      return result(state, false, '價格必須在允許範圍內，以 NT$5 為單位調整。');
    }
    const s = clone(state);
    s.prices[drinkId] = price;
    return result(s, true, `${drink.name}售價已調整為 NT$${price}。`);
  }

  function upgradeShop(state, upgradeId) {
    if (state.phase === 'ended') return result(state, false, '請先迎接下一個營業日，再進行升級。');
    const upgrade = byId(data.upgrades, upgradeId);
    if (!upgrade) return result(state, false, '找不到這項升級。');
    const level = state.upgrades[upgradeId];
    if (level >= upgrade.max) return result(state, false, '已升至最高等級。');
    const price = upgrade.price * (level + 1);
    if (state.cash < price) return result(state, false, `現金不足，需要 NT$${price}。`);
    const s = clone(state);
    s.upgrades[upgradeId]++;
    s.cash -= price;
    s.dayStats.expenses += price;
    const unlocked = unlockAchievements(s, -1);
    return result(s, true, `${upgrade.title}升級到 Lv.${s.upgrades[upgradeId]}！`, { unlocked });
  }

  function closeDay(state) {
    if (state.phase !== 'day_complete') return result(state, false, '請先完成今天的所有訂單。');
    const s = clone(state);
    const summary = {
      day: s.day, ...clone(s.dayStats),
      satisfaction: s.dayStats.served ? Math.round(s.dayStats.totalScore / s.dayStats.served) : 0,
      cash: s.cash
    };
    s.history.push(summary);
    s.phase = 'ended';
    const unlocked = unlockAchievements(s, -1);
    return result(s, true, `第 ${s.day} 天營業結束！`, { summary, unlocked });
  }

  function nextDay(state) {
    if (state.phase !== 'ended') return result(state, false, '今天尚未打烊。');
    const s = clone(state);
    s.day++;
    s.phase = 'ready';
    s.orders = [];
    s.orderIndex = 0;
    s.brew = defaultBrew();
    s.dayStats = blankDay();
    s.lastFeedback = null;
    return result(s, true, `準備迎接第 ${s.day} 天！`);
  }

  function averageScore(state) {
    return state.totalServed ? Math.round(state.totalScore / state.totalServed) : 0;
  }
  return {
    createInitialState, restoreState, makeOrders, orderCount, startDay, currentOrder,
    targetIngredients, selectDrink, adjustIngredient, stockRequirements, missingStock,
    serve, buyIngredient, updatePrice, upgradeShop, closeDay, nextDay, averageScore
  };
});
