import { dailyAnalysisLimit } from "./config";
import { getJson, setJson } from "./store";

const rateWindowMs = 24 * 60 * 60 * 1000;

export async function checkDailyLimit(clientId) {
  const key = String(clientId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  if (!key) {
    return { allowed: false, status: 400, error: "缺少用户标识，请刷新页面后重试。" };
  }

  const now = Date.now();
  const existing = (await getJson("usage", key)) || [];
  const recent = existing.filter((timestamp) => now - timestamp < rateWindowMs);

  if (recent.length >= dailyAnalysisLimit) {
    return {
      allowed: false,
      status: 429,
      error: `同一个用户 24 小时内最多只能分析 ${dailyAnalysisLimit} 张图片。`,
      remaining: 0,
      resetAt: new Date(Math.min(...recent) + rateWindowMs).toISOString()
    };
  }

  return { allowed: true, key, recent, now };
}

export async function recordAnalysis(limitCheck) {
  const updated = [...limitCheck.recent, limitCheck.now];
  await setJson("usage", limitCheck.key, updated, rateWindowMs / 1000);
  return Math.max(0, dailyAnalysisLimit - updated.length);
}
