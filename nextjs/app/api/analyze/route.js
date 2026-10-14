import { aiProvider, geminiModel, openaiModel, usdaConfigured } from "@/lib/config";
import { checkDailyLimit, recordAnalysis } from "@/lib/rate-limit";
import { getSignedInUserId } from "@/lib/supabase/server";
import { enrichFoodsWithUsda } from "@/lib/usda";
import { analyzeImage, clampFood } from "@/lib/vision";

export const runtime = "nodejs";
// 视觉模型 + USDA 查询有时需要十几秒，给 Vercel 函数留足时间。
export const maxDuration = 60;

const maxBodyLength = 5_000_000;

async function readJsonBody(request) {
  const text = await request.text();
  if (text.length > maxBodyLength) {
    throw new Error("图片太大，请压缩后再上传。");
  }
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("请求格式不正确。");
  }
}

export async function POST(request) {
  const userId = await getSignedInUserId();
  if (!userId) {
    return Response.json({ error: "请先登录后再分析照片。", needsLogin: true }, { status: 401 });
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (!String(body.imageDataUrl || "").startsWith("data:image/")) {
    return Response.json({ error: "请先上传或拍摄一张图片。" }, { status: 400 });
  }

  try {
    // 按登录账号计次，不再信任浏览器传来的 clientId。
    const limitCheck = await checkDailyLimit(`user_${userId}`);
    if (!limitCheck.allowed) {
      return Response.json(limitCheck, { status: limitCheck.status });
    }

    const fistVolumeMl = Math.max(250, Math.min(520, Number(body.fistVolumeMl) || 350));
    const parsed = await analyzeImage(body.imageDataUrl, fistVolumeMl);
    const foods = await enrichFoodsWithUsda((parsed.foods || []).map(clampFood));
    const remaining = await recordAnalysis(limitCheck);

    return Response.json({
      foods,
      overallConfidence: Math.min(1, Math.max(0, Number(parsed.overallConfidence) || 0.5)),
      usedFistReference: Boolean(parsed.usedFistReference),
      message: String(parsed.message || ""),
      provider: aiProvider,
      model: aiProvider === "openai" ? openaiModel : geminiModel,
      nutritionDatabase: usdaConfigured ? "USDA FoodData Central" : "model estimate",
      remaining
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "识别服务暂时不可用。" },
      { status: error.status || 500 }
    );
  }
}
