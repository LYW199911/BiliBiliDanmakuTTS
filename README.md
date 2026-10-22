# BiliDanmakuTTS - B站息屏听弹幕助手 (浏览器插件与脚本版)

专为**“通勤乘车、做家务、闭眼听视频、不想错过弹幕梗”**打造的跨平台听弹幕扩展！

---

## 核心特性

1. **智能梗词库与网络缩写翻译**：
   - `AWSL` $\rightarrow$ “啊我死了”
   - `YYDS` $\rightarrow$ “永远的神”
   - `2333` $\rightarrow$ “哈哈哈哈”
   - `草 / 下饭 / 泪目 / 前方高能 / 双厨狂喜` 针对听觉习惯特殊加权与优化。
2. **多重复读折叠与趣味播报**：
   - 当多个人在短时间内刷 `？？？` 时，自动聚合播报：“全屏问号”。
   - 当多个人复读同一句话时，播报：“[弹幕内容]，乘3” 或 “大量弹幕都在发...”。
3. **真实音频侧链压限 (Audio Ducking)**：
   - 弹幕开声前 **120ms**，自动将原视频音量平滑下沉至 **35%**；
   - 朗读完毕后，平滑淡出恢复至 **100%**，听感层次分明，绝不吵耳。
4. **自适应语速与防堆积丢弃 (Drop Strategy)**：
   - 弹幕密集时自动小幅提速（1.15x $\rightarrow$ 1.35x）；
   - 视频快进（Seek）或落后画面超过 2.2 秒未读出的弹幕自动淘汰，拒绝时滞。
5. **毛玻璃悬浮交互面板 (Glassmorphism)**：
   - 页面右下角极简胶囊，点击即可展开调节语速、压音深度、过滤模式与音色。
   - 支持全局快捷键：`Alt + D` 一秒快速开启/静音。

---

## 极速体验指南 (2 种方式)

### 方式 A：加载为浏览器扩展 (Chrome / Edge / Kiwi Browser)
1. 打开浏览器扩展管理页面：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
2. 开启右上角的 **“开发者模式” (Developer Mode)**。
3. 点击 **“加载已解压的扩展程序” (Load unpacked)**。
4. 选择目录：`c:\Users\lin\Desktop\c#\BiliDanmakuTTS-Extension`。
5. 打开任意 B 站视频（如热门鬼畜、科技评测、番剧），页面右下角即可看到 `🎙️ 听弹幕` 悬浮组件！

### 方式 B：油猴脚本单文件安装 (Tampermonkey / 手机 Safari / Stay)
* 如果你安装了 **Tampermonkey** 或 iOS Safari 上的 **Stay / Userscripts**，直接打开或新建脚本并粘贴：
  `c:\Users\lin\Desktop\c#\BiliDanmakuTTS-Extension\bilibili-danmaku-tts.user.js`
* 免解压、全平台即装即用！

---

## 目录结构说明

```
BiliDanmakuTTS-Extension/
├── manifest.json              # 扩展配置文件 (Manifest V3)
├── popup.html                 # 扩展工具栏弹窗
├── content.js                 # 核心编排调度入口
├── core/
│   ├── slang-dict.js          # 梗词库与低质弹幕正则清洗
│   ├── scheduler.js           # 优先级排序、滑动窗口与复读折叠算法
│   ├── tts-engine.js          # Web Speech API 与平滑 Audio Ducking 引擎
│   └── danmaku-provider.js    # B站官方 XML 弹幕解析与 DOM 观察器
├── ui/
│   ├── floating-panel.js      # 拟物化交互悬浮胶囊与控制卡片
│   └── floating-panel.css     # 毛玻璃与 B 站粉白动效样式
└── bilibili-danmaku-tts.user.js # 单文件全功能 Userscript 版
```
