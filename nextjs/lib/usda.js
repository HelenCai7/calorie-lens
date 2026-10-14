import { usdaApiKey, usdaCacheTtlDays, usdaConfigured } from "./config";
import { getJson, setJson } from "./store";
import { pickBestUsdaMatch } from "./usda-match";

const usdaApiBase = "https://api.nal.usda.gov/fdc/v1";
const usdaCacheTtlMs = usdaCacheTtlDays * 24 * 60 * 60 * 1000;
// v2：匹配规则改为“必须包含核心食物词”，旧缓存里有按旧规则选错的结果，不再使用。
const cacheNamespace = "usda-v2";
const usdaInflight = new Map();

async function searchUsda(query) {
  const response = await fetch(`${usdaApiBase}/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      pageSize: 25,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"]
    }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || payload.message || `USDA HTTP ${response.status}`);
  }
  return payload.foods || [];
}

// 先用 USDA 格式的搜索词（如 "broccoli, cooked"）；没有包含核心词的候选时，再只用核心词搜一次。
// 两次都找不到就返回 null，调用方保留模型估算值。
async function findMatch(query, core) {
  const match = pickBestUsdaMatch(await searchUsda(query), { query, core });
  if (match || query === core) return match;
  return pickBestUsdaMatch(await searchUsda(core), { query, core });
}

async function lookupUsdaFood(rawQuery, rawCore) {
  if (!usdaConfigured) return null;

  const query = String(rawQuery || "").trim().toLowerCase();
  const core = String(rawCore || "").trim().toLowerCase() || query;
  if (!query) return null;

  const cacheKey = `${query}|${core}`;
  const cached = await getJson(cacheNamespace, cacheKey);
  if (cached && Date.now() - Number(cached.cachedAt) < usdaCacheTtlMs) {
    return cached.value;
  }
  if (usdaInflight.has(cacheKey)) return usdaInflight.get(cacheKey);

  const lookup = findMatch(query, core);
  usdaInflight.set(cacheKey, lookup);
  try {
    const value = await lookup;
    await setJson(cacheNamespace, cacheKey, { cachedAt: Date.now(), value });
    return value;
  } catch (error) {
    // 过期刷新失败时继续使用旧缓存。
    if (cached) return cached.value;
    throw error;
  } finally {
    usdaInflight.delete(cacheKey);
  }
}

export async function enrichFoodsWithUsda(foods) {
  return Promise.all(
    foods.map(async (food) => {
      try {
        const match = await lookupUsdaFood(food.usdaQuery || food.nameEn || food.name, food.foodCore);
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
