/**
 * BiliDanmakuTTS - Content Script 核心编排入口
 * 职责：连接播放器、数据提供者、调度器、TTS 混音引擎与悬浮 UI。
 */

(function () {
  console.log('[BiliDanmakuTTS] 插件已加载，准备初始化...');

  const settings = (typeof window !== 'undefined' && window.BiliTTSSettings)
    ? window.BiliTTSSettings.get()
    : {
        enabled: true,
        onlyWhenHidden: false,
        autoPip: true,
        speechRate: 1.15,
        pauseBehavior: 'finish',
        duckingEnabled: true,
        duckingFactor: 0.35,
        filterMode: 'smart',
        voiceName: '',
        volumeAutoFollow: true,
        customVolume: 1.0
      };

  let scheduler = null;
  let ttsEngine = null;
  let provider = null;
  let panel = null;
  let videoEl = null;
  let tickTimer = null;
  let isEnabled = settings.enabled;
  let onlyWhenHidden = settings.onlyWhenHidden;
  let pauseBehavior = settings.pauseBehavior;
  let autoPipEnabled = settings.autoPip;
  let currentUrl = window.location.href;

  function updateBadgeState() {
    if (!panel) return;
    if (!isEnabled) {
      panel.setBadge('已暂停', 'muted');
    } else if (onlyWhenHidden) {
      if (document.hidden) {
        panel.setBadge('后台朗读中', 'active');
      } else {
        panel.setBadge('前台静音(切Tab读)', 'muted');
      }
    } else {
      panel.setBadge('全时朗读', 'active');
    }
  }

  async function togglePiP() {
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoEl.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('[BiliDanmakuTTS] 切换画中画失败:', err);
    }
  }

  function applyAutoPip() {
    if (!videoEl) return;
    if ('autoPictureInPicture' in videoEl) {
      videoEl.autoPictureInPicture = autoPipEnabled;
    }
    if (autoPipEnabled) {
      videoEl.setAttribute('autopictureinpicture', '');
    } else {
      videoEl.removeAttribute('autopictureinpicture');
    }
  }

  function init() {
    // 1. 根据记忆偏好实例化调度器与 TTS 引擎
    let minPri = 15;
    if (settings.filterMode === 'highlight') minPri = 25;
    else if (settings.filterMode === 'all') minPri = 0;

    scheduler = new DanmakuScheduler({
      baseSpeechRate: settings.speechRate,
      minPriorityToSpeak: minPri
    });

    ttsEngine = new TTSEngine({
      duckingEnabled: settings.duckingEnabled,
      duckingFactor: settings.duckingFactor,
      baseRate: settings.speechRate,
      voiceName: settings.voiceName,
      autoFollowVideoVolume: settings.volumeAutoFollow,
      volume: settings.volumeAutoFollow ? null : settings.customVolume
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
        updateBadgeState();
      },
      onOnlyHiddenChange: (hiddenOnly) => {
        onlyWhenHidden = hiddenOnly;
        if (onlyWhenHidden && !document.hidden) {
          ttsEngine.stop();
          panel.hideToast();
        }
        updateBadgeState();
      },
      onPipToggle: () => {
        togglePiP();
      },
      onAutoPipChange: (enabled) => {
        autoPipEnabled = enabled;
        applyAutoPip();
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
      onVolumeChange: (vol, autoFollow) => {
        ttsEngine.options.autoFollowVideoVolume = autoFollow;
        ttsEngine.options.volume = vol;
      },
      onAutoFollowVolumeChange: (autoFollow) => {
        ttsEngine.options.autoFollowVideoVolume = true;
        ttsEngine.options.volume = null;
        if (videoEl) {
          panel.updateVideoVolume(videoEl.volume);
        }
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
      onPauseBehaviorChange: (behavior) => {
        pauseBehavior = behavior;
      },
      onTestClick: () => {
        ttsEngine.speak({
          textToSpeak: '试听成功！当前所有选项均已自动保存记忆，换视频或刷新均会保持。',
          rate: ttsEngine.options.baseRate
        });
      }
    });

    // 绑定播放器原音量变化自动通知面板
    ttsEngine.onVideoVolumeChange = (volRatio) => {
      panel.updateVideoVolume(volRatio);
    };

    // 填充声音列表到 UI
    setTimeout(() => {
      panel.populateVoices(ttsEngine.availableVoices);
      updateBadgeState();
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

    // 5. 监听浏览器标签页切换 (Page Visibility API)
    document.addEventListener('visibilitychange', async () => {
      if (document.hidden) {
        // 切到其他 Tab：如果开启了切Tab自动小窗
        if (autoPipEnabled && videoEl && !videoEl.paused && !document.pictureInPictureElement) {
          try {
            await videoEl.requestPictureInPicture();
          } catch (e) {
            console.log('[BiliDanmakuTTS] 浏览器自动画中画已尝试');
          }
        }
      } else {
        // 切回当前视频页：静音
        if (onlyWhenHidden) {
          ttsEngine.stop();
          panel.hideToast();
        }
      }
      updateBadgeState();
    });

    // 6. 监听 URL / 视频切换（B 站单页面应用切换视频 P）
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        console.log('[BiliDanmakuTTS] 检测到页面跳转，重新载入弹幕...');
        locateVideoAndStart();
      }
    }, 1500);

    // 7. 全局快捷键 Alt + D 快速开关
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
        applyAutoPip();
        console.log('[BiliDanmakuTTS] 成功绑定播放器视频节点并配置自动小窗');

        // 初始化音量设置（若用户曾手动固定音量则恢复，否则默认跟随播放器原音量）
        const curSettings = (typeof window !== 'undefined' && window.BiliTTSSettings)
          ? window.BiliTTSSettings.get()
          : settings;

        if (!curSettings.volumeAutoFollow && typeof curSettings.customVolume === 'number') {
          ttsEngine.options.autoFollowVideoVolume = false;
          ttsEngine.options.volume = curSettings.customVolume;
          const pct = Math.round(curSettings.customVolume * 100);
          panel.autoFollowVolume = false;
          panel.customVolume = curSettings.customVolume;
          const slider = document.getElementById('bili-tts-vol-slider');
          const val = document.getElementById('bili-tts-vol-val');
          const status = document.getElementById('bili-tts-vol-status');
          const resetBtn = document.getElementById('bili-tts-vol-reset-btn');
          if (slider) slider.value = pct;
          if (val) val.textContent = `${pct}% (自定义)`;
          if (status) status.textContent = `独立设定音量: ${pct}%`;
          if (resetBtn) resetBtn.style.display = 'inline-block';
        } else {
          ttsEngine.options.autoFollowVideoVolume = true;
          panel.autoFollowVolume = true;
          panel.updateVideoVolume(video.volume);
        }

        // 监听视频暂停事件：清空待读队列，杜绝暂停期间连续读下去
        video.addEventListener('pause', () => {
          scheduler.clearQueue();
          if (pauseBehavior === 'stop') {
            ttsEngine.stop();
            panel.hideToast();
          }
        });

        // 监听视频恢复播放事件：对齐最新秒数，零陈旧积攒
        video.addEventListener('play', () => {
          scheduler.onSeek(video.currentTime);
        });

        // 监听视频进度拖动 Seeking / Seeked
        video.addEventListener('seeking', () => {
          scheduler.clearQueue();
          ttsEngine.stop();
          panel.hideToast();
        });

        video.addEventListener('seeked', () => {
          scheduler.onSeek(video.currentTime);
        });

        // 加载全量弹幕
        const danmakus = await provider.fetchAllDanmakus();
        scheduler.publicLoad(danmakus);
        panel.updateStats(scheduler.getStats());

        // 挂载 DOM 实时监听备用（追加模式，不破坏已有队列与游标）
        provider.attachDomObserver(video, (newDm) => {
          scheduler.addRealtimeDanmaku(newDm);
        });

        // 用户交互唤醒浏览器 Web Speech API 权限
        const unlockAudio = () => {
          if (window.speechSynthesis) {
            window.speechSynthesis.resume();
            try {
              const u = new SpeechSynthesisUtterance('');
              u.volume = 0;
              window.speechSynthesis.speak(u);
            } catch (e) {}
          }
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);

        // 启动时钟脉冲 Tick
        startTickLoop();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('[BiliDanmakuTTS] 未能及时找到播放器视频节点');
      }
    }, 500);
  }

  function handleTick() {
    if (!isEnabled || !videoEl || videoEl.paused) {
      return;
    }

    // 核心判定：若开启了“仅切Tab/后台时朗读”，且当前视频页面在前台被用户观看，则静音不读
    if (onlyWhenHidden && !document.hidden) {
      return;
    }

    const currentTime = videoEl.currentTime;
    const speechItem = scheduler.tick(currentTime, ttsEngine.isSpeaking);

    if (speechItem) {
      console.log(`[BiliDanmakuTTS] 播报弹幕 (${currentTime.toFixed(1)}s):`, speechItem.textToSpeak);
      ttsEngine.speak(speechItem);
    }

    // 定时刷新统计面板
    if (Math.random() < 0.2) {
      panel.updateStats(scheduler.getStats());
    }
  }

  function startTickLoop() {
    if (tickTimer) clearInterval(tickTimer);

    // 1. 高频定时器
    tickTimer = setInterval(handleTick, 120);

    // 2. 视频原生 timeupdate 事件驱动（确保在切换到后台其他 Tab 时不受浏览器定时器限频影响）
    videoEl.removeEventListener('timeupdate', handleTick);
    videoEl.addEventListener('timeupdate', handleTick);

    updateBadgeState();
  }

  // 页面就绪后启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
