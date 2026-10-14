// 生成 App 图标。改了图案后运行：node scripts/generate-icons.mjs
// 输出：
//   app/icon.svg                 浏览器标签页图标（Next.js 自动生成 <link rel="icon">）
//   app/apple-icon.png           iPhone 主屏幕图标 180×180（iOS 自己加圆角，所以这里是满版方形）
//   public/icons/icon-192.png    安卓 / PWA 图标
//   public/icons/icon-512.png
//   public/icons/maskable-512.png  安卓自适应图标：图案缩在中间 80% 的安全区内
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const green = "#287a63";
const orange = "#c46b2f";
const plate = "#fffdf8";

// scale：图案相对画布的大小（maskable 版本更小）；radius：背景圆角（0 = 满版方形）。
function iconSvg({ scale = 1, radius = 112 } = {}) {
  const c = 256;
  const r = (value) => (value * scale).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${green}"/>
  <circle cx="${c}" cy="${c}" r="${r(172)}" fill="${plate}"/>
  <circle cx="${c}" cy="${c}" r="${r(150)}" fill="none" stroke="#e6dccb" stroke-width="${r(6)}"/>
  <circle cx="${c}" cy="${c}" r="${r(92)}" fill="none" stroke="${green}" stroke-width="${r(30)}"/>
  <circle cx="${c}" cy="${c}" r="${r(34)}" fill="${green}"/>
  <circle cx="${(c + 58 * scale).toFixed(1)}" cy="${(c - 58 * scale).toFixed(1)}" r="${r(22)}" fill="${orange}"/>
</svg>
`;
}

async function png(svg, size, file) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(target);
  console.log(`wrote ${file} (${size}×${size})`);
}

fs.writeFileSync(path.join(root, "app/icon.svg"), iconSvg());
console.log("wrote app/icon.svg");
await png(iconSvg({ radius: 0 }), 180, "app/apple-icon.png");
await png(iconSvg(), 192, "public/icons/icon-192.png");
await png(iconSvg(), 512, "public/icons/icon-512.png");
await png(iconSvg({ scale: 0.78, radius: 0 }), 512, "public/icons/maskable-512.png");
