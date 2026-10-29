# Chrome Web Store 发布与审查通关指南 (CWS Submission Guide)

本指南为 **BiliDanmakuTTS (v1.0.3)** 发布到 Google Chrome 网上应用店（Chrome Web Store Developer Dashboard）准备了全套现成的表单文案、权限审查申明与上传物料。

---

## 一、 打包文件与宣传物料位置

* **扩展上传安装包 (ZIP)**：  
  [`dist/BiliDanmakuTTS-v1.0.3-ChromeWebStore.zip`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/dist/BiliDanmakuTTS-v1.0.3-ChromeWebStore.zip)  
  *(已严格遵循 Manifest V3 规范，移除了冗余脚本与说明，体积仅约 35KB，解压即是根目录)*

* **商店图标 (Store Icon)**：  
  [`icons/icon128.png`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/icons/icon128.png) (128 x 128 px)

* **小宣传图 (Small Promo Tile - 必选)**：  
  [`promo/promo_small_440x280.png`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/promo/promo_small_440x280.png) (440 x 280 px)

* **大宣传横幅 (Marquee Promo Tile - 推荐)**：  
  [`promo/promo_marquee_1400x560.png`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/promo/promo_marquee_1400x560.png) (1400 x 560 px)

* **商店功能截图 (Store Screenshots - 推荐 3 张，已包含实景真机图)**：  
  [`promo/promo_ui_panel_1280x800.png`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/promo/promo_ui_panel_1280x800.png) (1280 x 800 px - 全能控制中心实景面板展示)  
  [`promo/screenshot_1_1280x800.png`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/promo/screenshot_1_1280x800.png) (1280 x 800 px - 实时语音播报与自动原音压限)  
  [`promo/screenshot_2_1280x800.png`](file:///c:/Users/lin/Desktop/Repo/BiliDanmakuTTS-Extension/promo/screenshot_2_1280x800.png) (1280 x 800 px - 极简悬浮组件与零滞后抢占队列)

* **隐私政策链接 (Privacy Policy URL)**：  
  `https://github.com/LYW199911/BiliBiliDanmakuTTS/blob/main/PRIVACY_POLICY.md`

---

## 二、 商店信息配置 (Store Listing - 可直接复制粘贴)

### 1. 扩展基本信息
* **扩展名称 (Item Name)**：  
  `BiliDanmakuTTS - 息屏听弹幕助手`  
  *(英文版备选: `BiliDanmakuTTS - Danmaku Speech Assistant`)*
* **精简摘要 (Summary - 限制 132 字符)**：  
  `专为闭眼听视频、通勤听弹幕打造！智能过滤水词、高频梗折叠、自动音频侧链压限与自然人声播报。`  
  *(英文版: `Listen to Bilibili bullet comments in real time with audio ducking, smart noise filtering, and native voice synthesis.`)*
* **主要类别 (Category)**：  
  `Accessibility` (无障碍) 或 `Productivity` (生产工具)

---

### 2. 详细描述 (Detailed Description - 复制粘贴到商店说明框)

```markdown
专为“通勤乘车、做家务、闭眼听视频、不想错过弹幕精彩吐槽”打造的哔哩哔哩（Bilibili）听弹幕助手！

利用浏览器原生 Web Speech 语音合成引擎与智能清洗算法，将密集弹幕转化为适合听觉的高信息密度人声播报。

【核心功能亮点】

1. 智能梗词加权与网络缩写翻译：
- 自动翻译常见拼音缩写（如 AWSL -> “啊我死了”、YYDS -> “永远的神”、2333 -> “哈哈哈哈”）；
- 针对“前方高能”、“双厨狂喜”、“泪目”等经典弹幕自动加权优先播报。

2. 多重复读折叠与趣味播报：
- 当多名观众短时间内刷问号时，自动聚拢播报“全屏问号刷屏”；
- 批量复读同一条内容时，智能折叠为“[弹幕内容]，乘3”，告别机械复读轰炸。

3. 原音频自动侧链压限 (Audio Ducking)：
- 弹幕开声朗读前，自动平滑将原视频音量压低至设定比例（如 35%）；
- 朗读完毕后毫秒级平滑淡出恢复，层次分明，绝不刺耳。

4. 时效优先与零滞后抢占机制：
- 实时弹幕优先抢占淘汰陈旧队列，确保在第 5 秒听到的永远是第 5 秒当下的弹幕；
- 视频暂停时自动停止后续朗读，支持“读完当前句即停”与“立即掐断”双模式自由切换。

5. 极简悬浮状态胶囊：
- 页面右下角精简悬浮组件，支持拖拽靠边吸附；
- 闲置自动半透明收起，绝不遮挡选集列表与视频进度条。

【快捷键支持】
在任意 B 站视频播放页面按下快捷键：Alt + D，一秒快速开启或静音！

【隐私与安全保障】
- 100% 本地离线运行：代码不含任何远程加载逻辑（Strict Manifest V3）；
- 零数据收集：无任何后台追踪、数据埋点或第三方分析；
- 开源透明：欢迎在 GitHub 审查完整源代码 (https://github.com/LYW199911/BiliBiliDanmakuTTS)。
```

---

## 三、 隐私合规与审查申明 (Privacy Practices & Justifications - 审查员必看)

在开发者后台的 **“Privacy Practices”（隐私规范）** 选项卡中，请严格按如下要求填写：

### 1. 单一用途说明 (Single Purpose Description)
> **英文填写（推荐，审核最快）：**  
> `The single purpose of BiliDanmakuTTS is to synthesize audible speech for real-time bullet comments (danmaku) on Bilibili video pages using the browser's built-in Web Speech API, featuring automatic audio ducking and noise filtering.`  
>  
> **中文参考：**  
> `本扩展的唯一定位是利用浏览器原生语音合成技术，为 B 站视频播放页面的实时弹幕提供自动人声朗读、音频压限与降噪过滤服务。`

### 2. 权限使用理由 (Host Permissions Justification)
针对声明的 `*://*.bilibili.com/*` 权限：
> **英文填写（直接复制）：**  
> `The host permission for '*://*.bilibili.com/*' is required solely to inject the floating assistant UI, listen to video playback events (play, pause, timeupdate), and retrieve public real-time danmaku streams from Bilibili video pages. The extension never runs on or accesses any other domains.`  
>  
> **中文参考：**  
> `此权限仅用于在用户访问 B 站视频播放页时注入悬浮操作栏、监听视频播放进度，以及获取公开视频弹幕进行本地朗读。绝不访问任何其他网站。`

### 3. 数据使用披露自查清单 (Data Usage Disclosures)
请在问卷中依次勾选：
* **Does your extension collect any user data?**  
  👉 选择：**No, I am not collecting any user data.** (强烈推荐，免除多项隐私审计)
* **Limited Use Disclosure（有限使用条款）**：  
  👉 勾选复选框：**I agree to the Chrome Web Store User Data Policy regarding Limited Use.**
* **Remote Code（远程代码执行）**：  
  👉 勾选复选框：**My extension does not contain or execute remote code.** (完全符合，所有核心库已打包至 zip 内)

---

## 四、 发布步骤指引

1. 登录 **[Chrome 应用商店开发者信息中心 (Chrome Web Store Developer Dashboard)](https://chrome.google.com/webstore/devconsole)**；
2. 如果是首次发布，需支付 Google 官方收取的 **$5 美元一次性开发者注册费**；
3. 点击右上角 **“新建项” (New Item)**；
4. 上传本扩展包：`dist/BiliDanmakuTTS-v1.0.3-ChromeWebStore.zip`；
5. 依次上传 `promo/` 目录中的小宣传图、大宣传图以及 2 张功能截图；
6. 填入上述第二、三部分准备好的标题、文案、单一用途说明及权限理由；
7. 填入隐私政策网址：`https://github.com/LYW199911/BiliBiliDanmakuTTS/blob/main/PRIVACY_POLICY.md`；
8. 点击 **“提交以供审核” (Submit for Review)**。
   *(通常在 24~48 小时内即可通过 Google 审核并全球上架！)*
