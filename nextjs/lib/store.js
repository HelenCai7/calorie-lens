import fs from "node:fs/promises";
import path from "node:path";

// 线上用 Upstash Redis（Vercel KV 的环境变量也兼容），本地开发写到 .data/ 目录。
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const keyPrefix = "calorie-lens";
const dataDir = path.join(process.cwd(), ".data");
const fileStores = new Map();

export const storeKind = redisUrl && redisToken ? "redis" : "file";

async function redis(command) {
  const response = await fetch(redisUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${redisToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `Redis HTTP ${response.status}`);
  }
  return payload.result;
}

async function readFileStore(namespace) {
  if (fileStores.has(namespace)) return fileStores.get(namespace);

  let data = {};
  try {
    data = JSON.parse(await fs.readFile(path.join(dataDir, `${namespace}.json`), "utf8"));
  } catch {
    data = {};
  }
  fileStores.set(namespace, data);
  return data;
}

async function writeFileStore(namespace, data) {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(path.join(dataDir, `${namespace}.json`), JSON.stringify(data, null, 2));
  } catch (error) {
    // 只读文件系统（例如没配 Redis 的 Vercel）时只保留在内存里，不影响本次请求。
    console.warn(`Store write failed for ${namespace}: ${error.message}`);
  }
}

export async function getJson(namespace, key) {
  if (storeKind === "redis") {
    const raw = await redis(["GET", `${keyPrefix}:${namespace}:${key}`]);
    return raw ? JSON.parse(raw) : null;
  }

  const data = await readFileStore(namespace);
  return data[key] ?? null;
}

export async function setJson(namespace, key, value, ttlSeconds) {
  if (storeKind === "redis") {
    const command = ["SET", `${keyPrefix}:${namespace}:${key}`, JSON.stringify(value)];
    if (ttlSeconds) command.push("EX", String(Math.ceil(ttlSeconds)));
    await redis(command);
    return;
  }

  const data = await readFileStore(namespace);
  data[key] = value;
  await writeFileStore(namespace, data);
}
