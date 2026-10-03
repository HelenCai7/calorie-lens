# Calorie Lens（Next.js 版本）

这是 Calorie Lens 的 Next.js 版本，功能和根目录的原版一致。原版（`index.html` + `app.js` + `server.js`）保持不变，两个版本可以同时运行。

| | 原版 | Next.js 版 |
| --- | --- | --- |
| 前端 | 原生 JS（`app.js`） | React 组件（`components/`） |
| 后端 | `server.js` | Route Handler（`app/api/analyze/route.js`） |
| USDA 缓存 / 每日次数 | 本地 JSON 文件 | Upstash Redis，本地开发时写到 `.data/` |
| 本地端口 | 4173 | 4174 |

## 本地运行

```bash
cd nextjs
npm install
cp .env.example .env.local   # 填入 GEMINI_API_KEY、USDA_API_KEY
npm run dev
```

然后打开 http://localhost:4174

生产模式：`npm run build`，然后 `npm run start`。

## 目录结构

```text
app/
  layout.js            页面外壳、标题、viewport
  page.js              首页，渲染 CalorieLens
  manifest.js          PWA manifest
  globals.css          样式（来自原版 styles.css）
  api/analyze/route.js 图片分析接口
components/
  CalorieLens.jsx      主界面：相机、上传、分析、历史记录
  FoodItem.jsx         食物条目（克重、kcal/100g 编辑）
  FoodTag.jsx          图片上可拖动的食物标注
lib/
  config.js            环境变量
  vision.js            Gemini / OpenAI 识别
  usda.js              USDA 查询和缓存
  rate-limit.js        每个用户 24 小时分析次数限制
  store.js             存储（Redis 或本地文件）
  meal.js              前端共用的计算、图片压缩、模拟结果
```

## 部署到 Vercel

1. 在 Vercel 导入这个 GitHub 仓库，**Root Directory 选 `nextjs`**。
2. 在 Environment Variables 中填入 `GEMINI_API_KEY`、`USDA_API_KEY` 等变量（参考 `.env.example`）。
3. 在 Vercel Marketplace 添加 Upstash Redis，它会自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`；也可以手动填 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`。

不配 Redis 也能运行，但 Vercel 的文件系统是只读的，USDA 缓存和每日次数只会留在单个函数实例的内存里，次数限制基本不起作用。

GitHub Pages 只能放静态文件，跑不了 `/api/analyze`，所以这个版本不能部署到 GitHub Pages。根目录现有的 GitHub Pages 部署流程只发布原版文件，不受影响。
