const clean = value => String(value ?? "").trim().replace(/\s+/g, "").replace(/[–—−]/g, "-").toLowerCase();
const timeText = h => String(h).padStart(2, "0") + ":00";
const interval = (start,end,shift,label,raw) => ({shift,start_time:timeText(start),end_time:timeText(end),label,raw});

export function parseShift(value) {
  const raw=String(value ?? "").trim(), v=clean(raw);
  if(!v) return {shift:null,label:"Пусто",raw};
  if(/^(о|от|выходной|выходные|off)$/.test(v)) return {shift:null,off:true,label:"О",raw};
  if(/^(24|24ч|сутки|круглосуточно)$/.test(v)) return interval(8,8,"24","24 часа",raw);
  let m=v.match(/^(\d{1,2})-(\d{1,2})(?:\d{2})?$/) || v.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if(!m) return {shift:null,invalid:true,label:raw,raw};
  const start=Number(m[1]),end=Number(m[2]);
  if(start>23||end>23) return {shift:null,invalid:true,label:raw,raw};
  if(start===8&&end===8) return interval(8,8,"24","8-8 (24 часа)",raw);
  if(start===8&&end===20) return interval(8,20,"day","8-20",raw);
  if(start===20&&end===8) return interval(20,8,"night","20-8",raw);
  return interval(start,end,start<end?"day":"night",start+"-"+end,raw);
}