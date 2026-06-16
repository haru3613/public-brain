---
title: "我的個人知識系統：Obsidian → 網站的發布流"
date: 2026-04-18
category: system
tags: ["系統", "寫作"]
summary: "只有 publish: true 的筆記才會出現在網站。從 Obsidian 到公開頁面，我怎麼設計這條單向通道。"
publish: true
readTime: "6 分鐘"
---

網站上的每一篇，都是從 Obsidian 裡長出來的。但不是每則筆記都該公開 — 只有標了 publish: true 的，才會被發布。

#### 單向通道。

從私人筆記到公開頁面，我設計成一條單向通道：寫在 Obsidian、標記發布、自動轉成網站文章。frontmatter 帶 title、date、tags、summary、publish。

這樣我可以安心地在私底下亂寫，公開的永遠是我選擇要公開的版本。
