import React,{useMemo,useState} from "react";
import {FileText,Printer,ChevronDown,ChevronRight,CalendarDays} from "lucide-react";

const pad=n=>String(n).padStart(2,"0");
const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>localDate(new Date());
const monthStart=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`;};
const monthEnd=()=>{const d=new Date();const x=new Date(d.getFullYear(),d.getMonth()+1,0);return localDate(x);};
const weekStart=()=>{const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return localDate(d);};
const weekEnd=()=>{const d=new Date();const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day+6);return localDate(d);};
const formatDate=date=>new Date(date+"T00:00:00").toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"});
const minutes=value=>{if(!value)return null;const [h,m]=String(value).slice(0,5).split(":").map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const interval=(date,start,end)=>{const s=minutes(start),e=minutes(end);if(s==null||e==null)return null;let ee=e;if(ee<=s)ee+=1440;const base=new Date(date+"T00:00:00").getTime();return{start:base+s*60000,end:base+ee*60000};};
const duration=x=>x?Math.max(0,Math.round((x.end-x.start)/60000)):0;
const overlap=(a,b)=>!a||!b?0:Math.max(0,Math.round((Math.min(a.end,b.end)-Math.max(a.start,b.start))/60000));
const hours=m=>{const h=Math.floor(m/60),mm=m%60;return mm?`${h} ч ${mm} мин`:`${h} ч`;};

function build(items,staff,from,to){
 const names=new Set((staff||[]).filter(x=>x.role==="paramedic"&&x.active!==false).map(x=>x.full_name));
 (items||[]).forEach(d=>(d.crews||[]).forEach(c=>(c.paramedics||[]).forEach(p=>{if(p.name)names.add(p.name);})));
 const rows=new Map([...names].map(name=>[name,{name,shifts:0,totalMinutes:0,soloMinutes:0,withPartnerMinutes:0,details:[]}]));
 (items||[]).filter(d=>d.date>=from&&d.date<=to).forEach(d=>(d.crews||[]).forEach(c=>{
   const ps=(c.paramedics||[]).filter(p=>p.name&&p.start_time&&p.end_time);
   const ints=ps.map(p=>({p,i:interval(d.date,p.start_time,p.end_time)})).filter(x=>x.i);
   ints.forEach(({p,i})=>{const r=rows.get(p.name)||{name:p.name,shifts:0,totalMinutes:0,soloMinutes:0,withPartnerMinutes:0,details:[]};const total=duration(i);let covered=0;ints.forEach(o=>{if(o.p!==p)covered+=overlap(i,o.i);});const solo=Math.max(0,total-covered);r.shifts++;r.totalMinutes+=total;r.soloMinutes+=solo;r.withPartnerMinutes+=total-solo;r.details.push({date:d.date,brigade:c.id,start:p.start_time,end:p.end_time,totalMinutes:total,soloMinutes:solo,withPartnerMinutes:total-solo});rows.set(p.name,r);});
 }));
 return [...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,"ru"));
}
export default function ReportPage({items,staff,onPrint}){
 const[period,setPeriod]=useState("month"),[from,setFrom]=useState(monthStart()),[to,setTo]=useState(monthEnd()),[expanded,setExpanded]=useState(new Set()),[sortBy,setSortBy]=useState("name"),[dir,setDir]=useState("asc");
 const apply=p=>{setPeriod(p);if(p==="today"){setFrom(today());setTo(today());}if(p==="week"){setFrom(weekStart());setTo(weekEnd());}if(p==="month"){setFrom(monthStart());setTo(monthEnd());}};
 const rows=useMemo(()=>build(items,staff,from,to),[items,staff,from,to]);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>{let x=sortBy==="name"?a.name.localeCompare(b.name,"ru"):sortBy==="shifts"?a.shifts-b.shifts:sortBy==="total"?a.totalMinutes-b.totalMinutes:sortBy==="solo"?a.soloMinutes-b.soloMinutes:a.withPartnerMinutes-b.withPartnerMinutes;return dir==="asc"?x:-x;}),[rows,sortBy,dir]);
 const totals=rows.reduce((a,r)=>({shifts:a.shifts+r.shifts,total:a.total+r.totalMinutes,solo:a.solo+r.soloMinutes,withPartner:a.withPartner+r.withPartnerMinutes}),{shifts:0,total:0,solo:0,withPartner:0});
 const sort=k=>{if(sortBy===k)setDir(x=>x==="asc"?"desc":"asc");else{setSortBy(k);setDir(k==="name"?"asc":"desc");}};
 const mark=k=>sortBy===k?(dir==="asc"?" ↑":" ↓"):"";
 const toggle=n=>setExpanded(s=>{const x=new Set(s);x.has(n)?x.delete(n):x.add(n);return x;});
 return <div className="report-page">
  <div className="page-heading"><div><h1>Отчёт</h1><p>Работа фельдшеров и время без второго фельдшера.</p></div></div>
  <div className="report-controls">
   <div className="report-presets"><button className={period==="today"?"active":""} onClick={()=>apply("today")}>Сегодня</button><button className={period==="week"?"active":""} onClick={()=>apply("week")}>Неделя</button><button className={period==="month"?"active":""} onClick={()=>apply("month")}>Месяц</button><button className={period==="custom"?"active":""} onClick={()=>setPeriod("custom")}>Произвольный период</button></div>
   <div className="report-dates"><label>С<input type="date" value={from} onChange={e=>{setPeriod("custom");setFrom(e.target.value);}}/></label><span>→</span><label>По<input type="date" value={to} onChange={e=>{setPeriod("custom");setTo(e.target.value);}}/></label><button className="secondary" onClick={()=>onPrint?.()}><Printer size={16}/>Печать отчёта</button></div>
  </div>
  {from>to?<div className="empty"><CalendarDays size={38}/><h2>Некорректный период</h2><p>Дата начала не может быть позже даты окончания.</p></div>:!rows.length?<div className="empty"><FileText size={38}/><h2>Нет данных</h2><p>В выбранном периоде нет назначенных фельдшеров.</p></div>:<div className="report-table-wrap"><table className="report-table"><thead><tr><th>№</th><th onClick={()=>sort("name")}>Фельдшер{mark("name")}</th><th onClick={()=>sort("shifts")}>Смен{mark("shifts")}</th><th onClick={()=>sort("total")}>Всего{mark("total")}</th><th onClick={()=>sort("solo")}>Без напарника{mark("solo")}</th><th onClick={()=>sort("withPartner")}>С напарником{mark("withPartner")}</th></tr></thead><tbody>{sorted.map((r,i)=>{const open=expanded.has(r.name);return <React.Fragment key={r.name}><tr><td>{i+1}</td><td><button className="report-expand" onClick={()=>toggle(r.name)}>{open?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button><b>{r.name}</b></td><td>{r.shifts}</td><td>{hours(r.totalMinutes)}</td><td>{hours(r.soloMinutes)}</td><td>{hours(r.withPartnerMinutes)}</td></tr>{open&&<tr><td colSpan="6"><div className="report-details"><table><thead><tr><th>Дата</th><th>Бригада</th><th>Время</th><th>Всего</th><th>Без напарника</th><th>С напарником</th></tr></thead><tbody>{r.details.map((d,j)=><tr key={j}><td>{formatDate(d.date)}</td><td>№ {d.brigade}</td><td>{d.start?.slice(0,5)}–{d.end?.slice(0,5)}</td><td>{hours(d.totalMinutes)}</td><td>{hours(d.soloMinutes)}</td><td>{hours(d.withPartnerMinutes)}</td></tr>)}</tbody></table></div></td></tr>}</React.Fragment>})}<tr className="report-total"><td></td><td>ИТОГО</td><td>{totals.shifts}</td><td>{hours(totals.total)}</td><td>{hours(totals.solo)}</td><td>{hours(totals.withPartner)}</td></tr></tbody></table></div>}
 </div>;
}