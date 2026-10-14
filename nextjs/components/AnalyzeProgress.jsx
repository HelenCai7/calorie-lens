"use client";

import { useEffect, useState } from "react";

// 服务端不会回报进度，这里按实测耗时（通常 15–25 秒）推算阶段和进度条，
// 进度最多走到 92%，等结果真正回来才收尾，不假装已经完成。
const typicalSeconds = 22;
const stages = [
  { after: 0, key: "progress.uploading" },
  { after: 2, key: "progress.recognizing" },
  { after: 12, key: "progress.usda" },
  { after: 28, key: "progress.slow" }
];

export default function AnalyzeProgress({ startedAt, t }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, (now - startedAt) / 1000);
  const stage = [...stages].reverse().find((item) => seconds >= item.after) || stages[0];
  // 开始快、接近预计时间后放慢，最多 92%。
  const percent = Math.min(92, (1 - Math.exp(-seconds / (typicalSeconds / 2))) * 100);

  return (
    <div className="analyze-progress" role="status" aria-live="polite">
      <div className="analyze-progress-card">
        <div className="analyze-progress-head">
          <strong>{t(stage.key)}</strong>
          <span>{t("progress.seconds", { seconds: Math.floor(seconds) })}</span>
        </div>
        <div
          className="analyze-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label={t("progress.label")}
        >
          <div className="analyze-progress-bar" style={{ width: `${percent}%` }} />
        </div>
        <small>{t("progress.typical")}</small>
      </div>
    </div>
  );
}
