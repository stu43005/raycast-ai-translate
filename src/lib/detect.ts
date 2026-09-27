export interface DetectOptions {
  /** Code used when the text is Chinese but has no traditional/simplified-specific characters. */
  ambiguousChinese?: "zh-Hant" | "zh-Hans";
}

/** Only the beginning of the text is inspected; it is enough for a heuristic and keeps detection cheap. */
const SAMPLE_LENGTH = 1000;

/**
 * Han characters count as much as a short Latin word, so "我用 iPhone 拍照" is still treated as Chinese.
 * Applied to Han, kana and Hangul when comparing script dominance.
 */
const CJK_WEIGHT = 3;

/** Minimum score a non-English Latin language needs before it beats the English default. */
const LATIN_MIN_SCORE = 2;

/**
 * Traditional/simplified pairs, written as "繁简". Characters that are also in everyday use in
 * traditional text (e.g. 后, 台, 准, 里, 面) are deliberately left out to avoid false simplified hits.
 */
const CHINESE_VARIANT_PAIRS =
  "這这 個个 們们 來来 時时 說说 會会 為为 國国 對对 學学 發发 經经 過过 動动 開开 關关 門门 問问 間间 見见 " +
  "話话 語语 讓让 還还 進进 長长 電电 車车 東东 區区 書书 錢钱 買买 賣卖 愛爱 氣气 業业 體体 點点 無无 與与 " +
  "應应 頭头 樣样 實实 現现 場场 樂乐 歡欢 認认 識识 覺觉 聽听 寫写 讀读 備备 處处 萬万 億亿 網网 絡络 軟软 " +
  "腦脑 機机 雙双 歲岁 飛飞 魚鱼 鳥鸟 馬马 龍龙 雲云 風风 陽阳 陰阴 華华 灣湾 請请 謝谢 從从 麼么 沒没 給给 " +
  "邊边 頁页 題题 線线 紅红 綠绿 藍蓝 黃黄 顏颜 員员 師师 醫医 藥药 報报 紙纸 張张 條条 號号 碼码 單单 雜杂 " +
  "圖图 館馆 飯饭 燈灯 熱热 寶宝 貝贝 價价 貴贵 質质 費费 資资 產产 銀银 鐵铁 鋼钢 錯错 鐘钟 鍵键 標标 選选 " +
  "擇择 權权 歷历 記记 憶忆 錄录 課课 試试 驗验 證证 據据 將将 軍军 隊队 戰战 爭争 勝胜 敗败 殺杀 傷伤 驚惊 " +
  "嚇吓 懷怀 憂忧 惡恶 壞坏 難难 簡简 複复 復复 歐欧 亞亚 韓韩 蘇苏 義义 陸陆 島岛 橋桥 樓楼 廳厅 廣广 園园 " +
  "衛卫 兒儿 孫孙 媽妈 爺爷 親亲 戀恋 婦妇 禮礼 節节 慶庆 視视 頻频 聲声 響响 顯显 設设 計计 運运 輸输 轉转 " +
  "換换 達达 遠远 離离 連连 續续 斷断 織织 組组 結结 構构 約约 紀纪 級级 維维 護护 養养 飲饮 飽饱 餓饿 鹽盐 " +
  "醬酱 燒烧 煙烟 災灾 險险 隨随 際际 態态 樹树 葉叶 藝艺 術术 劇剧 戲戏 導导 夢梦 詩诗 詞词 論论 議议 講讲 " +
  "評评 訴诉 談谈 調调 該该 誰谁 誤误 謎谜 譯译 讚赞 變变 積积 極极 務务 勞劳 麗丽 豐丰 盡尽 壓压 廠厂 歸归 " +
  "屬属 屆届 層层 戶户 擊击 擔担 擁拥 擴扩 攝摄 敵敌 數数 夠够 滿满 濕湿 測测 溫温 濟济 漢汉 漁渔 淚泪 潔洁 " +
  "灑洒 燦灿 爛烂 狀状 獨独 獲获 猶犹 環环 畢毕 盜盗 眾众 確确 礦矿 禍祸 穩稳 窮穷 競竞 筆笔 築筑 糧粮 糾纠 " +
  "紛纷 終终 統统 繼继 罰罚 羅罗 習习 聖圣 聯联 職职 腳脚 膚肤 臉脸 興兴 舉举 艦舰 莊庄 蘭兰 蟲虫 衝冲 補补 " +
  "裝装 襲袭 觀观 規规 覽览 訊讯 訪访 許许 詢询 誠诚 貓猫 貿贸 賽赛 趕赶 躍跃 輕轻 輪轮 辦办 農农 郵邮 鄉乡 " +
  "鎮镇 閱阅 陳陈 雞鸡 霧雾 靈灵 韻韵 順顺 須须 預预 領领 顧顾 類类 麥麦 黨党 齊齐 齒齿 龜龟 嗎吗 啟启 喚唤 " +
  "嚴严 團团 堅坚 壯壮 夾夹 奪夺 奮奋 妝妆 寧宁 審审 岡冈 峽峡 幣币 帶带 幫帮 廢废 彈弹 徑径 悅悦 惱恼 慣惯 " +
  "憑凭 懶懒 拋抛 揮挥 損损 搖摇 撥拨 撐撑 擬拟 擾扰 攜携 暫暂 曉晓 曬晒 楊杨 榮荣 槍枪 橫横 檔档 檢检 櫃柜 " +
  "殘残 殼壳 況况 淨净 淺浅 湯汤 滅灭 漲涨 潛潜 澤泽 濃浓 烏乌 煉炼 爐炉 牆墙 獎奖 瑪玛 療疗 癢痒 盞盏 監监 " +
  "睜睁 礙碍 祕秘 稱称 竊窃 緊紧 總总 績绩 繩绳 罷罢 翹翘 聞闻 聰聪 肅肃 脫脱 腫肿 膽胆 臟脏 舊旧 艱艰 蓋盖 " +
  "薦荐 蘋苹 虛虚 蝦虾 螢萤 蠟蜡 襯衬 誇夸 詳详 誕诞 諾诺 謀谋 謂谓 豬猪 負负 財财 貨货 販贩 貪贪 貧贫 貼贴 " +
  "賀贺 賓宾 賴赖 購购 贈赠 趙赵 跡迹 踐践 蹤踪 軌轨 較较 載载 輔辅 輩辈 辭辞 遲迟 遺遗 鄰邻 釋释 針针 釣钓 " +
  "鈔钞 鉛铅 銷销 鋪铺 錦锦 鍋锅 鏡镜 閃闪 閉闭 閒闲 闊阔 陣阵 階阶 隱隐 雖虽 靜静 頂顶 項项 頓顿 顆颗 願愿 " +
  "飄飘 餅饼 駕驾 騎骑 騙骗 驅驱 髒脏 鬧闹 鮮鲜 鳳凤 鴨鸭 鵝鹅 齡龄";

