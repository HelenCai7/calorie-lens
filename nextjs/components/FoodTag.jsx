"use client";

import { useState } from "react";
import { formatCalories } from "@/lib/meal";

export default function FoodTag({ food, color, layerRef, onMove }) {
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event) {
    if (!dragging || !layerRef.current) return;
    const layerRect = layerRef.current.getBoundingClientRect();
    const tagRect = event.currentTarget.getBoundingClientRect();
    const left = ((event.clientX - layerRect.left - tagRect.width / 2) / layerRect.width) * 100;
    const top = ((event.clientY - layerRect.top - tagRect.height / 2) / layerRect.height) * 100;
    onMove({
      left: Math.min(88, Math.max(2, left)),
      top: Math.min(88, Math.max(2, top))
    });
  }

  function stopDrag() {
    setDragging(false);
  }

  return (
    <div
      className={dragging ? "food-tag is-dragging" : "food-tag"}
      style={{ left: `${food.position.left}%`, top: `${food.position.top}%`, color }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <strong>{food.name}</strong>
      <span>
        {food.grams}g · {formatCalories(food.grams, food.kcalPer100g)} kcal
      </span>
    </div>
  );
}
