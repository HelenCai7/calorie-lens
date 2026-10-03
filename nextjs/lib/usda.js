import { usdaApiKey, usdaCacheTtlDays, usdaConfigured } from "./config";
import { getJson, setJson } from "./store";

const usdaApiBase = "https://api.nal.usda.gov/fdc/v1";
const usdaCacheTtlMs = usdaCacheTtlDays * 24 * 60 * 60 * 1000;
const usdaInflight = new Map();

function foodEnergyKcal(food) {
  const priorities = new Map([
    ["2048", 0],
    ["2047", 1],
    ["1008", 2]
  ]);

  const matches = (food.foodNutrients || [])
    .map((item) => {
      const nutrientId = String(item.nutrientId ?? item.nutrient?.id ?? "");
      const unit = String(item.unitName ?? item.nutrient?.unitName ?? "").toUpperCase();
      const value = Number(item.value ?? item.amount);
      return { nutrientId, unit, value, priority: priorities.get(nutrientId) };
    })
    .filter(
      (item) =>
        item.priority !== undefined &&
        item.unit === "KCAL" &&
        Number.isFinite(item.value) &&
        item.value > 0
    )
    .sort((a, b) => a.priority - b.priority);

  return matches.length ? Math.round(matches[0].value) : null;
}

function usdaCandidateScore(food, query, index) {
  const description = String(food.description || "").toLowerCase();
  const queryWords = String(query || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
  const matchedWords = queryWords.filter((word) => description.includes(word)).length;
  const typeBonus = {
    Foundation: 10,
    "SR Legacy": 8,
    "Survey (FNDDS)": 6,
    Branded: -8
  }[food.dataType] || 0;

  return matchedWords * 12 + typeBonus - index;
}

async function searchUsda(query) {
  const response = await fetch(`${usdaApiBase}/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      pageSize: 12,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"]
    }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `USDA HTTP ${response.status}`);
  }

  const candidates = (payload.foods || [])
    .map((food, index) => ({
      food,
      kcalPer100g: foodEnergyKcal(food),
      score: usdaCandidateScore(food, query, index)
    }))
    .filter((candidate) => candidate.kcalPer100g)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;
  const best = candidates[0];
  return {
    kcalPer100g: best.kcalPer100g,
    fdcId: best.food.fdcId,
    matchedFood: String(best.food.description || "").slice(0, 120),
    dataType: String(best.food.dataType || "")
  };
}

async function lookupUsdaFood(query) {
  if (!usdaConfigured) return null;

  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return null;

  const cached = await getJson("usda", normalizedQuery);
  if (cached && Date.now() - Number(cached.cachedAt) < usdaCacheTtlMs) {
    return cached.value;
  }
  if (usdaInflight.has(normalizedQuery)) return usdaInflight.get(normalizedQuery);

  const lookup = searchUsda(normalizedQuery);
  usdaInflight.set(normalizedQuery, lookup);
  try {
    const value = await lookup;
    await setJson("usda", normalizedQuery, { cachedAt: Date.now(), value });
    return value;
  } catch (error) {
    // 过期刷新失败时继续使用旧缓存。
    if (cached) return cached.value;
    throw error;
  } finally {
    usdaInflight.delete(normalizedQuery);
  }
}

export async function enrichFoodsWithUsda(foods) {
  return Promise.all(
    foods.map(async (food) => {
      try {
        const match = await lookupUsdaFood(food.usdaQuery || food.name);
        if (!match) {
          return { ...food, nutritionSource: "gemini", matchedFood: "", fdcId: null };
        }

        return {
          ...food,
          kcalPer100g: match.kcalPer100g,
          nutritionSource: "usda",
          nutritionDataType: match.dataType,
          matchedFood: match.matchedFood,
          fdcId: match.fdcId
        };
      } catch (error) {
        console.warn(`USDA lookup failed for ${food.usdaQuery || food.name}: ${error.message}`);
        return { ...food, nutritionSource: "gemini", matchedFood: "", fdcId: null };
      }
    })
  );
}