const TRADITIONAL_ONLY = new Set<string>();
const SIMPLIFIED_ONLY = new Set<string>();
for (const pair of CHINESE_VARIANT_PAIRS.split(" ")) {
  const [traditional, simplified] = Array.from(pair);
  TRADITIONAL_ONLY.add(traditional);
  SIMPLIFIED_ONLY.add(simplified);
}

type Script =
  "han" | "kana" | "hangul" | "latin" | "cyrillic" | "greek" | "arabic" | "hebrew" | "thai" | "devanagari" | "bengali";

const SCRIPT_RANGES: [Script, number, number][] = [
  ["han", 0x4e00, 0x9fff],
  ["han", 0x3400, 0x4dbf],
  ["han", 0xf900, 0xfaff],
  ["kana", 0x3040, 0x30ff],
  ["kana", 0x31f0, 0x31ff],
  ["kana", 0xff66, 0xff9f],
  ["hangul", 0xac00, 0xd7a3],
  ["hangul", 0x1100, 0x11ff],
  ["hangul", 0x3130, 0x318f],
  ["latin", 0x41, 0x5a],
  ["latin", 0x61, 0x7a],
  ["latin", 0xc0, 0xd6],
  ["latin", 0xd8, 0xf6],
  ["latin", 0xf8, 0x24f],
  ["latin", 0x1e00, 0x1eff],
  ["cyrillic", 0x400, 0x4ff],
  ["greek", 0x370, 0x3ff],
  ["greek", 0x1f00, 0x1fff],
  ["arabic", 0x600, 0x6ff],
  ["arabic", 0x750, 0x77f],
  ["arabic", 0xfb50, 0xfdff],
  ["arabic", 0xfe70, 0xfeff],
  ["hebrew", 0x590, 0x5ff],
  ["thai", 0xe00, 0xe7f],
  ["devanagari", 0x900, 0x97f],
  ["bengali", 0x980, 0x9ff],
];

const SCRIPT_LANGUAGE: Partial<Record<Script, string>> = {
  greek: "el",
  hebrew: "he",
  thai: "th",
  devanagari: "hi",
  bengali: "bn",
};

const UKRAINIAN_LETTERS = /[іїєґІЇЄҐ]/;
const PERSIAN_LETTERS = /[پچژگ]/;
/** Letters that only Vietnamese uses among Latin-script languages, plus the tone-marked vowels block. */
const VIETNAMESE_LETTERS = /[ăĂơƠưƯđĐẠ-ỹ]/;

interface LatinProfile {
  code: string;
  /** Distinctive characters with their weight. */
  chars: Record<string, number>;
  /** Common function words, each hit scores 1. */
  words: string[];
}

