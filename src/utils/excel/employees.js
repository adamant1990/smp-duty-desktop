export const normalizeName=value=>String(value??"").toLowerCase().replace(/ё/g,"е").replace(/[.,;:]+/g," ").replace(/\s+/g," ").trim();
export const roleMatches=(employee,role)=>!employee||!role||employee.role===role;
export const matchStaff=(name,role,staff)=>{
 const key=normalizeName(name);
 const matches=(staff||[]).filter(x=>x.active!==false&&normalizeName(x.full_name)===key);
 if(!matches.length)return null;
 return (role&&matches.find(x=>roleMatches(x,role)))||matches[0];
};