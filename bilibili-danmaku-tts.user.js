// ==UserScript==
// @name         BiliDanmakuTTS - B站息屏听弹幕助手 (单文件免安装版)
// @namespace    https://github.com/lin/bili-danmaku-tts
// @version      1.0.0
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
      bottom: 85px;
      right: 25px;
      z-index: 9999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      font-size: 13px;
      color: #18191c;
    }
    .bili-tts-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(251, 114, 153, 0.35);
      border-radius: 30px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(251, 114, 153, 0.15);
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bili-tts-pill:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(251, 114, 153, 0.25);
      border-color: #FB7299;
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
      bottom: 50px;
      right: 0;
      width: 320px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(227, 229, 231, 0.8);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transform-origin: bottom right;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
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
      padding-bottom: 10px;
    }
    .bili-tts-card-title {
      font-size: 14px;
      font-weight: 700;
      color: #18191C;
      display: flex;
      align-items: center;
      gap: 6px;
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
      // 丢弃过期 2.2 秒以上的弹幕
      this.pendingQueue = this.pendingQueue.filter(item => {
        const expired = (currentTime - item.targetTime) > 2.2;
        if (expired) this.filteredCount++;
        return !expired;
      });

      // 拉取当前批次
      const windowEnd = currentTime + 1.2;
      const batch = [];
      while (this.currentIndex < this.danmakuList.length) {
        const d = this.danmakuList[this.currentIndex];
        if (d.time > windowEnd) break;
        if (d.time >= currentTime - 0.3) {
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
            this.pendingQueue.push({
              textToSpeak: text,
              priority: priority,
              targetTime: grp.raw.time,
              rate: this.baseRate
            });
          } else {
            this.filteredCount++;
          }
        });

        this.pendingQueue.sort((a, b) => b.priority - a.priority);
      }

      if (!isSpeaking && this.pendingQueue.length > 0) {
        const item = this.pendingQueue.shift();
        if (this.pendingQueue.length >= 2) {
          item.rate = Math.min(this.baseRate * 1.25, 1.8);
        }
        this.spokenCount++;
        return item;
      }
      return null;
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
      this.selectedVoice = null;
      this.duckTimer = null;
      this.onStart = null;
      this.onEnd = null;
    }

    setVideo(v) {
      this.videoEl = v;
      if (v) this.origVol = v.volume;
    }

    speak(item) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(item.textToSpeak);
      u.rate = item.rate || this.baseRate;
      if (this.selectedVoice) u.voice = this.selectedVoice;

      u.onstart = () => {
        this.isSpeaking = true;
        this.applyDucking(true);
        if (this.onStart) this.onStart(item.textToSpeak);
      };

      const cleanup = () => {
        this.isSpeaking = false;
        this.applyDucking(false);
        if (this.onEnd) this.onEnd();
      };

      u.onend = cleanup;
      u.onerror = cleanup;
      window.speechSynthesis.speak(u);
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
  const scheduler = new DanmakuScheduler();
  const tts = new TTSEngine();
  let isEnabled = true;

  // 注入 UI
  const container = document.createElement('div');
  container.id = 'bili-tts-container';
  container.innerHTML = `
    <div class="bili-tts-pill active" id="bili-tts-pill">
      <div class="bili-tts-pill-icon">🎙️</div>
      <div class="bili-tts-pill-text">听弹幕</div>
      <div class="bili-tts-pulse" id="bili-tts-pulse" style="display: none;"></div>
      <div class="bili-tts-pill-badge" id="bili-tts-badge">就绪</div>
    </div>
    <div class="bili-tts-card hidden" id="bili-tts-card">
      <div class="bili-tts-card-header">
        <div class="bili-tts-card-title"><span>🎙️</span><span>息屏听弹幕助手</span></div>
        <button class="bili-tts-close-btn" id="bili-tts-close">✕</button>
      </div>
      <div class="bili-tts-row">
        <span class="bili-tts-label">启用弹幕朗读 (Alt+D)</span>
        <label class="bili-tts-switch"><input type="checkbox" id="bili-tts-enable" checked><span class="bili-tts-slider"></span></label>
      </div>
      <div class="bili-tts-row">
        <span class="bili-tts-label">视频音频压限 (Ducking)</span>
        <label class="bili-tts-switch"><input type="checkbox" id="bili-tts-duck" checked><span class="bili-tts-slider"></span></label>
      </div>
      <div class="bili-tts-range-wrap">
        <div class="bili-tts-range-header"><span>原音压低程度</span><span id="bili-duck-txt">压低至 35%</span></div>
        <input type="range" class="bili-tts-range-input" id="bili-duck-slider" min="10" max="80" value="35">
      </div>
      <div class="bili-tts-range-wrap">
        <div class="bili-tts-range-header"><span>朗读语速</span><span id="bili-rate-txt">1.15x</span></div>
        <input type="range" class="bili-tts-range-input" id="bili-rate-slider" min="80" max="200" value="115">
      </div>
      <div class="bili-tts-range-wrap">
        <span class="bili-tts-label">过滤模式</span>
        <select class="bili-tts-select" id="bili-mode-select">
          <option value="smart" selected>💡 智能模式 (推荐: 梗词加权 + 自动折叠)</option>
          <option value="high">🔥 仅高能弹幕 (强力降噪)</option>
          <option value="all">📢 全部朗读 (全量接收)</option>
        </select>
      </div>
      <div class="bili-tts-stats-bar">
        <div><div class="bili-tts-stat-num" id="bili-stat-total">0</div><div class="bili-tts-stat-lbl">已抓取</div></div>
        <div><div class="bili-tts-stat-num" id="bili-stat-spoken" style="color: #10B981;">0</div><div class="bili-tts-stat-lbl">已朗读</div></div>
        <div><div class="bili-tts-stat-num" id="bili-stat-filtered" style="color: #9499A0;">0</div><div class="bili-tts-stat-lbl">已过滤</div></div>
      </div>
      <button class="bili-tts-btn" id="bili-test-btn">🔊 试听一条高能弹幕与压音效果</button>
    </div>
  `;
  document.body.appendChild(container);

  const toast = document.createElement('div');
  toast.id = 'bili-tts-toast';
  toast.innerHTML = `<span style="color:#38BDF8;">🔊</span><span id="bili-toast-txt"></span>`;
  document.body.appendChild(toast);

  // 绑定事件
  const pill = document.getElementById('bili-tts-pill');
  const card = document.getElementById('bili-tts-card');
  pill.onclick = () => card.classList.toggle('hidden');
  document.getElementById('bili-tts-close').onclick = () => card.classList.add('hidden');

  document.getElementById('bili-tts-enable').onchange = (e) => {
    isEnabled = e.target.checked;
    pill.classList.toggle('disabled', !isEnabled);
    document.getElementById('bili-tts-badge').textContent = isEnabled ? '开启中' : '已暂停';
    if (!isEnabled) tts.stop();
  };

  document.getElementById('bili-tts-duck').onchange = (e) => { tts.duckingEnabled = e.target.checked; };
  document.getElementById('bili-duck-slider').oninput = (e) => {
    tts.duckingFactor = e.target.value / 100;
    document.getElementById('bili-duck-txt').textContent = `压低至 ${e.target.value}%`;
  };
  document.getElementById('bili-rate-slider').oninput = (e) => {
    const r = (e.target.value / 100).toFixed(2);
    tts.baseRate = parseFloat(r);
    scheduler.baseRate = parseFloat(r);
    document.getElementById('bili-rate-txt').textContent = `${r}x`;
  };
  document.getElementById('bili-mode-select').onchange = (e) => {
    scheduler.minPriority = (e.target.value === 'high') ? 25 : (e.target.value === 'all') ? 0 : 15;
  };
  document.getElementById('bili-test-btn').onclick = () => {
    tts.speak({ textToSpeak: '前方高能！大量弹幕来袭，视频原音已自动压低！' });
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

  // 视频连接与主时钟
  let activeVideo = null;
  function connect() {
    const v = document.querySelector('video');
    if (!v) {
      setTimeout(connect, 600);
      return;
    }
    activeVideo = v;
    tts.setVideo(v);

    v.addEventListener('seeked', () => scheduler.onSeek(v.currentTime));

    fetchDanmakus().then(list => {
      scheduler.load(list);
      document.getElementById('bili-stat-total').textContent = list.length;
    });

    setInterval(() => {
      if (!isEnabled || !activeVideo || activeVideo.paused) return;
      const item = scheduler.tick(activeVideo.currentTime, tts.isSpeaking);
      if (item) tts.speak(item);

      document.getElementById('bili-stat-spoken').textContent = scheduler.spokenCount;
      document.getElementById('bili-stat-filtered').textContent = scheduler.filteredCount;
    }, 120);
  }

  connect();
})();
