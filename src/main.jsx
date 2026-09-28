import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogIn, Monitor, ShieldCheck } from "lucide-react";
import "./styles.css";
import {
  profile,
  restoreSession,
  signIn,
  signOut
} from "./supabaseClient";

function Login({ onReady }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const session = await signIn(email.trim(), password);
      onReady(session);
    } catch (err) {
      setError(err?.message || "Не удалось выполнить вход.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-icon">
            <Monitor size={25} />
          </div>
          <div>
            <strong>Наряд бригад СМП</strong>
            <span>Компьютерная версия</span>
          </div>
        </div>

        <div className="login-heading">
          <h1>Вход</h1>
          <p>Используйте тот же аккаунт, что и в веб-версии.</p>
        </div>

        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="primary login-button" disabled={busy}>
            <LogIn size={18} />
            {busy ? "Выполняется вход…" : "Войти"}
          </button>
        </form>

        <div className="login-security">
          <ShieldCheck size={17} />
          <span>Авторизация выполняется через существующий Supabase.</span>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    restoreSession()
      .then((stored) => {
        if (active) setSession(stored);
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    let active = true;

    setLoadingProfile(true);
    setError("");

    profile(session.access_token)
      .then((data) => {
        if (active) setUserProfile(data);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Не удалось загрузить профиль.");
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  async function logout() {
    await signOut();
    setSession(null);
    setUserProfile(null);
  }

  if (!checked) {
    return (
      <main className="loading-page">
        <div>
          <Monitor size={28} />
          <strong>Проверка авторизации…</strong>
        </div>
      </main>
    );
  }

  if (!session) {
    return <Login onReady={setSession} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Наряд бригад СМП</h1>
          <p>Компьютерная версия · подключено к общей базе</p>
        </div>

        <button className="secondary" onClick={logout}>
          Выйти
        </button>
      </header>

      <main className="content">
        <section className="welcome-card">
          <div className="connected">
            <span />
            Supabase подключён
          </div>

          <h2>Авторизация работает</h2>

          <p>
            Вы вошли в ту же систему, которая используется веб-версией
            приложения.
          </p>

          <div className="profile-card">
            <span>Пользователь</span>
            <strong>{userProfile?.full_name || session.user?.email}</strong>
            {userProfile?.role && <small>Роль: {userProfile.role}</small>}
          </div>

          {loadingProfile && <div className="muted">Загрузка профиля…</div>}
          {error && <div className="login-error">{error}</div>}

          <div className="next-step">
            <strong>Следующий этап</strong>
            <span>
              Переносим рабочий экран «Наряд» и подключаем сотрудников,
              бригады, сохранение и архив.
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
