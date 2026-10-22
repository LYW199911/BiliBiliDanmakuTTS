/**
 * BiliDanmakuTTS - 弹幕清洗、聚合与自适应调度器
 * 核心职责：将一秒数十条的密集弹幕，降维压缩为适合人类听觉的高信息密度语音流。
 */

class DanmakuScheduler {
  constructor(options = {}) {
    this.options = Object.assign({
      dropThresholdSeconds: 2.2, // 弹幕过期丢弃阈值（秒）
      windowSpanSeconds: 1.2,    // 批处理合并时间窗（秒）
      minPriorityToSpeak: 15,    // 最低朗读权重阈值（过滤过水弹幕）
      baseSpeechRate: 1.1,       // 默认朗读基础语速
      highDensitySpeechRate: 1.35// 密集期自适应提速
    }, options);

    this.danmakuList = [];       // 已解析的全量弹幕队列（按时间升序）
    this.currentIndex = 0;       // 游标位置
    this.pendingQueue = [];      // 待朗读语音队列
    this.spokenCount = 0;        // 累计朗读数
    this.filteredCount = 0;      // 累计过滤数
    this.lastSpokenTime = -1;
  }

  /**
   * 重置或重新载入弹幕池（切换分P或新视频时调用）
   * @param {Array<{ id: string, time: number, text: string }>} list
   */
  publicLoad(list) {
    this.danmakuList = list.slice().sort((a, b) => a.time - b.time);
    this.currentIndex = 0;
    this.pendingQueue = [];
    this.spokenCount = 0;
    this.filteredCount = 0;
    this.lastSpokenTime = -1;
    console.log(`[DanmakuScheduler] 已加载 ${this.danmakuList.length} 条弹幕`);
  }

  /**
   * 视频播放进度跳转（Seek）时快速重置游标
   * @param {number} currentVideoTimeSeconds 
   */
  onSeek(currentVideoTimeSeconds) {
    this.pendingQueue = [];
    // 二分查找或快速定位到 currentVideoTimeSeconds 附近
    let low = 0;
    let high = this.danmakuList.length - 1;
    let targetIdx = this.danmakuList.length;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.danmakuList[mid].time >= currentVideoTimeSeconds - 0.2) {
        targetIdx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    this.currentIndex = targetIdx;
  }

  /**
   * 核心时钟脉冲：由播放器的 requestAnimationFrame 或定时器高频调用（如 100ms）
   * @param {number} currentTime 视频当前播放秒数
   * @param {boolean} isSpeaking 当前 TTS 是否正在发音
   * @returns {Object|null} 需立即朗读的语音任务，若无则返回 null
   */
  tick(currentTime, isSpeaking) {
    // 1. 过滤丢弃过期积压任务（超过当前播放时间 dropThresholdSeconds）
    this.pendingQueue = this.pendingQueue.filter(item => {
      const isExpired = (currentTime - item.targetTime) > this.options.dropThresholdSeconds;
      if (isExpired) {
        this.filteredCount++;
      }
      return !isExpired;
    });

    // 2. 将当前播放进度范围内的弹幕拉入批处理
    // 范围：[currentTime - 0.3, currentTime + windowSpanSeconds]
    const windowEnd = currentTime + this.options.windowSpanSeconds;
    const batch = [];

    while (this.currentIndex < this.danmakuList.length) {
      const d = this.danmakuList[this.currentIndex];
      if (d.time > windowEnd) {
        break; // 超出当前窗口，留在下周期
      }
      if (d.time >= currentTime - 0.3) {
        batch.push(d);
      } else {
        // 落后太多的历史弹幕，直接跳过并计入过滤
        this.filteredCount++;
      }
      this.currentIndex++;
    }

    // 3. 对批次内的弹幕做清洗、聚合折叠与优先级打分
    if (batch.length > 0) {
      const processedItems = this.processBatch(batch, currentTime);
      for (const item of processedItems) {
        // 达到最低优先级才入队
        if (item.priority >= this.options.minPriorityToSpeak) {
          this.pendingQueue.push(item);
        } else {
          this.filteredCount++;
        }
      }
      // 队列按优先级降序排序（高能优先）
      this.pendingQueue.sort((a, b) => b.priority - a.priority);
    }

    // 4. 若 TTS 空闲且队列中有任务，出队最高优先级项返回
    if (!isSpeaking && this.pendingQueue.length > 0) {
      // 如果队列积压大于 2 条，自适应加速朗读
      const nextItem = this.pendingQueue.shift();
      if (this.pendingQueue.length >= 2) {
        nextItem.rate = Math.min(this.options.highDensitySpeechRate, 1.8);
      }
      this.spokenCount++;
      this.lastSpokenTime = currentTime;
      return nextItem;
    }

    return null;
  }

  /**
   * 批次处理：去重、折叠、梗翻译、打分
   */
  processBatch(batch, currentTime) {
    const textGroupMap = new Map();

    for (const d of batch) {
      const { cleanText, isJunk, normalizedText } = normalizeDanmaku(d.text);
      if (isJunk || !cleanText) {
        this.filteredCount++;
        continue;
      }

      if (!textGroupMap.has(normalizedText)) {
        textGroupMap.set(normalizedText, {
          rawList: [d],
          cleanText: cleanText,
          count: 1
        });
      } else {
        const grp = textGroupMap.get(normalizedText);
        grp.rawList.push(d);
        grp.count++;
      }
    }

    const result = [];

    textGroupMap.forEach((grp, norm) => {
      let speechText = grp.cleanText;
      let priority = 10;

      // 聚合折叠与趣味化文案
      if (grp.count >= 6) {
        if (norm === '问号') {
          speechText = '全屏问号刷屏';
        } else if (norm === '哈哈') {
          speechText = '弹幕全都在哈哈';
        } else if (norm === '草') {
          speechText = '一片生草';
        } else {
          speechText = `大量弹幕都在发：${speechText}`;
        }
        priority += 40; // 极高频突发，说明是全视频高潮/笑点
      } else if (grp.count >= 2) {
        speechText = `${speechText}，乘${grp.count}`;
        priority += (grp.count * 8);
      }

      // 高能关键词加权
      if (speechText.includes('高能') || speechText.includes('泪目') || speechText.includes('双厨') || speechText.includes('神作')) {
        priority += 25;
      }

      // 长度惩罚/奖励：5~16字最适合听，太长很难听清
      if (speechText.length >= 4 && speechText.length <= 16) {
        priority += 8;
      } else if (speechText.length > 25) {
        priority -= 15;
      }

      result.push({
        id: grp.rawList[0].id || Math.random().toString(36).substring(2),
        textToSpeak: speechText,
        priority: priority,
        targetTime: grp.rawList[0].time,
        rate: this.options.baseSpeechRate
      });
    });

    return result;
  }

  getStats() {
    return {
      total: this.danmakuList.length,
      spoken: this.spokenCount,
      filtered: this.filteredCount,
      pending: this.pendingQueue.length
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DanmakuScheduler };
}
