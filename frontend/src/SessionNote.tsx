import { useEffect, useRef, useState } from "react";
import { ApiError, request } from "./api";
import { useWork } from "./FocusShared";
type Note = {text:string;version:number};
type Props={sessionId?:string;draft?:string;onDraft?:(s:string)=>void};
export default function SessionNote(props:Props){return <NoteEditor key={props.sessionId??"unsaved"} {...props}/>;}
function NoteEditor({sessionId,draft,onDraft}:Props) {
  const work=useWork();const [text,setText]=useState(draft??""),[note,setNote]=useState<Note|null>(null),[latest,setLatest]=useState<Note|null>(null),[notice,setNotice]=useState("");
  const generation=useRef(0),edits=useRef(0);
  async function load(signal?:AbortSignal){const current=++generation.current;const n=await request<Note>(`/sessions/${sessionId}/note`,"GET",undefined,{signal});if(current!==generation.current)return;setNote(n);if(edits.current===0)setText(draft||n.text);}
  useEffect(()=>{const abort=new AbortController();void Promise.resolve().then(()=>{if(sessionId&&!abort.signal.aborted)void work.run(()=>load(abort.signal));});return()=>{++generation.current;abort.abort();};},[sessionId]);
  async function save(){const current=generation.current,revision=edits.current;setNotice("");try{const n=await request<Note>(`/sessions/${sessionId}/note`,"PUT",{text},{version:note!.version});if(current!==generation.current)return;setNote(n);setLatest(null);setNotice(revision===edits.current?"메모를 저장했습니다.":"요청한 메모를 저장했습니다. 이후 편집한 현재 입력은 아직 저장되지 않았습니다.");if(revision===edits.current)onDraft?.("");}catch(e){if(current!==generation.current)return;if(e instanceof ApiError&&e.status===412){const n=await request<Note>(`/sessions/${sessionId}/note`);if(current===generation.current)setLatest(n);}throw e;}}
  return <div className="session-note"><label htmlFor="session-note">세션 메모 · 선택</label><textarea id="session-note" rows={3} value={text} placeholder="이번 집중에서 할 일을 적어 보세요." onChange={e=>{++edits.current;setText(e.target.value);if(!sessionId)onDraft?.(e.target.value);setNotice("");}} aria-describedby="note-help"/>
    <div className="note-footer"><small id="note-help">{[...text].length}/2000자 · {sessionId?"이 세션에 저장":"시작 후 메모 저장을 눌러 저장하세요"}</small>{sessionId&&<button disabled={work.busy||!note||[...text].length>2000||!!latest} onClick={()=>{void work.run(save);}}>메모 저장</button>}</div>
    {latest&&<div className="note-conflict" role="status"><p>최신 메모: {latest.text||"(빈 메모)"}</p><p>입력한 편집값은 위에 보존했습니다.</p><button onClick={()=>{setNote(latest);setLatest(null);}}>최신 버전 기준으로 내 편집 계속</button><button onClick={()=>{setText(latest.text);setNote(latest);setLatest(null);}}>최신 메모 사용</button></div>}
    {work.busy&&<p role="status">메모를 확인하고 있습니다.</p>}{work.error&&<><p role="alert">{work.error}</p>{!note&&sessionId&&<button onClick={()=>{void work.run(()=>load());}}>메모 다시 확인</button>}</>}{notice&&<p role="status">{notice}</p>}
  </div>;
}
