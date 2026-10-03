export const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
export const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
export const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const usdaApiKey = process.env.USDA_API_KEY || "";
export const usdaCacheTtlDays = Math.max(1, Number(process.env.USDA_CACHE_TTL_DAYS) || 30);
export const dailyAnalysisLimit = Number(process.env.DAILY_ANALYSIS_LIMIT || 3);

export function configuredSecret(value, placeholderNeedle) {
  return Boolean(value && !String(value).includes(placeholderNeedle));
}

export const usdaConfigured = configuredSecret(usdaApiKey, "your-usda-api-key");
