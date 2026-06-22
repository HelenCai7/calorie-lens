# Calorie Lens

一个拍照估算食物卡路里的前端原型。手机浏览器打开后可以调用相机，也可以上传照片；界面预留了食物区域和拳头参照区域，并支持逐项调整食物重量。

## 运行

```bash
node server.js
```

然后打开：

```text
http://127.0.0.1:4173
```

## 启用真实图片识别

先设置 OpenAI API Key，再启动服务：

```powershell
$env:OPENAI_API_KEY="你的 API Key"
node server.js
```

可选：指定模型。

```powershell
$env:OPENAI_MODEL="gpt-4.1-mini"
node server.js
```

未设置 `OPENAI_API_KEY` 时，App 会保留本地模拟识别和手动校正流程。

## 当前功能

- 拍照或上传食物照片。
- 取景框中预留食物位置和拳头参照位置。
- 点击“分析照片”后生成盘中食物的估算标注。
- 每个食物单独显示重量和卡路里。
- 可以手动添加、删除食物。
- 可以调整每个食物的克重和 `kcal/100g`，卡路里和图片标注会即时更新。
- 可以拖动照片上的食物标注位置。
- 可以调整拳头参考体积，整体重量估算会同步校准。
- 可以保存本次记录，并在最近记录里查看。

## 后续接入真实识别

现在 `server.js` 里的 `/api/analyze` 会在配置 `OPENAI_API_KEY` 后调用视觉模型；`app.js` 里的 `mockAnalyzePlate()` 只作为未配置 API Key 或识别失败时的回退。

- OpenAI Vision 或其他视觉模型：识别食物种类、分割盘中物体、判断拳头参照比例。
- 后端营养数据库：根据食物名称返回更精确的 `kcalPer100g`。
- 分割模型：返回每个食物的边界框或 mask，再映射到页面上的标注位置。
