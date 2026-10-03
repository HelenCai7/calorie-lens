"use client";

import { useEffect, useState } from "react";
import { formatCalories, nutritionSourceLabel } from "@/lib/meal";

function toPositive(value) {
  return Math.max(1, Number(value) || 1);
}

// 输入框保留用户正在输入的原始文字（例如清空后重新输入），
// 只有外部改动数值（例如拖动拳头滑块）时才同步回来。
function useNumberDraft(value) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft((current) => (toPositive(current) === value ? current : String(value)));
  }, [value]);
  return [draft, setDraft];
}

export default function FoodItem({ food, color, onChange, onDelete }) {
  const [gramsDraft, setGramsDraft] = useNumberDraft(food.grams);
  const [kcalDraft, setKcalDraft] = useNumberDraft(food.kcalPer100g);
  const sourceLabel = nutritionSourceLabel(food);

  return (
    <article className="food-item">
      <div className="food-marker" style={{ background: color }} />
      <div className="food-main">
        <label>
          食物
          <input
            className="food-name-input"
            type="text"
            autoComplete="off"
            value={food.name}
            onChange={(event) =>
              onChange({ name: event.target.value, nutritionSource: "renamed", matchedFood: "", fdcId: null })
            }
          />
          <small className="nutrition-source" title={food.matchedFood || sourceLabel}>
            {sourceLabel}
          </small>
        </label>
        <label>
          估计重量
          <div className="number-field">
            <input
              className="grams-input"
              type="number"
              min="1"
              step="1"
              value={gramsDraft}
              onChange={(event) => {
                setGramsDraft(event.target.value);
                onChange({ grams: toPositive(event.target.value) });
              }}
            />
            <span>g</span>
          </div>
        </label>
        <label>
          热量密度
          <div className="number-field">
            <input
              className="kcal-input"
              type="number"
              min="1"
              step="1"
              value={kcalDraft}
              onChange={(event) => {
                setKcalDraft(event.target.value);
                onChange({ kcalPer100g: toPositive(event.target.value), nutritionSource: "manual" });
              }}
            />
            <span>kcal/100g</span>
          </div>
        </label>
      </div>
      <div className="food-meta">
        <strong className="calories-output">{formatCalories(food.grams, food.kcalPer100g)} kcal</strong>
        <span className="density-output">{food.kcalPer100g} kcal/100g</span>
        <button className="icon-button delete-food" type="button" title="删除" onClick={onDelete}>
          ×
        </button>
      </div>
    </article>
  );
}
