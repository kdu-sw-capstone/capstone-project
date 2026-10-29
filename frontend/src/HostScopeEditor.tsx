import {useState} from "react";
import {canonicalDraftHost} from "./AdditionalUi";
export type HostScope={host:string;include_subdomains:boolean};
/** Keeps scope flags intact when another row changes; exceptions never become a flat host list. */
export default function HostScopeEditor({title,rows,onChange}:{title:string;rows:HostScope[];onChange:(rows:HostScope[])=>void}) {
 const [error,setError]=useState("");
 const update=(index:number,patch:Partial<HostScope>)=>onChange(rows.map((row,n)=>n===index?{...row,...patch}:row));
 return <fieldset><legend>{title}</legend>{rows.map((row,index)=><div className="additional-inline" key={index}>
  <label>{title} 도메인 {index+1}<input required value={row.host} onChange={e=>{setError("");update(index,{host:e.target.value});}} onBlur={e=>{try{update(index,{host:canonicalDraftHost(e.target.value)});setError("");}catch{setError("도메인을 확인하세요. 잘못된 값은 저장되지 않습니다.");}}}/></label>
  <label><input type="checkbox" checked={row.include_subdomains} onChange={e=>update(index,{include_subdomains:e.target.checked})}/>{title} 하위 도메인 포함 {index+1}</label>
  <button type="button" onClick={()=>{setError("");onChange(rows.filter((_,n)=>n!==index));}}>{title} {index+1} 삭제</button>
 </div>)}{error&&<p role="alert">{error}</p>}<button type="button" disabled={rows.length>=500} onClick={()=>onChange([...rows,{host:"",include_subdomains:false}])}>{title} 추가</button></fieldset>;
}
