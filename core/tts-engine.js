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
      voiceName: ''
    }, options);

    this.isSpeaking = false;
    this.currentUtterance = null;
    this.videoElement = null;
    this.originalVideoVolume = 1.0;
    this.duckingTimer = null;
    this.availableVoices = [];
    this.onSpeechStart = null;
    this.onSpeechEnd = null;

    this.initVoices();
  }

  initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        this.availableVoices = window.speechSynthesis.getVoices().filter(v => 
          v.lang.includes('zh') || v.lang.includes('cmn') || v.lang.includes('CN')
        );
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  setVideoElement(videoEl) {
    this.videoElement = videoEl;
    if (videoEl) {
      this.originalVideoVolume = videoEl.volume;
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

      // 如果当前已有发音，先取消以避免浏览器队列死锁
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance; // 强引用防止垃圾回收导致的提前中断 Bug

      // 语速设置
      utterance.rate = speechItem.rate || this.options.baseRate;
      utterance.pitch = this.options.pitch;

      // 选择音色
      if (this.options.voiceName) {
        const found = this.availableVoices.find(v => v.name === this.options.voiceName);
        if (found) utterance.voice = found;
      } else if (this.availableVoices.length > 0) {
        // 智能优选音质好的合成音色 (如 Xiaoxiao, Yunxi, Google)
        const preferred = this.availableVoices.find(v => 
          v.name.includes('Xiaoxiao') || v.name.includes('Yunxi') || v.name.includes('自然') || v.name.includes('Natural')
        );
        utterance.voice = preferred || this.availableVoices[0];
      }

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
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.applyDucking(false);
        if (typeof this.onSpeechEnd === 'function') {
          this.onSpeechEnd();
        }
        resolve();
      };

      utterance.onend = cleanup;
      utterance.onerror = (err) => {
        console.warn('[TTSEngine] 朗读发生异常:', err);
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
