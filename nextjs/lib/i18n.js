"use client";

import { useCallback, useEffect, useState } from "react";

// 界面语言：中文 / 英文。用户的选择存在本机 localStorage；
// 没选过时按浏览器语言决定（中文系统用中文，其他用英文）。
const storageKey = "calorie-lens-lang";
const changeEvent = "calorie-lens-lang-change";

const messages = {
  zh: {
    "app.heading": "拍一下，估算这一盘",
    "app.reset": "重置",
    "lang.label": "界面语言",

    "account.checking": "正在检查登录状态...",
    "account.notConfigured": "登录功能未配置",
    "account.stats": "热量统计",
    "account.signOut": "退出",
    "account.signedOutHint": "登录后可分析照片，记录会同步到云端。",
    "account.signIn": "登录",

    "camera.photoAlt": "已拍摄的食物照片",
    "camera.foodGuide": "食物放这里",
    "camera.fistGuide": "拳头参照",
    "camera.emptyTitle": "把盘子放进大框",
    "camera.emptyHint": "如果份量不确定，把拳头放在右下角小框里。",
    "camera.open": "打开相机",
    "camera.upload": "上传照片",
    "camera.capture": "拍照",
    "camera.unsupported": "当前浏览器不支持直接调用相机，请使用“上传照片”。",
    "camera.denied": "无法打开相机。请在浏览器设置里允许使用相机，或改用“上传照片”。",
    "camera.imageReadFailed": "图片读取失败，请换一张试试。",

    "summary.calories": "总热量",
    "summary.weight": "总重量",
    "summary.confidence": "置信度",

    "status.waitingPhoto": "等待照片",
    "status.waitingCapture": "等待拍照",
    "status.processing": "处理图片",
    "status.waitingAnalysis": "等待分析",
    "status.analyzing": "识别中",
    "status.busy": "服务繁忙",
    "status.limitReached": "次数已用完",
    "status.sample": "示例结果",
    "status.manualCalibration": "手动校准",
    "status.manualEntry": "手动输入",
    "status.saved": "已保存",
    "status.calibrated": "已校准",
    "status.confidenceHigh": "较高",
    "status.confidenceMedium": "中等",
    "status.confidenceLow": "较低",

    "actions.analyze": "分析照片",
    "actions.analyzing": "识别中...",
    "actions.addFood": "添加食物",
    "actions.save": "保存记录",

    "fist.title": "拳头参照",
    "fist.hint": "默认成人拳头约 350 ml。拖动滑块校准后，所有体积估算会一起更新。",

    "foods.title": "食物",
    "foods.emptyTitle": "还没有食物条目",
    "foods.emptyHint": "拍照后点击分析，或手动添加食物并输入重量。",
    "foods.customName": "自定义食物",
    "food.name": "食物",
    "food.weight": "估计重量",
    "food.density": "热量密度",
    "food.delete": "删除",
    "source.usda": "USDA · {matched}",
    "source.local": "本地参考值",
    "source.manual": "手动调整",
    "source.renamed": "名称已修改，热量值待确认",
    "source.model": "AI 估算",

    "history.title": "最近记录",
    "history.cancel": "取消",
    "history.clear": "清空",
    "history.confirmClear": "确认删除全部记录",
    "history.summary": "{grams}g · {count} 项",
    "history.empty": "保存后会显示最近的用餐记录。",
    "history.signedOutEmpty": "登录后，保存的用餐记录会显示在这里。",

    "login.needForAnalyze": "登录后即可分析照片，每天 3 次。",
    "login.needForSave": "登录后保存的记录会同步到你的账号，换手机也能看到。",
    "login.expired": "登录已过期，请重新登录。",

    "toast.authError": "登录没有完成。如果用的是邮件里的链接，请在发起登录的同一个浏览器里打开，或改用 Google 登录。",
    "toast.imported": "已把这台设备上的 {count} 条旧记录导入你的账号。",
    "toast.historyFailed": "读取历史记录失败：{error}",
    "toast.needPhoto": "请先拍照或上传照片。",
    "toast.aiBusy": "AI 识别服务现在太忙，请过一会儿再试。这次不计入你的每日次数。",
    "toast.aiQuota": "AI 识别服务暂时达到使用上限，请稍后再试。如果一直失败，可能是今天的额度用完了，明天会恢复。",
    "toast.limitReached": "今天的 {limit} 次分析已经用完。",
    "toast.limitResetAt": "{time} 后恢复。",
    "toast.analyzed": "识别出 {count} 种食物，今天还剩 {remaining} 次。请检查克重是否合理。",
    "toast.noFood": "没有在照片里找到食物，可以换个角度重拍，或手动添加。",
    "toast.analyzeFailed": "识别失败：{error}。下面先显示示例结果，请手动修改或稍后重试。",
    "toast.saved": "已保存 {calories} kcal，可以在“热量统计”里查看。",
    "toast.saveFailed": "保存失败：{error}",
    "toast.clearFailed": "清空失败：{error}",
    "toast.close": "关闭",

    "progress.uploading": "正在上传照片...",
    "progress.recognizing": "AI 正在识别盘中的食物...",
    "progress.usda": "正在查询 USDA 营养数据...",
    "progress.slow": "比平时慢一些，请再等等...",
    "progress.seconds": "{seconds} 秒",
    "progress.typical": "通常需要 15–25 秒",
    "progress.label": "识别进度",

    "auth.title": "登录 Calorie Lens",
    "auth.close": "关闭",
    "auth.google": "使用 Google 登录",
    "auth.orEmail": "或用邮箱",
    "auth.email": "邮箱",
    "auth.sendLink": "发送登录链接",
    "auth.sending": "发送中...",
    "auth.linkSent": "登录链接已发送到 {email}。请在这个浏览器里打开邮件中的链接完成登录（也看看垃圾邮件箱）。",
    "auth.changeEmail": "换一个邮箱",

    "stats.title": "热量统计",
    "stats.back": "← 返回拍照",
    "stats.checking": "正在检查登录状态...",
    "stats.needLogin": "登录后才能查看热量统计。",
    "stats.goLogin": "回到首页登录",
    "stats.loadFailed": "读取记录失败：{error}",
    "stats.loading": "正在读取记录...",
    "stats.today": "今日热量",
    "stats.average": "7 日平均（有记录的天）",
    "stats.mealCount": "7 日记录",
    "stats.meals": "{count} 餐",
    "stats.chartTitle": "最近 7 天每日热量（kcal）",
    "stats.chartLabel": "最近 7 天每日热量柱状图",
    "stats.todayShort": "今天",
    "stats.barLabel": "{date}：{calories} kcal，{count} 餐",
    "stats.daily": "每日明细",
    "stats.empty": "最近 7 天还没有记录。拍一餐、保存后就会出现在这里。",
    "stats.listSeparator": "、",

    "footer.privacy": "隐私政策",
    "footer.terms": "服务条款"
  },
  en: {
    "app.heading": "Snap your plate, see the calories",
    "app.reset": "Reset",
    "lang.label": "Language",

    "account.checking": "Checking sign-in...",
    "account.notConfigured": "Sign-in is not configured",
    "account.stats": "Stats",
    "account.signOut": "Sign out",
    "account.signedOutHint": "Sign in to analyze photos and sync your meals.",
    "account.signIn": "Sign in",

    "camera.photoAlt": "Photo of your meal",
    "camera.foodGuide": "Food goes here",
    "camera.fistGuide": "Fist for scale",
    "camera.emptyTitle": "Fit your plate in the big frame",
    "camera.emptyHint": "Not sure about portions? Put your fist in the small frame at the bottom right.",
    "camera.open": "Open camera",
    "camera.upload": "Upload photo",
    "camera.capture": "Take photo",
    "camera.unsupported": "This browser can't open the camera. Use “Upload photo” instead.",
    "camera.denied": "Couldn't open the camera. Allow camera access in your browser settings, or use “Upload photo”.",
    "camera.imageReadFailed": "Couldn't read that image. Please try another one.",

    "summary.calories": "Calories",
    "summary.weight": "Weight",
    "summary.confidence": "Confidence",

    "status.waitingPhoto": "No photo yet",
    "status.waitingCapture": "Ready to shoot",
    "status.processing": "Processing",
    "status.waitingAnalysis": "Ready to analyze",
    "status.analyzing": "Analyzing",
    "status.busy": "Service busy",
    "status.limitReached": "Limit reached",
    "status.sample": "Sample result",
    "status.manualCalibration": "Manually adjusted",
    "status.manualEntry": "Manual entry",
    "status.saved": "Saved",
    "status.calibrated": "Recalibrated",
    "status.confidenceHigh": "High",
    "status.confidenceMedium": "Medium",
    "status.confidenceLow": "Low",

    "actions.analyze": "Analyze photo",
    "actions.analyzing": "Analyzing...",
    "actions.addFood": "Add food",
    "actions.save": "Save meal",

    "fist.title": "Fist size",
    "fist.hint": "An adult fist is about 350 ml. Adjust the slider and all portion estimates update together.",

    "foods.title": "Foods",
    "foods.emptyTitle": "No foods yet",
    "foods.emptyHint": "Analyze a photo, or add foods by hand and enter their weight.",
    "foods.customName": "Custom food",
    "food.name": "Food",
    "food.weight": "Weight",
    "food.density": "Energy density",
    "food.delete": "Delete",
    "source.usda": "USDA · {matched}",
    "source.local": "Reference value",
    "source.manual": "Edited by you",
    "source.renamed": "Renamed — check the calories",
    "source.model": "AI estimate",

    "history.title": "Recent meals",
    "history.cancel": "Cancel",
    "history.clear": "Clear",
    "history.confirmClear": "Delete all meals",
    "history.summary": "{grams}g · {count} items",
    "history.empty": "Saved meals will show up here.",
    "history.signedOutEmpty": "Sign in and your saved meals will show up here.",

    "login.needForAnalyze": "Sign in to analyze photos — 3 per day.",
    "login.needForSave": "Sign in to save meals to your account and see them on any device.",
    "login.expired": "Your session expired. Please sign in again.",

    "toast.authError": "Sign-in didn't finish. If you used the email link, open it in the same browser you started from, or use Google instead.",
    "toast.imported": "Imported {count} meals saved on this device into your account.",
    "toast.historyFailed": "Couldn't load your meals: {error}",
    "toast.needPhoto": "Take or upload a photo first.",
    "toast.aiBusy": "The AI service is busy right now. Please try again in a moment — this didn't count toward your daily limit.",
    "toast.aiQuota": "The AI service has hit its usage limit. Please try again later; if it keeps failing, it should recover tomorrow.",
    "toast.limitReached": "You've used all {limit} analyses for today.",
    "toast.limitResetAt": "Available again at {time}.",
    "toast.analyzed": "Found {count} foods. {remaining} analyses left today. Check that the weights look right.",
    "toast.noFood": "No food found in this photo. Try another angle, or add foods by hand.",
    "toast.analyzeFailed": "Analysis failed: {error}. Showing a sample result for now — edit it or try again later.",
    "toast.saved": "Saved {calories} kcal. See it in Stats.",
    "toast.saveFailed": "Couldn't save: {error}",
    "toast.clearFailed": "Couldn't clear meals: {error}",
    "toast.close": "Close",

    "progress.uploading": "Uploading photo...",
    "progress.recognizing": "AI is identifying the foods...",
    "progress.usda": "Looking up USDA nutrition data...",
    "progress.slow": "Taking longer than usual, hang tight...",
    "progress.seconds": "{seconds}s",
    "progress.typical": "Usually takes 15–25 seconds",
    "progress.label": "Analysis progress",

    "auth.title": "Sign in to Calorie Lens",
    "auth.close": "Close",
    "auth.google": "Continue with Google",
    "auth.orEmail": "or use email",
    "auth.email": "Email",
    "auth.sendLink": "Email me a sign-in link",
    "auth.sending": "Sending...",
    "auth.linkSent": "We sent a sign-in link to {email}. Open it in this browser to finish signing in (check your spam folder too).",
    "auth.changeEmail": "Use a different email",

    "stats.title": "Stats",
    "stats.back": "← Back to camera",
    "stats.checking": "Checking sign-in...",
    "stats.needLogin": "Sign in to see your stats.",
    "stats.goLogin": "Go to sign in",
    "stats.loadFailed": "Couldn't load your meals: {error}",
    "stats.loading": "Loading your meals...",
    "stats.today": "Today",
    "stats.average": "7-day average (days logged)",
    "stats.mealCount": "Last 7 days",
    "stats.meals": "{count} meals",
    "stats.chartTitle": "Daily calories, last 7 days (kcal)",
    "stats.chartLabel": "Bar chart of daily calories over the last 7 days",
    "stats.todayShort": "Today",
    "stats.barLabel": "{date}: {calories} kcal, {count} meals",
    "stats.daily": "Daily breakdown",
    "stats.empty": "Nothing logged in the last 7 days. Analyze and save a meal and it'll show up here.",
    "stats.listSeparator": ", ",

    "footer.privacy": "Privacy",
    "footer.terms": "Terms"
  }
};

