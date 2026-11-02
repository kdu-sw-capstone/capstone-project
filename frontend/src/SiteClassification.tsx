import {useEffect,useState} from "react";
import {ApiError,request,message} from "./api";
type Site={site_id:string;purpose:string};
type Page<T>={items:T[];next_cursor:string|null;has_more:boolean};
export default function SiteClassification({open}:{open:()=>void}) {
  const [counts,setCounts]=useState<number[]|null>(null);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  useEffect(()=>{const controller=new AbortController();setCounts(null);setError("");async function load(){
    const all:Site[]=[];let cursor:string|null=null;const seen=new Set<string>(),ids=new Set<string>();
    do {const page:Page<Site>=await request("/sites?"+new URLSearchParams({limit:"100",...(cursor?{cursor}:{})}),"GET",undefined,{signal:controller.signal});
      if(controller.signal.aborted)return;
      if(!page||!Array.isArray(page.items)||page.items.length>100||typeof page.has_more!=="boolean"||!(page.next_cursor===null||typeof page.next_cursor==="string"&&page.next_cursor.length>0&&page.next_cursor.length<=2048)||page.has_more!==(page.next_cursor!==null)||page.has_more&&page.items.length===0)throw new ApiError("SERVER_RESPONSE_INVALID",502);
      for(const site of page.items){if(!site||typeof site.site_id!=="string"||!site.site_id||ids.has(site.site_id)||!["FOCUS","DISTRACTION","GENERAL"].includes(site.purpose))throw new ApiError("SERVER_RESPONSE_INVALID",502);ids.add(site.site_id);}
      all.push(...page.items);cursor=page.next_cursor;if(cursor&&seen.has(cursor))throw new ApiError("INVALID_CURSOR",400);if(cursor)seen.add(cursor);
    }while(cursor&&!controller.signal.aborted);
    if(!controller.signal.aborted)setCounts(["FOCUS","DISTRACTION","GENERAL"].map(p=>all.filter(s=>s.purpose===p).length));
  }void load().catch(e=>{if(!controller.signal.aborted)setError(message(e));});return()=>controller.abort();},[retry]);
  const total=counts?.reduce((a,b)=>a+b,0)??0;
  const first=counts&&total?counts[0]/total*100:0,second=counts&&total?(counts[0]+counts[1])/total*100:0;
  return <section className="card site-classification" aria-label="등록한 사이트 분류"><div className="panel-heading"><h4>등록한 사이트 분류</h4><button onClick={open}>관리 →</button></div><p className="muted">현재 등록한 사이트 수 기준이며 이용시간 비율이 아닙니다.</p>
    {error?<div><p role="alert">{error}</p><button onClick={()=>setRetry(n=>n+1)}>분류 다시 조회</button></div>:counts===null?<p role="status">사이트 분류를 확인하고 있습니다.</p>:total===0?<p>등록된 사이트가 없습니다.</p>:<div className="distribution"><div className="donut" role="img" aria-label={`등록 사이트 ${total}개: 집중 ${counts[0]}개, 방해 ${counts[1]}개, 일반 ${counts[2]}개`} style={{background:"conic-gradient(#579fff 0% "+first+"%, #7dd3e8 "+first+"% "+second+"%, #bdd6ef "+second+"% 100%)"}}><div><strong>{total}</strong><small>등록 사이트</small></div></div><ul>{counts.map((count,i)=><li key={i}><span aria-hidden="true" style={{width:5,height:5,flexShrink:0,borderRadius:"50%",background:["#579fff","#7dd3e8","#bdd6ef"][i]}}/><span>{["집중","방해","일반"][i]}</span><strong>{count}개</strong><small>{(count/total*100).toFixed(1)}%</small></li>)}</ul></div>}
  </section>;
}
