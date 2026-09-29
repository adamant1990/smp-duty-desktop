import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogIn,
  LogOut,
  Monitor,
  Plus,
  Users,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  X
} from "lucide-react";
import "./styles.css";
import { db, profile, restoreSession, signIn, signOut } from "./supabaseClient";

const uid = () => crypto.randomUUID();

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

const formatDutyDate = (value) =>
  new Date(value + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

const formatDay = (value) =>
  new Date(value + "T00:00:00").toLocaleDateString("ru-RU", {
    weekday: "long"
  });

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
            <input type="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          </label>

          <label>
            Пароль
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" />
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
      ? list.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
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
            <button type="button" key={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(name);
                onChange(name);
                setOpen(false);
              }}>
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
      paramedics: [...crew.paramedics, { id: uid(), name: "", shift: "24" }]
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
            <SearchSelect value={person.name} list={paramedics}
              placeholder="Начните вводить фамилию"
              onChange={(name) => updateMember("paramedics", person.id, { name })} />
            <select value={person.shift}
              onChange={(e) => updateMember("paramedics", person.id, { shift: e.target.value })}>
              <option value="24">24 часа</option>
              <option value="day">День</option>
              <option value="night">Ночь</option>
            </select>
            {crew.paramedics.length > 1
              ? <button className="icon-btn" title="Удалить" onClick={() => removeParamedic(person.id)}><X size={17} /></button>
              : <span />}
          </div>
        ))}

        {crew.paramedics.length < 4 && (
          <button className="add" onClick={addParamedic}><Plus size={16} /> Добавить фельдшера</button>
        )}

        {crew.drivers.map((person, index) => (
          <div className="row driver" key={person.id}>
            <div className="role">Водитель {index === 0 ? "день" : "ночь"}</div>
            <SearchSelect value={person.name} list={drivers}
              placeholder="Начните вводить фамилию"
              onChange={(name) => updateMember("drivers", person.id, { name })} />
            <select value={person.shift}
              onChange={(e) => updateMember("drivers", person.id, { shift: e.target.value })}>
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

function ArchivePage({ items, onEdit, onCopy, onDelete, admin, canEdit, loading }) {
  const [selected, setSelected] = useState(null);

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const ordered = [...items].sort((a, b) => a.date.localeCompare(b.date));

  const selectedIndex = selected
    ? ordered.findIndex((item) => item.id === selected.id)
    : -1;

  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < ordered.length - 1;

  function changeSelected(direction) {
    if (selectedIndex < 0) return;

    const nextIndex = selectedIndex + direction;

    if (nextIndex >= 0 && nextIndex < ordered.length) {
      setSelected(ordered[nextIndex]);
    }
  }

  const weeks = sorted.reduce((acc, item) => {
    const d = new Date(item.date + "T00:00:00");
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const key = monday.toISOString().slice(0, 10);

    if (!acc[key]) {
      acc[key] = {
        key,
        label:
          monday.toLocaleDateString("ru-RU", { day: "2-digit", month: "long" }) +
          " — " +
          sunday.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" }),
        items: []
      };
    }

    acc[key].items.push(item);
    return acc;
  }, {});

  const weekList = Object.values(weeks);

  return (
    <div className="archive-page">
      <div className="page-heading">
        <h1>Наряды</h1>
        <p>Сохранённые наряды из общей базы.</p>
      </div>

      {loading ? (
        <div className="empty">Загрузка архива…</div>
      ) : !items.length ? (
        <div className="empty">
          <Archive size={38} />
          <h2>Нарядов пока нет</h2>
          <p>Сохраните первый наряд.</p>
        </div>
      ) : (
        <div className="archive-weeks">
          {weekList.map((week) => (
            <section className="archive-week" key={week.key}>
              <div className="archive-week-title">
                <b>▼ {week.label}</b>
                <span>{week.items.length} {week.items.length === 1 ? "наряд" : "наряда"}</span>
              </div>

              <div className="archive-week-list">
                {week.items.map((item) => (
                  <article className="archive-card" key={item.id}
                    onClick={() => setSelected(item)}>
                    <div className="archive-main">
                      <div className="archive-date">{formatDutyDate(item.date)}</div>
                      <div className="archive-info">
                        <b>{formatDay(item.date)}</b>
                        <span>{item.crews.length} бригад · Составил: {item.dispatcher || "—"}</span>
                      </div>
                    </div>

                    <div className="archive-actions">
                      <button className="secondary" onClick={(e) => {
                        e.stopPropagation();
                        setSelected(item);
                      }}>
                        <ClipboardList size={16} /> Открыть
                      </button>

                      {canEdit && (
                        <button className="secondary" onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}>
                          <Pencil size={16} /> Редактировать
                        </button>
                      )}

                      <button className="secondary" onClick={(e) => {
                        e.stopPropagation();
                        onCopy(item);
                      }}>
                        <RotateCcw size={16} /> Копировать
                      </button>

                      {admin && (
                        <button className="danger" title="Удалить" onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}>
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <div className="archive-overlay" onClick={() => setSelected(null)}>
          <div className="archive-preview" onClick={(e) => e.stopPropagation()}>
            <div className="archive-preview-head">
              <div className="archive-preview-date-controls">
                <button
                  className="icon-btn archive-nav"
                  disabled={!hasPrev}
                  onClick={() => changeSelected(-1)}
                  title="Предыдущий наряд"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="archive-preview-date">
                  <b>{formatDutyDate(selected.date)}</b>
                  <span>{formatDay(selected.date)}</span>
                </div>

                <button
                  className="icon-btn archive-nav"
                  disabled={!hasNext}
                  onClick={() => changeSelected(1)}
                  title="Следующий наряд"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <button className="icon-btn archive-preview-close" onClick={() => setSelected(null)} title="Закрыть">
                <X size={20} />
              </button>
            </div>

            <div className="archive-preview-list">
              {selected.crews.map((crew) => (
                <div className="archive-preview-crew" key={crew.id}>
                  <div className="archive-preview-number">№ {crew.id}</div>

                  <div className="archive-preview-person">
                    <span>ФЕЛЬДШЕРЫ</span>
                    {crew.paramedics.length
                      ? crew.paramedics.map((person) => (
                        <b key={person.id}>{person.name || "—"} <em>{person.shift}</em></b>
                      ))
                      : <b>—</b>}
                  </div>

                  <div className="archive-preview-person">
                    <span>ВОДИТЕЛИ</span>
                    {crew.drivers.length
                      ? crew.drivers.map((person) => (
                        <b key={person.id}>{person.name || "—"} <em>{person.shift}</em></b>
                      ))
                      : <b>—</b>}
                  </div>
                </div>
              ))}
            </div>

            <div className="archive-preview-footer">
              <span>Составил: {selected.dispatcher || "—"}</span>
              <div className="archive-preview-footer-actions">
                {canEdit && (
                  <button className="secondary" onClick={() => {
                    onEdit(selected);
                    setSelected(null);
                  }}>
                    <Pencil size={17} /> Редактировать
                  </button>
                )}
                <button className="primary" onClick={() => {
                  onCopy(selected);
                  setSelected(null);
                }}>
                  <RotateCcw size={17} /> Копировать наряд
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffBlock({ title, role, staff, telegramMap, onAdd, onEdit, onDeactivate, onLinkTelegram, onUnlinkTelegram, admin }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");

  const list = staff.filter((person) => person.role === role);

  return (
    <section className="staff-block">
      <div className="staff-block-head">
        <div><span>СПРАВОЧНИК</span><h2>{title}</h2></div>
        <span className="staff-count">{list.length}</span>
      </div>

      <div className="staff-list">
        {list.map((person) => {
          const tg = telegramMap[person.id];
          const editing = editingId === person.id;

          return (
            <div className="staff-item" key={person.id}>
              <div className="staff-line">
                {editing ? (
                  <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
                ) : (
                  <input value={person.full_name} readOnly />
                )}

                {admin && (
                  editing ? (
                    <>
                      <button className="staff-small primary" title="Сохранить" onClick={async () => {
                        if (draft.trim()) {
                          await onEdit(person, draft.trim());
                          setEditingId(null);
                        }
                      }}>✓</button>
                      <button className="staff-small" title="Отмена" onClick={() => setEditingId(null)}>×</button>
                    </>
                  ) : (
                    <button className="staff-small" title="Редактировать" onClick={() => {
                      setEditingId(person.id);
                      setDraft(person.full_name);
                    }}>✎</button>
                  )
                )}

                <button className="icon-btn staff-remove" disabled={!admin}
                  title={admin ? "Деактивировать сотрудника" : "Только администратор"}
                  onClick={() => onDeactivate(person)}>
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="staff-telegram">
                {tg ? (
                  <>
                    <span className="telegram-linked">Telegram: @{tg.telegram_username || tg.telegram_user_id}</span>
                    {admin && <button className="link-button" onClick={() => onUnlinkTelegram(person)}>Отвязать</button>}
                  </>
                ) : (
                  admin && <button className="link-button" onClick={() => onLinkTelegram(person)}>Привязать Telegram</button>
                )}
              </div>
            </div>
          );
        })}

        {!list.length && <div className="staff-empty">Сотрудников нет.</div>}
      </div>

      {admin && (adding ? (
        <div className="staff-add-form">
          <input autoFocus value={addDraft} placeholder="ФИО сотрудника"
            onChange={(e) => setAddDraft(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && addDraft.trim()) {
                await onAdd(role, addDraft.trim());
                setAddDraft("");
                setAdding(false);
              }
              if (e.key === "Escape") {
                setAddDraft("");
                setAdding(false);
              }
            }} />
          <button className="primary staff-small" disabled={!addDraft.trim()} onClick={async () => {
            await onAdd(role, addDraft.trim());
            setAddDraft("");
            setAdding(false);
          }}>✓</button>
          <button className="staff-small" onClick={() => { setAddDraft(""); setAdding(false); }}>×</button>
        </div>
      ) : (
        <button className="add staff-add" onClick={() => setAdding(true)}><Plus size={16} /> Добавить</button>
      ))}
    </section>
  );
}

function StaffPage({ staff, admin, telegramMap, onAdd, onEdit, onDeactivate, onLinkTelegram, onUnlinkTelegram }) {
  return (
    <div className="staff-page">
      <div className="page-heading">
        <h1>Сотрудники</h1>
        <p>{admin ? "Управление активным составом и привязкой Telegram." : "Просмотр активного состава."}</p>
      </div>

      {!admin && <div className="info">Изменять список сотрудников и привязывать Telegram может только администратор.</div>}

      <div className="staff-grid">
        <StaffBlock title="Фельдшеры" role="paramedic" staff={staff} telegramMap={telegramMap} onAdd={onAdd} onEdit={onEdit} onDeactivate={onDeactivate} onLinkTelegram={onLinkTelegram} onUnlinkTelegram={onUnlinkTelegram} admin={admin} />
        <StaffBlock title="Водители" role="driver" staff={staff} telegramMap={telegramMap} onAdd={onAdd} onEdit={onEdit} onDeactivate={onDeactivate} onLinkTelegram={onLinkTelegram} onUnlinkTelegram={onUnlinkTelegram} admin={admin} />
        <StaffBlock title="Диспетчеры" role="dispatcher" staff={staff} telegramMap={telegramMap} onAdd={onAdd} onEdit={onEdit} onDeactivate={onDeactivate} onLinkTelegram={onLinkTelegram} onUnlinkTelegram={onUnlinkTelegram} admin={admin} />
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [staff, setStaff] = useState([]);
  const [archive, setArchive] = useState([]);
  const [tab, setTab] = useState("duty");
  const [loading, setLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(tomorrow());
  const [dispatcher, setDispatcher] = useState("");
  const [crews, setCrews] = useState(newCrews);
  const [editingDutyId, setEditingDutyId] = useState(null);
  const [telegramAccounts, setTelegramAccounts] = useState([]);
  const [telegramLink, setTelegramLink] = useState(null);

  useEffect(() => {
    if (!message) return undefined;

    const timer = window.setTimeout(() => {
      setMessage("");
      setTelegramLink(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    restoreSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecked(true));
  }, []);

  const loadArchive = async (token = session?.access_token) => {
    if (!token) return;

    setArchiveLoading(true);

    try {
      const [duties, st] = await Promise.all([
        db.duties.list(token),
        staff.length ? Promise.resolve(staff) : db.staff.list(token)
      ]);

      const crewGroups = await Promise.all(
        (duties || []).map((duty) => db.crews.list(duty.id, token))
      );

      const allCrews = crewGroups.flat();
      const members = await db.members.list(allCrews.map((crew) => crew.id), token);
      const staffMap = Object.fromEntries((st || []).map((person) => [person.id, person.full_name]));

      const items = (duties || []).map((duty, index) => ({
        id: duty.id,
        date: duty.duty_date,
        dispatcherId: duty.dispatcher_id,
        dispatcher: staffMap[duty.dispatcher_id] || "—",
        savedAt: duty.created_at,
        crews: (crewGroups[index] || []).map((crew) => ({
          id: crew.brigade_number,
          dbId: crew.id,
          paramedics: members
            .filter((member) => member.crew_id === crew.id && member.position === "paramedic")
            .map((member) => ({
              id: uid(),
              staffId: member.staff_id,
              name: staffMap[member.staff_id] || "Сотрудник неактивен",
              shift: member.shift
            })),
          drivers: members
            .filter((member) => member.crew_id === crew.id && member.position === "driver")
            .map((member) => ({
              id: uid(),
              staffId: member.staff_id,
              name: staffMap[member.staff_id] || "",
              shift: member.shift
            }))
        }))
      }));

      setArchive(items);
    } catch (err) {
      setError(err?.message || "Не удалось загрузить архив.");
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token) return;

    let active = true;

    async function loadBase() {
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
        if (p?.role === "admin") {
          try {
            setTelegramAccounts(await db.telegram.list(session.access_token));
          } catch (telegramError) {
            setTelegramAccounts([]);
            setError(telegramError?.message || "Не удалось загрузить привязки Telegram.");
          }
        }
        setDispatcher((current) =>
          current ||
          (st || []).find((item) => item.role === "dispatcher")?.full_name ||
          ""
        );

        await loadArchive(session.access_token);
      } catch (err) {
        if (active) setError(err?.message || "Не удалось загрузить данные.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBase();

    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (session?.access_token && tab === "archive") {
      loadArchive(session.access_token);
    }
  }, [tab]);

  const paramedics = staff.filter((item) => item.role === "paramedic").map((item) => item.full_name);
  const drivers = staff.filter((item) => item.role === "driver").map((item) => item.full_name);
  const dispatchers = staff.filter((item) => item.role === "dispatcher").map((item) => item.full_name);
  const admin = profileData?.role === "admin";
  const canEditDuty = admin || profileData?.role === "dispatcher";
  const telegramMap = useMemo(
    () => Object.fromEntries(telegramAccounts.filter((item) => item.is_active).map((item) => [item.staff_id, item])),
    [telegramAccounts]
  );

  async function deactivateStaff(person) {
    if (!window.confirm(`Деактивировать сотрудника «${person.full_name}»?`)) return;

    setError("");
    try {
      await db.staff.update(person.id, { active: false }, session.access_token);
      await refreshStaff();
      setMessage(`Сотрудник «${person.full_name}» деактивирован.`);
    } catch (err) {
      setError(err?.message || "Не удалось деактивировать сотрудника.");
    }
  }

  async function refreshStaff() {
    const list = await db.staff.list(session.access_token);
    setStaff(list || []);
    if (admin) {
      try {
        setTelegramAccounts(await db.telegram.list(session.access_token));
      } catch (telegramError) {
        setTelegramAccounts([]);
        throw telegramError;
      }
    }
    setDispatcher((current) => current || (list || []).find((item) => item.role === "dispatcher")?.full_name || "");
  }

  async function addStaff(role, name) {
    if (!name?.trim()) return;
    setError("");
    try {
      await db.staff.add({ full_name: name.trim(), role, active: true }, session.access_token);
      await refreshStaff();
      setMessage("Сотрудник добавлен.");
    } catch (err) { setError(err?.message || "Не удалось добавить сотрудника."); }
  }

  async function editStaff(person, name) {
    try {
      await db.staff.update(person.id, { full_name: name }, session.access_token);
      await refreshStaff();
      setMessage("Данные сотрудника изменены.");
    } catch (err) { setError(err?.message || "Не удалось изменить сотрудника."); }
  }

  async function linkTelegram(person) {
    setError("");
    setTelegramLink(null);
    try {
      const result = await db.telegram.createLinkCode(person.id, session.access_token);
      if (!result?.bot_link) {
        throw new Error("Supabase не вернул ссылку привязки Telegram.");
      }
      setTelegramLink(result.bot_link);
      setMessage(`Ссылка привязки Telegram для ${person.full_name} создана. Она действительна 10 минут.`);
    } catch (err) {
      setError(err?.message || "Не удалось создать ссылку привязки Telegram.");
    }
  }

  async function unlinkTelegram(person) {
    if (!window.confirm(`Отвязать Telegram у ${person.full_name}?`)) return;
    try {
      await db.telegram.unlink(person.id, session.access_token);
      await refreshStaff();
      setMessage("Telegram отвязан.");
    } catch (err) { setError(err?.message || "Не удалось отвязать Telegram."); }
  }

  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];
    const seen = new Map();
    const brigadeNumbers = new Set(crews.map((crew) => crew.id));

    if (crews.length !== 8 || brigadeNumbers.size !== 8 || [...brigadeNumbers].some((number) => number < 1 || number > 8)) {
      errors.push("В наряде должны присутствовать все 8 бригад: №1–№8.");
    }

    crews.forEach((crew) => {
      const paramedics = crew.paramedics.filter((person) => person.name);
      const drivers = crew.drivers.filter((person) => person.name);

      if (!paramedics.length) {
        errors.push(`Бригада №${crew.id}: не указан ни один фельдшер.`);
      }

      if (!drivers.length) {
        warnings.push(`Бригада №${crew.id}: не указан водитель.`);
      }

      [...crew.paramedics, ...crew.drivers].forEach((person) => {
        if (!person.name) return;

        const key = person.staffId || person.name.trim().toLowerCase();
        const previous = seen.get(key);

        if (previous) {
          if (previous.crewId === crew.id) {
            errors.push(`${person.name}: сотрудник назначен более одного раза в бригаде №${crew.id}.`);
          } else {
            errors.push(`${person.name}: назначен в бригадах №${previous.crewId} и №${crew.id}.`);
          }
          return;
        }

        seen.set(key, { crewId: crew.id });
      });
    });

    return {
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)]
    };
  }, [crews]);

  const warnings = validation.errors;

  function updateCrew(nextCrew) {
    setCrews((current) => current.map((crew) => crew.id === nextCrew.id ? nextCrew : crew));
  }

  function clearDuty() {
    setEditingDutyId(null);
    setDate(tomorrow());
    setDispatcher(dispatchers[0] || "");
    setCrews(newCrews());
    setMessage("");
    setError("");
  }

  async function saveDuty() {
    setError("");
    setMessage("");

    if (validation.errors.length > 0) {
      setError(
        `Наряд не сохранён. Исправьте ошибки проверки: ${validation.errors.join(" ")}`
      );
      return;
    }

    try {
      const token = session.access_token;

      if (!date) {
        setError("Наряд не сохранён: укажите дату.");
        return;
      }

      const existing = await db.duties.findByDate(date, token);
      const conflictingDuty = (existing || []).find((item) => item.id !== editingDutyId);

      if (conflictingDuty) {
        setError(
          `На ${formatDutyDate(date)} уже существует другой наряд. Выберите другую дату или откройте этот наряд из архива.`
        );
        return;
      }

      const dispatcherId = staff.find(
        (item) => item.role === "dispatcher" && item.full_name === dispatcher
      )?.id || null;

      if (editingDutyId) {
        await db.duties.update(editingDutyId, {
          duty_date: date,
          dispatcher_id: dispatcherId
        }, token);

        for (const crewData of crews) {
          let crewId = crewData.dbId;

          if (crewId) {
            await db.crews.update(crewId, {
              brigade_number: crewData.id,
              brigade_type: "Линейная фельдшерская"
            }, token);
          } else {
            const created = (await db.crews.add({
              duty_id: editingDutyId,
              brigade_number: crewData.id,
              brigade_type: "Линейная фельдшерская"
            }, token))[0];
            crewId = created.id;
          }

          await db.members.removeByCrew(crewId, token);

          const members = [
            ...crewData.paramedics.filter((item) => item.name).map((item) => ({
              crew_id: crewId,
              staff_id: item.staffId || staff.find((person) => person.role === "paramedic" && person.full_name === item.name)?.id,
              position: "paramedic",
              shift: item.shift
            })),
            ...crewData.drivers.filter((item) => item.name).map((item) => ({
              crew_id: crewId,
              staff_id: item.staffId || staff.find((person) => person.role === "driver" && person.full_name === item.name)?.id,
              position: "driver",
              shift: item.shift
            }))
          ].filter((item) => item.staff_id);

          await db.members.addMany(members, token);
        }

        await loadArchive(token);
        setMessage(`Наряд на ${formatDutyDate(date)} изменён и сохранён.`);
        setEditingDutyId(null);
        return;
      }

      const duty = (await db.duties.add({
        duty_date: date,
        dispatcher_id: dispatcherId,
        created_by: session.user.id
      }, token))[0];

      for (const crewData of crews) {
        const crew = (await db.crews.add({
          duty_id: duty.id,
          brigade_number: crewData.id,
          brigade_type: "Линейная фельдшерская"
        }, token))[0];

        const members = [
          ...crewData.paramedics.filter((item) => item.name).map((item) => ({
            crew_id: crew.id,
            staff_id: item.staffId || staff.find((person) => person.role === "paramedic" && person.full_name === item.name)?.id,
            position: "paramedic",
            shift: item.shift
          })),
          ...crewData.drivers.filter((item) => item.name).map((item) => ({
            crew_id: crew.id,
            staff_id: item.staffId || staff.find((person) => person.role === "driver" && person.full_name === item.name)?.id,
            position: "driver",
            shift: item.shift
          }))
        ].filter((item) => item.staff_id);

        await db.members.addMany(members, token);
      }

      await loadArchive(token);
      setMessage("Наряд сохранён в общей базе Supabase.");
    } catch (err) {
      setError(err?.message || "Не удалось сохранить наряд.");
    }
  }

  function editDuty(item) {
    setEditingDutyId(item.id);
    setDate(item.date);
    setDispatcher(item.dispatcher === "—" ? "" : item.dispatcher);
    setCrews(item.crews.map((crew) => ({
      ...crew,
      paramedics: crew.paramedics.map((person) => ({ ...person, id: uid() })),
      drivers: crew.drivers.map((person) => ({ ...person, id: uid() }))
    })));
    setTab("duty");
    setError("");
    setMessage(`Наряд на ${formatDutyDate(item.date)} открыт для редактирования.`);
  }

  function copyDuty(item) {
    setEditingDutyId(null);
    setDate(tomorrow());
    setDispatcher(item.dispatcher === "—" ? "" : item.dispatcher);
    setCrews(item.crews.map((crew) => ({
      ...crew,
      dbId: null,
      paramedics: crew.paramedics.map((person) => ({ ...person, id: uid() })),
      drivers: crew.drivers.map((person) => ({ ...person, id: uid() }))
    })));
    setTab("duty");
    setError("");
    setMessage("Наряд загружен на завтрашнюю дату. Проверьте состав и сохраните.");
  }

  async function deleteDuty(id) {
    if (!window.confirm("Удалить этот наряд из архива?")) return;

    setError("");
    try {
      await db.duties.remove(id, session.access_token);
      setArchive((items) => items.filter((item) => item.id !== id));
      setMessage("Наряд удалён из архива.");
    } catch (err) {
      setError(err?.message || "Не удалось удалить наряд.");
    }
  }

  async function logout() {
    await signOut();
    setSession(null);
    setProfileData(null);
    setStaff([]);
    setArchive([]);
  }

  if (!checked) {
    return <main className="loading-page"><div><Monitor size={28} /><strong>Проверка авторизации…</strong></div></main>;
  }

  if (!session) return <Login onReady={setSession} />;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">СМП</div>
          <div><b>Наряд бригад</b><span>компьютерная версия · общая база</span></div>
        </div>

        <div className="top-actions">
          <button className={`tab ${tab === "duty" ? "active" : ""}`} onClick={() => setTab("duty")}>
            <ClipboardList size={17} /> Наряд
          </button>
          <button className={`tab ${tab === "archive" ? "active" : ""}`} onClick={() => setTab("archive")}>
            <Archive size={17} /> Архив
          </button>
          {admin && (
            <button className={`tab ${tab === "staff" ? "active" : ""}`} onClick={() => setTab("staff")}>
              <Users size={17} /> Сотрудники
            </button>
          )}
          <span className="user-name">{profileData?.full_name || session.user?.email}</span>
          <button className="tab" onClick={logout}><LogOut size={17} /> Выйти</button>
        </div>
      </header>

      <main className="page">
        {loading && <div className="info">Загрузка сотрудников и архива из общей базы…</div>}
        {error && <div className="warning">{error}</div>}
        {message && (
          <div className="success-message">
            <div>{message}</div>
            {telegramLink && (
              <div className="telegram-link-actions">
                <a href={telegramLink} target="_blank" rel="noreferrer">{telegramLink}</a>
                <button
                  className="link-button telegram-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(telegramLink);
                      setMessage("Ссылка привязки Telegram скопирована в буфер обмена.");
                    } catch {
                      setError("Не удалось скопировать ссылку. Скопируйте её вручную.");
                    }
                  }}
                >
                  Копировать
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "archive" ? (
          <ArchivePage
            items={archive}
            onEdit={editDuty}
            onCopy={copyDuty}
            onDelete={deleteDuty}
            admin={admin}
            canEdit={canEditDuty}
            loading={archiveLoading}
          />
        ) : tab === "staff" ? (
          <StaffPage
            staff={staff}
            admin={admin}
            telegramMap={telegramMap}
            onAdd={addStaff}
            onEdit={editStaff}
            onDeactivate={deactivateStaff}
            onLinkTelegram={linkTelegram}
            onUnlinkTelegram={unlinkTelegram}
          />
        ) : (
          <>
            <section className="hero">
              <div>
                <h1>{editingDutyId ? "Редактирование наряда" : "Новый наряд"}</h1>
                <p>{editingDutyId
                  ? `Измените состав наряда на ${formatDutyDate(date)} и сохраните изменения.`
                  : "Заполните состав 8 линейных фельдшерских бригад."}</p>
              </div>

              <div className="header-fields">
                <label>
                  Дата наряда
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>

                <label>
                  Наряд составил
                  <select value={dispatcher} onChange={(e) => setDispatcher(e.target.value)}>
                    <option value="">— выберите —</option>
                    {dispatchers.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
              </div>
            </section>

            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div className="warning">
                <b>Проверка наряда</b>
                {validation.errors.map((item) => <div key={`error-${item}`}>Ошибка: {item}</div>)}
                {validation.warnings.map((item) => <div key={`warning-${item}`}>Предупреждение: {item}</div>)}
              </div>
            )}

            {!staff.length && !loading && (
              <div className="warning">В общей базе пока нет активных сотрудников.</div>
            )}

            <section className="grid">
              {crews.map((crew) => (
                <CrewCard key={crew.id} crew={crew} paramedics={paramedics} drivers={drivers} onChange={updateCrew} />
              ))}
            </section>

            <div className="bottom">
              <button className="secondary" onClick={clearDuty}>
                {editingDutyId ? "Отменить редактирование" : "Новый чистый наряд"}
              </button>
              <div className="actions">
                <button className="secondary" onClick={() => window.desktopApp?.print?.()}>
                  <Printer size={18} /> Печать
                </button>
                <button className="primary action-button" onClick={saveDuty} disabled={loading}>
                  <Save size={18} /> {editingDutyId ? "Сохранить изменения" : "Сохранить в архив"}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {tab === "duty" && (
        <>
          <PrintView
            date={date}
            dispatcher={dispatcher}
            crews={crews}
          />

        </>
      )}
    </>
  );
}

function PrintView({ date, dispatcher, crews }) {
  return (
    <div className="print">
      <h1>НАРЯД БРИГАД СКОРОЙ МЕДИЦИНСКОЙ ПОМОЩИ</h1>
      <div className="print-meta">
        <span>Дата: <b>{formatDutyDate(date)}</b></span>
        <span>Наряд составил: <b>{dispatcher || "—"}</b></span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Бригада</th>
            <th>Фельдшеры</th>
            <th>Режим</th>
            <th>Водители</th>
            <th>Режим</th>
          </tr>
        </thead>
        <tbody>
          {crews.map((crew) => (
            <tr key={crew.id}>
              <td>{crew.id}</td>
              <td>{crew.paramedics.map((person) => <div key={person.id}>{person.name || "—"}</div>)}</td>
              <td>{crew.paramedics.map((person) => (
                <div key={person.id}>
                  {person.name ? (person.shift === "24" ? "24 ч." : person.shift === "day" ? "день" : "ночь") : "—"}
                </div>
              ))}</td>
              <td>{crew.drivers.map((person) => <div key={person.id}>{person.name || "—"}</div>)}</td>
              <td>{crew.drivers.map((person) => (
                <div key={person.id}>
                  {person.name ? (person.shift === "day" ? "день" : "ночь") : "—"}
                </div>
              ))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
