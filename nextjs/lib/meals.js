// 餐食记录的读写。所有查询都依赖 Supabase 的 Row Level Security，只能访问当前用户自己的记录。

const legacyHistoryKey = "calorie-lens-history";
const importedFlagPrefix = "calorie-lens-history-imported:";

function toMeal(row) {
  return {
    id: row.id,
    eatenAt: row.eaten_at,
    totalCalories: row.total_calories,
    totalGrams: row.total_grams,
    foods: row.foods || []
  };
}

export function formatMealTime(eatenAt, locale = "zh-CN") {
  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(eatenAt));
}

export async function fetchRecentMeals(supabase, limit = 8) {
  const { data, error } = await supabase
    .from("meals")
    .select("id, eaten_at, total_calories, total_grams, foods")
    .order("eaten_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(toMeal);
}

export async function fetchMealsSince(supabase, since) {
  const { data, error } = await supabase
    .from("meals")
    .select("id, eaten_at, total_calories, total_grams, foods")
    .gte("eaten_at", since.toISOString())
    .order("eaten_at", { ascending: false });
  if (error) throw error;
  return data.map(toMeal);
}

export async function insertMeal(supabase, { totalCalories, totalGrams, foods, eatenAt }) {
  const { data, error } = await supabase
    .from("meals")
    .insert({
      total_calories: totalCalories,
      total_grams: totalGrams,
      foods,
      ...(eatenAt ? { eaten_at: eatenAt } : {})
    })
    .select("id, eaten_at, total_calories, total_grams, foods")
    .single();
  if (error) throw error;
  return toMeal(data);
}

export async function deleteAllMeals(supabase, userId) {
  const { error } = await supabase.from("meals").delete().eq("user_id", userId);
  if (error) throw error;
}

// 旧版本把时间存成 "10/02 21:30" 这样不带年份的字符串，这里按今年还原；
// 如果还原出来的时间在未来，说明是去年的记录。
function parseLegacyTime(text) {
  const match = String(text || "").match(/(\d{1,2})\/(\d{1,2})\D+(\d{1,2}):(\d{2})/);
  if (!match) return new Date();
  const [, month, day, hour, minute] = match.map(Number);
  const now = new Date();
  const date = new Date(now.getFullYear(), month - 1, day, hour, minute);
  if (date > now) date.setFullYear(date.getFullYear() - 1);
  return date;
}

// 第一次登录时，把以前存在这台设备浏览器里的历史记录导入到账号里。
export async function importLegacyHistory(supabase, userId) {
  const flagKey = `${importedFlagPrefix}${userId}`;
  let legacy;
  try {
    if (localStorage.getItem(flagKey)) return 0;
    legacy = JSON.parse(localStorage.getItem(legacyHistoryKey)) || [];
  } catch {
    return 0;
  }

  if (legacy.length) {
    const rows = legacy.map((meal) => ({
      total_calories: Math.max(0, Math.round(Number(meal.totalCalories) || 0)),
      total_grams: Math.max(0, Math.round(Number(meal.totalGrams) || 0)),
      foods: Array.isArray(meal.foods) ? meal.foods : [],
      eaten_at: parseLegacyTime(meal.time).toISOString()
    }));
    const { error } = await supabase.from("meals").insert(rows);
    if (error) throw error;
  }

  localStorage.setItem(flagKey, new Date().toISOString());
  localStorage.removeItem(legacyHistoryKey);
  return legacy.length;
}
