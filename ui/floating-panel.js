/**
 * BiliDanmakuTTS - 悬浮控制面板组件
 * 核心职责：在 B 站视频页右下角注入精致的拟物化/毛玻璃悬浮窗与实时字幕浮层。
 */

class FloatingPanel {
  constructor(options = {}) {
    this.options = Object.assign({
      onToggle: null,
      onDuckingChange: null,
      onRateChange: null,
      onVoiceChange: null,
      onFilterModeChange: null,
      onTestClick: null
    }, options);

    this.container = null;
    this.toast = null;
    this.isExpanded = false;
    this.initDOM();
  }

  initDOM() {
    if (document.getElementById('bili-tts-container')) return;

    // 1. 创建悬浮主容器
    const container = document.createElement('div');
    container.id = 'bili-tts-container';
    container.innerHTML = `
      <!-- 最小化胶囊 -->
      <div class="bili-tts-pill active" id="bili-tts-pill">
        <div class="bili-tts-pill-icon">🎙️</div>
        <div class="bili-tts-pill-text">听弹幕</div>
        <div class="bili-tts-pulse" id="bili-tts-pulse" style="display: none;"></div>
        <div class="bili-tts-pill-badge" id="bili-tts-badge">就绪</div>
      </div>

      <!-- 展开的详细控制卡片 -->
      <div class="bili-tts-card hidden" id="bili-tts-card">
        <div class="bili-tts-card-header">
          <div class="bili-tts-card-title">
            <span>🎙️</span>
            <span>息屏听弹幕设置</span>
          </div>
          <button class="bili-tts-close-btn" id="bili-tts-close">✕</button>
        </div>

        <!-- 开启/关闭主开关 -->
        <div class="bili-tts-row">
          <span class="bili-tts-label">启用弹幕朗读</span>
          <label class="bili-tts-switch">
            <input type="checkbox" id="bili-tts-enable-switch" checked>
            <span class="bili-tts-slider"></span>
          </label>
        </div>

        <!-- 原音频侧链压限 (Ducking) 开关 -->
        <div class="bili-tts-row">
          <span class="bili-tts-label">视频原音压限 (Ducking)</span>
          <label class="bili-tts-switch">
            <input type="checkbox" id="bili-tts-duck-switch" checked>
            <span class="bili-tts-slider"></span>
          </label>
        </div>

        <!-- 压音程度滑块 -->
        <div class="bili-tts-range-wrap">
          <div class="bili-tts-range-header">
            <span>原音压低程度</span>
            <span id="bili-tts-duck-val">压低至 35%</span>
          </div>
          <input type="range" class="bili-tts-range-input" id="bili-tts-duck-slider" min="10" max="80" value="35">
        </div>

        <!-- 基础语速滑块 -->
        <div class="bili-tts-range-wrap">
          <div class="bili-tts-range-header">
            <span>朗读语速</span>
            <span id="bili-tts-rate-val">1.15x</span>
          </div>
          <input type="range" class="bili-tts-range-input" id="bili-tts-rate-slider" min="80" max="200" value="115">
        </div>

        <!-- 过滤模式选择 -->
        <div class="bili-tts-range-wrap">
          <span class="bili-tts-label">过滤模式</span>
          <select class="bili-tts-select" id="bili-tts-filter-mode">
            <option value="smart" selected>💡 智能模式 (推荐: 梗词加权 + 自动折叠)</option>
            <option value="highlight">🔥 仅高能弹幕 (强力降噪，不打扰正片)</option>
            <option value="all">📢 全部朗读 (自适应加速，全量接收)</option>
          </select>
        </div>

        <!-- TTS 音色选择 -->
        <div class="bili-tts-range-wrap">
          <span class="bili-tts-label">朗读人音色</span>
          <select class="bili-tts-select" id="bili-tts-voice-select">
            <option value="">默认自然合成音</option>
          </select>
        </div>

        <!-- 统计面板 -->
        <div class="bili-tts-stats-bar">
          <div>
            <div class="bili-tts-stat-num" id="bili-stat-total">0</div>
            <div class="bili-tts-stat-lbl">已抓取</div>
          </div>
          <div>
            <div class="bili-tts-stat-num" id="bili-stat-spoken" style="color: #10B981;">0</div>
            <div class="bili-tts-stat-lbl">已朗读</div>
          </div>
          <div>
            <div class="bili-tts-stat-num" id="bili-stat-filtered" style="color: #9499A0;">0</div>
            <div class="bili-tts-stat-lbl">已过滤</div>
          </div>
        </div>

        <!-- 测试按钮 -->
        <button class="bili-tts-btn" id="bili-tts-test-btn">🔊 试听一条高能弹幕与压音</button>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    // 2. 创建实时朗读浮层字幕 (Toast)
    const toast = document.createElement('div');
    toast.id = 'bili-tts-toast';
    toast.innerHTML = `
      <span class="bili-tts-toast-icon">🔊</span>
      <span id="bili-tts-toast-text">正在朗读...</span>
    `;
    document.body.appendChild(toast);
    this.toast = toast;

    this.bindEvents();
  }

  bindEvents() {
    const pill = document.getElementById('bili-tts-pill');
    const card = document.getElementById('bili-tts-card');
    const closeBtn = document.getElementById('bili-tts-close');
    const enableSwitch = document.getElementById('bili-tts-enable-switch');
    const duckSwitch = document.getElementById('bili-tts-duck-switch');
    const duckSlider = document.getElementById('bili-tts-duck-slider');
    const duckVal = document.getElementById('bili-tts-duck-val');
    const rateSlider = document.getElementById('bili-tts-rate-slider');
    const rateVal = document.getElementById('bili-tts-rate-val');
    const filterSelect = document.getElementById('bili-tts-filter-mode');
    const voiceSelect = document.getElementById('bili-tts-voice-select');
    const testBtn = document.getElementById('bili-tts-test-btn');

    // 点击胶囊展开/折叠
    pill.addEventListener('click', () => {
      this.isExpanded = !this.isExpanded;
      card.classList.toggle('hidden', !this.isExpanded);
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isExpanded = false;
      card.classList.add('hidden');
    });

    // 开关监听
    enableSwitch.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      pill.classList.toggle('disabled', !isEnabled);
      document.getElementById('bili-tts-badge').textContent = isEnabled ? '开启中' : '已暂停';
      if (this.options.onToggle) this.options.onToggle(isEnabled);
    });

    // 压音开关与滑块
    duckSwitch.addEventListener('change', (e) => {
      if (this.options.onDuckingChange) {
        this.options.onDuckingChange(e.target.checked, parseFloat(duckSlider.value) / 100);
      }
    });

    duckSlider.addEventListener('input', (e) => {
      const pct = e.target.value;
      duckVal.textContent = `压低至 ${pct}%`;
      if (this.options.onDuckingChange) {
        this.options.onDuckingChange(duckSwitch.checked, parseFloat(pct) / 100);
      }
    });

    // 语速滑块
    rateSlider.addEventListener('input', (e) => {
      const rate = (parseInt(e.target.value, 10) / 100).toFixed(2);
      rateVal.textContent = `${rate}x`;
      if (this.options.onRateChange) {
        this.options.onRateChange(parseFloat(rate));
      }
    });

    // 过滤模式
    filterSelect.addEventListener('change', (e) => {
      if (this.options.onFilterModeChange) {
        this.options.onFilterModeChange(e.target.value);
      }
    });

    // 音色选择
    voiceSelect.addEventListener('change', (e) => {
      if (this.options.onVoiceChange) {
        this.options.onVoiceChange(e.target.value);
      }
    });

    // 试听测试按钮
    testBtn.addEventListener('click', () => {
      if (this.options.onTestClick) {
        this.options.onTestClick();
      }
    });
  }

  populateVoices(voices) {
    const select = document.getElementById('bili-tts-voice-select');
    if (!select || !voices || voices.length === 0) return;

    select.innerHTML = '<option value="">默认优选中文音色</option>';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      select.appendChild(opt);
    });
  }

  showToast(text) {
    const toast = this.toast;
    const toastText = document.getElementById('bili-tts-toast-text');
    const pulse = document.getElementById('bili-tts-pulse');
    if (!toast || !toastText) return;

    toastText.textContent = text;
    toast.classList.add('visible');
    if (pulse) pulse.style.display = 'block';
  }

  hideToast() {
    const toast = this.toast;
    const pulse = document.getElementById('bili-tts-pulse');
    if (toast) toast.classList.remove('visible');
    if (pulse) pulse.style.display = 'none';
  }

  updateStats(stats) {
    const elTotal = document.getElementById('bili-stat-total');
    const elSpoken = document.getElementById('bili-stat-spoken');
    const elFiltered = document.getElementById('bili-stat-filtered');

    if (elTotal) elTotal.textContent = stats.total || 0;
    if (elSpoken) elSpoken.textContent = stats.spoken || 0;
    if (elFiltered) elFiltered.textContent = stats.filtered || 0;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FloatingPanel };
}
