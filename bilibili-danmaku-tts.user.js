// ==UserScript==
// @name         BiliDanmakuTTS - B站息屏听弹幕助手 (单文件免安装版)
// @namespace    https://github.com/lin/bili-danmaku-tts
// @version      1.0.3
// @description  专为通勤/做家务/息屏听视频设计！智能过滤水弹幕、高频梗折叠、原视频自动侧链压限 (Ducking) 与自然人声播报。
// @author       Yuwei Lin
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/list/*
// @match        https://www.bilibili.com/bangumi/play/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  console.log('[BiliDanmakuTTS Userscript] 启动中...');

  // ==========================================
  // 1. 样式注入
  // ==========================================
  const STYLES = `
    #bili-tts-container {
      position: fixed;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      font-size: 13px;
      color: #18191c;
      touch-action: none;
    }
    #bili-tts-container.snapping {
      transition: left 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  right 0.28s cubic-bezier(0.16, 1, 0.3, 1),
                  top 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #bili-tts-container.dragging .bili-tts-pill {
      cursor: grabbing !important;
      transform: scale(1.05);
      box-shadow: 0 16px 36px rgba(251, 114, 153, 0.38);
    }
    .bili-tts-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(251, 114, 153, 0.35);
      border-radius: 30px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(251, 114, 153, 0.15);
      cursor: grab;
      white-space: nowrap;
      transition: opacity 0.35s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
    }
    .bili-tts-pill:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(251, 114, 153, 0.25);
      border-color: #FB7299;
    }
    .bili-tts-pill.idle {
      opacity: 0.52;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    #bili-tts-container[data-dock="right"] .bili-tts-pill.idle {
      transform: translateX(18px);
    }
    #bili-tts-container[data-dock="left"] .bili-tts-pill.idle {
      transform: translateX(-18px);
    }
    .bili-tts-pill:hover,
    #bili-tts-container:hover .bili-tts-pill {
      opacity: 1 !important;
      transform: translateX(0) translateY(-2px) !important;
    }
    .bili-tts-pill.active {
      background: linear-gradient(135deg, #FFF0F5 0%, #FFFFFF 100%);
      border-color: #FB7299;
    }
    .bili-tts-pill.disabled {
      background: #F1F2F3;
      border-color: #D0D3D6;
    }
    .bili-tts-pill-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #FB7299;
      color: white;
      font-size: 11px;
    }
    .bili-tts-pill.disabled .bili-tts-pill-icon {
      background: #9499A0;
    }
    .bili-tts-pill-text {
      font-weight: 600;
      color: #18191C;
      font-size: 13px;
    }
    .bili-tts-pill-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: #E3F5FC;
      color: #00A1D6;
      font-weight: 500;
    }
    .bili-tts-pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      animation: biliTtsPulse 1.6s infinite;
    }
    @keyframes biliTtsPulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1.1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .bili-tts-card {
      position: absolute;
      width: 324px;
      max-height: calc(100vh - 80px);
      background: rgba(255, 255, 255, 0.97);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(227, 229, 231, 0.85);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
      z-index: 10;
    }
    #bili-tts-container[data-v-align="up"] .bili-tts-card,
    #bili-tts-container:not([data-v-align]) .bili-tts-card {
      bottom: 52px;
      top: auto;
    }
    #bili-tts-container[data-v-align="down"] .bili-tts-card {
      top: 52px;
      bottom: auto;
    }
    #bili-tts-container[data-dock="right"] .bili-tts-card {
      right: 0;
      left: auto;
      transform-origin: bottom right;
    }
    #bili-tts-container[data-dock="right"][data-v-align="down"] .bili-tts-card {
      transform-origin: top right;
    }
    #bili-tts-container[data-dock="left"] .bili-tts-card {
      left: 0;
      right: auto;
      transform-origin: bottom left;
    }
    #bili-tts-container[data-dock="left"][data-v-align="down"] .bili-tts-card {
      transform-origin: top left;
    }
    .bili-tts-card.hidden {
      opacity: 0;
      transform: scale(0.92) translateY(10px);
      pointer-events: none;
    }
    .bili-tts-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #F1F2F3;
      padding-bottom: 8px;
      flex-shrink: 0;
    }
    .bili-tts-card-title {
      font-size: 14px;
      font-weight: 700;
      color: #18191C;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .bili-tts-version-badge {
      font-size: 10px;
      font-weight: 600;
      color: #FB7299;
      background: #FFF0F5;
      padding: 1px 6px;
      border-radius: 10px;
      border: 1px solid rgba(251, 114, 153, 0.35);
    }
    .bili-tts-close-btn {
      background: none;
      border: none;
      color: #9499A0;
      font-size: 16px;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .bili-tts-close-btn:hover {
      background: #F1F2F3;
      color: #18191C;
    }
    .bili-tts-tabs {
      display: flex;
      gap: 4px;
      background: #F1F2F3;
      padding: 3px;
      border-radius: 8px;
      flex-shrink: 0;
    }
    .bili-tts-tab-btn {
      flex: 1;
      padding: 5px 0;
      font-size: 11px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #61666D;
      cursor: pointer;
      transition: all 0.2s;
    }
    .bili-tts-tab-btn:hover { color: #18191C; }
    .bili-tts-tab-btn.active {
      background: #FFFFFF;
      color: #FB7299;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    }
    .bili-tts-card-body {
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 2px;
      display: flex;
      flex-direction: column;
    }
    .bili-tts-card-body::-webkit-scrollbar { width: 4px; }
    .bili-tts-card-body::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.12); border-radius: 4px; }
    .bili-tts-card-body::-webkit-scrollbar-thumb:hover { background: #FB7299; }
    .bili-tts-tab-content { display: flex; flex-direction: column; gap: 10px; }
    .bili-tts-card-footer {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-top: 1px solid #F1F2F3;
      padding-top: 8px;
      flex-shrink: 0;
    }
    .bili-tts-btn-group { display: flex; flex-direction: column; gap: 6px; }
    .bili-tts-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .bili-tts-label {
      font-size: 12px;
      font-weight: 500;
      color: #61666D;
    }
    .bili-tts-switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
    }
    .bili-tts-switch input { opacity: 0; width: 0; height: 0; }
    .bili-tts-slider {
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background-color: #E3E5E7; transition: .3s; border-radius: 22px;
    }
    .bili-tts-slider:before {
      position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px;
      background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    input:checked + .bili-tts-slider { background-color: #FB7299; }
    input:checked + .bili-tts-slider:before { transform: translateX(18px); }
    .bili-tts-range-wrap { display: flex; flex-direction: column; gap: 4px; width: 100%; }
    .bili-tts-range-header { display: flex; justify-content: space-between; font-size: 11px; color: #61666D; }
    .bili-tts-range-input { width: 100%; accent-color: #FB7299; height: 4px; cursor: pointer; }
    .bili-tts-select {
      width: 100%; padding: 6px 10px; border: 1px solid #E3E5E7; border-radius: 8px;
      font-size: 12px; background: white; color: #18191C; outline: none;
    }
    .bili-tts-stats-bar {
      display: flex; justify-content: space-around; background: #F6F7F8;
      border-radius: 8px; padding: 8px 4px; font-size: 11px; text-align: center;
    }
    .bili-tts-stat-num { font-weight: 700; color: #00A1D6; font-size: 13px; }
    .bili-tts-stat-lbl { color: #9499A0; }
    .bili-tts-btn {
      width: 100%; padding: 8px; border-radius: 8px; border: none; background: #FB7299;
      color: white; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;
    }
    .bili-tts-btn:hover { background: #E0567E; }
    #bili-tts-toast {
      position: fixed; top: 80px; left: 50%; transform: translateX(-50%) translateY(-20px);
      background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(8px); color: #FFFFFF;
      padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.15); opacity: 0; pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); z-index: 99999999;
    }
    #bili-tts-toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
    .bili-tts-vol-hint { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #9499A0; margin-top: 1px; }
    .bili-tts-link-btn { background: none; border: none; color: #00A1D6; font-size: 10px; cursor: pointer; padding: 0; text-decoration: underline; }
    .bili-tts-link-btn:hover { color: #FB7299; }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // ==========================================
  // 2. 梗词表与清洗模块
  // ==========================================
  const SLANG_MAP = {
    "AWSL": "啊我死了", "XSWL": "笑死我了", "YYDS": "永远的神", "U1S1": "有一说一",
    "DBQ": "对不起", "ZQSG": "真情实感", "KSWL": "嗑死我了", "BUSH": "不是", "BUSHI": "不是",
    "KDL": "嗑到了", "TQL": "太强了", "NB": "牛逼", "NBBB": "牛逼", "WOC": "卧槽", "WC": "卧槽",
    "DDDD": "懂得都懂", "233": "哈哈", "2333": "哈哈哈哈", "23333": "哈哈哈哈",
    "666": "溜溜溜", "6666": "太溜了", "草": "好生草", "下饭": "这也太下饭了",
    "泪目": "泪目", "爷青回": "爷青回", "下次一定": "下次一定", "双厨狂喜": "双厨狂喜",
    "前方高能": "前方高能预警", "高能预警": "前方高能预警", "完结撒花": "完结撒花"
  };

  const JUNK_PATTERNS = [
    /^[?？!！.~。，、/\\~@#$%^&*()_+\-=\[\]{}|:;"'<>,`·\s]+$/,
    /^[0-9\s]+$/,
    /^(第一|前排|来了|打卡|签到|盖楼|第一集|第一P|第\d+个?)$/i
  ];

  function normalizeDanmaku(rawText) {
    if (!rawText) return { cleanText: '', isJunk: true, normalizedText: '' };
    let text = rawText.trim();

    for (const pat of JUNK_PATTERNS) {
      if (pat.test(text)) {
        if (/^[?？]+$/.test(text)) return { cleanText: '问号', isJunk: false, normalizedText: '问号' };
        if (/^233+$/.test(text)) return { cleanText: '哈哈', isJunk: false, normalizedText: '哈哈' };
        return { cleanText: '', isJunk: true, normalizedText: '' };
      }
    }

    const upper = text.toUpperCase();
    if (SLANG_MAP[upper]) {
      text = SLANG_MAP[upper];
    } else {
      for (const [slang, rep] of Object.entries(SLANG_MAP)) {
        if (text.toUpperCase().includes(slang) && text.length <= slang.length + 3) {
          text = text.replace(new RegExp(slang, 'gi'), rep);
        }
      }
    }

    text = text.replace(/[?？]{2,}/g, '？');
    text = text.replace(/[!！]{2,}/g, '！');

    return { cleanText: text, isJunk: text.length === 0, normalizedText: text.toLowerCase() };
  }

  // ==========================================
  // 3. 调度器核心 (DanmakuScheduler)
  // ==========================================
  class DanmakuScheduler {
    constructor() {
      this.danmakuList = [];
      this.currentIndex = 0;
      this.pendingQueue = [];
      this.spokenCount = 0;
      this.filteredCount = 0;
      this.minPriority = 15;
      this.baseRate = 1.15;
    }

    load(list) {
      this.danmakuList = list.slice().sort((a, b) => a.time - b.time);
      this.currentIndex = 0;
      this.pendingQueue = [];
      this.spokenCount = 0;
      this.filteredCount = 0;
    }

    onSeek(currentTime) {
      this.pendingQueue = [];
      let idx = 0;
      while (idx < this.danmakuList.length && this.danmakuList[idx].time < currentTime) {
        idx++;
      }
      this.currentIndex = idx;
    }

    tick(currentTime, isSpeaking) {
      // 丢弃过期 2.0 秒以上的弹幕
      this.pendingQueue = this.pendingQueue.filter(item => {
        const expired = (currentTime - item.targetTime) > 2.0;
        if (expired) this.filteredCount++;
        return !expired;
      });

      // 拉取当前批次
      const windowEnd = currentTime + 1.2;
      const batch = [];
      while (this.currentIndex < this.danmakuList.length) {
        const d = this.danmakuList[this.currentIndex];
        if (d.time > windowEnd) break;
        if (d.time >= currentTime - 0.2) {
          batch.push(d);
        } else {
          this.filteredCount++;
        }
        this.currentIndex++;
      }

      if (batch.length > 0) {
        const textMap = new Map();
        for (const d of batch) {
          const { cleanText, isJunk, normalizedText } = normalizeDanmaku(d.text);
          if (isJunk || !cleanText) {
            this.filteredCount++;
            continue;
          }
          if (!textMap.has(normalizedText)) {
            textMap.set(normalizedText, { raw: d, clean: cleanText, count: 1 });
          } else {
            textMap.get(normalizedText).count++;
          }
        }

        const validBatch = [];
        textMap.forEach((grp, norm) => {
          let text = grp.clean;
          let priority = 10;
          if (grp.count >= 5) {
            text = (norm === '问号') ? '全屏问号' : (norm === '哈哈') ? '都在哈哈' : `大量弹幕：${text}`;
            priority += 40;
          } else if (grp.count >= 2) {
            text = `${text}，乘${grp.count}`;
            priority += (grp.count * 8);
          }

          if (text.includes('高能') || text.includes('泪目')) priority += 25;

          if (priority >= this.minPriority) {
            validBatch.push({
              textToSpeak: text,
              priority: priority,
              targetTime: grp.raw.time,
              rate: this.baseRate
            });
          } else {
            this.filteredCount++;
          }
        });

        // 【时效优先与队列覆盖】：当前秒数有新弹幕到达时，优先覆盖淘汰陈旧积攒
        if (validBatch.length > 0) {
          const kept = [];
          for (const item of this.pendingQueue) {
            if ((currentTime - item.targetTime) <= 0.8) {
              kept.push(item);
            } else {
              this.filteredCount++;
            }
          }
          this.pendingQueue = kept.concat(validBatch);
        }

        this.pendingQueue.sort((a, b) => b.priority - a.priority);

        // 限制队列最大长度不超过 2 条，杜绝多句连读造成的滞后
        if (this.pendingQueue.length > 2) {
          const discarded = this.pendingQueue.splice(2);
          this.filteredCount += discarded.length;
        }
      }

      if (!isSpeaking && this.pendingQueue.length > 0) {
        const item = this.pendingQueue.shift();
        if (this.pendingQueue.length >= 1) {
          item.rate = Math.min(this.baseRate * 1.25, 1.8);
        }
        this.spokenCount++;
        return item;
      }
      return null;
    }

    clearQueue() {
      this.pendingQueue = [];
    }
  }

  // ==========================================
  // 4. TTS 与侧链压限引擎 (TTSEngine)
  // ==========================================
  class TTSEngine {
    constructor() {
      this.isSpeaking = false;
      this.videoEl = null;
      this.origVol = 1.0;
      this.duckingEnabled = true;
      this.duckingFactor = 0.35;
      this.baseRate = 1.15;
      this.volume = null;              // 朗读音量 (0.0~1.0)，null 为跟随原视频
      this.autoFollowVolume = true;     // 是否自动跟随视频音量
      this.selectedVoice = null;
      this.duckTimer = null;
      this.onStart = null;
      this.onEnd = null;
      this.onVideoVolumeChange = null;
      this._onVolChange = null;
    }

    getEffectiveVolume() {
      if (this.autoFollowVolume || this.volume === null) {
        if (this.videoEl) return Math.max(0.0, Math.min(1.0, this.origVol));
        return 0.5;
      }
      return Math.max(0.0, Math.min(1.0, this.volume));
    }

    setVideo(v) {
      if (this.videoEl && this._onVolChange) {
        this.videoEl.removeEventListener('volumechange', this._onVolChange);
      }
      this.videoEl = v;
      if (v) {
        this.origVol = v.volume;
        this._onVolChange = () => {
          if (!this.isSpeaking) {
            this.origVol = v.volume;
            if (this.onVideoVolumeChange) this.onVideoVolumeChange(this.origVol);
          }
        };
        v.addEventListener('volumechange', this._onVolChange);
      }
    }

    speak(item) {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (this.isSpeaking && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      const u = new SpeechSynthesisUtterance(item.textToSpeak);
      u.lang = 'zh-CN';
      u.rate = item.rate || this.baseRate;
      u.volume = this.getEffectiveVolume();

      if (!this.selectedVoice) {
        const voices = window.speechSynthesis.getVoices() || [];
        this.selectedVoice = voices.find(v => 
          (v.lang && (v.lang.toLowerCase().includes('zh') || v.lang.toLowerCase().includes('cn'))) ||
          v.name.includes('Chinese') || v.name.includes('Huihui') || v.name.includes('Xiaoxiao') || v.name.includes('Yunxi')
        ) || null;
      }
      if (this.selectedVoice) u.voice = this.selectedVoice;

      let keepAlive = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAlive);
        }
      }, 2500);

      u.onstart = () => {
        this.isSpeaking = true;
        this.applyDucking(true);
        if (this.onStart) this.onStart(item.textToSpeak);
      };

      const cleanup = () => {
        clearInterval(keepAlive);
        this.isSpeaking = false;
        this.applyDucking(false);
        if (this.onEnd) this.onEnd();
      };

      u.onend = cleanup;
      u.onerror = cleanup;
      window.speechSynthesis.speak(u);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }

    applyDucking(duckIn) {
      if (!this.duckingEnabled || !this.videoEl) return;
      if (this.duckTimer) clearInterval(this.duckTimer);

      const v = this.videoEl;
      if (duckIn) {
        if (!this.isSpeaking || v.volume > (this.origVol * this.duckingFactor + 0.05)) {
          this.origVol = v.volume;
        }
      }

      const startVol = v.volume;
      const targetVol = duckIn ? Math.max(0.05, this.origVol * this.duckingFactor) : this.origVol;
      const steps = 10;
      let step = 0;
      const delta = (targetVol - startVol) / steps;

      this.duckTimer = setInterval(() => {
        step++;
        v.volume = Math.min(1.0, Math.max(0, startVol + delta * step));
        if (step >= steps) {
          clearInterval(this.duckTimer);
          v.volume = targetVol;
        }
      }, 15);
    }

    stop() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.applyDucking(false);
    }
  }

  // ==========================================
  // 5. 弹幕拉取器 (DanmakuProvider)
  // ==========================================
  async function fetchDanmakus() {
    const match = window.location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    if (!match) return [];
    const bvid = match[1];

    let cid = window.cid || window.__INITIAL_STATE__?.videoData?.cid;
    if (!cid) {
      try {
        const p = new URLSearchParams(window.location.search).get('p') || 1;
        const res = await fetch(`https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`);
        const j = await res.json();
        if (j && j.data && j.data.length > 0) {
          const item = j.data.find(it => it.page === parseInt(p, 10)) || j.data[0];
          cid = item.cid;
        }
      } catch (e) {
        console.warn('[BiliDanmakuTTS] 获取 CID 失败:', e);
      }
    }

    if (!cid) return [];

    try {
      const res = await fetch(`https://comment.bilibili.com/${cid}.xml`);
      const xml = await res.text();
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const nodes = doc.getElementsByTagName('d');
      const list = [];
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i].getAttribute('p');
        const text = nodes[i].textContent;
        if (p && text) {
          const t = parseFloat(p.split(',')[0]);
          if (!isNaN(t)) list.push({ id: `dm_${i}`, time: t, text: text.trim() });
        }
      }
      return list.sort((a, b) => a.time - b.time);
    } catch (e) {
      console.warn('[BiliDanmakuTTS] 解析弹幕 XML 失败:', e);
      return [];
    }
  }

  // ==========================================
  // 6. UI 与主循环驱动
  // ==========================================
  const BILI_TTS_SETTINGS_KEY = 'bili_tts_settings';

  const DEFAULT_BILI_TTS_SETTINGS = {
    enabled: true,            // 启用弹幕朗读 (Alt+D)
    onlyWhenHidden: false,    // 仅切Tab/后台时朗读
    autoPip: true,            // 切Tab自动开启小窗
    volumeAutoFollow: true,   // 朗读音量是否跟随视频
    customVolume: 1.0,        // 独立设定音量 (0.0 ~ 1.0)
    speechRate: 1.15,         // 朗读语速 (0.8 ~ 2.0)
    pauseBehavior: 'finish',  // 视频暂停时 ('finish' | 'stop')
    duckingEnabled: true,     // 视频原音压限开关
    duckingFactor: 0.35,      // 原音压低程度 (0.1 ~ 0.8)
    filterMode: 'smart',      // 过滤模式 ('smart' | 'high' | 'all')
    voiceName: '',            // 朗读人音色
    activeTab: 'basic'        // 上次停留在哪个选项卡 ('basic' | 'audio')
  };

  function getBiliTTSSettings() {
    let s = Object.assign({}, DEFAULT_BILI_TTS_SETTINGS);
    try {
      const raw = localStorage.getItem(BILI_TTS_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          s = Object.assign(s, parsed);
        }
      }
    } catch (e) {}

    try {
      const oldPause = localStorage.getItem('bili_tts_pause_pref');
      if (oldPause === 'stop' || oldPause === 'finish') s.pauseBehavior = oldPause;
      const oldVolRaw = localStorage.getItem('bili_tts_vol_pref');
      if (oldVolRaw) {
        const oldVol = JSON.parse(oldVolRaw);
        if (oldVol && typeof oldVol === 'object') {
          if (typeof oldVol.autoFollow === 'boolean') s.volumeAutoFollow = oldVol.autoFollow;
          if (typeof oldVol.volume === 'number') s.customVolume = oldVol.volume;
        }
      }
    } catch (e) {}

    return s;
  }

  function updateBiliTTSSettings(patch) {
    try {
      const s = getBiliTTSSettings();
      Object.assign(s, patch);
      localStorage.setItem(BILI_TTS_SETTINGS_KEY, JSON.stringify(s));

      if ('pauseBehavior' in patch) {
        localStorage.setItem('bili_tts_pause_pref', patch.pauseBehavior);
      }
      if ('volumeAutoFollow' in patch || 'customVolume' in patch) {
        localStorage.setItem('bili_tts_vol_pref', JSON.stringify({
          autoFollow: s.volumeAutoFollow,
          volume: s.customVolume
        }));
      }
      return s;
    } catch (e) {
      return DEFAULT_BILI_TTS_SETTINGS;
    }
  }

  const settings = getBiliTTSSettings();
  const scheduler = new DanmakuScheduler();
  scheduler.baseRate = settings.speechRate;
  scheduler.minPriority = (settings.filterMode === 'high' || settings.filterMode === 'highlight') ? 25 : (settings.filterMode === 'all') ? 0 : 15;

  const tts = new TTSEngine();
  tts.duckingEnabled = settings.duckingEnabled;
  tts.duckingFactor = settings.duckingFactor;
  tts.baseRate = settings.speechRate;
  tts.autoFollowVolume = settings.volumeAutoFollow;
  tts.volume = settings.volumeAutoFollow ? null : settings.customVolume;

  let isEnabled = settings.enabled;
  let onlyWhenHidden = settings.onlyWhenHidden;
  let pauseBehavior = settings.pauseBehavior;

  // 恢复保存的位置
  let savedPos = null;
  try {
    savedPos = JSON.parse(localStorage.getItem('bili_tts_pill_pos'));
  } catch (e) {}

  const dock = savedPos?.dock || 'right';
  const topPx = savedPos?.topPx || Math.max(120, Math.floor(window.innerHeight * 0.65));

  // 注入 UI
  const container = document.createElement('div');
  container.id = 'bili-tts-container';
  container.setAttribute('data-dock', dock);
  container.setAttribute('data-v-align', topPx < 380 ? 'down' : 'up');
  container.style.top = `${Math.max(60, Math.min(window.innerHeight - 80, topPx))}px`;
  if (dock === 'left') {
    container.style.left = '12px';
    container.style.right = 'auto';
  } else {
    container.style.left = 'auto';
    container.style.right = '12px';
  }

  const volPct = Math.round((settings.customVolume || 1.0) * 100);
  const duckPct = Math.round((settings.duckingFactor || 0.35) * 100);
  const rateVal = (settings.speechRate || 1.15).toFixed(2);
  const rateSliderVal = Math.round((settings.speechRate || 1.15) * 100);
  const isBasicTab = settings.activeTab !== 'audio';

  container.innerHTML = `
    <div class="bili-tts-pill active${settings.enabled ? '' : ' disabled'}" id="bili-tts-pill" title="点击展开设置，按住可拖动">
      <div class="bili-tts-pill-icon">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
      </div>
      <div class="bili-tts-pulse" id="bili-tts-pulse" style="display: none;"></div>
      <div class="bili-tts-pill-badge" id="bili-tts-badge">就绪</div>
    </div>
    <div class="bili-tts-card hidden" id="bili-tts-card">
      <div class="bili-tts-card-header">
        <div class="bili-tts-card-title">
          <span>息屏听弹幕助手</span>
          <span class="bili-tts-version-badge">v1.0.3</span>
        </div>
        <button class="bili-tts-close-btn" id="bili-tts-close" title="关闭 (点击外部任意处也可关闭)">✕</button>
      </div>

      <div class="bili-tts-tabs">
        <button class="bili-tts-tab-btn ${isBasicTab ? 'active' : ''}" id="bili-tab-btn-basic" data-tab="basic">常用设置</button>
        <button class="bili-tts-tab-btn ${!isBasicTab ? 'active' : ''}" id="bili-tab-btn-audio" data-tab="audio">音频与降噪</button>
      </div>

      <div class="bili-tts-card-body" id="bili-tts-card-body">
        <div class="bili-tts-tab-content" id="bili-tab-content-basic" style="display: ${isBasicTab ? 'flex' : 'none'};">
          <div class="bili-tts-row">
            <span class="bili-tts-label">启用弹幕朗读 (Alt+D)</span>
            <label class="bili-tts-switch"><input type="checkbox" id="bili-tts-enable" ${settings.enabled ? 'checked' : ''}><span class="bili-tts-slider"></span></label>
          </div>
          <div class="bili-tts-row">
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span class="bili-tts-label">仅切Tab/后台时朗读</span>
              <span style="font-size:10px;color:#9499A0;">看视频时静音，切换到其他Tab时朗读</span>
            </div>
            <label class="bili-tts-switch"><input type="checkbox" id="bili-tts-hidden-only" ${settings.onlyWhenHidden ? 'checked' : ''}><span class="bili-tts-slider"></span></label>
          </div>
          <div class="bili-tts-range-wrap">
            <div class="bili-tts-range-header"><span>朗读音量</span><span id="bili-vol-txt">${settings.volumeAutoFollow ? '跟随视频 (100%)' : `${volPct}% (自定义)`}</span></div>
            <input type="range" class="bili-tts-range-input" id="bili-vol-slider" min="0" max="100" value="${settings.volumeAutoFollow ? '100' : volPct}">
            <div class="bili-tts-vol-hint">
              <span id="bili-vol-status">${settings.volumeAutoFollow ? '默认跟随 B 站播放器音量' : `独立设定音量: ${volPct}%`}</span>
              <button class="bili-tts-link-btn" id="bili-vol-reset-btn" style="display: ${settings.volumeAutoFollow ? 'none' : 'inline-block'};">恢复跟随视频</button>
            </div>
          </div>
          <div class="bili-tts-range-wrap">
            <div class="bili-tts-range-header"><span>朗读语速</span><span id="bili-rate-txt">${rateVal}x</span></div>
            <input type="range" class="bili-tts-range-input" id="bili-rate-slider" min="80" max="200" value="${rateSliderVal}">
          </div>
          <div class="bili-tts-range-wrap">
            <span class="bili-tts-label">视频暂停时</span>
            <select class="bili-tts-select" id="bili-pause-select">
              <option value="finish"${settings.pauseBehavior === 'finish' ? ' selected' : ''}>读完当前条即停 (推荐)</option>
              <option value="stop"${settings.pauseBehavior === 'stop' ? ' selected' : ''}>立即掐断朗读</option>
            </select>
          </div>
        </div>

        <div class="bili-tts-tab-content" id="bili-tab-content-audio" style="display: ${!isBasicTab ? 'flex' : 'none'};">
          <div class="bili-tts-row">
            <span class="bili-tts-label">视频音频压限 (Ducking)</span>
            <label class="bili-tts-switch"><input type="checkbox" id="bili-tts-duck" ${settings.duckingEnabled ? 'checked' : ''}><span class="bili-tts-slider"></span></label>
          </div>
          <div class="bili-tts-range-wrap">
            <div class="bili-tts-range-header"><span>原音压低程度</span><span id="bili-duck-txt">压低至 ${duckPct}%</span></div>
            <input type="range" class="bili-tts-range-input" id="bili-duck-slider" min="10" max="80" value="${duckPct}">
          </div>
          <div class="bili-tts-range-wrap">
            <span class="bili-tts-label">过滤模式</span>
            <select class="bili-tts-select" id="bili-mode-select">
              <option value="smart"${settings.filterMode === 'smart' ? ' selected' : ''}>智能模式 (推荐: 梗词加权 + 自动折叠)</option>
              <option value="high"${settings.filterMode === 'high' || settings.filterMode === 'highlight' ? ' selected' : ''}>仅高能弹幕 (强力降噪)</option>
              <option value="all"${settings.filterMode === 'all' ? ' selected' : ''}>全部朗读 (全量接收)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="bili-tts-card-footer">
        <div class="bili-tts-stats-bar">
          <div><div class="bili-tts-stat-num" id="bili-stat-total">0</div><div class="bili-tts-stat-lbl">已抓取</div></div>
          <div><div class="bili-tts-stat-num" id="bili-stat-spoken" style="color: #10B981;">0</div><div class="bili-tts-stat-lbl">已朗读</div></div>
          <div><div class="bili-tts-stat-num" id="bili-stat-filtered" style="color: #9499A0;">0</div><div class="bili-tts-stat-lbl">已过滤</div></div>
        </div>
        <div class="bili-tts-btn-group">
          <button class="bili-tts-btn bili-tts-btn-pip" id="bili-pip-btn">开启 / 退出 画中画小窗</button>
          <button class="bili-tts-btn" id="bili-test-btn">试听高能弹幕与原音压限效果</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  const toast = document.createElement('div');
  toast.id = 'bili-tts-toast';
  toast.innerHTML = `
    <span style="color:#38BDF8;display:inline-flex;align-items:center;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    </span>
    <span id="bili-toast-txt"></span>
  `;
  document.body.appendChild(toast);

  // 绑定事件与拖拽逻辑
  const pill = document.getElementById('bili-tts-pill');
  const card = document.getElementById('bili-tts-card');

  let isCardExpanded = false;

  function closeCard() {
    if (!isCardExpanded) return;
    isCardExpanded = false;
    card.classList.add('hidden');
    resetIdle();
  }

  function adjustCardPosition() {
    if (!card || !container) return;
    const containerRect = container.getBoundingClientRect();
    const winH = window.innerHeight;
    const spaceAbove = containerRect.top - 16;
    const spaceBelow = winH - containerRect.bottom - 16;
    const popUp = spaceAbove >= 320 || spaceAbove >= spaceBelow;
    container.setAttribute('data-v-align', popUp ? 'up' : 'down');
    const maxAvailable = popUp ? spaceAbove : spaceBelow;
    card.style.maxHeight = `${Math.max(260, Math.min(520, Math.floor(maxAvailable)))}px`;
  }

  function openCard() {
    isCardExpanded = true;
    card.classList.remove('hidden');
    adjustCardPosition();
  }

  function toggleCard() {
    if (isCardExpanded) {
      closeCard();
    } else {
      openCard();
    }
  }

  // 拖动与自动贴边吸附
  let isPointerDown = false;
  let hasDragged = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let idleTimer = null;

  const resetIdle = () => {
    clearTimeout(idleTimer);
    pill.classList.remove('idle');
    if (!isCardExpanded) {
      idleTimer = setTimeout(() => pill.classList.add('idle'), 3500);
    }
  };

  pill.addEventListener('mouseenter', () => { clearTimeout(idleTimer); pill.classList.remove('idle'); });
  pill.addEventListener('mouseleave', resetIdle);

  const onDown = (cx, cy) => {
    isPointerDown = true;
    hasDragged = false;
    startX = cx;
    startY = cy;
    const r = container.getBoundingClientRect();
    startLeft = r.left;
    startTop = r.top;
    container.classList.remove('snapping');
    clearTimeout(idleTimer);
    pill.classList.remove('idle');
  };

  const onMove = (cx, cy) => {
    if (!isPointerDown) return;
    const dx = cx - startX;
    const dy = cy - startY;
    if (!hasDragged && Math.hypot(dx, dy) > 5) {
      hasDragged = true;
      container.classList.add('dragging');
    }
    if (hasDragged) {
      const w = window.innerWidth, h = window.innerHeight;
      const r = container.getBoundingClientRect();
      const nLeft = Math.max(6, Math.min(w - r.width - 6, startLeft + dx));
      const nTop = Math.max(50, Math.min(h - r.height - 20, startTop + dy));
      container.style.left = `${nLeft}px`;
      container.style.right = 'auto';
      container.style.top = `${nTop}px`;
      container.style.bottom = 'auto';
    }
  };

  const onUp = () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    if (hasDragged) {
      container.classList.remove('dragging');
      container.classList.add('snapping');
      const r = container.getBoundingClientRect();
      const isLeft = (r.left + r.width / 2) < (window.innerWidth / 2);
      const finalDock = isLeft ? 'left' : 'right';
      const finalTop = Math.max(60, Math.min(window.innerHeight - 80, r.top));

      container.setAttribute('data-dock', finalDock);
      container.setAttribute('data-v-align', finalTop < 380 ? 'down' : 'up');
      container.style.top = `${finalTop}px`;
      container.style.bottom = 'auto';
      if (isLeft) {
        container.style.left = '12px';
        container.style.right = 'auto';
      } else {
        container.style.left = 'auto';
        container.style.right = '12px';
      }

      try {
        localStorage.setItem('bili_tts_pill_pos', JSON.stringify({ dock: finalDock, topPx: finalTop }));
      } catch (e) {}

      setTimeout(() => container.classList.remove('snapping'), 300);
      resetIdle();
    } else {
      toggleCard();
    }
  };

  pill.addEventListener('mousedown', (e) => { if (e.button === 0) onDown(e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onUp);
  pill.addEventListener('touchstart', (e) => { if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchend', onUp);
  resetIdle();

  // 外部点击自动关闭卡片
  document.addEventListener('pointerdown', (e) => {
    if (!isCardExpanded) return;
    if (container && !container.contains(e.target)) {
      closeCard();
    }
  });

  const closeBtn = document.getElementById('bili-tts-close');
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeCard();
    };
  }

  // 标签页切换
  const tabBtns = card.querySelectorAll('.bili-tts-tab-btn');
  tabBtns.forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const targetTab = btn.getAttribute('data-tab');
      updateBiliTTSSettings({ activeTab: targetTab });
      tabBtns.forEach(b => b.classList.toggle('active', b === btn));
      const basicContent = document.getElementById('bili-tab-content-basic');
      const audioContent = document.getElementById('bili-tab-content-audio');
      if (basicContent && audioContent) {
        basicContent.style.display = targetTab === 'basic' ? 'flex' : 'none';
        audioContent.style.display = targetTab === 'audio' ? 'flex' : 'none';
      }
      adjustCardPosition();
    };
  });

  function updateBadge() {
    const badge = document.getElementById('bili-tts-badge');
    if (!badge) return;
    badge.classList.remove('muted', 'active-bg');
    if (!isEnabled) {
      badge.textContent = '已暂停';
      badge.classList.add('muted');
    } else if (onlyWhenHidden) {
      if (document.hidden) {
        badge.textContent = '后台朗读中';
        badge.classList.add('active-bg');
      } else {
        badge.textContent = '前台静音(切Tab读)';
        badge.classList.add('muted');
      }
    } else {
      badge.textContent = '全时朗读';
      badge.classList.add('active-bg');
    }
  }
  updateBadge();

  document.getElementById('bili-tts-enable').onchange = (e) => {
    isEnabled = e.target.checked;
    updateBiliTTSSettings({ enabled: isEnabled });
    pill.classList.toggle('disabled', !isEnabled);
    if (!isEnabled) tts.stop();
    updateBadge();
  };

  const hiddenOnlyEl = document.getElementById('bili-tts-hidden-only');
  if (hiddenOnlyEl) {
    hiddenOnlyEl.onchange = (e) => {
      onlyWhenHidden = e.target.checked;
      updateBiliTTSSettings({ onlyWhenHidden: onlyWhenHidden });
      if (onlyWhenHidden && !document.hidden) {
        tts.stop();
        toast.classList.remove('visible');
      }
      updateBadge();
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && onlyWhenHidden) {
      tts.stop();
      toast.classList.remove('visible');
    }
    updateBadge();
  });

  document.getElementById('bili-tts-duck').onchange = (e) => {
    tts.duckingEnabled = e.target.checked;
    updateBiliTTSSettings({ duckingEnabled: e.target.checked });
  };
  document.getElementById('bili-duck-slider').oninput = (e) => {
    const factor = e.target.value / 100;
    tts.duckingFactor = factor;
    updateBiliTTSSettings({ duckingFactor: factor });
    document.getElementById('bili-duck-txt').textContent = `压低至 ${e.target.value}%`;
  };

  const volSlider = document.getElementById('bili-vol-slider');
  const volTxt = document.getElementById('bili-vol-txt');
  const volStatus = document.getElementById('bili-vol-status');
  const volResetBtn = document.getElementById('bili-vol-reset-btn');

  function syncVideoVolume(volRatio) {
    if (tts.autoFollowVolume) {
      const pct = Math.round(volRatio * 100);
      if (volSlider) volSlider.value = pct;
      if (volTxt) volTxt.textContent = `跟随视频 (${pct}%)`;
      if (volStatus) volStatus.textContent = `跟随 B 站播放器音量 (${pct}%)`;
      if (volResetBtn) volResetBtn.style.display = 'none';
    }
  }

  tts.onVideoVolumeChange = (vol) => {
    syncVideoVolume(vol);
  };

  if (volSlider) {
    volSlider.oninput = (e) => {
      const pct = parseInt(e.target.value, 10);
      tts.autoFollowVolume = false;
      tts.volume = pct / 100;
      volTxt.textContent = `${pct}% (自定义)`;
      volStatus.textContent = `独立设定音量: ${pct}%`;
      volResetBtn.style.display = 'inline-block';
      updateBiliTTSSettings({ volumeAutoFollow: false, customVolume: tts.volume });
    };
  }

  if (volResetBtn) {
    volResetBtn.onclick = (e) => {
      e.stopPropagation();
      tts.autoFollowVolume = true;
      tts.volume = null;
      volResetBtn.style.display = 'none';
      if (activeVideo) syncVideoVolume(activeVideo.volume);
      updateBiliTTSSettings({ volumeAutoFollow: true });
    };
  }
  document.getElementById('bili-rate-slider').oninput = (e) => {
    const r = (e.target.value / 100).toFixed(2);
    const numR = parseFloat(r);
    tts.baseRate = numR;
    scheduler.baseRate = numR;
    updateBiliTTSSettings({ speechRate: numR });
    document.getElementById('bili-rate-txt').textContent = `${r}x`;
  };
  document.getElementById('bili-mode-select').onchange = (e) => {
    scheduler.minPriority = (e.target.value === 'high' || e.target.value === 'highlight') ? 25 : (e.target.value === 'all') ? 0 : 15;
    updateBiliTTSSettings({ filterMode: e.target.value });
  };
  const togglePiP = async () => {
    if (!activeVideo) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await activeVideo.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('[BiliDanmakuTTS] 画中画切换异常:', e);
    }
  };
  const pipPillBtn = document.getElementById('bili-tts-pip-btn');
  const pipCardBtn = document.getElementById('bili-pip-btn');
  if (pipPillBtn) pipPillBtn.onclick = (e) => { e.stopPropagation(); togglePiP(); };
  if (pipCardBtn) pipCardBtn.onclick = (e) => { e.stopPropagation(); togglePiP(); };

  document.getElementById('bili-test-btn').onclick = () => {
    tts.speak({ textToSpeak: '试听成功！当前所有设置已自动记忆保存，无论切换标签页还是打开新视频均会保持。' });
  };

  tts.onStart = (txt) => {
    document.getElementById('bili-toast-txt').textContent = `正在朗读: ${txt}`;
    toast.classList.add('visible');
    document.getElementById('bili-tts-pulse').style.display = 'block';
  };
  tts.onEnd = () => {
    toast.classList.remove('visible');
    document.getElementById('bili-tts-pulse').style.display = 'none';
  };

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      document.getElementById('bili-tts-enable').click();
    }
  });

  const pauseSelect = document.getElementById('bili-pause-select');
  if (pauseSelect) {
    pauseSelect.value = pauseBehavior;
    pauseSelect.onchange = (e) => {
      pauseBehavior = e.target.value;
      updateBiliTTSSettings({ pauseBehavior: pauseBehavior });
    };
  }

  // 视频连接与主时钟
  let activeVideo = null;
  function handleTick() {
    if (!isEnabled || !activeVideo || activeVideo.paused) return;
    if (onlyWhenHidden && !document.hidden) return; // 看视频前台页面时静音

    const item = scheduler.tick(activeVideo.currentTime, tts.isSpeaking);
    if (item) tts.speak(item);

    document.getElementById('bili-stat-spoken').textContent = scheduler.spokenCount;
    document.getElementById('bili-stat-filtered').textContent = scheduler.filteredCount;
  }

  function connect() {
    const v = document.querySelector('video');
    if (!v) {
      setTimeout(connect, 600);
      return;
    }
    activeVideo = v;
    tts.setVideo(v);

    // 初始化音量同步或恢复自定义音量
    const curSettings = getBiliTTSSettings();
    if (!curSettings.volumeAutoFollow && typeof curSettings.customVolume === 'number') {
      tts.autoFollowVolume = false;
      tts.volume = curSettings.customVolume;
      const pct = Math.round(curSettings.customVolume * 100);
      if (volSlider) volSlider.value = pct;
      if (volTxt) volTxt.textContent = `${pct}% (自定义)`;
      if (volStatus) volStatus.textContent = `独立设定音量: ${pct}%`;
      if (volResetBtn) volResetBtn.style.display = 'inline-block';
    } else {
      tts.autoFollowVolume = true;
      syncVideoVolume(v.volume);
    }

    // 监听视频暂停事件：清空待读队列，杜绝暂停期间连续读下去
    v.addEventListener('pause', () => {
      scheduler.clearQueue();
      if (pauseBehavior === 'stop') {
        tts.stop();
        toast.classList.remove('visible');
        document.getElementById('bili-tts-pulse').style.display = 'none';
      }
    });

    // 监听视频恢复播放事件：对齐最新秒数，零陈旧积攒
    v.addEventListener('play', () => {
      scheduler.onSeek(v.currentTime);
    });

    // 监听视频拖动进度 Seeking / Seeked
    v.addEventListener('seeking', () => {
      scheduler.clearQueue();
      tts.stop();
      toast.classList.remove('visible');
      document.getElementById('bili-tts-pulse').style.display = 'none';
    });

    v.addEventListener('seeked', () => scheduler.onSeek(v.currentTime));

    // 用户手势解锁 Web Speech API 音频权限
    const unlockAudio = () => {
      if (window.speechSynthesis) window.speechSynthesis.resume();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    fetchDanmakus().then(list => {
      scheduler.load(list);
      document.getElementById('bili-stat-total').textContent = list.length;
    });

    setInterval(handleTick, 120);
    v.removeEventListener('timeupdate', handleTick);
    v.addEventListener('timeupdate', handleTick);

    updateBadge();
  }

  // 监听 URL 变化（分 P 或单页切视频）
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      connect();
    }
  }, 1500);

  connect();
})();
