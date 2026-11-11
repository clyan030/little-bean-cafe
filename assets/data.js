/*
 * Little Bean Café — editable game content.
 * To add a drink, ingredient or customer, follow AGENTS.md before editing.
 * Keep IDs stable: saved games refer to them.
 */
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  root.CafeData = data;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ingredients = [
    { id: 'beans', name: '咖啡豆', emoji: '🫘', initial: 30, pack: 18, price: 70, color: '#a16c4c' },
    { id: 'milk', name: '鮮奶', emoji: '🥛', initial: 36, pack: 18, price: 65, color: '#e6bf83' },
    { id: 'water', name: '純淨水', emoji: '💧', initial: 48, pack: 24, price: 25, color: '#8cb9c4' },
    { id: 'ice', name: '冰塊', emoji: '🧊', initial: 32, pack: 20, price: 20, color: '#a6d0d7' },
    { id: 'cocoa', name: '可可粉', emoji: '🍫', initial: 14, pack: 10, price: 52, color: '#ac7b5c' },
    { id: 'matcha', name: '抹茶粉', emoji: '🍵', initial: 16, pack: 10, price: 60, color: '#9fb582' },
    { id: 'sugar', name: '砂糖', emoji: '🍬', initial: 22, pack: 14, price: 32, color: '#cfb69d' },
    { id: 'tea', name: '紅茶葉', emoji: '🫖', initial: 18, pack: 12, price: 45, color: '#bd9367' },
    { id: 'honey', name: '蜂蜜', emoji: '🍯', initial: 14, pack: 10, price: 48, color: '#e2b44e' }
  ];

  // A recipe is a mapping of ingredient IDs to non-negative integers.
  const drinks = [
    { id: 'espresso', name: '濃縮咖啡', english: 'Espresso', icon: '☕', category: 'coffee', color: '#e5b792', price: 75, minPrice: 55, maxPrice: 120, description: '小小一杯，香氣滿分', recipe: { beans: 2, water: 1 } },
    { id: 'americano', name: '冰美式', english: 'Iced Americano', icon: '🧊', category: 'coffee', color: '#d7c0a8', price: 90, minPrice: 65, maxPrice: 140, description: '清爽又帶點大人味', recipe: { beans: 2, water: 3, ice: 1 } },
    { id: 'latte', name: '冰拿鐵', english: 'Iced Latte', icon: '🥛', category: 'coffee', color: '#f0ccaa', price: 120, minPrice: 90, maxPrice: 165, description: '咖啡與奶香的剛好比例', recipe: { beans: 2, milk: 3, water: 1, ice: 1 } },
    { id: 'cappuccino', name: '卡布奇諾', english: 'Cappuccino', icon: '☁️', category: 'coffee', color: '#e6c3a4', price: 125, minPrice: 90, maxPrice: 170, description: '蓬鬆奶泡般的好心情', recipe: { beans: 2, milk: 2, water: 1 } },
    { id: 'mocha', name: '摩卡可可', english: 'Café Mocha', icon: '🍫', category: 'coffee', color: '#d4aa90', price: 135, minPrice: 100, maxPrice: 180, description: '巧克力愛好者的最愛', recipe: { beans: 2, milk: 2, cocoa: 1, sugar: 1 } },
    { id: 'matcha', name: '抹茶歐蕾', english: 'Matcha Latte', icon: '🍵', category: 'tea', color: '#b8c99f', price: 130, minPrice: 95, maxPrice: 175, description: '有一點苦，也有一點甜', recipe: { matcha: 2, milk: 3, sugar: 1, ice: 1 } },
    { id: 'honeytea', name: '蜂蜜冰紅茶', english: 'Honey Black Tea', icon: '🍯', category: 'tea', color: '#e5c386', price: 100, minPrice: 75, maxPrice: 150, description: '午後的一口清甜', recipe: { tea: 2, water: 2, honey: 1, ice: 2 } }
  ];

  const customers = [
    { id: 'yuna', name: '小羽', avatar: '👩🏻', line: '今天想喝點療癒的！', color: '#f7d5bf' },
    { id: 'kai', name: '阿凱', avatar: '🧑🏻', line: '等等還有好多工作呢。', color: '#d7e4cf' },
    { id: 'mei', name: '美美', avatar: '👩🏽', line: '聽說這裡的飲品很好喝！', color: '#e6d5e9' },
    { id: 'bo', name: '阿波', avatar: '👨🏻', line: '一杯咖啡，補充元氣。', color: '#f4dfb7' },
    { id: 'lin', name: '小林', avatar: '🧑🏽', line: '希望今天有個好開始。', color: '#cfdbef' },
    { id: 'lulu', name: '露露', avatar: '👩🏻‍🦰', line: '想找個舒服的角落坐坐。', color: '#f4d0ce' },
    { id: 'hao', name: '阿豪', avatar: '👨🏽', line: '朋友推薦我來這間店！', color: '#dae8c5' }
  ];

  const upgrades = [
    { id: 'machine', title: '專業咖啡機', icon: '⚙️', price: 280, max: 2, description: '咖啡飲品每杯節省 1 單位咖啡豆／等級（最少仍使用 1）', effect: '降低咖啡豆消耗' },
    { id: 'decor', title: '舒適店內裝潢', icon: '🪴', price: 250, max: 2, description: '每杯小費額外增加 NT$4／等級', effect: '增加每單小費' },
    { id: 'storage', title: '大容量原料櫃', icon: '🗄️', price: 230, max: 2, description: '補貨包數量增加 25%／等級（向下取整）', effect: '提高進貨效率' },
    { id: 'promotion', title: '咖啡館人氣計畫', icon: '📣', price: 300, max: 2, description: '從下一個營業日起，每天額外增加 1 位客人／等級', effect: '提升來客人數' }
  ];

  const achievements = [
    { id: 'first', title: '第一杯的溫度', icon: '☕', description: '成功完成第一杯飲品' },
    { id: 'perfect', title: '黃金比例', icon: '✨', description: '獲得一次 100 分的滿意度' },
    { id: 'ten', title: '熟客的最愛', icon: '💛', description: '累積服務 10 位客人' },
    { id: 'decor', title: '有家的感覺', icon: '🪴', description: '首次升級店內裝潢' },
    { id: 'three', title: '第三個早晨', icon: '🌤️', description: '完成 3 個營業日' },
    { id: 'revenue', title: '人氣小店', icon: '🏅', description: '累積營收達 NT$2,500' }
  ];

  return { ingredients, drinks, customers, upgrades, achievements, stateVersion: 1 };
});
