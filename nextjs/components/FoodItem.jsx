"use client";

import { useEffect, useState } from "react";
import { foodDisplayName } from "@/lib/i18n";
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

export default function FoodItem({ food, color, lang, t, onChange, onDelete }) {
  const [gramsDraft, setGramsDraft] = useNumberDraft(food.grams);
  const [kcalDraft, setKcalDraft] = useNumberDraft(food.kcalPer100g);
  const sourceLabel = nutritionSourceLabel(food, t);

  return (
    <article className="food-item">
      <div className="food-marker" style={{ background: color }} />
      <div className="food-main">
        <label>
          {t("food.name")}
          <input
            className="food-name-input"
            type="text"
            autoComplete="off"
            value={foodDisplayName(food, lang)}
            onChange={(event) =>
              // 只改当前语言的名称；另一种语言的旧名称已经对不上了，清空后会自动显示这个新名称。
              onChange({
                ...(lang === "en" ? { nameEn: event.target.value, name: "" } : { name: event.target.value, nameEn: "" }),
                nutritionSource: "renamed",
                matchedFood: "",
                fdcId: null
              })
            }
          />
          <small className="nutrition-source" title={food.matchedFood || sourceLabel}>
            {sourceLabel}
          </small>
        </label>
        <label>
          {t("food.weight")}
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
          {t("food.density")}
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
        <button className="icon-button delete-food" type="button" title={t("food.delete")} onClick={onDelete}>
          ×
        </button>
      </div>
    </article>
  );
}