function detectLang() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // 读不到 localStorage 时按浏览器语言。
  }
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function translate(lang, key, vars = {}) {
  const template = messages[lang]?.[key] ?? messages.zh[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`).toString());
}

export function localeFor(lang) {
  return lang === "en" ? "en-US" : "zh-CN";
}

export function useI18n() {
  // 首次渲染（包括服务端预渲染）先用中文，挂载后再换成用户的语言，避免水合不一致。
  const [lang, setLangState] = useState("zh");

  useEffect(() => {
    setLangState(detectLang());
    const sync = () => setLangState(detectLang());
    window.addEventListener(changeEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(changeEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }, [lang]);

  const setLang = useCallback((next) => {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // 隐私模式等情况下写不进去，只影响这一次。
    }
    setLangState(next);
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return { lang, setLang, t };
}

// 按界面语言取食物名称；该语言没有名称时退回另一种。
export function foodDisplayName(food, lang) {
  if (lang === "en") return food.nameEn || food.name || "";
  return food.name || food.nameEn || "";
}

export function LangToggle({ lang, onChange }) {
  return (
    <div className="lang-toggle" role="group" aria-label="语言 / Language">
      <button type="button" lang="zh" aria-pressed={lang === "zh"} onClick={() => onChange("zh")}>
        中文
      </button>
      <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => onChange("en")}>
        EN
      </button>
    </div>
  );
}
