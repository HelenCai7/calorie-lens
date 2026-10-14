"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LangToggle, foodDisplayName, localeFor, useI18n } from "@/lib/i18n";
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

export default function MealStats() {
  const { lang, setLang, t } = useI18n();
  const { supabase, user, ready } = useSupabaseUser();
  const [meals, setMeals] = useState(null);
  const [error, setError] = useState("");
  const [activeKey, setActiveKey] = useState(null);

  const format = useMemo(() => {
    const locale = localeFor(lang);
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const monthDay = new Intl.DateTimeFormat(locale, { month: lang === "en" ? "short" : "numeric", day: "numeric" });
    return {
      weekday: (date) => weekday.format(date),
      day: (date) => `${monthDay.format(date)} ${weekday.format(date)}`,
      clock: (date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date),
      number: (value) => new Intl.NumberFormat(locale).format(value)
    };
  }, [lang]);

  useEffect(() => {
    if (!supabase || !user) return;
    const since = startOfDay(new Date());
    since.setDate(since.getDate() - (dayCount - 1));
    fetchMealsSince(supabase, since)
      .then(setMeals)
      .catch((fetchError) => setError(fetchError.message));
  }, [supabase, user]);

  const shell = { t, lang, setLang };

  if (!ready) {
    return <StatsShell {...shell}>{t("stats.checking")}</StatsShell>;
  }
  if (!user) {
    return (
      <StatsShell {...shell}>
        <p>{t("stats.needLogin")}</p>
        <Link className="primary-button link-button" href="/">
          {t("stats.goLogin")}
        </Link>
      </StatsShell>
    );
  }
  if (error) return <StatsShell {...shell}>{t("stats.loadFailed", { error })}</StatsShell>;
  if (!meals) return <StatsShell {...shell}>{t("stats.loading")}</StatsShell>;

  const days = buildDays(meals);
  const today = days[days.length - 1];
  const loggedDays = days.filter((day) => day.meals.length);
  const average = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, day) => sum + day.calories, 0) / loggedDays.length)
    : 0;
  const axisMax = niceMax(Math.max(...days.map((day) => day.calories)));
  const ticks = [0, axisMax / 2, axisMax];

  return (
    <StatsShell {...shell}>
      <div className="summary-strip">
        <div>
          <span>{t("stats.today")}</span>
          <strong>{format.number(today.calories)} kcal</strong>
        </div>
        <div>
          <span>{t("stats.average")}</span>
          <strong>{format.number(average)} kcal</strong>
        </div>
        <div>
          <span>{t("stats.mealCount")}</span>
          <strong>{t("stats.meals", { count: meals.length })}</strong>
        </div>
      </div>

      <figure className="stats-chart" aria-label={t("stats.chartLabel")}>
        <figcaption>{t("stats.chartTitle")}</figcaption>
        <div className="chart-body">
          <div className="chart-axis" aria-hidden="true">
            {[...ticks].reverse().map((tick) => (
              <span key={tick}>{format.number(tick)}</span>
            ))}
          </div>
          <div className="chart-plot">
            {ticks.map((tick) => (
              <div key={tick} className="chart-gridline" style={{ bottom: `${(tick / axisMax) * 100}%` }} />
            ))}
            {days.map((day, index) => {
              const isToday = index === days.length - 1;
              const label = t("stats.barLabel", {
                date: format.day(day.date),
                calories: format.number(day.calories),
                count: day.meals.length
              });
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
                      {format.number(day.calories)}
                    </span>
                  )}
                  <div className="chart-bar" style={{ height: `${(day.calories / axisMax) * 100}%` }} />
                  {activeKey === day.key && (
                    <div
                      className={index >= days.length - 2 ? "chart-tooltip align-end" : "chart-tooltip"}
                      role="tooltip"
                      style={{ bottom: `calc(${Math.min(100, (day.calories / axisMax) * 100)}% + 8px)` }}
                    >
                      <strong>{format.day(day.date)}</strong>
                      <span>{format.number(day.calories)} kcal</span>
                      <span>{t("stats.meals", { count: day.meals.length })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <span aria-hidden="true" />
          <div className="chart-labels" aria-hidden="true">
            {days.map((day, index) => (
              <span key={day.key}>{index === days.length - 1 ? t("stats.todayShort") : format.weekday(day.date)}</span>
            ))}
          </div>
        </div>
      </figure>

      <section className="history-panel" aria-label={t("stats.daily")}>
        <h2>{t("stats.daily")}</h2>
        {loggedDays.length ? (
          [...loggedDays].reverse().map((day) => (
            <div className="stats-day" key={day.key}>
              <div className="section-heading">
                <strong>{format.day(day.date)}</strong>
                <span>{format.number(day.calories)} kcal</span>
              </div>
              {day.meals.map((meal) => (
                <article className="history-item" key={meal.id}>
                  <div>
                    <strong>{format.number(meal.totalCalories)} kcal</strong>
                    <span>
                      {meal.foods.map((food) => foodDisplayName(food, lang)).join(t("stats.listSeparator")) ||
                        `${meal.totalGrams}g`}
                    </span>
                  </div>
                  <time dateTime={meal.eatenAt}>{format.clock(new Date(meal.eatenAt))}</time>
                </article>
              ))}
            </div>
          ))
        ) : (
          <p className="history-empty">{t("stats.empty")}</p>
        )}
      </section>
    </StatsShell>
  );
}

function StatsShell({ t, lang, setLang, children }) {
  return (
    <main className="stats-shell">
      <section className="analysis-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Calorie Lens</p>
            <h1>{t("stats.title")}</h1>
          </div>
          <div className="topbar-actions">
            <LangToggle lang={lang} onChange={setLang} />
          </div>
        </header>
        <Link className="text-button back-link" href="/">
          {t("stats.back")}
        </Link>
        {children}
      </section>
    </main>
  );
}
