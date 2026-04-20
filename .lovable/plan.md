
S20 上一直閃「正在辨識交易單」(`scan.processing`) — 這個訊息在 `busy === true` 時顯示，亦即 `processDecodedText` 正在跑。會「一直閃」表示同一筆 TN 反覆被觸發 → busy 進去 → API 回完 → busy 退出 → 又被觸發。

## 根本原因

看現在的 `processDecodedText`：
```ts
processedTnsRef.current.add(tn);
// ...
if (result.alreadyUsed) {
  blockedRef.current = true;   // ← 已用會 block，OK
  return;
}
navigatingAway = true;
await stopScanner();
navigate(...);                 // ← 成功會離頁，OK
```

但有兩個漏洞讓 S20 卡循環：

1. **API 出錯時會 `processedTnsRef.current.delete(tn)`**，於是下一幀又掃到同一個 QR、又呼叫 API、又顯示 busy。S20 native BarcodeDetector 命中很穩，每 200ms 一次，所以視覺上就是「閃」。

2. **`navigate(...)` 是同步排程**，TanStack Router 卸載這個 route 前，native loop 還會跑 1-2 幀。雖然有 `cancelledRef` / `busyRef` 擋，但成功路徑現在只 `await stopScanner()` → `navigate()`，沒有設「成功也要 block」，所以如果 API 慢、或 navigate 之間又掃到同一個 TN，就會二次進入。

3. **核心問題**：`busy` state 是 React state，從 `setBusyState(true)` 到 UI re-render 有延遲；而 native loop 用 `busyRef.current` 檔，理論上應該檔住，但 S20 上 API 失敗時走的 `processedTnsRef.current.delete(tn)` + `setBusyState(false)` 解鎖路徑就會放行下一次。

## 修法（最小改動，只動 scan.tsx）

1. **成功路徑也設 `blockedRef.current = true`**：navigate 之前就 block，避免 navigate 卸載前的殘餘幀再次進入
2. **API 失敗時不要立刻 delete tn**：保留 1.5s 冷卻（延遲 delete），跟「invalidFormat」一樣的處理，避免下一幀立刻重撞同個 TN
3. **native loop 的 guard 加上 `blockedRef.current` 檢查**（其實 processDecodedText 內部已檢查，但提前 short-circuit 可以避免無謂 detect call、也避免在 cancellation 競態下進入）
4. **用「冷卻」取代「delete」整個機制統一**：用 `Map<string, number>`（tn → expiresAt）取代 `Set`，過期才允許再次處理；invalidFormat / API 錯誤都用統一冷卻 1.5s

## 不做
- 不改 native loop 節流（200ms 已合理）
- 不動 ZXing 路徑邏輯
- 不動 UI、文案、其他頁面
