import {useEffect, useState, type ReactNode} from "react";
import {allPages, type PolicySite} from "./FocusShared";
import {message} from "./api";
import "./additional-mvp.css";

// UI-only draft utilities. These are neither a public API DTO nor a Wire contract.
export function DraftNotice(){return <p className="additional-note" role="note">설정 편집 초안입니다. 서버 저장·브라우저 적용은 아직 연결되지 않았습니다. 페이지를 나가면 초안은 사라집니다. 현재 저장된 정책은 변경하지 않습니다.</p>;}
export function DraftActions({dirty,onCancel}:{dirty:boolean;onCancel:()=>void}){
  return <div className="additional-actions"><button type="button" className="additional-primary" disabled title="공통 계약 합의 후 저장 연결">설정 저장 · 연동 대기</button><button type="button" disabled={!dirty} onClick={onCancel}>초안 취소</button></div>;
}
export function Toggle({title,description,checked,onChange}:{title:string;description?:string;checked:boolean;onChange:(v:boolean)=>void}){
  return <div className="additional-toggle-row"><div><strong>{title}</strong>{description&&<p>{description}</p>}</div><button type="button" role="switch" className="additional-switch" aria-label={title} aria-checked={checked} onClick={()=>onChange(!checked)}><span aria-hidden="true"/></button></div>;
}
export function Panel({title,children,node}:{title:string;children:ReactNode;node?:string}){return <section className="additional-panel" aria-label={title} data-figma-node={node}><h4>{title}</h4>{children}</section>;}
export function usePolicySites(){
  const [sites,setSites]=useState<PolicySite[]|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useEffect(()=>{let disposed=false;setError("");setSites(null);void allPages<PolicySite>("/sites").then(rows=>{if(!disposed)setSites(rows);}).catch(e=>{if(!disposed)setError(message(e));});return()=>{disposed=true;};},[retry]);
  return {sites,error,retry:()=>setRetry(x=>x+1)};
}
export function addKeyword(existing:string[],input:string){
  const value=input.normalize("NFKC").trim();
  if(!value||Array.from(value).length>80)throw Error("INVALID_KEYWORD");
  if(existing.length>=200)throw Error("MAX_KEYWORDS");
  if(existing.some(x=>x.normalize("NFKC").toLocaleLowerCase("und")===value.toLocaleLowerCase("und")))throw Error("DUPLICATE_KEYWORD");
  return [...existing,value];
}
export function canonicalDraftHost(input:string){
  const value=input.trim();
  if(!value||/[\s\\]/u.test(value))throw Error("INVALID_HOST");
  let u:URL;try{u=new URL(value.includes("://")?value:"https://"+value);}catch{throw Error("INVALID_HOST");}
  const host=u.hostname.replace(/\.$/,"").toLowerCase();
  const authority=value.replace(/^https?:\/\//i,"").split(/[/?#]/)[0];
  if(!["http:","https:"].includes(u.protocol)||u.username||u.password||u.port||authority.includes(":")||/^[0-9.]+$/.test(host)||host.length>253||!host.includes(".")||
    !host.split(".").every(p=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(p)))throw Error("INVALID_HOST");
  return host;
}
