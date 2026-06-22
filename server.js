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
const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12_000_000) {
        req.destroy();
        reject(new Error("图片太大，请换一张较小的照片。"));
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

function extractTextFromResponse(payload) {
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.text) return content.text;
    }
  }

  return "";
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

async function analyzePhoto(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 501, {
      error: "还没有配置 OPENAI_API_KEY。当前只能使用本地模拟识别。"
    });
    return;
  }

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

  const fistVolumeMl = Math.max(250, Math.min(520, Number(body.fistVolumeMl) || 350));
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["foods", "overallConfidence", "usedFistReference", "message"],
    properties: {
      foods: {
        type: "array",
        minItems: 0,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
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

  const prompt = [
    "你是营养识别助手。请分析照片中的一盘食物。",
    "目标是给用户一个可编辑的初步估算，不要假装绝对准确。",
    `如果画面里有拳头，把它当作体积参照；用户设置的拳头体积约为 ${fistVolumeMl} ml。`,
    "请尽量识别盘子中每个独立食物，不要把米饭、肉、蔬菜混成一个条目。",
    "估算每项食物的克重、每100g热量、置信度，以及标注在图片中的位置。",
    "left/top 是标注左上角相对图片区域的百分比，范围 2 到 88。",
    "如果无法确定，请给出较低 confidence，并在 notes 说明需要用户手动调整。"
  ].join("\n");

  try {
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
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: body.imageDataUrl, detail: "high" }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "calorie_plate_analysis",
            strict: true,
            schema
          }
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      sendJson(res, response.status, {
        error: payload.error?.message || "OpenAI 图片识别失败。"
      });
      return;
    }

    const text = extractTextFromResponse(payload);
    const parsed = JSON.parse(text);
    sendJson(res, 200, {
      foods: (parsed.foods || []).map(clampFood),
      overallConfidence: Math.min(1, Math.max(0, Number(parsed.overallConfidence) || 0.5)),
      usedFistReference: Boolean(parsed.usedFistReference),
      message: String(parsed.message || "")
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "识别服务暂时不可用。" });
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
  });
