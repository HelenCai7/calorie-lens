"use client";

import { useState } from "react";

// 邮箱登录目前用 Supabase 默认的“登录链接”邮件：免费版在没有配置自定义 SMTP 时不能修改邮件模板，
// 所以发不了验证码。链接要在发起登录的同一个浏览器里打开（PKCE 校验依赖这个浏览器里的 cookie）。
// 配置自定义 SMTP 后，可以把模板改成 {{ .Token }}，再换回验证码登录。
export default function AuthPanel({ supabase, reason, onClose }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendLink(event) {
    event.preventDefault();
    const address = email.trim();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    setSentTo(address);
  }

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
    }
  }

  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label="登录">
      <div className="auth-card">
        <div className="section-heading">
          <h2>登录 Calorie Lens</h2>
          <button className="icon-button" type="button" title="关闭" onClick={onClose}>
            ×
          </button>
        </div>
        {reason && <p className="auth-reason">{reason}</p>}

        {sentTo ? (
          <div className="auth-form">
            <p className="auth-message">
              登录链接已发送到 {sentTo}。请在<strong>这个浏览器</strong>里打开邮件中的链接完成登录（也看看垃圾邮件箱）。
            </p>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSentTo("");
                setMessage("");
              }}
            >
              换一个邮箱
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={sendLink}>
            <button className="primary-button" type="button" disabled={busy} onClick={signInWithGoogle}>
              使用 Google 登录
            </button>
            <div className="auth-divider">
              <span>或用邮箱</span>
            </div>
            <label>
              邮箱
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <button className="secondary-button" type="submit" disabled={busy}>
              {busy ? "发送中..." : "发送登录链接"}
            </button>
          </form>
        )}

        {message && <p className="auth-message">{message}</p>}
      </div>
    </div>
  );
}
