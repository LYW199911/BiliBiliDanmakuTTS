/**
 * BiliDanmakuTTS - 悬浮控制面板组件
 * 核心职责：在 B 站视频页右下角注入精致的拟物化/毛玻璃悬浮窗与实时字幕浮层。
 */

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
  filterMode: 'smart',      // 过滤模式 ('smart' | 'highlight' | 'all')
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

  // 向上兼容旧版独立键
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

if (typeof window !== 'undefined') {
  window.BiliTTSSettings = {
    get: getBiliTTSSettings,
    update: updateBiliTTSSettings,
    DEFAULT: DEFAULT_BILI_TTS_SETTINGS
  };
}

class FloatingPanel {
  constructor(options = {}) {
    this.options = Object.assign({
      onToggle: null,
      onOnlyHiddenChange: null,
      onPipToggle: null,
      onAutoPipChange: null,
      onDuckingChange: null,
      onRateChange: null,
      onVoiceChange: null,
      onFilterModeChange: null,
      onPauseBehaviorChange: null,
      onVolumeChange: null,
      onAutoFollowVolumeChange: null,
      onTestClick: null
    }, options);

    this.settings = getBiliTTSSettings();
    this.container = null;
    this.toast = null;
    this.isExpanded = false;
    this.autoFollowVolume = this.settings.volumeAutoFollow;
    this.customVolume = this.settings.customVolume;
    this.selectedVoiceName = this.settings.voiceName || '';
    this.initDOM();
  }

  /**
   * 外部同步当前视频播放器音量 (0.0 ~ 1.0)
   */
  updateVideoVolume(volRatio) {
    const pct = Math.round(volRatio * 100);
    if (this.autoFollowVolume) {
      const slider = document.getElementById('bili-tts-vol-slider');
      const val = document.getElementById('bili-tts-vol-val');
      const status = document.getElementById('bili-tts-vol-status');
      const resetBtn = document.getElementById('bili-tts-vol-reset-btn');
      if (slider) slider.value = pct;
      if (val) val.textContent = `跟随视频 (${pct}%)`;
      if (status) status.textContent = `跟随 B 站播放器音量 (${pct}%)`;
      if (resetBtn) resetBtn.style.display = 'none';
    }
  }

