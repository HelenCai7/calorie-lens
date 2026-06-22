const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();

function loadEnvFile(fileName) {
  const envPath = path.join(root, fileName);
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const port = Number(process.env.PORT || 4173);
const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const dailyAnalysisLimit = Number(process.env.DAILY_ANALYSIS_LIMIT || 3);
const rateWindowMs = 24 * 60 * 60 * 1000;
const usageFile = path.join(root, ".analysis-usage.json");
const analysisUsage = loadAnalysisUsage();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function configuredSecret(value, placeholderNeedle) {
  return Boolean(value && !String(value).includes(placeholderNeedle));
}

function loadAnalysisUsage() {
  try {
    const raw = JSON.parse(fs.readFileSync(usageFile, "utf8"));
    return new Map(Object.entries(raw).filter(([, value]) => Array.isArray(value)));
  } catch {
    return new Map();
  }
}

function saveAnalysisUsage() {
  const data = Object.fromEntries(analysisUsage.entries());
  fs.writeFile(usageFile, JSON.stringify(data, null, 2), () => {});
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        req.destroy();
        reject(new Error("图片太大，请压缩后再上传。"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("请求格式不正确。"));
      }
    });
    req.on("error", reject);
  });
}

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
          required: ["name", "grams", "kcalPer100g", "confidence", "left", "top", "notes"],
          properties: {
            name: { type: "string" },
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
          required: ["name", "grams", "kcalPer100g", "confidence", "left", "top", "notes"],
          properties: {
            name: { type: "STRING" },
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
    "left/top 是标注左上角相对图片区域的百分比，范围 2 到 88。",
    "如果无法确定，请给出较低 confidence，并在 notes 说明需要用户手动调整。"
  ].join("\n");
}

function clampFood(food, index) {
  const fallbackPositions = [
    { left: 18, top: 28 },
    { left: 48, top: 24 },
    { left: 34, top: 58 },
    { left: 58, top: 54 }
  ];
  const fallback = fallbackPositions[index % fallbackPositions.length];

  return {
    name: String(food.name || "未知食物").slice(0, 24),
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

function usageForClient(clientId) {
  const now = Date.now();
  const key = String(clientId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  if (!key) return null;

  const existing = analysisUsage.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < rateWindowMs);
  analysisUsage.set(key, recent);
  saveAnalysisUsage();
  return { key, recent, now };
}

function checkDailyLimit(clientId) {
  const usage = usageForClient(clientId);
  if (!usage) {
    return { allowed: false, status: 400, error: "缺少用户标识，请刷新页面后重试。" };
  }

  if (usage.recent.length >= dailyAnalysisLimit) {
    const resetAt = new Date(Math.min(...usage.recent) + rateWindowMs).toISOString();
    return {
      allowed: false,
      status: 429,
      error: `同一个用户 24 小时内最多只能分析 ${dailyAnalysisLimit} 张图片。`,
      remaining: 0,
      resetAt
    };
  }

  return {
    allowed: true,
    key: usage.key,
    recent: usage.recent,
    now: usage.now,
    remaining: dailyAnalysisLimit - usage.recent.length
  };
}

function recordAnalysis(limitCheck) {
  const updated = [...limitCheck.recent, limitCheck.now];
  analysisUsage.set(limitCheck.key, updated);
  saveAnalysisUsage();
  return Math.max(0, dailyAnalysisLimit - updated.length);
}

async function analyzeWithOpenAI(body, fistVolumeMl) {
  if (!configuredSecret(process.env.OPENAI_API_KEY, "your-openai-api-key")) {
    throw Object.assign(new Error("还没有配置 OPENAI_API_KEY。"), { status: 501 });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
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
            { type: "input_image", image_url: body.imageDataUrl, detail: "high" }
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
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(payload.error?.message || "OpenAI 图片识别失败。"), {
      status: response.status
    });
  }

  return JSON.parse(extractOpenAIText(payload));
}

async function analyzeWithGemini(body, fistVolumeMl) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!configuredSecret(geminiKey, "your-gemini-api-key")) {
    throw Object.assign(new Error("还没有配置 GEMINI_API_KEY。请先在 Google AI Studio 创建 API Key。"), {
      status: 501
    });
  }

  const image = parseDataUrl(body.imageDataUrl);
  if (!image) {
    throw Object.assign(new Error("图片格式不正确。"), { status: 400 });
  }

  const modelPath = geminiModel.startsWith("models/") ? geminiModel : `models/${geminiModel}`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const response = await fetch(endpoint, {
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
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(payload.error?.message || "Gemini 图片识别失败。"), {
      status: response.status
    });
  }

  return JSON.parse(extractGeminiText(payload));
}

async function analyzePhoto(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  if (!String(body.imageDataUrl || "").startsWith("data:image/")) {
    sendJson(res, 400, { error: "请先上传或拍摄一张图片。" });
    return;
  }

  const limitCheck = checkDailyLimit(body.clientId);
  if (!limitCheck.allowed) {
    sendJson(res, limitCheck.status, limitCheck);
    return;
  }

  const fistVolumeMl = Math.max(250, Math.min(520, Number(body.fistVolumeMl) || 350));

  try {
    const parsed =
      aiProvider === "openai"
        ? await analyzeWithOpenAI(body, fistVolumeMl)
        : await analyzeWithGemini(body, fistVolumeMl);
    const remaining = recordAnalysis(limitCheck);

    sendJson(res, 200, {
      foods: (parsed.foods || []).map(clampFood),
      overallConfidence: Math.min(1, Math.max(0, Number(parsed.overallConfidence) || 0.5)),
      usedFistReference: Boolean(parsed.usedFistReference),
      message: String(parsed.message || ""),
      provider: aiProvider,
      model: aiProvider === "openai" ? openaiModel : geminiModel,
      remaining
    });
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "识别服务暂时不可用。" });
  }
}

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/analyze") {
      analyzePhoto(req, res);
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const filePath = path.resolve(root, requested);

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("forbidden");
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        res.writeHead(404);
        res.end("not found");
        return;
      }

      res.writeHead(200, {
        "content-type": types[path.extname(filePath)] || "application/octet-stream"
      });
      res.end(body);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`http://127.0.0.1:${port}`);
    console.log(`AI provider: ${aiProvider}`);
  });
