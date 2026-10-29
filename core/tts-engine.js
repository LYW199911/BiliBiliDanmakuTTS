/**
 * BiliDanmakuTTS - 语音合成引擎与视频侧链压限（Audio Ducking）
 * 核心职责：封装 Web Speech API，并在朗读时实现平滑的“原声衰减，读毕恢复”音频混音效果。
 */

class TTSEngine {
  constructor(options = {}) {
    this.options = Object.assign({
      duckingEnabled: true,
      duckingFactor: 0.35,       // 朗读时原视频音量衰减至基准的 35%
      duckingFadeInMs: 120,      // 衰减淡入时间
      duckingFadeOutMs: 220,     // 恢复淡出时间
      pitch: 1.0,
      baseRate: 1.15,
      voiceName: '',
      volume: null,              // 朗读音量 (0.0~1.0)，若为 null 或开启 autoFollowVideoVolume 则默认跟随原视频音量
      autoFollowVideoVolume: true // 是否默认跟随 B 站播放器音量
    }, options);

    this.isSpeaking = false;
    this.currentUtterance = null;
    this.videoElement = null;
    this.originalVideoVolume = 1.0;
    this.duckingTimer = null;
    this.availableVoices = [];
    this.onSpeechStart = null;
    this.onSpeechEnd = null;
    this.onVideoVolumeChange = null; // 当 B 站播放器音量变化时的回调通知
    this._onVideoVolChangeHandler = null;

    this.initVoices();
  }

  /**
   * 获取当前生效的朗读音量 (0.0 ~ 1.0)
   * 默认自动跟随视频播放器音量（如 B 站调至 20%，朗读即为 20%），除非用户手动设定独立音量
   */
  getEffectiveVolume() {
    if (this.options.autoFollowVideoVolume || this.options.volume === null || typeof this.options.volume === 'undefined') {
      if (this.videoElement) {
        // 使用非 ducking 状态下的原音量
        return Math.max(0.0, Math.min(1.0, this.originalVideoVolume));
      }
      return 0.5;
    }
    return Math.max(0.0, Math.min(1.0, this.options.volume));
  }

  initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const all = window.speechSynthesis.getVoices() || [];
        // 严格仅保留中文音色（简体、繁体、普通话、国语或包含常见中文音色名）
        const chineseVoices = all.filter(v => {
          const lang = (v.lang || '').toLowerCase();
          const name = (v.name || '').toLowerCase();
          return lang.includes('zh') || lang.includes('cmn') || lang.includes('cn') ||
                 name.includes('chinese') || name.includes('huihui') || name.includes('yaoyao') ||
                 name.includes('kangkang') || name.includes('xiaoxiao') || name.includes('yunxi') ||
                 (name.includes('natural') && (lang.includes('zh') || name.includes('chinese')));
        });
        this.availableVoices = chineseVoices;
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  setVideoElement(videoEl) {
    if (this.videoElement && this._onVideoVolChangeHandler) {
      this.videoElement.removeEventListener('volumechange', this._onVideoVolChangeHandler);
    }

    this.videoElement = videoEl;
    if (videoEl) {
      this.originalVideoVolume = videoEl.volume;

      // 实时监听 B 站原生播放器音量滑块变化
      this._onVideoVolChangeHandler = () => {
        // 排除朗读压音期间的虚假变化，只记录用户在 B 站播放器上真实调整的原音量
        if (!this.isSpeaking) {
          this.originalVideoVolume = videoEl.volume;
          if (typeof this.onVideoVolumeChange === 'function') {
            this.onVideoVolumeChange(this.originalVideoVolume);
          }
        }
      };
      videoEl.addEventListener('volumechange', this._onVideoVolChangeHandler);
    }
  }

