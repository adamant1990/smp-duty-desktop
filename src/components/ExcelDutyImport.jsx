import React,{useEffect,useMemo,useState} from "react";
import {readFile} from "../utils/excel/parser";
import {validateDay} from "../utils/excel/validator";
import {BRIGADE_COLORS} from "../utils/excel/colors";
import {db} from "../supabaseClient";

const session=()=>{try{return JSON.parse(localStorage.getItem("smpDutyDesktopSession")||"null");}catch{return null;}};
const today=()=>new Date().toLocaleDateString("en-CA");
const monthDays=m=>{if(!m)return 31;const [y,mm]=m.split("-").map(Number);return new Date(y,mm,0).getDate();};

async function saveAssignments({date,assignments,token}){
 if(date<today())throw new Error("Нельзя создать или изменить наряд на прошедшую дату.");
 const existing=await db.duties.findByDate(date,token);
 let dutyId=existing?.[0]?.id;
 if(!dutyId)dutyId=(await db.duties.add({duty_date:date,created_by:session()?.user?.id||null},token))[0]?.id;
 if(!dutyId)throw new Error("Не удалось получить ID наряда.");
 const crews=await db.crews.list(dutyId,token);
 const map=new Map((crews||[]).map(c=>[Number(c.brigade_number),c.id]));
 const ids=[...map.values()];
 if(ids.length)await db.members.removeByCrew(ids,token);
 for(let n=1;n<=8;n++){
   let crewId=map.get(n);
   if(!crewId)crewId=(await db.crews.add({duty_id:dutyId,brigade_number:n,brigade_type:"Линейная фельдшерская"},token))[0]?.id;
   if(!crewId)throw new Error("Не удалось создать бригаду №"+n+".");
   const rows=assignments.filter(x=>x.brigade===n).map(x=>({crew_id:crewId,staff_id:x.employee.id,position:x.role,shift:x.shift,start_time:x.start_time,end_time:x.end_time}));
   if(rows.length)await db.members.addMany(rows,token);
 }
 return{updated:Boolean(existing?.length)};
}

export default function ExcelDutyImport(){
 const[open,setOpen]=useState(false),[file,setFile]=useState(null),[parsed,setParsed]=useState(null),[staff,setStaff]=useState([]),[month,setMonth]=useState(new Date().toISOString().slice(0,7)),[day,setDay]=useState(String(new Date().getDate())),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 const token=session()?.access_token,maxDay=monthDays(month);
 const validation=useMemo(()=>parsed?validateDay(parsed.rows,Number(day),staff):null,[parsed,day,staff]);
 useEffect(()=>{if(open&&token)db.staff.list(token).then(setStaff).catch(e=>setError(e.message));},[open,token]);
 useEffect(()=>{if(Number(day)>maxDay)setDay(String(maxDay));},[maxDay,day]);
 const choose=async e=>{const f=e.target.files?.[0];setError("");setParsed(null);setFile(f||null);if(f)try{setParsed(await readFile(f));}catch(x){setError(x.message||"Не удалось прочитать Excel.");}};
 const save=async()=>{if(!validation||validation.errors.length)return;const date=`${month}-${String(day).padStart(2,"0")}`;if(!validation.assignments.length){setError("На выбранную дату нет сотрудников для создания наряда.");return;}try{setSaving(true);setError("");const r=await saveAssignments({date,assignments:validation.assignments,token});window.dispatchEvent(new Event("smp-duty-refresh"));setOpen(false);window.alert(r.updated?"Наряд обновлён из Excel.":"Наряд создан из Excel.");}catch(e){setError(e.message||"Ошибка сохранения.");}finally{setSaving(false);}};
 if(!open)return <button className="secondary excel-open" onClick={()=>setOpen(true)}>Excel-график</button>;
 return <div className="excel-import"><div className="excel-import-head"><div><b>Загрузка готового графика Excel</b><span>Цвет ячейки определяет бригаду; смена читается из текста.</span></div><button className="icon-btn" onClick={()=>setOpen(false)}>×</button></div>
 <div className="excel-import-controls"><label>Файл Excel<input type="file" accept=".xlsx,.xls,.xlsm" onChange={choose}/></label><label>Месяц<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><label>День<select value={day} onChange={e=>setDay(e.target.value)}>{Array.from({length:maxDay},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label></div>
 {file&&<div className="excel-file">Файл: <b>{file.name}</b>{parsed&&<> · лист: <b>{parsed.sheetName}</b></>}</div>}
 {validation&&<><div className="excel-warnings">{validation.warnings.map((x,i)=><div key={i}>ℹ {x}</div>)}</div>{validation.errors.length>0&&<div className="warning">{validation.errors.map((x,i)=><div key={i}>⚠ {x}</div>)}</div>}<div className="excel-preview-grid">{Array.from({length:8},(_,i)=>i+1).map(n=>{const rows=validation.assignments.filter(x=>x.brigade===n);return <div className="excel-preview-crew" key={n}><div className="excel-preview-title" style={{borderLeft:`8px solid ${BRIGADE_COLORS[n]}`}}>Бригада №{n}</div>{rows.map((x,i)=><div className="excel-preview-row" key={i}><span>{x.employee.full_name}</span><small>{x.role==="paramedic"?"фельдшер":"водитель"} · {x.start_time?.slice(0,5)}–{x.end_time?.slice(0,5)}</small></div>)}</div>})}</div><div className="excel-import-actions"><button className="secondary" onClick={()=>setOpen(false)}>Отмена</button><button className="primary" disabled={saving||validation.errors.length>0} onClick={save}>{saving?"Сохранение…":"Создать / обновить наряд"}</button></div></>}
 {error&&<div className="warning">{error}</div>}</div>;
}