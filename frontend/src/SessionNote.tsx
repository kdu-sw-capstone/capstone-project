import { useEffect, useState } from "react";
import { ApiError, request } from "./api";
import { useWork } from "./FocusShared";
type Note = {text:string;version:number};
export default function SessionNote({sessionId,draft,onDraft}:{sessionId?:string;draft?:string;onDraft?:(s:string)=>void}) {
  const work=useWork();const [text,setText]=useState(draft??""),[note,setNote]=useState<Note|null>(null),[latest,setLatest]=useState<Note|null>(null),[notice,setNotice]=useState("");
  async function load(){const n=await request<Note>(`/sessions/${sessionId}/note`);setNote(n);setText(draft||n.text);}
  useEffect(()=>{if(sessionId)void work.run(load);},[sessionId]);
  async function save(){setNotice("");try{const n=await request<Note>(`/sessions/${sessionId}/note`,"PUT",{text},{version:note!.version});setNote(n);setLatest(null);setNotice("메모를 저장했습니다.");onDraft?.("");}catch(e){if(e instanceof ApiError&&e.status===412)setLatest(await request<Note>(`/sessions/${sessionId}/note`));throw e;}}
  return <div className="session-note"><label htmlFor="session-note">세션 메모 · 선택</label><textarea id="session-note" rows={3} value={text} placeholder="이번 집중에서 할 일을 적어 보세요." onChange={e=>{setText(e.target.value);if(!sessionId)onDraft?.(e.target.value);setNotice("");}} aria-describedby="note-help"/>
    <div className="note-footer"><small id="note-help">{[...text].length}/2000자 · {sessionId?"이 세션에 저장":"시작 후 메모 저장을 눌러 저장하세요"}</small>{sessionId&&<button disabled={work.busy||!note||[...text].length>2000||!!latest} onClick={()=>{void work.run(save);}}>메모 저장</button>}</div>
    {latest&&<div className="note-conflict" role="status"><p>최신 메모: {latest.text||"(빈 메모)"}</p><p>입력한 편집값은 위에 보존했습니다.</p><button onClick={()=>{setNote(latest);setLatest(null);}}>최신 버전 기준으로 내 편집 계속</button><button onClick={()=>{setText(latest.text);setNote(latest);setLatest(null);}}>최신 메모 사용</button></div>}
    {work.busy&&<p role="status">메모를 확인하고 있습니다.</p>}{work.error&&<><p role="alert">{work.error}</p>{!note&&sessionId&&<button onClick={()=>{void work.run(load);}}>메모 다시 확인</button>}</>}{notice&&<p role="status">{notice}</p>}
  </div>;
}
