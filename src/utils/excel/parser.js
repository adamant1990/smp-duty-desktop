import * as XLSX from "xlsx-js-style";
import { brigadeFromColor, cellFillColor } from "./colors";
import { parseShift } from "./shifts";
const text=v=>String(v??"").trim();
function findHeader(sheet){const range=XLSX.utils.decode_range(sheet["!ref"]||"A1:A1");for(let r=range.s.r;r<=Math.min(range.e.r,30);r++){const a=text(sheet[XLSX.utils.encode_cell({r,c:0})]?.v).toLowerCase();const b=text(sheet[XLSX.utils.encode_cell({r,c:1})]?.v).toLowerCase();if(a.includes("фио")&&(b.includes("долж")||b.includes("должность")))return r;}return -1;}
export function parseWorkbook(buffer){
 const wb=XLSX.read(buffer,{type:"array",cellStyles:true,cellNF:true,cellDates:true});
 const sheetName=wb.SheetNames.find(x=>x.toLowerCase()==="лист1")||wb.SheetNames[0];
 if(!sheetName)throw new Error("В Excel не найден лист с графиком.");
 const sheet=wb.Sheets[sheetName],headerRow=findHeader(sheet);
 if(headerRow<0)throw new Error("Не найден заголовок графика: ожидаются колонки «ФИО» и «Должность».");
 const range=XLSX.utils.decode_range(sheet["!ref"]),days=[];
 for(let c=2;c<=range.e.c;c++){const n=Number(sheet[XLSX.utils.encode_cell({r:headerRow,c})]?.v);if(Number.isInteger(n)&&n>=1&&n<=31)days.push({day:n,col:c});}
 if(!days.length)throw new Error("В графике не найдены колонки дней 1–31.");
 const rows=[];
 for(let r=headerRow+1;r<=range.e.r;r++){const name=text(sheet[XLSX.utils.encode_cell({r,c:0})]?.v),position=text(sheet[XLSX.utils.encode_cell({r,c:1})]?.v);if(!name)continue;const lp=position.toLowerCase(),role=lp.includes("фельд")?"paramedic":lp.includes("вод")?"driver":null;rows.push({name,position,role,row:r+1,cells:days.map(d=>{const cell=sheet[XLSX.utils.encode_cell({r,c:d.col})],raw=text(cell?.w??cell?.v),parsed=parseShift(raw),color=cellFillColor(cell);return{day:d.day,raw,...parsed,color,brigade:brigadeFromColor(color)};})});}
 return{sheetName,rows,days:days.map(x=>x.day)};
}
export async function readFile(file){return parseWorkbook(await file.arrayBuffer());}