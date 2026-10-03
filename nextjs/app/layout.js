import "./globals.css";

export const metadata = {
  title: "Calorie Lens",
  description: "拍照估算食物卡路里"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f3ea"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
