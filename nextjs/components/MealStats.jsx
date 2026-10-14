"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchMealsSince } from "@/lib/meals";
import { useSupabaseUser } from "@/lib/use-supabase-user";

const dayCount = 7;

function startOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function dayKey(date) {
  const day = new Date(date);
  return `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
}

function buildDays(meals) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (dayCount - 1 - index));
    return { key: dayKey(date), date, calories: 0, meals: [] };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const meal of meals) {
    const day = byKey.get(dayKey(meal.eatenAt));
    if (!day) continue;
    day.calories += meal.totalCalories;
    day.meals.push(meal);
  }
  return days;
}

// 坐标轴最大值取整到好读的刻度：500、1,000、2,000、2,500 ...
function niceMax(value) {
  if (value <= 0) return 2000;
  const step = value <= 1000 ? 250 : 500;
  return Math.ceil((value * 1.1) / step) * step;
}

const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" });
const monthDay = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" });
const clock = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" });
const number = new Intl.NumberFormat("zh-CN");

export default function MealStats() {
  const { supabase, user, ready } = useSupabaseUser();
  const [meals, setMeals] = useState(null);
  const [error, setError] = useState("");
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (!supabase || !user) return;
    const since = startOfDay(new Date());
    since.setDate(since.getDate() - (dayCount - 1));
    fetchMealsSince(supabase, since)
      .then(setMeals)
      .catch((fetchError) => setError(fetchError.message));
  }, [supabase, user]);

  if (!ready) {
    return <StatsShell>正在检查登录状态...</StatsShell>;
  }
  if (!user) {
    return (
      <StatsShell>
        <p>登录后才能查看热量统计。</p>
        <Link className="primary-button link-button" href="/">
          回到首页登录
        </Link>
      </StatsShell>
    );
  }
  if (error) return <StatsShell>读取记录失败：{error}</StatsShell>;
  if (!meals) return <StatsShell>正在读取记录...</StatsShell>;

  const days = buildDays(meals);
  const today = days[days.length - 1];
  const loggedDays = days.filter((day) => day.meals.length);
  const average = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length)
    : 0;
  const axisMax = niceMax(Math.max(...days.map((day) => day.calories)));
  const ticks = [0, axisMax / 2, axisMax];

  return (
    <StatsShell>
      <div className="summary-strip">
        <div>
          <span>今日热量</span>
          <strong>{number.format(today.calories)} kcal</strong>
        </div>
        <div>
          <span>7 日平均（有记录的天）</span>
          <strong>{number.format(average)} kcal</strong>
        </div>
        <div>
          <span>7 日记录</span>
          <strong>{meals.length} 餐</strong>
        </div>
      </div>

      <figure className="stats-chart" aria-label="最近 7 天每日热量柱状图">
        <figcaption>最近 7 天每日热量（kcal）</figcaption>
        <div className="chart-body">
          <div className="chart-axis" aria-hidden="true">
            {[...ticks].reverse().map((tick) => (
              <span key={tick}>{number.format(tick)}</span>
            ))}
          </div>
          <div className="chart-plot">
            {ticks.map((tick) => (
              <div key={tick} className="chart-gridline" style={{ bottom: `${(tick / axisMax) * 100}%` }} />
            ))}
            {days.map((day, index) => {
              const isToday = index === days.length - 1;
              const label = `${monthDay.format(day.date)} ${weekday.format(day.date)}：${number.format(day.calories)} kcal，${day.meals.length} 餐`;
              return (
                <div
                  key={day.key}
                  className={activeKey === day.key ? "chart-column is-active" : "chart-column"}
                  tabIndex={0}
                  aria-label={label}
                  onPointerEnter={() => setActiveKey(day.key)}
                  onPointerLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(day.key)}
                  onBlur={() => setActiveKey(null)}
                >
                  {isToday && day.calories > 0 && (
                    <span className="chart-direct-label" style={{ bottom: `${(day.calories / axisMax) * 100}%` }}>
                      {number.format(day.calories)}
                    </span>
                  )}
                  <div className="chart-bar" style={{ height: `${(day.calories / axisMax) * 100}%` }} />
                  {activeKey === day.key && (
                    <div
                      className={index >= days.length - 2 ? "chart-tooltip align-end" : "chart-tooltip"}
                      role="tooltip"
                      style={{ bottom: `calc(${Math.min(100, (day.calories / axisMax) * 100)}% + 8px)` }}
                    >
                      <strong>
                        {monthDay.format(day.date)} {weekday.format(day.date)}
                      </strong>
                      <span>{number.format(day.calories)} kcal</span>
                      <span>{day.meals.length} 餐</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <span aria-hidden="true" />
          <div className="chart-labels" aria-hidden="true">
            {days.map((day, index) => (
              <span key={day.key}>{index === days.length - 1 ? "今天" : weekday.format(day.date)}</span>
            ))}
          </div>
        </div>
      </figure>

      <section className="history-panel" aria-label="每日明细">
        <h2>每日明细</h2>
        {loggedDays.length ? (
          [...loggedDays].reverse().map((day) => (
            <div className="stats-day" key={day.key}>
              <div className="section-heading">
                <strong>
                  {monthDay.format(day.date)} {weekday.format(day.date)}
                </strong>
                <span>{number.format(day.calories)} kcal</span>
              </div>
              {day.meals.map((meal) => (
                <article className="history-item" key={meal.id}>
                  <div>
                    <strong>{number.format(meal.totalCalories)} kcal</strong>
                    <span>{meal.foods.map((food) => food.name).join("、") || `${meal.totalGrams}g`}</span>
                  </div>
                  <time dateTime={meal.eatenAt}>{clock.format(new Date(meal.eatenAt))}</time>
                </article>
              ))}
            </div>
          ))
        ) : (
          <p className="history-empty">最近 7 天还没有记录。拍一餐、保存后就会出现在这里。</p>
        )}
      </section>
    </StatsShell>
  );
}

function StatsShell({ children }) {
  return (
    <main className="stats-shell">
      <section className="analysis-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Calorie Lens</p>
            <h1>热量统计</h1>
          </div>
          <Link className="text-button" href="/">
            ← 返回拍照
          </Link>
        </header>
        {children}
      </section>
    </main>
  );
}
