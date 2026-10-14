export default function manifest() {
  return {
    name: "Calorie Lens",
    short_name: "Calories",
    description: "Snap a photo of your meal to estimate calories.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ea",
    theme_color: "#287a63",
    // 图标由 scripts/generate-icons.mjs 生成。
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
