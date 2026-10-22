/**
 * BiliDanmakuTTS - Content Script 核心编排入口
 * 职责：连接播放器、数据提供者、调度器、TTS 混音引擎与悬浮 UI。
 */

(function () {
  console.log('[BiliDanmakuTTS] 插件已加载，准备初始化...');

  let scheduler = null;
  let ttsEngine = null;
  let provider = null;
  let panel = null;
  let videoEl = null;
  let tickTimer = null;
  let isEnabled = true;
  let currentUrl = window.location.href;

  function init() {
    // 1. 实例化核心组件
    scheduler = new DanmakuScheduler({
      baseSpeechRate: 1.15,
      minPriorityToSpeak: 15
    });

    ttsEngine = new TTSEngine({
      duckingEnabled: true,
      duckingFactor: 0.35,
      baseRate: 1.15
    });

    provider = new DanmakuProvider();

    // 2. 实例化 UI 面板
    panel = new FloatingPanel({
      onToggle: (enabled) => {
        isEnabled = enabled;
        if (!enabled) {
          ttsEngine.stop();
          panel.hideToast();
        }
      },
      onDuckingChange: (enabled, factor) => {
        ttsEngine.options.duckingEnabled = enabled;
        ttsEngine.options.duckingFactor = factor;
      },
      onRateChange: (rate) => {
        ttsEngine.options.baseRate = rate;
        scheduler.options.baseSpeechRate = rate;
      },
      onVoiceChange: (voiceName) => {
        ttsEngine.options.voiceName = voiceName;
      },
      onFilterModeChange: (mode) => {
        if (mode === 'highlight') {
          scheduler.options.minPriorityToSpeak = 25; // 仅高能
        } else if (mode === 'all') {
          scheduler.options.minPriorityToSpeak = 0;  // 全量
        } else {
          scheduler.options.minPriorityToSpeak = 15; // 智能
        }
      },
      onTestClick: () => {
        ttsEngine.speak({
          textToSpeak: '前方高能！检测到全屏弹幕刷屏，已开启音频压限！',
          rate: ttsEngine.options.baseRate
        });
      }
    });

    // 填充声音列表到 UI
    setTimeout(() => {
      panel.populateVoices(ttsEngine.availableVoices);
    }, 1000);

    // 3. 绑定发音事件与浮层 Toast
    ttsEngine.onSpeechStart = (spokenText) => {
      panel.showToast(`正在朗读: ${spokenText}`);
    };
    ttsEngine.onSpeechEnd = () => {
      panel.hideToast();
    };

    // 4. 定位并监听 <video> 元素
    locateVideoAndStart();

    // 5. 监听 URL / 视频切换（B 站单页面应用切换视频 P）
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('[BiliDanmakuTTS] 检测到页面跳转，重新载入弹幕...');
        locateVideoAndStart();
      }
    }, 1500);

    // 6. 全局快捷键 Alt + D 快速开关
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        const toggleEl = document.getElementById('bili-tts-enable-switch');
        if (toggleEl) {
          toggleEl.click();
        }
      }
    });
  }

  function locateVideoAndStart() {
    let attempts = 0;
    const maxAttempts = 30;

    const interval = setInterval(async () => {
      attempts++;
      const video = document.querySelector('video');

      if (video && video.readyState >= 1) {
        clearInterval(interval);
        videoEl = video;
        ttsEngine.setVideoElement(video);
        console.log('[BiliDanmakuTTS] 成功绑定播放器视频节点');

        // 监听视频跳转 Seek
        video.addEventListener('seeked', () => {
          scheduler.onSeek(video.currentTime);
        });

        // 加载全量弹幕
        const danmakus = await provider.fetchAllDanmakus();
        scheduler.publicLoad(danmakus);
        panel.updateStats(scheduler.getStats());

        // 挂载 DOM 实时监听备用
        provider.attachDomObserver(video, (newDm) => {
          scheduler.publicLoad([...scheduler.danmakuList, newDm]);
        });

        // 启动时钟脉冲 Tick
        startTickLoop();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('[BiliDanmakuTTS] 未能及时找到播放器视频节点');
      }
    }, 500);
  }

  function startTickLoop() {
    if (tickTimer) clearInterval(tickTimer);

    // 每 120ms 驱动一次时钟脉冲
    tickTimer = setInterval(() => {
      if (!isEnabled || !videoEl || videoEl.paused) {
        return;
      }

      const currentTime = videoEl.currentTime;
      const speechItem = scheduler.tick(currentTime, ttsEngine.isSpeaking);

      if (speechItem) {
        ttsEngine.speak(speechItem);
      }

      // 每秒定时刷新统计面板
      if (Math.random() < 0.25) {
        panel.updateStats(scheduler.getStats());
      }
    }, 120);
  }

  // 页面就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
