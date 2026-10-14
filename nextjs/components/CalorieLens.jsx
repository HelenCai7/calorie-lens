"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AuthPanel from "./AuthPanel";
import FoodItem from "./FoodItem";
import FoodTag from "./FoodTag";
import {
  colors,
  compressImageDataUrl,
  confidenceLabel,
  foodLibrary,
  mealTotals,
  mockAnalyzePlate
} from "@/lib/meal";
import { deleteAllMeals, fetchRecentMeals, formatMealTime, importLegacyHistory, insertMeal } from "@/lib/meals";
import { useSupabaseUser } from "@/lib/use-supabase-user";

export default function CalorieLens() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const overlayRef = useRef(null);

  const { supabase, user, ready: authReady } = useSupabaseUser();
  const [authReason, setAuthReason] = useState(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState("等待照片");
  const [foods, setFoods] = useState([]);
  const [fistVolumeMl, setFistVolumeMl] = useState(350);
  const [history, setHistory] = useState([]);

  const totals = mealTotals(foods);

  useEffect(() => () => stopCamera(), []);

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
        if (imported) setStatus(`已导入 ${imported} 条本机记录`);
      } catch (error) {
        if (!cancelled) alert(`读取历史记录失败：${error.message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  function requireLogin(reason) {
    if (user) return true;
    setAuthReason(reason);
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
      alert("当前浏览器不支持直接调用相机，请使用上传照片。");
      return;
    }

    stopCamera();
    setPhoto(null);
    setFoods([]);
    setStatus("等待拍照");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCameraOn(true);
    } catch {
      setStatus("等待照片");
      alert("无法打开相机。请检查浏览器权限，或改用上传照片。");
    }
  }

  async function applyPhoto(src) {
    stopCamera();
    setPhoto(null);
    setFoods([]);
    setProcessing(true);
    setStatus("处理图片");

    try {
      setPhoto(await compressImageDataUrl(src));
      setStatus("等待分析");
    } catch (error) {
      setStatus("等待照片");
      alert(error.message);
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
      alert("请先拍照或上传照片。");
      return;
    }
    if (!requireLogin("登录后即可分析照片，每天 3 次。")) return;

    setAnalyzing(true);
    setStatus("识别中");

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

      // 登录失效和次数用完不是识别故障，直接提示，不用模拟结果糊弄过去。
      if (response.status === 401) {
        setStatus("等待分析");
        setAuthReason("登录已过期，请重新登录。");
        return;
      }
      if (response.status === 429) {
        const resetAt = result.resetAt ? `，${formatMealTime(result.resetAt)} 后恢复` : "";
        setStatus("次数已用完");
        alert(`${result.error}${resetAt}`);
        return;
      }
      if (!response.ok) {
        throw new Error(result.error || "图片识别失败。");
      }

      setFoods(
        result.foods.map((food) => ({
          id: crypto.randomUUID(),
          name: food.name,
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
      setStatus(confidenceLabel(result.overallConfidence));
    } catch (error) {
      setFoods(mockAnalyzePlate(fistVolumeMl));
      setStatus("模拟结果");
      alert(`${error.message}\n\n已先使用本地模拟结果。配置 GEMINI_API_KEY 后可以启用真实图片识别。`);
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
        kcalPer100g: food.kcalPer100g,
        nutritionSource: "manual",
        matchedFood: "",
        grams: 100,
        position: { left: 18 + ((current.length * 16) % 52), top: 24 + ((current.length * 13) % 46) }
      }
    ]);
    setStatus(photo ? "手动校准" : "手动输入");
  }

  async function saveMeal() {
    if (!foods.length) return;
    if (!requireLogin("登录后保存的记录会同步到你的账号，换手机也能看到。")) return;

    try {
      const meal = await insertMeal(supabase, {
        totalCalories: totals.calories,
        totalGrams: totals.grams,
        foods: foods.map((food) => ({
          name: food.name,
          grams: food.grams,
          kcalPer100g: food.kcalPer100g
        }))
      });
      setHistory((current) => [meal, ...current].slice(0, 8));
      setStatus("已保存");
    } catch (error) {
      alert(`保存失败：${error.message}`);
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
      alert(`清空失败：${error.message}`);
    } finally {
      setConfirmingClear(false);
    }
  }

  function resetApp() {
    stopCamera();
    setPhoto(null);
    setFoods([]);
    setStatus("等待照片");
  }

  function handleFistVolumeChange(event) {
    const next = Number(event.target.value);
    const ratio = next / fistVolumeMl;
    setFistVolumeMl(next);

    if (foods.length) {
      setFoods((current) =>
        current.map((food) => ({ ...food, grams: Math.max(1, Math.round(food.grams * ratio)) }))
      );
      setStatus("已校准");
    }
  }

  const showEmptyState = !cameraOn && !photo && !processing;

  return (
    <main className="app-shell">
      <section className="camera-panel" aria-label="拍照估算卡路里">
        <header className="topbar">
          <div>
            <p className="eyebrow">Calorie Lens</p>
            <h1>拍一下，估算这一盘</h1>
          </div>
          <button className="icon-button" type="button" title="重置" onClick={resetApp}>
            <span aria-hidden="true">↻</span>
          </button>
        </header>

        <div className="account-bar">
          {!authReady ? (
            <span>正在检查登录状态...</span>
          ) : !supabase ? (
            <span>登录功能未配置</span>
          ) : user ? (
            <>
              <span className="account-email" title={user.email}>
                {user.email}
              </span>
              <Link className="text-button" href="/stats">
                热量统计
              </Link>
              <button className="text-button" type="button" onClick={signOut}>
                退出
              </button>
            </>
          ) : (
            <>
              <span>登录后可分析照片，记录会同步到云端。</span>
              <button className="text-button" type="button" onClick={() => setAuthReason("")}>
                登录
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
          {photo && <img id="photoPreview" src={photo.src} alt="已拍摄的食物照片" style={{ display: "block" }} />}
          <div className="guide food-guide">
            <span>食物放这里</span>
          </div>
          <div className="guide fist-guide">
            <span>拳头参照</span>
          </div>
          <div className="overlay-layer" ref={overlayRef}>
            {foods.map((food, index) => (
              <FoodTag
                key={food.id}
                food={food}
                color={colors[index % colors.length]}
                layerRef={overlayRef}
                onMove={(position) => updateFood(food.id, { position })}
              />
            ))}
          </div>
          {showEmptyState && (
            <div className="empty-state">
              <strong>把盘子放进大框</strong>
              <span>如果份量不确定，把拳头放在右下角小框里。</span>
            </div>
          )}
        </div>

        <div className="capture-actions">
          <button className="secondary-button" type="button" onClick={startCamera}>
            打开相机
          </button>
          <label className="secondary-button file-label">
            上传照片
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          <button className="primary-button" type="button" disabled={!cameraOn} onClick={capturePhoto}>
            拍照
          </button>
        </div>
      </section>

      <section className="analysis-panel" aria-label="卡路里估算结果">
        <div className="summary-strip">
          <div>
            <span>总热量</span>
            <strong>{totals.calories} kcal</strong>
          </div>
          <div>
            <span>总重量</span>
            <strong>{totals.grams} g</strong>
          </div>
          <div>
            <span>置信度</span>
            <strong>{status}</strong>
          </div>
        </div>

        <div className="control-row">
          <button
            className="primary-button"
            type="button"
            disabled={!photo || analyzing}
            onClick={analyzePlate}
          >
            {analyzing ? "识别中..." : "分析照片"}
          </button>
          <button className="secondary-button" type="button" onClick={addManualFood}>
            添加食物
          </button>
          <button className="secondary-button" type="button" disabled={!foods.length} onClick={saveMeal}>
            保存记录
          </button>
        </div>

        <div className="reference-card">
          <div>
            <h2>拳头参照</h2>
            <p>默认成人拳头约 350 ml。拖动滑块校准后，所有体积估算会一起更新。</p>
          </div>
          <label>
            <span>{fistVolumeMl} ml</span>
            <input
              type="range"
              min="250"
              max="520"
              step="10"
              value={fistVolumeMl}
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
                onChange={(patch) => updateFood(food.id, patch)}
                onDelete={() => deleteFood(food.id)}
              />
            ))
          ) : (
            <div className="reference-card">
              <div>
                <h2>还没有食物条目</h2>
                <p>拍照后点击分析，或手动添加食物并输入重量。</p>
              </div>
            </div>
          )}
        </div>

        <section className="history-panel" aria-label="历史记录">
          <div className="section-heading">
            <h2>最近记录</h2>
            {user && history.length > 0 && (
              <div className="history-actions">
                {confirmingClear && (
                  <button className="text-button" type="button" onClick={() => setConfirmingClear(false)}>
                    取消
                  </button>
                )}
                <button className="text-button danger" type="button" onClick={clearHistory}>
                  {confirmingClear ? "确认删除全部记录" : "清空"}
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
                    <span>
                      {meal.totalGrams}g · {meal.foods.length} 项
                    </span>
                  </div>
                  <time dateTime={meal.eatenAt}>{formatMealTime(meal.eatenAt)}</time>
                </article>
              ))
            ) : (
              <p className="history-empty">
                {user ? "保存后会显示最近的用餐记录。" : "登录后，保存的用餐记录会显示在这里。"}
              </p>
            )}
          </div>
        </section>
      </section>

      {authReason !== null && supabase && (
        <AuthPanel supabase={supabase} reason={authReason} onClose={() => setAuthReason(null)} />
      )}
    </main>
  );
}
