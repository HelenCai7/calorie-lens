"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AnalyzeProgress from "./AnalyzeProgress";
import AuthPanel from "./AuthPanel";
import FoodItem from "./FoodItem";
import FoodTag from "./FoodTag";
import Toasts from "./Toasts";
import { LangToggle, localeFor, useI18n } from "@/lib/i18n";
import {
  colors,
  compressImageDataUrl,
  confidenceStatusKey,
  foodLibrary,
  mealTotals,
  mockAnalyzePlate
} from "@/lib/meal";
import { deleteAllMeals, fetchRecentMeals, formatMealTime, importLegacyHistory, insertMeal } from "@/lib/meals";
import { useSupabaseUser } from "@/lib/use-supabase-user";
import { useToasts } from "@/lib/use-toasts";

export default function CalorieLens() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const overlayRef = useRef(null);

  const { lang, setLang, t } = useI18n();
  const { supabase, user, ready: authReady } = useSupabaseUser();
  const { toasts, showToast, dismissToast } = useToasts();
  const [analyzeStartedAt, setAnalyzeStartedAt] = useState(0);
  // 登录弹窗的提示文字对应的翻译 key；"" 表示不带提示打开，null 表示关闭。
  const [authReasonKey, setAuthReasonKey] = useState(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  // 置信度区域显示的状态，存翻译 key，切换语言时跟着变。
  const [statusKey, setStatusKey] = useState("status.waitingPhoto");
  const [foods, setFoods] = useState([]);
  const [fistVolumeMl, setFistVolumeMl] = useState(350);
  const [history, setHistory] = useState([]);

  const totals = mealTotals(foods);
  const locale = localeFor(lang);

  useEffect(() => () => stopCamera(), []);

  // /auth/callback 登录失败时会带 ?authError=1 跳回来。
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("authError")) return;
    showToast(t("toast.authError"), { tone: "error" });
    url.searchParams.delete("authError");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // 只在打开页面时检查一次；t 变化（切换语言）不需要重新提示。
  }, [showToast]);

  useEffect(() => {
    if (!supabase || !user) {
      setHistory([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const imported = await importLegacyHistory(supabase, user.id);
        const meals = await fetchRecentMeals(supabase);
        if (cancelled) return;
        setHistory(meals);
        if (imported) showToast(t("toast.imported", { count: imported }), { tone: "success" });
      } catch (error) {
        if (!cancelled) showToast(t("toast.historyFailed", { error: error.message }), { tone: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // 只在登录用户变化时读取记录，切换语言不需要重新读取。
  }, [supabase, user, showToast]);

  function requireLogin(reasonKey) {
    if (user) return true;
    setAuthReasonKey(reasonKey);
    return false;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setConfirmingClear(false);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(t("camera.unsupported"), { tone: "error" });
      return;
    }

    stopCamera();
    setPhoto(null);
    setFoods([]);
    setStatusKey("status.waitingCapture");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setStatusKey("status.waitingPhoto");
      showToast(t("camera.denied"), { tone: "error" });
    }
  }

  async function applyPhoto(src) {
    stopCamera();
    setPhoto(null);
    setFoods([]);
    setProcessing(true);
    setStatusKey("status.processing");

    try {
      setPhoto(await compressImageDataUrl(src));
      setStatusKey("status.waitingAnalysis");
    } catch {
      setStatusKey("status.waitingPhoto");
      showToast(t("camera.imageReadFailed"), { tone: "error" });
    } finally {
      setProcessing(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    applyPhoto(canvas.toDataURL("image/jpeg", 0.92));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    // 清空 value，这样再次选择同一张图片也会触发 change。
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => applyPhoto(String(reader.result || "")));
    reader.readAsDataURL(file);
  }

  async function analyzePlate() {
    if (!photo) {
      showToast(t("toast.needPhoto"));
      return;
    }
    if (!requireLogin("login.needForAnalyze")) return;

    setAnalyzing(true);
    setAnalyzeStartedAt(Date.now());
    setStatusKey("status.analyzing");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: photo.src,
          fistVolumeMl
        })
      });
      const result = await response.json();

      // 登录失效、服务繁忙、次数用完都不是识别故障，直接提示，不用示例结果糊弄过去。
      if (response.status === 401) {
        setStatusKey("status.waitingAnalysis");
        setAuthReasonKey("login.expired");
        return;
      }
      if (result.code === "ai_busy") {
        setStatusKey("status.busy");
        showToast(t(result.quota ? "toast.aiQuota" : "toast.aiBusy"), { tone: "error" });
        return;
      }
      if (response.status === 429) {
        setStatusKey("status.limitReached");
        const resetAt = result.resetAt
          ? ` ${t("toast.limitResetAt", { time: formatMealTime(result.resetAt, locale) })}`
          : "";
        showToast(`${t("toast.limitReached", { limit: result.limit ?? 3 })}${resetAt}`, { tone: "error" });
        return;
      }
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      showToast(
        result.foods.length
          ? t("toast.analyzed", { count: result.foods.length, remaining: result.remaining })
          : t("toast.noFood"),
        { tone: result.foods.length ? "success" : "info", duration: 6000 }
      );
      setFoods(
        result.foods.map((food) => ({
          id: crypto.randomUUID(),
          name: food.name,
          nameEn: food.nameEn,
          kcalPer100g: food.kcalPer100g,
          grams: food.grams,
          confidence: food.confidence,
          notes: food.notes,
          nutritionSource: food.nutritionSource,
          nutritionDataType: food.nutritionDataType,
          matchedFood: food.matchedFood,
          fdcId: food.fdcId,
          position: food.position
        }))
      );
      setStatusKey(confidenceStatusKey(result.overallConfidence));
    } catch (error) {
      setFoods(mockAnalyzePlate(fistVolumeMl));
      setStatusKey("status.sample");
      showToast(t("toast.analyzeFailed", { error: error.message }), { tone: "error" });
    } finally {
      setAnalyzing(false);
    }
  }

  function updateFood(id, patch) {
    setFoods((current) => current.map((food) => (food.id === id ? { ...food, ...patch } : food)));
  }

  function deleteFood(id) {
    setFoods((current) => current.filter((food) => food.id !== id));
  }

  function addManualFood() {
    const food = foodLibrary[foodLibrary.length - 1];
    setFoods((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: food.name,
        nameEn: food.nameEn,
        kcalPer100g: food.kcalPer100g,
        nutritionSource: "manual",
        matchedFood: "",
        grams: 100,
        position: { left: 18 + ((current.length * 16) % 52), top: 24 + ((current.length * 13) % 46) }
      }
    ]);
    setStatusKey(photo ? "status.manualCalibration" : "status.manualEntry");
  }

  async function saveMeal() {
    if (!foods.length) return;
    if (!requireLogin("login.needForSave")) return;

    try {
      const meal = await insertMeal(supabase, {
        totalCalories: totals.calories,
        totalGrams: totals.grams,
        foods: foods.map((food) => ({
          name: food.name,
          ...(food.nameEn ? { nameEn: food.nameEn } : {}),
          grams: food.grams,
          kcalPer100g: food.kcalPer100g
        }))
      });
      setHistory((current) => [meal, ...current].slice(0, 8));
      setStatusKey("status.saved");
      showToast(t("toast.saved", { calories: totals.calories }), { tone: "success" });
    } catch (error) {
      showToast(t("toast.saveFailed", { error: error.message }), { tone: "error" });
    }
  }

  async function clearHistory() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    try {
      await deleteAllMeals(supabase, user.id);
      setHistory([]);
    } catch (error) {
      showToast(t("toast.clearFailed", { error: error.message }), { tone: "error" });
    } finally {
      setConfirmingClear(false);
    }
  }

  function resetApp() {
    stopCamera();
    setPhoto(null);
    setFoods([]);
    setStatusKey("status.waitingPhoto");
  }

  function handleFistVolumeChange(event) {
    const next = Number(event.target.value);
    const ratio = next / fistVolumeMl;
    setFistVolumeMl(next);

    if (foods.length) {
      setFoods((current) =>
        current.map((food) => ({ ...food, grams: Math.max(1, Math.round(food.grams * ratio)) }))
      );
      setStatusKey("status.calibrated");
    }
  }

  const showEmptyState = !cameraOn && !photo && !processing;

  return (
    <main className="app-shell">
      <section className="camera-panel" aria-label={t("app.heading")}>
        <header className="topbar">
          <div>
            <p className="eyebrow">Calorie Lens</p>
            <h1>{t("app.heading")}</h1>
          </div>
          <div className="topbar-actions">
            <LangToggle lang={lang} onChange={setLang} />
            <button className="icon-button" type="button" title={t("app.reset")} onClick={resetApp}>
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        </header>

        <div className="account-bar">
          {!authReady ? (
            <span>{t("account.checking")}</span>
          ) : !supabase ? (
            <span>{t("account.notConfigured")}</span>
          ) : user ? (
            <>
              <span className="account-email" title={user.email}>
                {user.email}
              </span>
              <Link className="text-button" href="/stats">
                {t("account.stats")}
              </Link>
              <button className="text-button" type="button" onClick={signOut}>
                {t("account.signOut")}
              </button>
            </>
          ) : (
            <>
              <span>{t("account.signedOutHint")}</span>
              <button className="text-button" type="button" onClick={() => setAuthReasonKey("")}>
                {t("account.signIn")}
              </button>
            </>
          )}
        </div>

        <div
          className={photo ? "viewfinder has-photo" : "viewfinder"}
          style={photo ? { "--photo-aspect-ratio": `${photo.width} / ${photo.height}` } : undefined}
        >
          <video
            id="camera"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ display: cameraOn ? "block" : "none" }}
          />
          {photo && <img id="photoPreview" src={photo.src} alt={t("camera.photoAlt")} style={{ display: "block" }} />}
          <div className="guide food-guide">
            <span>{t("camera.foodGuide")}</span>
          </div>
          <div className="guide fist-guide">
            <span>{t("camera.fistGuide")}</span>
          </div>
          <div className="overlay-layer" ref={overlayRef}>
            {foods.map((food, index) => (
              <FoodTag
                key={food.id}
                food={food}
                color={colors[index % colors.length]}
                lang={lang}
                layerRef={overlayRef}
                onMove={(position) => updateFood(food.id, { position })}
              />
            ))}
          </div>
          {analyzing && <AnalyzeProgress startedAt={analyzeStartedAt} t={t} />}
          {showEmptyState && (
            <div className="empty-state">
              <strong>{t("camera.emptyTitle")}</strong>
              <span>{t("camera.emptyHint")}</span>
            </div>
          )}
        </div>

        <div className="capture-actions">
          <button className="secondary-button" type="button" onClick={startCamera}>
            {t("camera.open")}
          </button>
          <label className="secondary-button file-label">
            {t("camera.upload")}
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          <button className="primary-button" type="button" disabled={!cameraOn} onClick={capturePhoto}>
            {t("camera.capture")}
          </button>
        </div>
      </section>

      <section className="analysis-panel" aria-label={t("summary.calories")}>
        <div className="summary-strip">
          <div>
            <span>{t("summary.calories")}</span>
            <strong>{totals.calories} kcal</strong>
          </div>
          <div>
            <span>{t("summary.weight")}</span>
            <strong>{totals.grams} g</strong>
          </div>
          <div>
            <span>{t("summary.confidence")}</span>
            <strong>{t(statusKey)}</strong>
          </div>
        </div>

        <div className="control-row">
          <button
            className="primary-button"
            type="button"
            disabled={!photo || analyzing}
            onClick={analyzePlate}
          >
            {analyzing ? t("actions.analyzing") : t("actions.analyze")}
          </button>
          <button className="secondary-button" type="button" onClick={addManualFood}>
            {t("actions.addFood")}
          </button>
          <button className="secondary-button" type="button" disabled={!foods.length} onClick={saveMeal}>
            {t("actions.save")}
          </button>
        </div>

        <div className="reference-card">
          <div>
            <h2>{t("fist.title")}</h2>
            <p>{t("fist.hint")}</p>
          </div>
          <label>
            <span>{fistVolumeMl} ml</span>
            <input
              type="range"
              min="250"
              max="520"
              step="10"
              value={fistVolumeMl}
              aria-label={t("fist.title")}
              onChange={handleFistVolumeChange}
            />
          </label>
        </div>

        <div className="food-list">
          {foods.length ? (
            foods.map((food, index) => (
              <FoodItem
                key={food.id}
                food={food}
                color={colors[index % colors.length]}
                lang={lang}
                t={t}
                onChange={(patch) => updateFood(food.id, patch)}
                onDelete={() => deleteFood(food.id)}
              />
            ))
          ) : (
            <div className="reference-card">
              <div>
                <h2>{t("foods.emptyTitle")}</h2>
                <p>{t("foods.emptyHint")}</p>
              </div>
            </div>
          )}
        </div>

        <section className="history-panel" aria-label={t("history.title")}>
          <div className="section-heading">
            <h2>{t("history.title")}</h2>
            {user && history.length > 0 && (
              <div className="history-actions">
                {confirmingClear && (
                  <button className="text-button" type="button" onClick={() => setConfirmingClear(false)}>
                    {t("history.cancel")}
                  </button>
                )}
                <button className="text-button danger" type="button" onClick={clearHistory}>
                  {confirmingClear ? t("history.confirmClear") : t("history.clear")}
                </button>
              </div>
            )}
          </div>
          <div className="history-list">
            {history.length ? (
              history.map((meal) => (
                <article className="history-item" key={meal.id}>
                  <div>
                    <strong>{meal.totalCalories} kcal</strong>
                    <span>{t("history.summary", { grams: meal.totalGrams, count: meal.foods.length })}</span>
                  </div>
                  <time dateTime={meal.eatenAt}>{formatMealTime(meal.eatenAt, locale)}</time>
                </article>
              ))
            ) : (
              <p className="history-empty">{user ? t("history.empty") : t("history.signedOutEmpty")}</p>
            )}
          </div>
        </section>

        <footer className="app-footer">
          <Link href="/privacy">{t("footer.privacy")}</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms">{t("footer.terms")}</Link>
        </footer>
      </section>

      {authReasonKey !== null && supabase && (
        <AuthPanel
          supabase={supabase}
          reason={authReasonKey ? t(authReasonKey) : ""}
          t={t}
          onClose={() => setAuthReasonKey(null)}
        />
      )}
      <Toasts toasts={toasts} closeLabel={t("toast.close")} onDismiss={dismissToast} />
    </main>
  );
}
