# Privacy Policy for BiliDanmakuTTS

**Last updated:** October 29, 2026  
**Effective date:** October 29, 2026  

This Privacy Policy explains how **BiliDanmakuTTS** ("the Extension", "we", "us", or "our") handles user information and data privacy.

---

## 1. Single Purpose & Overview

BiliDanmakuTTS is an open-source browser extension designed to synthesize speech for real-time danmaku (bullet comments) on Bilibili video pages using the browser's built-in Web Speech API, with automatic audio ducking and noise filtering.

---

## 2. Information We Do NOT Collect

We firmly believe in absolute user privacy. **BiliDanmakuTTS does NOT collect, store, transmit, sell, or share any personal information or user browsing data.**

* **No Personal Data:** We do not collect names, email addresses, IP addresses, browsing histories, account credentials, or identifiers.
* **No Telemetry or Analytics:** The Extension contains zero tracking pixels, telemetry scripts, or third-party analytical SDKs (no Google Analytics, no Mixpanel, no tracking).
* **No Remote Code Execution:** All JavaScript logic is bundled entirely within the extension package in compliance with Manifest V3 policies. No external scripts are fetched at runtime.
* **No External Servers:** The Extension does not operate any backend servers. All processing is strictly performed locally in the user's browser.

---

## 3. How Data Is Handled (Local Processing Only)

1. **Danmaku Comment Parsing:**  
   The extension fetches public video danmaku XML streams directly from Bilibili's official content delivery network strictly within the active video page. This data is processed in memory on the client machine to fold repetitive spam and filter junk words.
2. **Text-to-Speech (TTS):**  
   Speech synthesis is handled exclusively by the browser's native `window.speechSynthesis` (Web Speech API). No voice data or synthesized audio is transmitted to any third-party recording service.
3. **User Preferences (Local Storage):**  
   Your custom preferences (such as speech volume, speech speed, ducking factor, and pause behavior) are stored strictly within the browser's local `localStorage`. This data never leaves your device.

---

## 4. Permissions Justification

* **Host Permission (`*://*.bilibili.com/*`):**  
  Required solely to inject the floating assistant UI, observe playback state (`play`, `pause`, `timeupdate`), and retrieve the current video's public bullet comments on Bilibili video pages. The extension does not activate or run on any other domain.

---

## 5. Compliance with Chrome Web Store User Data Policy

* **Limited Use Disclosure:** BiliDanmakuTTS complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.
* **No Sale of Data:** We never sell or transfer user data to third parties.
* **No Credit Worthiness or Lending:** User data is not used for credit assessment or advertising.

---

## 6. Open Source & Transparency

BiliDanmakuTTS is open source. You can audit the complete codebase at any time:  
[https://github.com/LYW199911/BiliBiliDanmakuTTS](https://github.com/LYW199911/BiliBiliDanmakuTTS)

---

## 7. Contact Us

If you have questions about this Privacy Policy or the Extension, please submit an issue on our GitHub repository:  
[https://github.com/LYW199911/BiliBiliDanmakuTTS/issues](https://github.com/LYW199911/BiliBiliDanmakuTTS/issues)

---

# 隐私政策 (中文版)

**最后更新日期：** 2026 年 10 月 29 日  
**生效日期：** 2026 年 10 月 29 日  

本隐私政策说明了 **BiliDanmakuTTS**（以下简称“本扩展”、“我们”）在您使用扩展程序时对用户数据与隐私的处理原则。

---

## 1. 单一用途与概述

BiliDanmakuTTS 是一款专为 B 站（bilibili.com）视频打造的无障碍与生产力扩展，利用浏览器原生 Web Speech API 实现弹幕实时真人语音播报、音频自动侧链压限与水词过滤。

---

## 2. 我们承诺不收集任何数据

我们坚定维护用户的隐私权。**BiliDanmakuTTS 不会收集、记录、存储、上传、出售或转让任何用户的个人信息或使用记录。**

* **无个人身份信息：** 不获取您的姓名、邮箱、账号密码、Cookie、IP 地址或浏览历史。
* **无埋点与数据统计：** 代码中不含任何第三方分析、监控或追踪脚本（无 Google Analytics、无友盟、无任何统计 SDK）。
* **无远程代码执行：** 严格遵循 Chrome 扩展 Manifest V3 规范，所有脚本全部本地离线打包，不从远程服务器动态加载代码。
* **无自建外部服务器：** 本扩展不设立任何后端收集服务器，全部算法逻辑均在您的浏览器本地执行。

---

## 3. 本地数据处理方式

1. **弹幕解析：** 扩展仅在当前播放的视频页面中，通过 B 站官方接口拉取公开弹幕流，并在本地内存中进行去重、梗词翻译与过滤，计算完毕后即释放。
2. **语音朗读：** 调用浏览器本地集成的 `speechSynthesis` API，语音生成全程在本地操作系统完成。
3. **偏好设置存储：** 用户的自定义设置（如语速、音量偏好、压音程度）保存在浏览器本地的 `localStorage` 中，绝不上云。

---

## 4. 权限合理性声明

* **网站权限 (`*://*.bilibili.com/*`)：**  
  仅用于在用户访问 B 站视频播放页面时，注入悬浮控制组件、监听视频播放/暂停进度，以及读取视频公开弹幕。本扩展绝不监听任何其他网站。

---

## 5. 开源与监督

本扩展完全开源透明，接受全球开发者的审查与监督：  
[https://github.com/LYW199911/BiliBiliDanmakuTTS](https://github.com/LYW199911/BiliBiliDanmakuTTS)
