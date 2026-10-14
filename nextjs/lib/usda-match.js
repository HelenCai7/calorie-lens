// 从 USDA 搜索结果里挑出最匹配的条目。纯函数，不依赖网络，方便单独测试。
//
// USDA 的条目描述是“核心食物在前，修饰词在后”的格式，例如 "Broccoli, cooked, boiled"。
// 规则：
// 1. 候选必须包含核心食物词（foodCore），否则直接淘汰。宁可不校准，也不能把西兰花校准成牡蛎。
// 2. 核心词越靠前越好：描述以核心词开头最好，其次在第一段，再次在第二段（如 "Cheese, mozzarella"）。
// 3. 描述里和搜索词无关的修饰词轻微扣分，偏向通用条目。
// 4. 生熟状态冲突（要熟的却是生的/粉/干货）、菜品组合（"with sauce"、"and basil"）扣分。
// 5. 素食替代品、品牌、餐厅、婴儿食品、果汁、沙拉等条目大幅扣分。

const stopWords = new Set(["and", "or", "with", "the", "of", "a", "an", "in", "as", "to", "from", "ns", "nfs", "for"]);

// 出现这些词（且搜索词里没有）说明不是普通的这种食物。
const offTargetWords = [
  "meatless",
  "imitation",
  "substitute",
  "vegetarian",
  "baby",
  "babyfood",
  "infant",
  "toddler",
  "restaurant",
  "fast",
  "dehydrated",
  "powder",
  "flour",
  "flavored",
  "juice",
  "salad",
  "soup",
  "sandwich",
  "sauce",
  "lomi",
  // 加工肉制品
  "roll",
  "deli",
  "luncheon",
  "loaf",
  "nugget",
  "patty"
];

const cookedWords = new Set([
  "cooked",
  "boiled",
  "baked",
  "fried",
  "grilled",
  "roasted",
  "steamed",
  "broiled",
  "sauteed",
  "braised",
  "stewed",
  "mashed"
]);
const rawWords = new Set(["raw", "uncooked", "dry", "dried", "flour"]);

// 低脂、减量版本的热量密度和普通版本差很多，用户没说时默认选普通版本。
const reducedWords = new Set(["nonfat", "lowfat", "low", "light", "lite", "reduced", "skim", "diet", "fat-free"]);

// 这些说明是“未细分 / 不加油”的通用条目，适合作为默认值。
const genericPhrases = ["nfs", "ns as to", "no added fat", "plain"];

const energyPriorities = new Map([
  ["2048", 0],
  ["2047", 1],
  ["1008", 2]
]);

const typeBonus = {
  Foundation: 6,
  "SR Legacy": 5,
  "Survey (FNDDS)": 5
};

// 简单的单复数归一：carrots → carrot，tomatoes → tomato，berries → berry。
export function normalizeWord(word) {
  const lower = word.toLowerCase();
  if (lower.length > 4 && lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.length > 4 && lower.endsWith("oes")) return lower.slice(0, -2);
  if (lower.length > 3 && lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

export function tokenize(text) {
  return (String(text || "").toLowerCase().match(/[a-z]+/g) || [])
    .filter((word) => !stopWords.has(word))
    .map(normalizeWord);
}

export function foodEnergyKcal(food) {
  const matches = (food.foodNutrients || [])
    .map((item) => {
      const nutrientId = String(item.nutrientId ?? item.nutrient?.id ?? "");
      const unit = String(item.unitName ?? item.nutrient?.unitName ?? "").toUpperCase();
      const value = Number(item.value ?? item.amount);
      return { unit, value, priority: energyPriorities.get(nutrientId) };
    })
    .filter((item) => item.priority !== undefined && item.unit === "KCAL" && Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => a.priority - b.priority);

  return matches.length ? Math.round(matches[0].value) : null;
}

// 品牌条目常见的写法：全大写的单词（DENNY'S、MORI-NU）或 “USA”。
function looksBranded(description) {
  return /\b[A-Z][A-Z'\-]{2,}\b/.test(description) || /\bUSA\b/.test(description);
}

export function scoreCandidate(food, { query, core }, index) {
  const description = String(food.description || "");
  const descriptionTokens = tokenize(description);
  const descriptionSet = new Set(descriptionTokens);
  const coreTokens = tokenize(core);

  if (!coreTokens.length || !coreTokens.every((token) => descriptionSet.has(token))) return null;

  const segments = description.split(",");
  const firstSegmentTokens = new Set(tokenize(segments[0]));
  const secondSegmentTokens = new Set(tokenize(segments[1] || ""));
  const queryTokens = new Set(tokenize(query));
  const lowerDescription = description.toLowerCase();

  let score = 0;
  const startsWithCore = coreTokens.every((token, position) => descriptionTokens[position] === token);
  if (startsWithCore) score += 25;
  else if (coreTokens.every((token) => firstSegmentTokens.has(token))) score += 15;
  else if (coreTokens.every((token) => secondSegmentTokens.has(token))) score += 10;

  const matchedQueryTokens = [...queryTokens].filter((token) => descriptionSet.has(token)).length;
  score += matchedQueryTokens * 8;

  const extraTokens = descriptionTokens.filter((token) => !queryTokens.has(token) && !coreTokens.includes(token));
  score -= Math.min(extraTokens.length, 10) * 1.5;

  // 生熟状态冲突：要熟的却给了生的、干货或粉，反之亦然。热量密度会差好几倍。
  const wantsCooked = [...queryTokens].some((token) => cookedWords.has(token));
  const wantsRaw = [...queryTokens].some((token) => rawWords.has(token));
  if (wantsCooked && descriptionTokens.some((token) => rawWords.has(token))) score -= 20;
  if (wantsRaw && descriptionTokens.some((token) => cookedWords.has(token))) score -= 20;

  // 组合菜品（"with sauce"、"tomato, and basil"）。"with/without salt" 只是调味，不算。
  const withoutSalt = lowerDescription.replace(/\bwith(out)? (added )?salt\b/g, "");
  if (/\bwith\b/.test(withoutSalt) && !/\bwith\b/.test(query.toLowerCase())) score -= 8;
  if (/\band\b/.test(withoutSalt) && !/\band\b/.test(query.toLowerCase())) score -= 8;

  if (descriptionTokens.some((token) => reducedWords.has(token) && !queryTokens.has(token))) score -= 12;

  if (genericPhrases.some((phrase) => lowerDescription.includes(phrase))) score += 4;
  if (offTargetWords.some((word) => descriptionSet.has(word) && !queryTokens.has(word))) score -= 25;
  if (looksBranded(description)) score -= 15;

  score += typeBonus[food.dataType] || -10;
  score -= index * 0.3;
  return score;
}

export function pickBestUsdaMatch(foods, { query, core }) {
  let best = null;
  (foods || []).forEach((food, index) => {
    const kcalPer100g = foodEnergyKcal(food);
    if (!kcalPer100g) return;
    const score = scoreCandidate(food, { query, core }, index);
    if (score === null) return;
    if (!best || score > best.score) best = { food, kcalPer100g, score };
  });

  if (!best) return null;
  return {
    kcalPer100g: best.kcalPer100g,
    fdcId: best.food.fdcId,
    matchedFood: String(best.food.description || "").slice(0, 120),
    dataType: String(best.food.dataType || "")
  };
}
