"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 页面内提示，代替浏览器的 alert。最多同时显示 3 条，到时间自动消失。
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const showToast = useCallback(
    (message, { tone = "info", duration } = {}) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      const ms = duration ?? (tone === "error" ? 8000 : 4000);
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), ms)
      );
    },
    [dismissToast]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  return { toasts, showToast, dismissToast };
}
