# Calorie Lens（Next.js 版本）

线上地址：https://calorie-lens-nine.vercel.app

这是 Calorie Lens 的 Next.js 版本。拍照识别、USDA 校准、手动校正这些核心功能和根目录的原版一致，另外增加了**用户登录、云端历史记录、热量统计、隐私政策页面**。原版（`index.html` + `app.js` + `server.js`）保持不变，两个版本可以同时运行。

| | 原版 | Next.js 版 |
| --- | --- | --- |
| 前端 | 原生 JS（`app.js`） | React 组件（`components/`） |
| 后端 | `server.js` | Route Handler（`app/api/analyze/route.js`） |
| 用户 | 浏览器生成的 `clientId` | Supabase 登录（Google、邮件登录链接） |
| 历史记录 | 浏览器 `localStorage` | Supabase 数据库，换设备也能看到 |
| USDA 缓存 / 每日次数 | 本地 JSON 文件 | Upstash Redis，本地开发时写到 `.data/` |
| 本地端口 | 4173 | 4174 |

## 本地运行

```bash
cd nextjs
npm install
cp .env.example .env.local   # 填入 GEMINI_API_KEY、USDA_API_KEY、Supabase 的两个 NEXT_PUBLIC_ 变量
npm run dev
```

然后打开 http://localhost:4174

- 生产模式：`npm run build`，然后 `npm run start`。
- Supabase 变量可以在项目关联 Vercel 后用 `vercel env pull` 拉取（注意它会**覆盖** `.env.local`，先备份），也可以从 Supabase 控制台的 API 设置里复制。
- 本地登录用的是线上同一个 Supabase 项目，本地保存的记录会出现在线上账号里。

## 目录结构

```text
proxy.js               每次请求前刷新 Supabase 登录状态（Next.js 16 的 middleware）
app/
  layout.js            页面外壳、标题、viewport
  page.js              首页，渲染 CalorieLens
  manifest.js          PWA manifest
  globals.css          样式
  api/analyze/route.js 图片分析接口（需要登录）
  auth/callback/       Google 登录和邮件登录链接的回调
  stats/               热量统计页
  privacy/ terms/      隐私政策、服务条款（英文）
components/
  CalorieLens.jsx      主界面：账号栏、相机、上传、分析、云端历史
  AuthPanel.jsx        登录弹窗
  MealStats.jsx        统计页内容
  FoodItem.jsx         食物条目（克重、kcal/100g 编辑）
  FoodTag.jsx          图片上可拖动的食物标注
  LegalPage.jsx        法律页面外壳
lib/
  config.js            环境变量
  vision.js            Gemini / OpenAI 识别
  usda.js              USDA 查询和缓存
  rate-limit.js        每个账号 24 小时分析次数限制
  store.js             存储（Redis 或本地文件）
  meal.js              前端共用的计算、图片压缩、模拟结果
  meals.js             云端餐食记录的读写、旧本地记录导入
  use-supabase-user.js 前端登录状态
  legal.js             法律页面的联系邮箱和更新日期
  supabase/            Supabase 客户端（浏览器端、服务端）
supabase/migrations/   数据库建表脚本（meals 表和 RLS 规则）
```

## 部署到 Vercel

已部署在 Vercel 团队 `helen-cai7` 的 `calorie-lens` 项目，推送到 `main` 会自动部署。从零开始搭建的步骤：

1. 在 Vercel 导入这个 GitHub 仓库，**Root Directory 选 `nextjs`**。
2. 在 Environment Variables 中填入 `GEMINI_API_KEY`、`USDA_API_KEY` 等变量（参考 `.env.example`）。
3. 在 Vercel Marketplace 添加 **Upstash Redis**，它会自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`。
4. 在 Vercel Marketplace 添加 **Supabase**，它会自动注入 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
5. 在 Supabase 运行 `supabase/migrations/` 下的 SQL。
6. 在 Supabase Auth 设置 Site URL 和 Redirect URLs（`<网址>/auth/callback`），开启 Google 登录。Google 那边要先创建 OAuth 客户端，并发布授权页面，发布需要 `/privacy` 和 `/terms` 两个网址。

不配 Redis 也能运行，但 Vercel 的文件系统是只读的，USDA 缓存和每日次数只会留在单个函数实例的内存里，次数限制基本不起作用。

GitHub Pages 只能放静态文件，跑不了 `/api/analyze`，所以这个版本不能部署到 GitHub Pages。根目录现有的 GitHub Pages 部署流程只发布原版文件，不受影响。

更多细节（接口、数据库结构、安全规则、测试方法）见 [docs/development.md](../docs/development.md)。