  /**
   * 朗读一条处理好的语音项
   * @param {Object} speechItem { textToSpeak: string, rate?: number }
   * @returns {Promise<void>}
   */
  speak(speechItem) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('[TTSEngine] 浏览器不支持 speechSynthesis');
        resolve();
        return;
      }

      const text = speechItem.textToSpeak;
      if (!text) {
        resolve();
        return;
      }

      // 如果浏览器处于暂停状态，先唤醒恢复
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // 仅在已有发音且正在说话时才取消，避免 Chromium 连环 cancel 导致的静音 Bug
      if (this.isSpeaking && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance; // 强引用防止垃圾回收导致的中断 Bug

      // 强制设置语言为中文 zh-CN，防止非中文系统下默认使用英文/日语音色报错或静音
      utterance.lang = 'zh-CN';
      utterance.rate = speechItem.rate || this.options.baseRate;
      utterance.pitch = this.options.pitch;

      // 动态更新与优选音色
      if (this.availableVoices.length === 0) {
        this.initVoices();
      }

      // 优选中文音色，坚决不降级赋值非中文音色（如日文 Haruka），避免日文语音引擎遇到中文静音或报错
      let selectedVoice = null;
      if (this.options.voiceName) {
        selectedVoice = this.availableVoices.find(v => v.name === this.options.voiceName);
      }
      if (!selectedVoice && this.availableVoices.length > 0) {
        // 优先自然网络音色 (Xiaoxiao/Yunxi)，其次本地微软慧慧 (Huihui) 等
        selectedVoice = this.availableVoices.find(v => 
          v.name.includes('Xiaoxiao') || v.name.includes('Yunxi') || v.name.includes('Natural') || v.name.includes('自然')
        ) || this.availableVoices.find(v =>
          v.name.includes('Huihui') || v.name.includes('Yaoyao') || v.name.includes('Kangkang')
        ) || this.availableVoices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      // 注：若系统中暂时未枚举出中文 Voice 对象，绝不强行指定外语 Voice，
      // 保持 utterance.voice 为空配合 utterance.lang = 'zh-CN'，Edge/Chrome 会自动调用内置的中文云端合成！

      // 设置朗读音量（默认跟随原视频音量，也可由用户独立调节）
      const effectiveVol = this.getEffectiveVolume();
      utterance.volume = effectiveVol;

      console.log(`[TTSEngine] 触发发音: "${text}", 音量: ${(effectiveVol * 100).toFixed(0)}% (${this.options.autoFollowVideoVolume ? '跟随视频' : '独立调节'}), 音色: ${utterance.voice?.name || '系统智能匹配(zh-CN)'}, 语言: ${utterance.lang}`);

      // 定期唤醒 Chromium Web Speech API 防止后台标签页在朗读中途被浏览器假死挂起
      let keepAliveTimer = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAliveTimer);
        }
      }, 2500);

      // 朗读开始事件：触发原视频音频 Ducking 衰减
      utterance.onstart = () => {
        this.isSpeaking = true;
        this.applyDucking(true);
        if (typeof this.onSpeechStart === 'function') {
          this.onSpeechStart(text);
        }
      };

      // 朗读结束或错误事件：恢复原视频音量
      const cleanup = () => {
        clearInterval(keepAliveTimer);
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.applyDucking(false);
        if (typeof this.onSpeechEnd === 'function') {
          this.onSpeechEnd();
        }
        resolve();
      };

      utterance.onend = () => {
        cleanup();
      };

      utterance.onerror = (err) => {
        console.warn('[TTSEngine] 朗读发生异常:', err.error || err);
        cleanup();
      };

      // 浏览器防假死看门狗：如果 7 秒后仍未触发 onend，强制复位
      setTimeout(() => {
        if (this.currentUtterance === utterance && this.isSpeaking) {
          console.warn('[TTSEngine] 触发看门狗强制复位');
          cleanup();
        }
      }, 7000);

      window.speechSynthesis.speak(utterance);

      // Chromium 在某些后台状态下需要额外 resume
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    });
  }

  /**
   * 平滑淡入/淡出侧链压限
   * @param {boolean} duckIn true: 压低视频音量, false: 恢复原音量
   */
  applyDucking(duckIn) {
    if (!this.options.duckingEnabled || !this.videoElement) return;

    if (this.duckingTimer) {
      clearInterval(this.duckingTimer);
      this.duckingTimer = null;
    }

    const video = this.videoElement;
    if (!duckIn) {
      // 若原音量本身就是 0 (静音)，不需要恢复
      if (this.originalVideoVolume <= 0.05) return;
    } else {
      // 记录用户当前设置的原音量（排除被压音状态）
      if (!this.isSpeaking || video.volume > (this.originalVideoVolume * this.options.duckingFactor + 0.05)) {
        this.originalVideoVolume = video.volume;
      }
    }

    const startVol = video.volume;
    const targetVol = duckIn 
      ? Math.max(0.05, this.originalVideoVolume * this.options.duckingFactor)
      : this.originalVideoVolume;

    const duration = duckIn ? this.options.duckingFadeInMs : this.options.duckingFadeOutMs;
    const steps = 12;
    const stepInterval = duration / steps;
    const volDelta = (targetVol - startVol) / steps;
    let stepCount = 0;

    this.duckingTimer = setInterval(() => {
      stepCount++;
      const nextVol = startVol + volDelta * stepCount;
      video.volume = Math.min(1.0, Math.max(0, nextVol));

      if (stepCount >= steps) {
        clearInterval(this.duckingTimer);
        this.duckingTimer = null;
        video.volume = targetVol;
      }
    }, stepInterval);
  }

  stop() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.applyDucking(false);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TTSEngine };
}
