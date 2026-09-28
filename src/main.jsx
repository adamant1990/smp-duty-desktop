import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogIn, Monitor, Plus, Save, LogOut, X } from "lucide-react";
import "./styles.css";
import {
  db,
  profile,
  restoreSession,
  signIn,
  signOut
} from "./supabaseClient";

const uid = () => crypto.randomUUID();

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const newCrew = (number) => ({
  id: number,
  paramedics: [{ id: uid(), name: "", shift: "24" }],
  drivers: [
    { id: uid(), name: "", shift: "day" },
    { id: uid(), name: "", shift: "night" }
  ]
});

const newCrews = () => Array.from({ length: 8 }, (_, i) => newCrew(i + 1));

function Login({ onReady }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      onReady(await signIn(email.trim(), password));
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
          <div className="login-icon"><Monitor size={25} /></div>
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
              onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
            />
          </label>

          {error && <div className="warning">{error}</div>}

          <button className="primary login-button" disabled={busy}>
            <LogIn size={18} />
            {busy ? "Выполняется вход…" : "Войти"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SearchSelect({ value, list, placeholder, onChange }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(value), [value]);

  const options = useMemo(
    () => (query
      ? list.filter((name) =>
          name.toLowerCase().includes(query.toLowerCase())
        )
      : list
    ).slice(0, 8),
    [query, list]
  );

  return (
    <div className="search-select">
      <input
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />

      {open && options.length > 0 && (
        <div className="suggestions">
          {options.map((name) => (
            <button
              type="button"
              key={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(name);
                onChange(name);
                setOpen(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CrewCard({ crew, paramedics, drivers, onChange }) {
  function updateMember(type, id, patch) {
    onChange({
      ...crew,
      [type]: crew[type].map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    });
  }

  function addParamedic() {
    onChange({
      ...crew,
      paramedics: [
        ...crew.paramedics,
        { id: uid(), name: "", shift: "24" }
      ]
    });
  }

  function removeParamedic(id) {
    onChange({
      ...crew,
      paramedics: crew.paramedics.filter((item) => item.id !== id)
    });
  }

  return (
    <article className="crew">
      <div className="crew-title">
        <div>
          <span>БРИГАДА</span>
          <strong>№ {crew.id}</strong>
        </div>
        <span className="crew-type">Линейная фельдшерская</span>
      </div>

      <div className="rows">
        {crew.paramedics.map((person, index) => (
          <div className="row" key={person.id}>
            <div className="role">Фельдшер {index + 1}</div>

            <SearchSelect
              value={person.name}
              list={paramedics}
              placeholder="Начните вводить фамилию"
              onChange={(name) =>
                updateMember("paramedics", person.id, { name })
              }
            />

            <select
              value={person.shift}
              onChange={(e) =>
                updateMember("paramedics", person.id, {
                  shift: e.target.value
                })
              }
            >
              <option value="24">24 часа</option>
              <option value="day">День</option>
              <option value="night">Ночь</option>
            </select>

            {crew.paramedics.length > 1 ? (
              <button
                className="icon-btn"
                title="Удалить"
                onClick={() => removeParamedic(person.id)}
              >
                <X size={17} />
              </button>
            ) : <span />}
          </div>
        ))}

        {crew.paramedics.length < 4 && (
          <button className="add" onClick={addParamedic}>
            <Plus size={16} />
            Добавить фельдшера
          </button>
        )}

        {crew.drivers.map((person, index) => (
          <div className="row driver" key={person.id}>
            <div className="role">
              Водитель {index === 0 ? "день" : "ночь"}
            </div>

            <SearchSelect
              value={person.name}
              list={drivers}
              placeholder="Начните вводить фамилию"
              onChange={(name) =>
                updateMember("drivers", person.id, { name })
              }
            />

            <select
              value={person.shift}
              onChange={(e) =>
                updateMember("drivers", person.id, {
                  shift: e.target.value
                })
              }
            >
              <option value="day">День</option>
              <option value="night">Ночь</option>
            </select>

            <span />
          </div>
        ))}
      </div>
    </article>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(tomorrow());
  const [dispatcher, setDispatcher] = useState("");
  const [crews, setCrews] = useState(newCrews);

  useEffect(() => {
    restoreSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [p, st] = await Promise.all([
          profile(session.access_token),
          db.staff.list(session.access_token)
        ]);

        if (!active) return;

        setProfileData(p);
        setStaff(st || []);

        const firstDispatcher =
          (st || []).find((item) => item.role === "dispatcher")?.full_name || "";

        setDispatcher((current) => current || firstDispatcher);
      } catch (err) {
        if (active) setError(err?.message || "Не удалось загрузить данные.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [session]);

  const paramedics = staff
    .filter((item) => item.role === "paramedic")
    .map((item) => item.full_name);

  const drivers = staff
    .filter((item) => item.role === "driver")
    .map((item) => item.full_name);

  const dispatchers = staff
    .filter((item) => item.role === "dispatcher")
    .map((item) => item.full_name);

  const warnings = useMemo(() => {
    const seen = new Map();
    const result = [];

    crews.forEach((crew) => {
      [...crew.paramedics, ...crew.drivers].forEach((person) => {
        if (!person.name) return;

        if (seen.has(person.name)) {
          result.push(
            person.name + ": бригады №" +
            seen.get(person.name) + " и №" + crew.id
          );
        } else {
          seen.set(person.name, crew.id);
        }
      });
    });

    return [...new Set(result)];
  }, [crews]);

  function updateCrew(nextCrew) {
    setCrews((current) =>
      current.map((crew) =>
        crew.id === nextCrew.id ? nextCrew : crew
      )
    );
  }

  function clearDuty() {
    setDate(tomorrow());
    setDispatcher(dispatchers[0] || "");
    setCrews(newCrews());
    setMessage("");
    setError("");
  }

  async function saveDuty() {
    setError("");
    setMessage("");

    try {
      const token = session.access_token;
      const dispatcherId =
        staff.find(
          (item) =>
            item.role === "dispatcher" &&
            item.full_name === dispatcher
        )?.id || null;

      const duty = (
        await db.duties.add(
          {
            duty_date: date,
            dispatcher_id: dispatcherId,
            created_by: session.user.id
          },
          token
        )
      )[0];

      for (const crewData of crews) {
        const crew = (
          await db.crews.add(
            {
              duty_id: duty.id,
              brigade_number: crewData.id,
              brigade_type: "Линейная фельдшерская"
            },
            token
          )
        )[0];

        const members = [
          ...crewData.paramedics
            .filter((item) => item.name)
            .map((item) => ({
              crew_id: crew.id,
              staff_id: staff.find(
                (person) =>
                  person.role === "paramedic" &&
                  person.full_name === item.name
              )?.id,
              position: "paramedic",
              shift: item.shift
            })),
          ...crewData.drivers
            .filter((item) => item.name)
            .map((item) => ({
              crew_id: crew.id,
              staff_id: staff.find(
                (person) =>
                  person.role === "driver" &&
                  person.full_name === item.name
              )?.id,
              position: "driver",
              shift: item.shift
            }))
        ].filter((item) => item.staff_id);

        await db.members.addMany(members, token);
      }

      setMessage("Наряд сохранён в общей базе Supabase.");
    } catch (err) {
      setError(err?.message || "Не удалось сохранить наряд.");
    }
  }

  async function logout() {
    await signOut();
    setSession(null);
    setProfileData(null);
    setStaff([]);
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

  if (!session) return <Login onReady={setSession} />;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">СМП</div>
          <div>
            <b>Наряд бригад</b>
            <span>компьютерная версия · общая база</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="user-name">
            {profileData?.full_name || session.user?.email}
          </span>
          <button className="tab" onClick={logout}>
            <LogOut size={17} />
            Выйти
          </button>
        </div>
      </header>

      <main className="page">
        {loading && (
          <div className="info">Загрузка сотрудников из общей базы…</div>
        )}

        {error && <div className="warning">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <section className="hero">
          <div>
            <h1>Новый наряд</h1>
            <p>Заполните состав 8 линейных фельдшерских бригад.</p>
          </div>

          <div className="header-fields">
            <label>
              Дата наряда
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label>
              Наряд составил
              <select
                value={dispatcher}
                onChange={(e) => setDispatcher(e.target.value)}
              >
                <option value="">— выберите —</option>
                {dispatchers.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {warnings.length > 0 && (
          <div className="warning">
            <b>Проверьте назначения</b>
            {warnings.map((item) => <div key={item}>⚠ {item}</div>)}
          </div>
        )}

        {!staff.length && !loading && (
          <div className="warning">
            В общей базе пока нет активных сотрудников.
          </div>
        )}

        <section className="grid">
          {crews.map((crew) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              paramedics={paramedics}
              drivers={drivers}
              onChange={updateCrew}
            />
          ))}
        </section>

        <div className="bottom">
          <button className="secondary" onClick={clearDuty}>
            Новый чистый наряд
          </button>

          <button className="primary action-button" onClick={saveDuty}>
            <Save size={18} />
            Сохранить в архив
          </button>
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
