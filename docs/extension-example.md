# AI 延伸功能示範：讓規範真正能被重複使用

## 現有架構為什麼容易擴充？

- 顧客訂單依 `assets/data.js` 的 `drinks` 自動生成。
- 菜單售價卡與前台飲品選擇由 `data.drinks.map(...)` 渲染，不需要為每杯飲品複製新 HTML。
- 飲品標準配方直接來自 `recipe`；增減食材依 ingredient ID 動態渲染。
- `engine.js` 對所有飲品使用同樣的評分與庫存規則，無須為每一杯加一套 if/else。
- 透過 `AGENTS.md` 限定範圍、命名、測試及存檔相容性，降低 AI 任意重構、導致舊功能失效的風險。

## 可以請 AI 執行的擴充指令

```text
請先讀根目錄 AGENTS.md，遵守裡面的開發規則。
我想為「Little Bean Café」新增「蜂蜜拿鐵」：
- 名稱：蜂蜜拿鐵 / Honey Latte
- id：honeylatte
- 類別：coffee
- 基礎配方：咖啡豆2、鮮奶3、蜂蜜1
- 售價：NT$140，調價範圍：NT$110–190
- 卡片顏色：#e6c99a，icon 用 🍯
請讓飲品自動出現在「菜單與定價」「咖啡館前台」，並能被隨機顧客點到。
不能破壞既有價格、遊戲流程、存檔與 GitHub Pages 的純靜態部署。
請新增存檔相容性／飲品規格測試，執行 node --test tests/game.test.js，
最後列出實際改動檔案與測試結果。
```

### 預期修改

1. `assets/data.js` 新增一筆飲品物件。
2. `assets/engine.js` 的 `restoreState()` 為舊存檔補上 `honeylatte` 的預設價格（如果是從既有版本擴充）。
3. `tests/game.test.js` 增加新飲品規則與舊存檔相容性測試。
4. `README.md` 更新飲品數量。

**不應修改**：所有現有飲品的 ID、既有菜單 HTML 版型、庫存演算法、已上線的 URL 結構。

> 以上是「可以交給 AI 的擴充指令」，不是已經加入本版本的功能。現在正式遊戲內有 7 杯飲品。
