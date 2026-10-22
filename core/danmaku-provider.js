/**
 * BiliDanmakuTTS - 弹幕数据提供者 (Danmaku Provider)
 * 核心职责：自动识别当前视频的 BV 号与 CID，通过官方 XML 接口全量抓取弹幕，
 * 同时挂载 DOM MutationObserver 作为实时备用源。
 */

class DanmakuProvider {
  constructor() {
    this.currentBvid = null;
    this.currentCid = null;
    this.cachedList = [];
    this.domObserver = null;
    this.onNewDanmakuCallback = null;
  }

  /**
   * 从当前页面 URL 或 DOM 提取 BVID
   */
  extractBvid() {
    const match = window.location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    return match ? match[1] : null;
  }

  /**
   * 获取当前分 P 的索引（如 ?p=2）
   */
  extractPageIndex() {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    return p ? parseInt(p, 10) : 1;
  }

  /**
   * 自动探测并获取当前视频的 CID
   */
  async resolveCid() {
    // 方案 A: 尝试直接从全局变量读取
    if (window.cid && typeof window.cid === 'number') {
      return window.cid;
    }
    if (window.__INITIAL_STATE__?.videoData?.cid) {
      return window.__INITIAL_STATE__.videoData.cid;
    }

    // 方案 B: 通过 bvid 请求官方 pagelist 接口获取精确 cid
    const bvid = this.extractBvid();
    if (!bvid) return null;

    try {
      const pageIndex = this.extractPageIndex();
      const resp = await fetch(`https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`);
      const json = await resp.json();
      if (json && json.code === 0 && Array.isArray(json.data)) {
        const pageData = json.data.find(item => item.page === pageIndex) || json.data[0];
        if (pageData && pageData.cid) {
          return pageData.cid;
        }
      }
    } catch (err) {
      console.warn('[DanmakuProvider] 获取 pagelist 失败:', err);
    }

    return null;
  }

  /**
   * 抓取当前视频的全量 XML 弹幕并解析
   * @returns {Promise<Array<{ id: string, time: number, text: string }>>}
   */
  async fetchAllDanmakus() {
    const bvid = this.extractBvid();
    const cid = await this.resolveCid();

    if (!cid) {
      console.warn('[DanmakuProvider] 未能获取到当前视频的 CID，无法拉取弹幕');
      return [];
    }

    this.currentBvid = bvid;
    this.currentCid = cid;

    console.log(`[DanmakuProvider] 开始拉取弹幕: BVID=${bvid}, CID=${cid}`);

    try {
      const url = `https://comment.bilibili.com/${cid}.xml`;
      const resp = await fetch(url);
      const xmlText = await resp.text();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const dNodes = xmlDoc.getElementsByTagName('d');

      const danmakus = [];
      for (let i = 0; i < dNodes.length; i++) {
        const node = dNodes[i];
        const pAttr = node.getAttribute('p');
        const text = node.textContent;

        if (pAttr && text) {
          // p 属性格式: 播放时间(秒), 弹幕类型, 字号, 颜色, 发送时间戳, 弹幕池, 用户ID, 记录ID
          const parts = pAttr.split(',');
          const time = parseFloat(parts[0]);
          const id = parts[7] || `dm_${i}`;

          if (!isNaN(time) && text.trim().length > 0) {
            danmakus.push({
              id: id,
              time: time,
              text: text.trim()
            });
          }
        }
      }

      // 按时间升序排序
      danmakus.sort((a, b) => a.time - b.time);
      this.cachedList = danmakus;
      console.log(`[DanmakuProvider] 弹幕加载成功，共解析出 ${danmakus.length} 条弹幕`);
      return danmakus;
    } catch (err) {
      console.error('[DanmakuProvider] 拉取 XML 弹幕异常:', err);
      return [];
    }
  }

  /**
   * 启动实时 DOM 监听（针对动态弹幕流或 XML 兜底）
   */
  attachDomObserver(videoElement, onNewDanmaku) {
    this.detachDomObserver();
    this.onNewDanmakuCallback = onNewDanmaku;

    // 寻找 B 站播放器弹幕层容器
    const findContainer = () => {
      return document.querySelector('.bpx-player-row-dm-wrap') ||
             document.querySelector('.bpx-player-dm-wrap') ||
             document.querySelector('.bilibili-player-danmaku-item');
    };

    const container = findContainer();
    if (!container) return;

    this.domObserver = new MutationObserver((mutations) => {
      if (!videoElement) return;
      const currentTime = videoElement.currentTime;

      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const text = node.textContent?.trim();
            if (text && typeof this.onNewDanmakuCallback === 'function') {
              this.onNewDanmakuCallback({
                id: 'dom_' + Math.random().toString(36).substring(2),
                time: currentTime,
                text: text
              });
            }
          }
        }
      }
    });

    this.domObserver.observe(container, { childList: true, subtree: true });
  }

  detachDomObserver() {
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DanmakuProvider };
}
