// Run: node --test tests/game.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../assets/data.js');
const E = require('../assets/engine.js');

function open() {
  const result = E.startDay(E.createInitialState());
  assert.equal(result.ok, true);
  return result.state;
}
function perfectFirstCup() {
  let s = open();
  const order = E.currentOrder(s);
  assert.equal(order.drinkId, 'latte');
  assert.equal(order.modifier.delta, 0);
  s = E.selectDrink(s, 'latte').state;
  const served = E.serve(s);
  assert.equal(served.ok, true);
  return served;
}

test('initial game state has stable prices, positive stock, and ready state', () => {
  const s = E.createInitialState();
  assert.equal(s.day, 1);
  assert.equal(s.cash, 1000);
  assert.equal(s.phase, 'ready');
  for (const i of D.ingredients) assert.equal(s.inventory[i.id], i.initial);
  for (const d of D.drinks) assert.equal(s.prices[d.id], d.price);
});

test('first-day tutorial gives a standard latte order within budget', () => {
  const s = open();
  assert.equal(s.orders.length, 4);
  assert.deepEqual(E.currentOrder(s).modifier, { ingredient: null, delta: 0, label: '正常配方' });
  assert.ok(E.currentOrder(s).budget >= D.drinks.find(d => d.id === 'latte').price);
});

test('serving a perfect drink updates cash, inventory, statistics and badge', () => {
  const before = open();
  const startingMilk = before.inventory.milk;
  const result = perfectFirstCup();
  const s = result.state;
  assert.equal(result.feedback.score, 100);
  assert.equal(s.inventory.milk, startingMilk - 3);
  assert.equal(s.cash, 1140);
  assert.equal(s.dayStats.revenue, 120);
  assert.equal(s.dayStats.tips, 20);
  assert.equal(s.totalServed, 1);
  assert.deepEqual(s.unlocked, ['first', 'perfect']);
  assert.equal(s.orderIndex, 1);
});

test('a customer custom request changes the required recipe', () => {
  const s = open();
  const order = { drinkId: 'latte', modifier: { ingredient: 'milk', delta: 1 } };
  assert.equal(E.targetIngredients(order).milk, 4);
  const decrease = { drinkId: 'latte', modifier: { ingredient: 'ice', delta: -1 } };
  assert.equal(E.targetIngredients(decrease).ice, 0);
  assert.equal(E.currentOrder(s).drinkId, 'latte');
});

test('missing stock blocks serving and never debits inventory or cash', () => {
  let s = E.selectDrink(open(), 'latte').state;
  s.inventory.milk = 0;
  const original = JSON.stringify(s);
  const result = E.serve(s);
  assert.equal(result.ok, false);
  assert.match(result.message, /鮮奶/);
  assert.equal(JSON.stringify(s), original);
});

test('wrong drink or wrong recipe lowers customer satisfaction', () => {
  let s = E.selectDrink(open(), 'espresso').state;
  const result = E.serve(s);
  assert.equal(result.ok, true);
  assert.ok(result.feedback.score < 75);
  assert.ok(result.feedback.notes.some(n => n.includes('飲品種類')));
});

test('overpricing makes a customer less happy', () => {
  let s = E.selectDrink(open(), 'latte').state;
  s.prices.latte = 165;
  const result = E.serve(s);
  assert.equal(result.ok, true);
  assert.ok(result.feedback.score < 100);
  assert.ok(result.feedback.notes.includes('定價超出顧客預算'));
});

test('buying inventory costs cash, adds packs, and records spending', () => {
  let s = E.createInitialState();
  const result = E.buyIngredient(s, 'milk');
  assert.equal(result.ok, true);
  assert.equal(result.state.cash, s.cash - 65);
  assert.equal(result.state.inventory.milk, s.inventory.milk + 18);
  assert.equal(result.state.dayStats.expenses, 65);
});

test('storage increases supply pack and coffee machine saves beans', () => {
  let s = E.createInitialState();
  s = E.upgradeShop(s, 'storage').state;
  assert.equal(s.upgrades.storage, 1);
  const buy = E.buyIngredient(s, 'milk');
  assert.equal(buy.state.inventory.milk - s.inventory.milk, 18 + Math.floor(18 * 0.25));
  s = E.startDay(E.createInitialState()).state;
  s = E.upgradeShop(s, 'machine').state;
  s = E.selectDrink(s, 'latte').state;
  assert.equal(E.stockRequirements(s).beans, 1);
  assert.equal(s.brew.ingredients.beans, 2);
});

test('promotions increase next day customers and upgrade costs scale', () => {
  const s = E.createInitialState();
  const upgraded = E.upgradeShop(s, 'promotion').state;
  assert.equal(E.orderCount(s), 4);
  assert.equal(E.orderCount(upgraded), 5);
  assert.equal(E.startDay(upgraded).state.orders.length, 5);
  assert.equal(E.upgradeShop(upgraded, 'promotion').state.cash, upgraded.cash - 600);
});

test('pricing enforces per-drink range and NT$5 increments', () => {
  const s = E.createInitialState();
  assert.equal(E.updatePrice(s, 'latte', 122).ok, false);
  assert.equal(E.updatePrice(s, 'latte', 500).ok, false);
  assert.equal(E.updatePrice(s, 'latte', 125).state.prices.latte, 125);
});

test('day can only close after all customers are served', () => {
  let s = open();
  assert.equal(E.closeDay(s).ok, false);
  while (s.phase === 'serving') {
    const o = E.currentOrder(s);
    const selected = E.selectDrink(s, o.drinkId);
    s = selected.state;
    if (o.modifier.ingredient) s = E.adjustIngredient(s, o.modifier.ingredient, o.modifier.delta).state;
    const served = E.serve(s);
    assert.equal(served.ok, true, served.message);
    s = served.state;
  }
  assert.equal(s.phase, 'day_complete');
  s = E.closeDay(s).state;
  assert.equal(s.phase, 'ended');
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].served, 4);
  assert.equal(E.buyIngredient(s, 'beans').ok, false);
  assert.equal(E.upgradeShop(s, 'decor').ok, false);
  s = E.nextDay(s).state;
  assert.equal(s.day, 2);
  assert.equal(s.phase, 'ready');
  assert.equal(s.dayStats.served, 0);
});

test('save restoration roundtrips, rejects invalid and corrupt values', () => {
  const s = perfectFirstCup().state;
  assert.deepEqual(E.restoreState(JSON.parse(JSON.stringify(s))), s);
  assert.equal(E.restoreState({ version: -1 }).phase, 'ready');
  assert.equal(E.restoreState({ ...s, inventory: { ...s.inventory, milk: -3 } }).cash, 1000);
});

test('content schema has unique IDs and valid ingredient references', () => {
  const unique = arr => new Set(arr.map(x => x.id)).size === arr.length;
  for (const collection of [D.ingredients, D.drinks, D.customers, D.upgrades, D.achievements]) assert.ok(unique(collection));
  for (const drink of D.drinks) {
    assert.ok(Object.keys(drink.recipe).length);
    assert.ok(drink.minPrice <= drink.price && drink.price <= drink.maxPrice);
    for (const [id, amount] of Object.entries(drink.recipe)) {
      assert.ok(D.ingredients.some(i => i.id === id));
      assert.ok(Number.isInteger(amount) && amount > 0 && amount <= 9);
    }
  }
});
