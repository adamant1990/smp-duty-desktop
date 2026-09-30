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
  Pencil,
  Maximize2,
  Minimize2,
  Users,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  X,
  FileText
} from "lucide-react";
import "./styles.css";
import { db, profile, restoreSession, signIn, signOut } from "./supabaseClient";
import { shiftTimes, newCrews as createNewCrews, uid as dutyUid, tomorrow as getTomorrow } from "./utils/duty";
import { cloneCrewsForForm, getAssignmentWarnings } from "./utils/dutyState";
import { saveDutyDraft, loadDutyDraft, clearDutyDraft } from "./utils/dutyDraft";
import { hasAssignmentConflict } from "./utils/shiftIntervals";
import ReportPage from "./components/ReportPage";
import ExcelDutyImport from "./components/ExcelDutyImport";

const intervalsOverlapSafe = (a,b,c,d) => hasAssignmentConflict({staff_id:"x",start_time:a,end_time:b},{staff_id:"x",start_time:c,end_time:d});

const uid = dutyUid;
const tomorrow = getTomorrow;
const newCrews = createNewCrews;

const formatDutyDate = (value) =>
  new Date(value + "T00:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });

const formatDay = (value) =>
  new Date(value + "T00:00:00").toLocaleDateString("ru-RU", { weekday: "long" });

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

function CrewCard({ crew, paramedics, drivers, onChange, viewing = false }) {
  function updateMember(type, id, patch) {
    onChange({...crew,[type]:crew[type].map(item=>item.id===id?{...item,...patch}:item)});
  }
  function addParamedic() {
    onChange({...crew,paramedics:[...crew.paramedics,{id:uid(),name:"",shift:"24",start_time:"08:00",end_time:"08:00"}]});
  }
  function removeParamedic(id) {
    onChange({...crew,paramedics:crew.paramedics.filter(item=>item.id!==id)});
  }
  function changeShift(type,id,shift) {
    const t=shiftTimes(shift);
    updateMember(type,id,{shift,start_time:t.start,end_time:t.end});
  }
  return <article className="crew">
    <div className="crew-title"><div><span>БРИГАДА</span><strong>№ {crew.id}</strong></div><span className="crew-type">Линейная фельдшерская</span></div>
    <div className="rows">
      {crew.paramedics.map((person,index)=><div className="row" key={person.id}>
        <div className="role">Фельдшер {index+1}</div>
        <SearchSelect value={person.name} list={paramedics} placeholder="Начните вводить фамилию" onChange={name=>updateMember("paramedics",person.id,{name})}/>
        <div className="shift-control">
          <select value={person.shift||"24"} disabled={viewing} onChange={e=>changeShift("paramedics",person.id,e.target.value)}>
            <option value="24">24 часа</option><option value="day">День</option><option value="night">Ночь</option><option value="other">Другое</option>
          </select>
          {person.shift==="other"&&<div className="custom-shift"><label>Начало<input type="time" value={person.start_time||"08:00"} disabled={viewing} onChange={e=>updateMember("paramedics",person.id,{shift:"other",start_time:e.target.value})}/></label><span>→</span><label>Конец<input type="time" value={person.end_time||"16:00"} disabled={viewing} onChange={e=>updateMember("paramedics",person.id,{shift:"other",end_time:e.target.value})}/></label></div>}
        </div>
        {crew.paramedics.length>1?<button className="icon-btn" disabled={viewing} title="Удалить" onClick={()=>removeParamedic(person.id)}><X size={17}/></button>:<span/>}
      </div>)}
      {crew.paramedics.length<4&&!viewing&&<button className="add" onClick={addParamedic}><Plus size={16}/> Добавить фельдшера</button>}
      {crew.drivers.map((person,index)=><div className="row driver" key={person.id}>
        <div className="role">Водитель {index===0?"день":"ночь"}</div>
        <SearchSelect value={person.name} list={drivers} placeholder="Начните вводить фамилию" onChange={name=>updateMember("drivers",person.id,{name,shift:index?"night":"day",start_time:index?"20:00":"08:00",end_time:index?"08:00":"20:00"})}/>
        <span/>
        <span/>
      </div>)}
    </div>
  </article>;
}

function ArchivePage({items,onEdit,onCopy,onPrint,onDelete,admin,canEdit,loading}) {
  const [selected,setSelected]=useState(null),[query,setQuery]=useState(""),[expandedWeeks,setExpandedWeeks]=useState(null);
  const sorted=[...items].sort((a,b)=>b.date.localeCompare(a.date));
  const q=query.trim().toLowerCase();
  const filtered=useMemo(()=>!q?sorted:sorted.filter(item=>{
    const values=[item.date,formatDutyDate(item.date),formatDay(item.date),item.dispatcher,...item.crews.flatMap(c=>[...(c.paramedics||[]),...(c.drivers||[])].map(p=>p.name))];
    return values.some(v=>String(v||"").toLowerCase().includes(q));
  }),[items,q]);
  const weeks=filtered.reduce((acc,item)=>{
    const d=new Date(item.date+"T00:00:00"),day=(d.getDay()+6)%7,m=new Date(d);
    m.setDate(d.getDate()-day);const key=m.toLocaleDateString("en-CA");
    const sun=new Date(m);sun.setDate(m.getDate()+6);
    if(!acc[key])acc[key]={key,label:`${m.toLocaleDateString("ru-RU",{day:"2-digit",month:"long"})} — ${sun.toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric"})}`,items:[]};
    acc[key].items.push(item);return acc;
  },{});
  const weekList=Object.values(weeks),latest=weekList[0]?.key;
  const openWeek=key=>expandedWeeks?expandedWeeks.has(key):key===latest;
  const toggleWeek=key=>setExpandedWeeks(prev=>{const next=new Set(prev||[latest]);next.has(key)?next.delete(key):next.add(key);return next;});
  const ordered=[...filtered].sort((a,b)=>a.date.localeCompare(b.date));
  const idx=selected?ordered.findIndex(x=>x.id===selected.id):-1;
  const move=dir=>{const n=idx+dir;if(n>=0&&n<ordered.length)setSelected(ordered[n]);};
  return <div className="archive-page">
    <div className="page-heading archive-heading"><div><h1>Наряды</h1><p>Сохранённые наряды сгруппированы по неделям.</p></div>
      <div className="archive-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по дате, диспетчеру, фельдшеру или водителю"/>{query&&<button className="icon-btn" onClick={()=>setQuery("")}>×</button>}</div>
    </div>
    {loading?<div className="empty">Загрузка архива…</div>:!items.length?<div className="empty"><Archive size={38}/><h2>Нарядов пока нет</h2><p>Сохраните первый наряд.</p></div>:!filtered.length?<div className="empty"><h2>Ничего не найдено</h2><p>Измените запрос.</p></div>:
    <div className="archive-weeks">{weekList.map(w=>{const open=openWeek(w.key);return <section className="archive-week" key={w.key}>
      <div className="archive-week-title" onClick={()=>toggleWeek(w.key)}><b>{open?"▼":"▶"} {w.label}</b><span>{w.items.length} наряд(ов)</span></div>
      {open&&<div className="archive-week-list">{w.items.map(item=><article className="archive-card" key={item.id} onClick={()=>setSelected(item)}>
        <div className="archive-main"><div className="archive-date">{formatDutyDate(item.date)}</div><div className="archive-info"><b>{formatDay(item.date)}</b><span>{item.crews.length} бригад · Составил: {item.dispatcher||"—"}</span></div></div>
        <div className="archive-actions"><button className="secondary" onClick={e=>{e.stopPropagation();setSelected(item);}}><ClipboardList size={16}/> Открыть</button>{admin&&<button className="danger" onClick={e=>{e.stopPropagation();onDelete(item.id);}} title="Удалить"><Trash2 size={17}/></button>}</div>
      </article>)}</div>}
    </section>})}</div>}
    {selected&&<div className="archive-overlay" onClick={()=>setSelected(null)}><div className="archive-preview" onClick={e=>e.stopPropagation()}>
      <div className="archive-preview-head"><div className="archive-preview-date-controls">
        <button className="icon-btn archive-nav" disabled={idx<=0} onClick={()=>move(-1)}><ChevronLeft size={20}/></button>
        <div className="archive-preview-date"><b>{formatDutyDate(selected.date)}</b><span>{formatDay(selected.date)}</span></div>
        <button className="icon-btn archive-nav" disabled={idx<0||idx>=ordered.length-1} onClick={()=>move(1)}><ChevronRight size={20}/></button>
      </div><button className="icon-btn archive-preview-close" onClick={()=>setSelected(null)}><X size={20}/></button></div>
      <div className="archive-preview-list">{selected.crews.map(crew=><div className="archive-preview-crew" key={crew.id}><div className="archive-preview-number">№ {crew.id}</div>
        <div className="archive-preview-person"><span>ФЕЛЬДШЕРЫ</span>{crew.paramedics?.length?crew.paramedics.map(p=><b key={p.id}>{p.name||"—"} <em>{p.shift}</em></b>):<b>—</b>}</div>
        <div className="archive-preview-person"><span>ВОДИТЕЛИ</span>{crew.drivers?.length?crew.drivers.map(p=><b key={p.id}>{p.name||"—"} <em>{p.shift}</em></b>):<b>—</b>}</div>
      </div>)}</div>
      <div className="archive-preview-footer"><span>Составил: {selected.dispatcher||"—"}</span><div className="archive-preview-footer-actions">
        <button className="archive-icon-action" title="Печать" onClick={()=>onPrint(selected)}><Printer size={19}/></button>
        {canEdit&&(admin||selected.date>=new Date().toLocaleDateString("en-CA"))&&<button className="archive-icon-action" title="Редактировать" onClick={()=>{onEdit(selected);setSelected(null);}}><Pencil size={19}/></button>}
        <button className="archive-icon-action" title="Копировать наряд" onClick={()=>{onCopy(selected);setSelected(null);}}><RotateCcw size={19}/></button>
      </div></div>
    </div></div>}
  </div>;
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
  const [printDuty, setPrintDuty] = useState(null);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const [draft, setDraft] = useState(null);
  const [viewingDuty, setViewingDuty] = useState(false);

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
              shift: member.shift,
              start_time: member.start_time,
              end_time: member.end_time
            })),
          drivers: members
            .filter((member) => member.crew_id === crew.id && member.position === "driver")
            .map((member) => ({
              id: uid(),
              staffId: member.staff_id,
              name: staffMap[member.staff_id] || "",
              shift: member.shift,
              start_time: member.start_time,
              end_time: member.end_time
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

  useEffect(() => {
    if (!session?.user?.id) return;
    const saved = loadDutyDraft(session.user.id);
    const hasEmployees = saved?.crews?.some(c => c.paramedics?.some(p => p.name) || c.drivers?.some(d => d.name));
    if (hasEmployees) setDraft(saved);
    else if (saved) clearDutyDraft(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || editingDutyId || viewingDuty) return;
    const hasEmployees = crews.some(c => c.paramedics.some(p => p.name) || c.drivers.some(d => d.name));
    if (!hasEmployees) return;
    const timer = window.setTimeout(() => saveDutyDraft(session.user.id, {date, dispatcher, crews}), 150);
    return () => window.clearTimeout(timer);
  }, [session?.user?.id, editingDutyId, viewingDuty, date, dispatcher, crews]);


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
    const brigadeNumbers = new Set(crews.map(c => c.id));
    if (crews.length !== 8 || brigadeNumbers.size !== 8 || [...brigadeNumbers].some(n => n < 1 || n > 8)) {
      errors.push("В наряде должны присутствовать все 8 бригад: №1–№8.");
    }
    crews.forEach(crew => {
      const paramedics = crew.paramedics.filter(p => p.name);
      const drivers = crew.drivers.filter(p => p.name);
      if (!paramedics.length) errors.push(`Бригада №${crew.id}: не указан ни один фельдшер.`);
      if (!drivers.length) warnings.push(`Бригада №${crew.id}: не указан водитель.`);
      [...crew.paramedics, ...crew.drivers].forEach(person => {
        if (!person.name) return;
        const staffId = person.staffId || staff.find(x => x.full_name === person.name)?.id;
        const times = shiftTimes(person.shift, person.start_time, person.end_time);
        const key = staffId || person.name.trim().toLowerCase();
        const previous = seen.get(key) || [];
        previous.forEach(prev => {
          if (intervalsOverlapSafe(prev.start_time, prev.end_time, times.start, times.end)) {
            errors.push(`${person.name}: пересекающаяся смена в бригадах №${prev.crewId} и №${crew.id}.`);
          }
        });
        seen.set(key, [...previous, { crewId: crew.id, start_time: times.start, end_time: times.end }]);
      });
    });
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
  }, [crews, staff]);


  function updateCrew(nextCrew) {
    setCrews((current) => current.map((crew) => crew.id === nextCrew.id ? nextCrew : crew));
  }

  function clearDuty() {
    setEditingDutyId(null);
    setViewingDuty(false);
    setDate(tomorrow());
    setDispatcher(dispatchers[0] || "");
    setCrews(newCrews());
    setMessage("");
    setError("");
    if (session?.user?.id) { clearDutyDraft(session.user.id); setDraft(null); }
  }

  const buildAssignments = () => crews.map(c => ({
    number: c.id,
    members: [
      ...c.paramedics.filter(p=>p.name).map(p=> {
        const times=shiftTimes(p.shift,p.start_time,p.end_time);
        // В архиве ID сотрудника хранится в duty_members.staff_id.
        // Сначала определяем ID по текущему ФИО, затем используем сохранённый ID.
        const staffId =
          staff.find(x=>x.role==="paramedic"&&x.full_name===p.name)?.id ||
          p.staffId ||
          p.staff_id ||
          null;
        return {staff_id:staffId,position:"paramedic",shift:p.shift,start_time:times.start,end_time:times.end};
      }),
      ...c.drivers.filter(p=>p.name).map(p=> {
        const times=shiftTimes(p.shift,p.start_time,p.end_time);
        const staffId =
          staff.find(x=>x.role==="driver"&&x.full_name===p.name)?.id ||
          p.staffId ||
          p.staff_id ||
          null;
        return {staff_id:staffId,position:"driver",shift:p.shift,start_time:times.start,end_time:times.end};
      })
    ].filter(x=>x.staff_id)
  }));

  async function saveDuty() {
    setError(""); setMessage("");
    const today = new Date().toLocaleDateString("en-CA");
    if (!editingDutyId && date < today) { setError("Нельзя создать наряд на прошедшую дату."); return; }
    if (validation.errors.length) { setError("Наряд не сохранён. Исправьте ошибки проверки: " + validation.errors.join(" ")); return; }
    try {
      const token=session.access_token;
      const existing=await db.duties.findByDate(date,token);
      const conflict=(existing||[]).find(x=>x.id!==editingDutyId);
      if(conflict){setError(`На ${formatDutyDate(date)} уже существует другой наряд. Откройте его в архиве и используйте редактирование.`);return;}
      const dispatcherId=staff.find(x=>x.role==="dispatcher"&&x.full_name===dispatcher)?.id||null;
      if(editingDutyId){
        const payload=buildAssignments();
        await db.duties.updateFull(editingDutyId,date,dispatcherId,payload,token);
        await loadArchive(token);
        clearDutyDraft(session.user.id);
        setDraft(null);
        setEditingDutyId(null);
        setViewingDuty(false);
        setMessage("Изменения наряда сохранены.");
        setTab("archive");
        return;
      }
      const duty=(await db.duties.add({duty_date:date,dispatcher_id:dispatcherId,created_by:session.user.id},token))[0];
      const newAssignments=[];
      for(const c of crews){
        const crew=(await db.crews.add({duty_id:duty.id,brigade_number:c.id,brigade_type:"Линейная фельдшерская"},token))[0];
        const rows=buildAssignments().find(x=>x.number===c.id)?.members.map(x=>({...x,crew_id:crew.id}))||[];
        await db.members.addMany(rows,token);
        rows.forEach(row=>newAssignments.push({...row,brigade_number:c.id}));
      }
      if (date === tomorrow()) {
        try {
          await db.telegram.publishDutyChanges({
            duty_id: duty.id,
            duty_date: date,
            old_members: [],
            new_members: newAssignments.map(row => ({
              staff_id: row.staff_id,
              position: row.position,
              shift: row.shift,
              start_time: row.start_time,
              end_time: row.end_time,
              brigade_number: row.brigade_number
            }))
          }, token);
        } catch (e) { console.warn("Telegram duty publish notification failed:", e); }
      }
      clearDutyDraft(session.user.id); setDraft(null);
      await loadArchive(token);
      setMessage("Наряд сохранён в общей базе Supabase.");
    } catch(err){setError(err?.message||"Не удалось сохранить наряд.");}
  }

  function editDuty(item) {
    const today = new Date().toLocaleDateString("en-CA");
    if (!canEditDuty || (!admin && item.date < today)) return;
    setEditingDutyId(item.id);
    setViewingDuty(false);
    setDate(item.date);
    setDispatcher(item.dispatcher==="—"?"":item.dispatcher);
    setCrews(cloneCrewsForForm(item.crews));
    setTab("duty");
    setError("");
    setMessage(`Наряд на ${formatDutyDate(item.date)} открыт для редактирования.`);
  }

  function copyDuty(item) {
    setEditingDutyId(null);
    setViewingDuty(false);
    setDate(tomorrow());
    setDispatcher(item.dispatcher==="—"?"":item.dispatcher);
    setCrews(cloneCrewsForForm(item.crews).map(c=>({...c,dbId:null})));
    setTab("duty");
    setError("");
    setMessage("Наряд загружен на завтрашнюю дату. Проверьте состав и сохраните.");
  }

  function printArchiveDuty(item) {
    setPrintDuty(item);
    window.setTimeout(() => window.desktopApp?.print?.(), 80);
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
            <button className={`tab ${tab === "report" ? "active" : ""}`} onClick={() => setTab("report")}>
              <FileText size={17} /> Отчёт
            </button>
          )}
          {admin && (
            <button className={`tab ${tab === "staff" ? "active" : ""}`} onClick={() => setTab("staff")}>
              <Users size={17} /> Сотрудники
            </button>
          )}
          <span className="user-name">{profileData?.full_name || session.user?.email}</span>
          <button className="tab" onClick={logout}><LogOut size={17} /> Выйти</button>
        </div>

        <div className="window-controls" aria-label="Управление окном">
          <button className="window-control" title="Свернуть" onClick={() => window.desktopApp?.minimize?.()}>
            <Minimize2 size={15} />
          </button>
          <button className="window-control" title={windowMaximized ? "Восстановить" : "Развернуть"} onClick={async () => {
            const maximized = await window.desktopApp?.toggleMaximize?.();
            setWindowMaximized(Boolean(maximized));
          }}>
            {windowMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="window-control close" title="Закрыть" onClick={() => window.desktopApp?.close?.()}>
            <X size={16} />
          </button>
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

        {tab === "report" && admin ? (
          <ReportPage items={archive} staff={staff} onPrint={() => window.desktopApp?.print?.()} />
        ) : tab === "archive" ? (
          <ArchivePage
            items={archive}
            onEdit={editDuty}
            onCopy={copyDuty}
            onPrint={printArchiveDuty}
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
                  <input type="date" value={date} min={profileData?.role==="admin"?undefined:new Date().toLocaleDateString("en-CA")} disabled={Boolean(editingDutyId||viewingDuty)} onChange={(e) => setDate(e.target.value)} />
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

            {draft && !editingDutyId && !viewingDuty && (
              <div className="draft-bar">
                <div><b>Найден несохранённый черновик наряда</b><span>Дата: {draft.date ? formatDutyDate(draft.date) : "—"}</span></div>
                <div className="draft-actions">
                  <button className="primary" onClick={()=>{setDate(draft.date||tomorrow());setDispatcher(draft.dispatcher||"");setCrews(cloneCrewsForForm(draft.crews||newCrews()));clearDutyDraft(session.user.id);setDraft(null);}}>Восстановить</button>
                  <button className="secondary" onClick={()=>{clearDutyDraft(session.user.id);setDraft(null);}}>Удалить</button>
                </div>
              </div>
            )}
            {!editingDutyId && !viewingDuty && <div className="template-bar"><ExcelDutyImport /></div>}
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
                <CrewCard key={crew.id} crew={crew} paramedics={paramedics} drivers={drivers} onChange={updateCrew} viewing={viewingDuty} />
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
        <PrintView date={date} dispatcher={dispatcher} crews={crews} />
      )}

      {printDuty && (
        <PrintView
          date={printDuty.date}
          dispatcher={printDuty.dispatcher}
          crews={printDuty.crews}
        />
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
                  {person.name ? (person.shift === "24" ? "24 ч." : person.shift === "day" ? "день" : person.shift === "night" ? "ночь" : `${person.start_time || "08:00"}–${person.end_time || "16:00"}`) : "—"}
                </div>
              ))}</td>
              <td>{crew.drivers.map((person) => <div key={person.id}>{person.name || "—"}</div>)}</td>
              <td>{crew.drivers.map((person) => (
                <div key={person.id}>
                  {person.name ? (person.shift === "day" ? "день" : person.shift === "night" ? "ночь" : `${person.start_time || "08:00"}–${person.end_time || "16:00"}`) : "—"}
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