  initDOM() {
    if (document.getElementById('bili-tts-container')) return;

    const s = this.settings;

    // 1. 创建悬浮主容器并恢复用户记忆位置
    const container = document.createElement('div');
    container.id = 'bili-tts-container';

    let savedPos = null;
    try {
      savedPos = JSON.parse(localStorage.getItem('bili_tts_pill_pos'));
    } catch (e) {}

    const dock = savedPos?.dock || 'right';
    const topPx = savedPos?.topPx || Math.max(120, Math.floor(window.innerHeight * 0.65));
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

    const volPct = Math.round((s.customVolume || 1.0) * 100);
    const duckPct = Math.round((s.duckingFactor || 0.35) * 100);
    const rateVal = (s.speechRate || 1.15).toFixed(2);
    const rateSliderVal = Math.round((s.speechRate || 1.15) * 100);
    const isBasicTab = s.activeTab !== 'audio';

    container.innerHTML = `
      <!-- 最小化胶囊（极简精致设计：仅保留麦克风图标与当前状态徽章，短小美观不挡选集与进度条） -->
      <div class="bili-tts-pill active${s.enabled ? '' : ' disabled'}" id="bili-tts-pill" title="点击展开设置，按住可拖动">
        <div class="bili-tts-pill-icon">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
        </div>
        <div class="bili-tts-pulse" id="bili-tts-pulse" style="display: none;"></div>
        <div class="bili-tts-pill-badge" id="bili-tts-badge">就绪</div>
      </div>

      <!-- 展开的详细控制卡片 -->
      <div class="bili-tts-card hidden" id="bili-tts-card">
        <!-- 顶部固定标题栏 -->
        <div class="bili-tts-card-header">
          <div class="bili-tts-card-title">
            <span>息屏听弹幕助手</span>
            <span class="bili-tts-version-badge">v1.0.3</span>
          </div>
          <button class="bili-tts-close-btn" id="bili-tts-close" title="关闭 (点击外部任意处也可关闭)">✕</button>
        </div>

        <!-- 二级导航标签页 -->
        <div class="bili-tts-tabs">
          <button class="bili-tts-tab-btn ${isBasicTab ? 'active' : ''}" id="bili-tab-btn-basic" data-tab="basic">常用设置</button>
          <button class="bili-tts-tab-btn ${!isBasicTab ? 'active' : ''}" id="bili-tab-btn-audio" data-tab="audio">音频与降噪</button>
        </div>

        <!-- 可滚动内容主体 -->
        <div class="bili-tts-card-body" id="bili-tts-card-body">
          <!-- 标签页 1: 常用控制 -->
          <div class="bili-tts-tab-content" id="bili-tab-content-basic" style="display: ${isBasicTab ? 'flex' : 'none'};">
            <!-- 开启/关闭主开关 -->
            <div class="bili-tts-row">
              <span class="bili-tts-label">启用弹幕朗读 (Alt+D)</span>
              <label class="bili-tts-switch">
                <input type="checkbox" id="bili-tts-enable-switch" ${s.enabled ? 'checked' : ''}>
                <span class="bili-tts-slider"></span>
              </label>
            </div>

            <!-- 仅切Tab/后台时朗读 -->
            <div class="bili-tts-row">
              <div class="bili-tts-label-group">
                <span class="bili-tts-label">仅切Tab/后台时朗读</span>
                <span class="bili-tts-sub-label">看视频时静音，切换到其他Tab时朗读</span>
              </div>
              <label class="bili-tts-switch">
                <input type="checkbox" id="bili-tts-hidden-only-switch" ${s.onlyWhenHidden ? 'checked' : ''}>
                <span class="bili-tts-slider"></span>
              </label>
            </div>

            <!-- 切Tab自动开启画中画小窗 -->
            <div class="bili-tts-row">
              <div class="bili-tts-label-group">
                <span class="bili-tts-label">切Tab自动开启小窗</span>
                <span class="bili-tts-sub-label">离开页面自动弹出画中画，常驻桌面</span>
              </div>
              <label class="bili-tts-switch">
                <input type="checkbox" id="bili-tts-auto-pip-switch" ${s.autoPip ? 'checked' : ''}>
                <span class="bili-tts-slider"></span>
              </label>
            </div>

            <!-- 朗读音量滑块（默认跟随原视频音量，也可独立自由调节） -->
            <div class="bili-tts-range-wrap">
              <div class="bili-tts-range-header">
                <span>朗读音量</span>
                <span id="bili-tts-vol-val">${s.volumeAutoFollow ? '跟随视频 (100%)' : `${volPct}% (自定义)`}</span>
              </div>
              <input type="range" class="bili-tts-range-input" id="bili-tts-vol-slider" min="0" max="100" value="${s.volumeAutoFollow ? '100' : volPct}">
              <div class="bili-tts-vol-hint">
                <span id="bili-tts-vol-status">${s.volumeAutoFollow ? '默认跟随 B 站播放器音量' : `独立设定音量: ${volPct}%`}</span>
                <button class="bili-tts-link-btn" id="bili-tts-vol-reset-btn" style="display: ${s.volumeAutoFollow ? 'none' : 'inline-block'};">恢复跟随视频</button>
              </div>
            </div>

            <!-- 基础语速滑块 -->
            <div class="bili-tts-range-wrap">
              <div class="bili-tts-range-header">
                <span>朗读语速</span>
                <span id="bili-tts-rate-val">${rateVal}x</span>
              </div>
              <input type="range" class="bili-tts-range-input" id="bili-tts-rate-slider" min="80" max="200" value="${rateSliderVal}">
            </div>

            <!-- 视频暂停时的朗读行为 -->
            <div class="bili-tts-range-wrap">
              <span class="bili-tts-label">视频暂停时</span>
              <select class="bili-tts-select" id="bili-tts-pause-behavior">
                <option value="finish"${s.pauseBehavior === 'finish' ? ' selected' : ''}>读完当前条即停 (推荐)</option>
                <option value="stop"${s.pauseBehavior === 'stop' ? ' selected' : ''}>立即掐断朗读</option>
              </select>
            </div>
          </div>

          <!-- 标签页 2: 降噪与音效 -->
          <div class="bili-tts-tab-content" id="bili-tab-content-audio" style="display: ${!isBasicTab ? 'flex' : 'none'};">
            <!-- 原音频侧链压限 (Ducking) 开关 -->
            <div class="bili-tts-row">
              <div class="bili-tts-label-group">
                <span class="bili-tts-label">视频原音压限 (Ducking)</span>
                <span class="bili-tts-sub-label">朗读时自动按比例压低视频原声</span>
              </div>
              <label class="bili-tts-switch">
                <input type="checkbox" id="bili-tts-duck-switch" ${s.duckingEnabled ? 'checked' : ''}>
                <span class="bili-tts-slider"></span>
              </label>
            </div>

            <!-- 压音程度滑块 -->
            <div class="bili-tts-range-wrap">
              <div class="bili-tts-range-header">
                <span>原音压低程度</span>
                <span id="bili-tts-duck-val">压低至 ${duckPct}%</span>
              </div>
              <input type="range" class="bili-tts-range-input" id="bili-tts-duck-slider" min="10" max="80" value="${duckPct}">
            </div>

            <!-- 过滤模式选择 -->
            <div class="bili-tts-range-wrap">
              <span class="bili-tts-label">过滤模式</span>
              <select class="bili-tts-select" id="bili-tts-filter-mode">
                <option value="smart"${s.filterMode === 'smart' ? ' selected' : ''}>智能模式 (推荐: 过滤水词 + 高能加权)</option>
                <option value="highlight"${s.filterMode === 'highlight' ? ' selected' : ''}>仅高能弹幕 (强力降噪，不打扰正片)</option>
                <option value="all"${s.filterMode === 'all' ? ' selected' : ''}>全部朗读 (全量播报，建议提高语速)</option>
              </select>
            </div>

            <!-- TTS 音色选择 -->
            <div class="bili-tts-range-wrap">
              <span class="bili-tts-label">朗读人音色</span>
              <select class="bili-tts-select" id="bili-tts-voice-select">
                <option value="">默认优选中文音色</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 底部固定操作栏 -->
        <div class="bili-tts-card-footer">
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

          <div class="bili-tts-btn-group">
            <button class="bili-tts-btn bili-tts-btn-pip" id="bili-tts-pip-action-btn">开启 / 退出 画中画小窗</button>
            <button class="bili-tts-btn" id="bili-tts-test-btn">试听高能弹幕与原音压限效果</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    this.container = container;

    // 2. 创建实时朗读浮层字幕 (Toast)
    const toast = document.createElement('div');
    toast.id = 'bili-tts-toast';
    toast.innerHTML = `
      <span class="bili-tts-toast-icon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      </span>
      <span id="bili-tts-toast-text">正在朗读...</span>
    `;
    document.body.appendChild(toast);
    this.toast = toast;

    this.bindEvents();
    this.initDraggable();
  }

  closeCard() {
    if (!this.isExpanded) return;
    this.isExpanded = false;
    const card = document.getElementById('bili-tts-card');
    if (card) card.classList.add('hidden');
    if (this._resetIdle) this._resetIdle();
  }

  openCard() {
    const card = document.getElementById('bili-tts-card');
    if (!card) return;
    this.isExpanded = true;
    card.classList.remove('hidden');
    this.adjustCardPosition();
  }

  toggleCard() {
    if (this.isExpanded) {
      this.closeCard();
    } else {
      this.openCard();
    }
  }

  adjustCardPosition() {
    const card = document.getElementById('bili-tts-card');
    if (!card || !this.container) return;
    const containerRect = this.container.getBoundingClientRect();
    const winH = window.innerHeight;

    // 计算胶囊上方与下方的安全可用像素空间
    const spaceAbove = containerRect.top - 16;
    const spaceBelow = winH - containerRect.bottom - 16;

    // 当上方空间充裕（>= 320px）或上方比下方更大时，向上展开；否则向下展开
    const popUp = spaceAbove >= 320 || spaceAbove >= spaceBelow;
    this.container.setAttribute('data-v-align', popUp ? 'up' : 'down');

    // 动态限制卡片最大高度，确保顶底永远至少留出 16px 边距，绝不溢出屏幕！
    const maxAvailable = popUp ? spaceAbove : spaceBelow;
    const targetMaxH = Math.max(260, Math.min(520, Math.floor(maxAvailable)));
    card.style.maxHeight = `${targetMaxH}px`;
  }

  initDraggable() {
    const pill = document.getElementById('bili-tts-pill');
    const container = this.container;
    if (!pill || !container) return;

    let isPointerDown = false;
    let hasDragged = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let idleTimer = null;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      pill.classList.remove('idle');
      if (!this.isExpanded) {
        idleTimer = setTimeout(() => {
          pill.classList.add('idle');
        }, 3500);
      }
    };
    this._resetIdle = resetIdleTimer;

    pill.addEventListener('mouseenter', () => {
      clearTimeout(idleTimer);
      pill.classList.remove('idle');
    });

    pill.addEventListener('mouseleave', () => {
      resetIdleTimer();
    });

    const onPointerDown = (clientX, clientY) => {
      isPointerDown = true;
      hasDragged = false;
      startX = clientX;
      startY = clientY;
      const rect = container.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      container.classList.remove('snapping');
      clearTimeout(idleTimer);
      pill.classList.remove('idle');
    };

    const onPointerMove = (clientX, clientY) => {
      if (!isPointerDown) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      if (!hasDragged && Math.hypot(dx, dy) > 5) {
        hasDragged = true;
        container.classList.add('dragging');
      }

      if (hasDragged) {
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const rect = container.getBoundingClientRect();
        const newLeft = Math.max(6, Math.min(winW - rect.width - 6, startLeft + dx));
        const newTop = Math.max(50, Math.min(winH - rect.height - 20, startTop + dy));

        container.style.left = `${newLeft}px`;
        container.style.right = 'auto';
        container.style.top = `${newTop}px`;
        container.style.bottom = 'auto';
      }
    };

    const onPointerUp = () => {
      if (!isPointerDown) return;
      isPointerDown = false;

      if (hasDragged) {
        container.classList.remove('dragging');
        container.classList.add('snapping');

        const rect = container.getBoundingClientRect();
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const isLeft = (rect.left + rect.width / 2) < (winW / 2);
        const dock = isLeft ? 'left' : 'right';
        const finalTop = Math.max(60, Math.min(winH - 80, rect.top));

        container.setAttribute('data-dock', dock);
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
          localStorage.setItem('bili_tts_pill_pos', JSON.stringify({
            dock: dock,
            topPx: finalTop
          }));
        } catch (e) {}

        setTimeout(() => {
          container.classList.remove('snapping');
        }, 300);

        resetIdleTimer();
      } else {
        this.toggleCard();
      }
    };

    pill.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      onPointerDown(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      onPointerMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      onPointerUp();
    });

    pill.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      onPointerUp();
    });

    resetIdleTimer();
  }

  bindEvents() {
    const card = document.getElementById('bili-tts-card');
    const pill = document.getElementById('bili-tts-pill');
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

    // 外部点击自动关闭卡片
    document.addEventListener('pointerdown', (e) => {
      if (!this.isExpanded) return;
      if (this.container && !this.container.contains(e.target)) {
        this.closeCard();
      }
    });

    // 点击胶囊展开/折叠已交由 initDraggable 的轻触与拖拽分离器处理
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeCard();
    });

    // 标签页切换
    const tabBtns = card.querySelectorAll('.bili-tts-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetTab = btn.getAttribute('data-tab');
        this.settings.activeTab = targetTab;
        updateBiliTTSSettings({ activeTab: targetTab });
        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        const basicContent = document.getElementById('bili-tab-content-basic');
        const audioContent = document.getElementById('bili-tab-content-audio');
        if (basicContent && audioContent) {
          basicContent.style.display = targetTab === 'basic' ? 'flex' : 'none';
          audioContent.style.display = targetTab === 'audio' ? 'flex' : 'none';
        }
        this.adjustCardPosition();
      });
    });

    // 开关监听
    enableSwitch.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      this.settings.enabled = isEnabled;
      updateBiliTTSSettings({ enabled: isEnabled });
      pill.classList.toggle('disabled', !isEnabled);
      if (this.options.onToggle) this.options.onToggle(isEnabled);
    });

    // 仅切Tab/后台时朗读开关监听
    const hiddenOnlySwitch = document.getElementById('bili-tts-hidden-only-switch');
    if (hiddenOnlySwitch) {
      hiddenOnlySwitch.addEventListener('change', (e) => {
        this.settings.onlyWhenHidden = e.target.checked;
        updateBiliTTSSettings({ onlyWhenHidden: e.target.checked });
        if (this.options.onOnlyHiddenChange) {
          this.options.onOnlyHiddenChange(e.target.checked);
        }
      });
    }

    // 压音开关与滑块
    duckSwitch.addEventListener('change', (e) => {
      this.settings.duckingEnabled = e.target.checked;
      updateBiliTTSSettings({ duckingEnabled: e.target.checked });
      if (this.options.onDuckingChange) {
        this.options.onDuckingChange(e.target.checked, parseFloat(duckSlider.value) / 100);
      }
    });

    duckSlider.addEventListener('input', (e) => {
      const pct = e.target.value;
      duckVal.textContent = `压低至 ${pct}%`;
      const factor = parseFloat(pct) / 100;
      this.settings.duckingFactor = factor;
      updateBiliTTSSettings({ duckingFactor: factor });
      if (this.options.onDuckingChange) {
        this.options.onDuckingChange(duckSwitch.checked, factor);
      }
    });

    // 朗读音量滑块与恢复跟随视频按钮
    const volSlider = document.getElementById('bili-tts-vol-slider');
    const volVal = document.getElementById('bili-tts-vol-val');
    const volStatus = document.getElementById('bili-tts-vol-status');
    const volResetBtn = document.getElementById('bili-tts-vol-reset-btn');

    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        this.autoFollowVolume = false;
        this.customVolume = pct / 100;
        this.settings.volumeAutoFollow = false;
        this.settings.customVolume = pct / 100;
        updateBiliTTSSettings({ volumeAutoFollow: false, customVolume: pct / 100 });
        if (volVal) volVal.textContent = `${pct}% (自定义)`;
        if (volStatus) volStatus.textContent = `独立设定音量: ${pct}%`;
        if (volResetBtn) volResetBtn.style.display = 'inline-block';
        if (this.options.onVolumeChange) {
          this.options.onVolumeChange(pct / 100, false);
        }
      });
    }

    if (volResetBtn) {
      volResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.autoFollowVolume = true;
        this.settings.volumeAutoFollow = true;
        updateBiliTTSSettings({ volumeAutoFollow: true });
        volResetBtn.style.display = 'none';
        if (this.options.onAutoFollowVolumeChange) {
          this.options.onAutoFollowVolumeChange(true);
        }
      });
    }

    // 语速滑块
    rateSlider.addEventListener('input', (e) => {
      const rate = (parseInt(e.target.value, 10) / 100).toFixed(2);
      rateVal.textContent = `${rate}x`;
      const rateNum = parseFloat(rate);
      this.settings.speechRate = rateNum;
      updateBiliTTSSettings({ speechRate: rateNum });
      if (this.options.onRateChange) {
        this.options.onRateChange(rateNum);
      }
    });

    // 过滤模式
    filterSelect.addEventListener('change', (e) => {
      this.settings.filterMode = e.target.value;
      updateBiliTTSSettings({ filterMode: e.target.value });
      if (this.options.onFilterModeChange) {
        this.options.onFilterModeChange(e.target.value);
      }
    });

    // 音色选择
    voiceSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      this.selectedVoiceName = val;
      this.settings.voiceName = val;
      updateBiliTTSSettings({ voiceName: val });
      if (this.options.onVoiceChange) {
        this.options.onVoiceChange(val);
      }
    });

    // 视频暂停时朗读行为
    const pauseSelect = document.getElementById('bili-tts-pause-behavior');
    if (pauseSelect) {
      pauseSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.settings.pauseBehavior = val;
        updateBiliTTSSettings({ pauseBehavior: val });
        if (this.options.onPauseBehaviorChange) {
          this.options.onPauseBehaviorChange(val);
        }
      });
    }

    // 画中画小窗按钮
    const pipBtn = document.getElementById('bili-tts-pip-btn');
    const pipActionBtn = document.getElementById('bili-tts-pip-action-btn');
    const autoPipSwitch = document.getElementById('bili-tts-auto-pip-switch');

    const handlePipToggle = (e) => {
      e.stopPropagation();
      if (this.options.onPipToggle) {
        this.options.onPipToggle();
      }
    };

    if (pipBtn) {
      pipBtn.addEventListener('click', handlePipToggle);
      pipBtn.addEventListener('mousedown', (e) => e.stopPropagation());
      pipBtn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    }
    if (pipActionBtn) pipActionBtn.addEventListener('click', handlePipToggle);

    if (autoPipSwitch) {
      autoPipSwitch.addEventListener('change', (e) => {
        this.settings.autoPip = e.target.checked;
        updateBiliTTSSettings({ autoPip: e.target.checked });
        if (this.options.onAutoPipChange) {
          this.options.onAutoPipChange(e.target.checked);
        }
      });
    }

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

    // 恢复记忆的音色选择
    if (this.selectedVoiceName) {
      select.value = this.selectedVoiceName;
    }
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

  setBadge(text, state = 'default') {
    const badge = document.getElementById('bili-tts-badge');
    if (!badge) return;
    badge.textContent = text;
    badge.classList.remove('muted', 'active-bg');
    if (state === 'muted') {
      badge.classList.add('muted');
    } else if (state === 'active') {
      badge.classList.add('active-bg');
    }
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