const LATIN_PROFILES: LatinProfile[] = [
  {
    code: "en",
    chars: {},
    words: ["the", "and", "is", "of", "to", "in", "that", "it", "you", "with", "for", "this", "are", "was"],
  },
  {
    code: "de",
    chars: { ä: 2, ö: 2, ü: 2, ß: 2 },
    words: ["der", "die", "das", "und", "ist", "nicht", "ich", "ein", "eine", "mit", "auf", "den", "sie", "zu"],
  },
  {
    code: "fr",
    chars: { è: 2, ë: 2, î: 2, ï: 2, û: 2, ù: 2, œ: 2, à: 1, â: 1, ç: 1, ê: 1, ô: 1 },
    words: ["le", "la", "les", "est", "et", "une", "des", "du", "je", "ne", "pas", "dans", "pour", "vous", "au"],
  },
  {
    code: "es",
    chars: { ñ: 3, "¿": 3, "¡": 3, á: 1, í: 1, ó: 1, ú: 1 },
    words: ["el", "los", "las", "es", "y", "una", "del", "por", "con", "muy", "está", "pero", "como"],
  },
  {
    code: "pt",
    chars: { ã: 3, õ: 3, ç: 1, á: 1, í: 1, ó: 1, ú: 1 },
    words: ["não", "uma", "os", "do", "da", "em", "um", "com", "para", "isso", "mas", "você"],
  },
  {
    code: "it",
    chars: {},
    words: ["il", "che", "è", "sono", "della", "gli", "molto", "questo", "anche", "perché", "per", "di"],
  },
];

function scriptOf(codePoint: number): Script | undefined {
  for (const [script, start, end] of SCRIPT_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return script;
    }
  }
  return undefined;
}

function countChineseVariants(text: string): { traditional: number; simplified: number } {
  let traditional = 0;
  let simplified = 0;
  for (const char of text) {
    if (TRADITIONAL_ONLY.has(char)) {
      traditional++;
    } else if (SIMPLIFIED_ONLY.has(char)) {
      simplified++;
    }
  }
  return { traditional, simplified };
}

/** True when the text has more traditional-only than simplified-only characters; false when there is no signal. */
export function isTraditionalChinese(text: string): boolean {
  const { traditional, simplified } = countChineseVariants(text);
  return traditional > simplified;
}

function detectChinese(text: string, options: DetectOptions): string {
  const { traditional, simplified } = countChineseVariants(text);
  if (traditional > simplified) {
    return "zh-Hant";
  }
  if (simplified > traditional) {
    return "zh-Hans";
  }
  return options.ambiguousChinese ?? "zh-Hant";
}

function detectLatin(text: string): string {
  if (VIETNAMESE_LETTERS.test(text)) {
    return "vi";
  }
  const lower = text.toLowerCase();
  const words = lower.split(/[^\p{L}]+/u).filter(Boolean);
  let best = "en";
  let bestScore = 0;
  for (const profile of LATIN_PROFILES) {
    let score = 0;
    for (const char of lower) {
      score += profile.chars[char] ?? 0;
    }
    for (const word of words) {
      if (profile.words.includes(word)) {
        score++;
      }
    }
    const threshold = profile.code === "en" ? 1 : LATIN_MIN_SCORE;
    if (score > bestScore && score >= threshold) {
      best = profile.code;
      bestScore = score;
    }
  }
  return best;
}

/** Offline heuristic language detection; always returns a code present in `LANGUAGES`. */
export function detectLanguage(text: string, options: DetectOptions = {}): string {
  const sample = text.slice(0, SAMPLE_LENGTH);
  const counts: Partial<Record<Script, number>> = {};
  for (const char of sample) {
    const script = scriptOf(char.codePointAt(0) ?? 0);
    if (script) {
      counts[script] = (counts[script] ?? 0) + 1;
    }
  }

  const han = counts.han ?? 0;
  const kana = counts.kana ?? 0;
  const cjk = han + kana;
  // Japanese mixes Han with kana, so both are scored together and split afterwards.
  const scores: [string, number][] = [
    ["cjk", cjk * CJK_WEIGHT],
    ["hangul", (counts.hangul ?? 0) * CJK_WEIGHT],
  ];
  for (const script of Object.keys(counts) as Script[]) {
    if (script !== "han" && script !== "kana" && script !== "hangul") {
      scores.push([script, counts[script] ?? 0]);
    }
  }

  let dominant: string | undefined;
  let dominantScore = 0;
  for (const [script, score] of scores) {
    if (score > dominantScore) {
      dominant = script;
      dominantScore = score;
    }
  }

  switch (dominant) {
    case undefined:
      return "en";
    case "cjk":
      // A stray の in Chinese text (e.g. shop names) should not flip it to Japanese.
      return kana >= 5 || kana * 10 >= cjk ? "ja" : detectChinese(sample, options);
    case "hangul":
      return "ko";
    case "cyrillic":
      return UKRAINIAN_LETTERS.test(sample) ? "uk" : "ru";
    case "arabic":
      return PERSIAN_LETTERS.test(sample) ? "fa" : "ar";
    case "latin":
      return detectLatin(sample);
    default:
      return SCRIPT_LANGUAGE[dominant as Script] ?? "en";
  }
}
