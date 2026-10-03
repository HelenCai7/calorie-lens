export const foodLibrary = [
  { name: "米饭", kcalPer100g: 116, density: 0.78 },
  { name: "鸡胸肉", kcalPer100g: 165, density: 0.95 },
  { name: "煎蛋", kcalPer100g: 196, density: 0.82 },
  { name: "西兰花", kcalPer100g: 34, density: 0.36 },
  { name: "牛油果", kcalPer100g: 160, density: 0.64 },
  { name: "三文鱼", kcalPer100g: 208, density: 0.92 },
  { name: "面条", kcalPer100g: 138, density: 0.68 },
  { name: "土豆", kcalPer100g: 77, density: 0.72 },
  { name: "苹果", kcalPer100g: 52, density: 0.61 },
  { name: "自定义食物", kcalPer100g: 120, density: 0.7 }
];

export const colors = ["#287a63", "#c46b2f", "#466ca6", "#bf4f5f", "#6d6a2e", "#6c58a8"];

const maxImageSide = 1280;
const jpegQuality = 0.82;

export function formatCalories(grams, kcalPer100g) {
  return Math.round((grams * kcalPer100g) / 100);
}

export function mealTotals(foods) {
  return {
    grams: Math.round(foods.reduce((sum, food) => sum + Number(food.grams), 0)),
    calories: foods.reduce((sum, food) => sum + formatCalories(food.grams, food.kcalPer100g), 0)
  };
}

export function confidenceLabel(value) {
  if (value >= 0.72) return "较高";
  if (value >= 0.46) return "中等";
  return "较低";
}

export function nutritionSourceLabel(food) {
  if (food.nutritionSource === "usda") return `USDA · ${food.matchedFood}`;
  if (food.nutritionSource === "local") return "本地参考值";
  if (food.nutritionSource === "manual") return "手动调整";
  if (food.nutritionSource === "renamed") return "名称已修改，热量值待确认";
  return "Gemini 估算";
}

export function mockAnalyzePlate(fistVolumeMl) {
  const picks = [foodLibrary[0], foodLibrary[1], foodLibrary[3]];
  const shares = [0.72, 0.58, 0.42];
  const positions = [
    { left: 18, top: 28 },
    { left: 48, top: 22 },
    { left: 34, top: 58 }
  ];

  return picks.map((food, index) => ({
    id: crypto.randomUUID(),
    name: food.name,
    kcalPer100g: food.kcalPer100g,
    nutritionSource: "local",
    matchedFood: "",
    grams: Math.max(20, Math.round(fistVolumeMl * shares[index] * food.density)),
    position: positions[index]
  }));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败。"));
    image.src = src;
  });
}

export async function compressImageDataUrl(src) {
  const image = await loadImage(src);
  const scale = Math.min(1, maxImageSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return {
    src: canvas.toDataURL("image/jpeg", jpegQuality),
    width,
    height
  };
}
