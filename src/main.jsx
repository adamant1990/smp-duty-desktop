import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Наряд бригад СМП</h1>
          <p>Компьютерная версия</p>
        </div>
        <div className="status">
          <span className="status-dot" />
          Desktop
        </div>
      </header>

      <main className="content">
        <section className="welcome-card">
          <h2>Проект создан</h2>
          <p>
            Это отдельное приложение для Windows. Существующий
            <strong> smp-duty</strong> не изменён.
          </p>

          <div className="next-step">
            <strong>Следующий этап</strong>
            <span>
              Подключаем авторизацию и существующий Supabase, затем переносим
              рабочий экран наряда.
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
