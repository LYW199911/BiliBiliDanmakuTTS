/**
 * BiliDanmakuTTS - 梗词库与文本清洗模块
 * 负责将弹幕缩写、火星文、梗转化为适合 TTS 朗读的自然口语，并剔除纯符号等水弹幕。
 */

const SLANG_MAP = {
  // 常见拼音/字母缩写
  "AWSL": "啊我死了",
  "XSWL": "笑死我了",
  "YYDS": "永远的神",
  "U1S1": "有一说一",
  "DBQ": "对不起",
  "ZQSG": "真情实感",
  "KSWL": "嗑死我了",
  "BUSH": "不是",
  "BUSHI": "不是",
  "(BUSHI)": "不是",
  "（BUSHI）": "不是",
  "KDL": "嗑到了",
  "TQL": "太强了",
  "NB": "牛逼",
  "NBBB": "牛逼",
  "WOC": "卧槽",
  "WC": "卧槽",
  "DDDD": "懂得都懂",
  "BDJW": "不懂就问",
  "SRDS": "虽然但是",
  "NSDD": "你说得对",
  "SSMY": "盛世美颜",
  "GKD": "搞快点",
  "OP": "片头曲",
  "ED": "片尾曲",
  "BGM": "背景音乐",
  "CP": "配对",
  "FLAG": "立旗",
  "CG": "动画",
  
  // 数字梗与谐音
  "233": "哈哈",
  "2333": "哈哈哈哈",
  "23333": "哈哈哈哈",
  "233333": "全屏哈哈",
  "666": "溜溜溜",
  "6666": "太溜了",
  "66666": "太强了",
  "999": "溜翻了",
  "886": "拜拜啦",
  "555": "呜呜呜",
  "5555": "呜呜呜",
  
  // 经典社区梗
  "草": "好生草",
  "生草": "生草",
  "下饭": "这也太下饭了",
  "泪目": "泪目",
  "爷青回": "爷的青春回来了",
  "爷青结": "爷的青春结束了",
  "下次一定": "下次一定",
  "双厨狂喜": "双厨狂喜",
  "前方高能": "前方高能预警",
  "高能预警": "前方高能预警",
  "弹幕护体": "全员弹幕护体",
  "完结撒花": "完结撒花",
  "不愧是你": "不愧是你",
  "要素过多": "要素过多",
  "战术后仰": "战术后仰",
  "破防了": "破防了",
  "绝了": "绝了",
  "针不戳": "真不错",
  "泰裤辣": "太酷啦",
  "基操勿六": "基本操作请坐下"
};

// 低价值/垃圾弹幕正则（纯标点、无意义刷屏、打卡）
const JUNK_PATTERNS = [
  /^[?？!！.~。，、/\\~@#$%^&*()_+\-=\[\]{}|:;"'<>,`·\s]+$/, // 纯标点符号
  /^[0-9\s]+$/, // 纯数字
  /^[a-zA-Z\s]{1,2}$/, // 1~2个无意义孤立英文字母
  /^(第一|前排|来了|打卡|签到|盖楼|第一集|第一P|第一页|第\d+个?)$/i, // 打卡水弹幕
  /^(\(\s*⌒\s*▽\s*⌒\s*\)|\(ﾟДﾟ\)|\(°∀°)ﾉ|\(｡･ω･｡\)|_(:з」∠)_)+$/, // 颜文字
  /^(233+|666+|哈+|啊+|草+|卧槽+|牛逼+|牛批+|哈哈哈+)$/ // 超长单字复读
];

/**
 * 转换与清洗文本
 * @param {string} rawText 原始弹幕文本
 * @returns {{ cleanText: string, isJunk: boolean, normalizedText: string }}
 */
function normalizeDanmaku(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: '', isJunk: true, normalizedText: '' };
  }

  let text = rawText.trim();

  // 1. 判断是否属于直接废弃的水弹幕
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(text)) {
      // 特殊情况：如果是纯“？？？”或者纯“233”，保留归一化用于后续聚合统计，但不作为独立单条长句朗读
      if (/^[?？]+$/.test(text)) {
        return { cleanText: '问号', isJunk: false, normalizedText: '问号' };
      }
      if (/^233+$/.test(text)) {
        return { cleanText: '哈哈', isJunk: false, normalizedText: '哈哈' };
      }
      if (/^(草|好草)+$/.test(text)) {
        return { cleanText: '草', isJunk: false, normalizedText: '草' };
      }
      return { cleanText: '', isJunk: true, normalizedText: '' };
    }
  }

  // 2. 查表替换梗词
  const upper = text.toUpperCase();
  if (SLANG_MAP[upper]) {
    text = SLANG_MAP[upper];
  } else {
    // 检查局部单词替换
    for (const [slang, replacement] of Object.entries(SLANG_MAP)) {
      if (text.toUpperCase().includes(slang) && text.length <= slang.length + 4) {
        text = text.replace(new RegExp(slang, 'gi'), replacement);
      }
    }
  }

  // 3. 压缩过多的连续感叹号/问号/重叠字（如“哈哈哈哈哈哈哈哈” -> “哈哈哈哈”）
  text = text.replace(/([哈啊草溜牛])/g, (match, p1, offset, string) => {
    // 若连续出现超过4次，压缩为2次
    return match;
  });
  text = text.replace(/(.)\1{4,}/g, '$1$1'); // 任何字符连续超过4次，压缩为2次
  text = text.replace(/[?？]{2,}/g, '？');
  text = text.replace(/[!！]{2,}/g, '！');

  return {
    cleanText: text,
    isJunk: text.length === 0,
    normalizedText: text.toLowerCase()
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SLANG_MAP, JUNK_PATTERNS, normalizeDanmaku };
}
