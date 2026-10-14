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
    // 模型服务繁忙或它自己的额度用完：统一返回 503 和 code，避免前端误以为是用户的每日次数用完。
    // 这次请求没有成功，所以不计入用户的次数。
    if (error.aiBusy) {
      console.warn(`AI provider busy (${error.status}): ${error.message}`);
      return Response.json(
        {
          code: "ai_busy",
          quota: Boolean(error.aiQuota),
          error: error.aiQuota
            ? "AI 识别服务暂时达到使用上限，请稍后再试。如果一直失败，可能是今天的额度用完了，明天会恢复。"
            : "AI 识别服务现在太忙，请过一会儿再试。这次不计入你的每日次数。"
        },
        { status: 503 }
      );
    }
    return Response.json(
      { error: error.message || "识别服务暂时不可用。" },
      { status: error.status || 500 }
    );
  }
}
