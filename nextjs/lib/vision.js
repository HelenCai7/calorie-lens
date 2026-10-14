import { aiProvider, configuredSecret, geminiModel, openaiModel } from "./config";

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2]
  };
}

function extractOpenAIText(payload) {
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) return content.text;
    }
  }

  return "";
}

function extractGeminiText(payload) {
  if (payload.output_text) return payload.output_text;
  if (payload.text) return payload.text;

  for (const step of payload.steps || []) {
    const contents = step.modelOutput?.content || step.model_output?.content || step.content || [];
    for (const content of contents) {
      if (typeof content.text === "string") return content.text;
      if (content.text?.text) return content.text.text;
    }
  }

  for (const candidate of payload.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.text) return part.text;
    }
  }

  return "";
}

function analysisSchema({ strict }) {
  const objectBase = strict ? { additionalProperties: false } : {};
  return {
    type: "object",
    ...objectBase,
    required: ["foods", "overallConfidence", "usedFistReference", "message"],
    properties: {
      foods: {
        type: "array",
        minItems: 0,
        maxItems: 8,
        items: {
          type: "object",
          ...objectBase,
          required: ["name", "usdaQuery", "grams", "kcalPer100g", "confidence", "left", "top", "notes"],
          properties: {
            name: { type: "string" },
            usdaQuery: { type: "string" },
            grams: { type: "number" },
            kcalPer100g: { type: "number" },
            confidence: { type: "number" },
            left: { type: "number" },
            top: { type: "number" },
            notes: { type: "string" }
          }
        }
      },
      overallConfidence: { type: "number" },
      usedFistReference: { type: "boolean" },
      message: { type: "string" }
    }
  };
}

function geminiAnalysisSchema() {
  return {
    type: "OBJECT",
    required: ["foods", "overallConfidence", "usedFistReference", "message"],
    properties: {
      foods: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["name", "usdaQuery", "grams", "kcalPer100g", "confidence", "left", "top", "notes"],
          properties: {
            name: { type: "STRING" },
            usdaQuery: { type: "STRING" },
            grams: { type: "NUMBER" },
            kcalPer100g: { type: "NUMBER" },
            confidence: { type: "NUMBER" },
            left: { type: "NUMBER" },
            top: { type: "NUMBER" },
            notes: { type: "STRING" }
          }
        }
      },
      overallConfidence: { type: "NUMBER" },
      usedFistReference: { type: "BOOLEAN" },
      message: { type: "STRING" }
    }
  };
}

function analysisPrompt(fistVolumeMl) {
  return [
    "你是营养识别助手。请分析照片中的一盘食物。",
    "目标是给用户一个可编辑的初步估算，不要假装绝对准确。",
    `如果画面里有拳头，把它当作体积参照；用户设置的拳头体积约为 ${fistVolumeMl} ml。`,
    "请尽量识别盘子中每个独立食物，不要把米饭、肉、蔬菜混成一个条目。",
    "估算每项食物的克重、每100g热量、置信度，以及标注在图片中的位置。",
    "每项食物还要返回 usdaQuery：用于 USDA FoodData Central 搜索的简短英文标准名称，必须包含生熟状态和主要烹饪方式，例如 cooked white rice 或 grilled chicken breast。",
    "left/top 是标注左上角相对图片区域的百分比，范围 2 到 88。",
    "如果无法确定，请给出较低 confidence，并在 notes 说明需要用户手动调整。"
  ].join("\n");
}

export function clampFood(food, index) {
  const fallbackPositions = [
    { left: 18, top: 28 },
    { left: 48, top: 24 },
    { left: 34, top: 58 },
    { left: 58, top: 54 }
  ];
  const fallback = fallbackPositions[index % fallbackPositions.length];

  return {
    name: String(food.name || "未知食物").slice(0, 24),
    usdaQuery: String(food.usdaQuery || food.name || "").slice(0, 80),
    grams: Math.max(1, Math.round(Number(food.grams) || 100)),
    kcalPer100g: Math.max(1, Math.round(Number(food.kcalPer100g) || 120)),
    confidence: Math.min(1, Math.max(0, Number(food.confidence) || 0.45)),
    position: {
      left: Math.min(88, Math.max(2, Number(food.left) || fallback.left)),
      top: Math.min(88, Math.max(2, Number(food.top) || fallback.top))
    },
    notes: String(food.notes || "").slice(0, 80)
  };
}

function httpError(message, status, extra = {}) {
  return Object.assign(new Error(message), { status, ...extra });
}

// 模型服务自身的繁忙或限额错误。和“用户今天的 3 次用完了”是两回事，路由会单独处理。
const busyStatuses = new Set([429, 500, 502, 503, 504]);
// 这些是临时故障，通常很快返回，值得自动重试。
const retryStatuses = new Set([500, 503]);
const retryDelaysMs = [2000, 4000];

function providerError(provider, payload, status) {
  const message = payload.error?.message || `${provider} 图片识别失败。`;
  return busyStatuses.has(status)
    ? httpError(message, status, { aiBusy: true, aiQuota: status === 429 })
    : httpError(message, status);
}

async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || !retryStatuses.has(response.status) || attempt >= retryDelaysMs.length) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
  }
}

async function analyzeWithOpenAI(imageDataUrl, fistVolumeMl) {
  if (!configuredSecret(process.env.OPENAI_API_KEY, "your-openai-api-key")) {
    throw httpError("还没有配置 OPENAI_API_KEY。", 501);
  }

  const response = await fetchWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: analysisPrompt(fistVolumeMl) },
            { type: "input_image", image_url: imageDataUrl, detail: "high" }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "calorie_plate_analysis",
          strict: true,
          schema: analysisSchema({ strict: true })
        }
      }
    }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw providerError("OpenAI", payload, response.status);
  }

  return JSON.parse(extractOpenAIText(payload));
}

async function analyzeWithGemini(imageDataUrl, fistVolumeMl) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!configuredSecret(geminiKey, "your-gemini-api-key")) {
    throw httpError("还没有配置 GEMINI_API_KEY。请先在 Google AI Studio 创建 API Key。", 501);
  }

  const image = parseDataUrl(imageDataUrl);
  if (!image) {
    throw httpError("图片格式不正确。", 400);
  }

  const modelPath = geminiModel.startsWith("models/") ? geminiModel : `models/${geminiModel}`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: analysisPrompt(fistVolumeMl) },
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.data
              }
            }
          ]
        }
      ],
      generation_config: {
        response_mime_type: "application/json",
        response_schema: geminiAnalysisSchema()
      }
    }),
    cache: "no-store"
  });

  const payload = await response.json();
  if (!response.ok) {
    throw providerError("Gemini", payload, response.status);
  }

  return JSON.parse(extractGeminiText(payload));
}

export function analyzeImage(imageDataUrl, fistVolumeMl) {
  return aiProvider === "openai"
    ? analyzeWithOpenAI(imageDataUrl, fistVolumeMl)
    : analyzeWithGemini(imageDataUrl, fistVolumeMl);
}
