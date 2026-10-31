import {useEffect,useRef,useState} from "react";
import {ApiError,message} from "./api";
import {Panel,Toggle,canonicalDraftHost} from "./AdditionalUi";
import HostScopeEditor,{type HostScope} from "./HostScopeEditor";
import TimeRuleEditor,{WhenEditor,type TimeWindow,type RuleWhen} from "./TimeRuleEditor";
import {internalFeatures} from "./additionalFeatures";
import {configWrite,configDelete,listConfigs,type ConfigRecord,type ConfigValue} from "./additionalConfigApi";
import RuntimeDeliveryPanel from "./RuntimeDeliveryPanel";
import DailyUsagePanel from "./DailyUsagePanel";
import ScheduleExecutionPanel from "./ScheduleExecutionPanel";
import DeletedConfigReleasePanel,{type DeletedConfigRef} from "./DeletedConfigReleasePanel";
import {configDelivery} from "./runtimeDeliveryState";

type Kind=ConfigValue["kind"];
const names:Record<Kind,string>={CONTENT:"콘텐츠 제한",CADENCE:"반복 집중·휴식",SITE_TIME:"사이트 시간·일일 한도",FOCUS_SCHEDULE:"집중 예약"};
function blank(kind:Kind,id:string):ConfigValue {
 if(kind==="CONTENT")return {kind,features:internalFeatures.map(([feature_id])=>({feature_id,enabled:false,required:true})),keyword:{enabled:false,match_profile:"URL_BOUNDARY_1",terms:[],exceptions:[],scope:"FOCUS_FROZEN"},adult:{enabled:false,artifact_id:null,artifact_sha256:null,custom_hosts:[],exceptions:[],scope:"FOCUS_FROZEN"},blur:{enabled:false,sensitivity:"HIGH",model_profile_id:null,profile_sha256:null,scope:"FOCUS_FROZEN"}};
 if(kind==="CADENCE")return {kind,enabled:false,focus_minutes:25,rest_minutes:5,cycles:4,auto_start_next:false,rest_clock:"ELAPSED_WALL_CLOCK",missed_focus:"WAIT_USER",deadline_at:null};
 if(kind==="SITE_TIME")return {kind,policy_id:id,version:1,site_id:null,scope:{host:"",include_subdomains:false},enabled:false,tracking_scope:"BROWSER_ALWAYS",daily_limit_ms:null,windows:[]};
 return {kind,schedule_id:id,enabled:false,name:"",when:{recurrence:"WEEKLY",weekdays:[1,2,3,4,5],start_local:"09:00",timezone:"Asia/Seoul",dst_gap:"SKIP",dst_overlap:"EARLIER_ONCE"},duration_minutes:25,conflict:"WAIT_FIXED_END",minimum_remaining_ms:60000};
}
type Editor={id:string;version?:number;value:ConfigValue};
// Typed projections of already schema-tagged editor objects; the server revalidates every field.
type Feature={feature_id:string;enabled:boolean;required:true};
type Nested=Record<string,unknown>;
export default function AdditionalSettings({installations}:{installations:{executor_id:string;client_version:string}[]}) {
 const [executor,setExecutor]=useState(""),[rows,setRows]=useState<ConfigRecord[]>([]),[editor,setEditor]=useState<Editor|null>(null);
 const [busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const deletePending=useRef<ReturnType<typeof configDelete>|null>(null);
 const generation=useRef(0),pending=useRef<ReturnType<typeof configWrite>|null>(null);
 const [keywordText,setKeywordText]=useState("");
 const [retry,setRetry]=useState(0),[confirmDelete,setConfirmDelete]=useState<ConfigRecord|null>(null);
 const [deleted,setDeleted]=useState<DeletedConfigRef[]>([]);
 useEffect(()=>{if(executor&&!installations.some(i=>i.executor_id===executor))setExecutor("");},[installations,executor]);
 useEffect(()=>{
  const current=++generation.current;pending.current=null;deletePending.current=null;setEditor(null);setConfirmDelete(null);setRows([]);setLoaded(false);setError("");setNotice("");setBusy(false);
  if(!executor)return;const controller=new AbortController();setBusy(true);
  void listConfigs(executor,controller.signal).then(data=>{if(current===generation.current){setRows(data);setLoaded(true);}}).catch(e=>{if(current===generation.current&&!controller.signal.aborted)setError(message(e));}).finally(()=>{if(current===generation.current)setBusy(false);});
  return()=>{++generation.current;controller.abort();};
 },[executor,retry]);
 function openEditor(next:Editor){setEditor(next);setKeywordText(((next.value.keyword as Nested|undefined)?.terms as string[]|undefined)?.join("\n")??"");}
 function change(patch:Partial<ConfigValue>){pending.current=null;setNotice("");setEditor(old=>old?{...old,value:{...old.value,...patch}}:null);}
 async function save(){
  if(!editor||busy)return;setBusy(true);setError("");setNotice("");const current=generation.current;
  try {
   // Freeze this payload/key. Explicit retry reuses it after a lost response.
   pending.current??=configWrite(executor,editor.id,editor.value,editor.version);const saved=await pending.current.send();
   if(current!==generation.current)return;pending.current=null;setRows(old=>[...old.filter(row=>row.config_id!==saved.config_id),saved]);setEditor({id:saved.config_id,version:saved.version,value:structuredClone(saved.value)});
   setNotice("설정을 저장하고 다시 조회했습니다. 브라우저 적용 상태는 별도 확인이 필요합니다.");
  }catch(e){if(current===generation.current){setError(message(e));if(e instanceof ApiError&&e.status>=400&&e.status<500)pending.current=null;}}
  finally{if(current===generation.current)setBusy(false);}
 }
 const value=editor?.value;
 function nested(field:string,patch:Nested){if(value)change({[field]:{...(value[field] as Nested),...patch}});}
 return <section className="additional-ui" aria-label="추가 집중 설정">
  <Panel title="추가 집중 설정"><p>설치별로 저장합니다. 저장 완료는 정책 적용 완료를 뜻하지 않습니다. 현재 집중의 고정 설정은 유지됩니다.</p>
   <label>설치 선택<select value={executor} disabled={busy} onChange={e=>{++generation.current;setRows([]);setLoaded(false);setExecutor(e.target.value);}}><option value="">설치를 선택하세요</option>{installations.map(i=><option key={i.executor_id} value={i.executor_id}>{i.client_version} · {i.executor_id}</option>)}</select></label>
   {!installations.length&&<p>연결된 회원 설치가 없습니다. 비회원 자료는 확장 프로그램에서 관리합니다.</p>}
   {busy&&<p role="status">설정 결과를 확인하고 있습니다.</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {executor&&<button disabled={busy} onClick={()=>setRetry(n=>n+1)}>현재 저장 설정 다시 조회</button>}
   {loaded&&<><div className="additional-actions">{(Object.keys(names) as Kind[]).map(kind=><button key={kind} disabled={busy||!!editor||((kind==="CONTENT"||kind==="CADENCE")&&rows.some(row=>row.value.kind===kind))} onClick={()=>{const id=crypto.randomUUID();openEditor({id,value:blank(kind,id)});setNotice("");}}>{names[kind]} 추가</button>)}</div>
    {!rows.length&&<p>저장된 추가 설정이 없습니다.</p>}
    <ul>{rows.map(row=><li key={row.config_id}><strong>{names[row.value.kind]}</strong> · 버전 {row.version} · {configDelivery(row).label}<button disabled={busy||!!editor} onClick={()=>{pending.current=null;openEditor({id:row.config_id,version:row.version,value:structuredClone(row.value)});setNotice("");}}>수정</button><button disabled={busy||!!editor} onClick={()=>{deletePending.current=null;setConfirmDelete(row);}}>삭제</button></li>)}</ul>
   </>}
   {confirmDelete&&<div role="group" aria-label="설정 삭제 확인"><p>설정 삭제를 요청할까요? 실제 제한 해제 확인까지 완료로 표시하지 않습니다.</p><button disabled={busy} onClick={()=>{setBusy(true);setError("");const current=generation.current;deletePending.current??=configDelete(confirmDelete);void deletePending.current.send().then(receipt=>{if(current===generation.current){setNotice("삭제 요청을 저장했습니다. 실제 제한 해제는 확인 대기 중입니다.");setDeleted(old=>[...old.filter(r=>r.id!==confirmDelete.config_id),{executor,id:confirmDelete.config_id,previousVersion:confirmDelete.version,operationId:receipt.operation_id}]);setRows(old=>old.filter(r=>r.config_id!==confirmDelete.config_id));setConfirmDelete(null);deletePending.current=null;}}).catch(e=>{if(current===generation.current)setError(message(e));}).finally(()=>{if(current===generation.current)setBusy(false);});}}>삭제 요청 확인</button><button disabled={busy} onClick={()=>{deletePending.current=null;setConfirmDelete(null);}}>취소</button></div>}
  </Panel>
  {loaded&&executor&&<RuntimeDeliveryPanel executor={executor} records={rows} onRefresh={()=>setRetry(n=>n+1)} />}
  {loaded&&executor&&<DeletedConfigReleasePanel executor={executor} targets={deleted}/>}
  {loaded&&executor&&<DailyUsagePanel executor={executor} records={rows} />}
  {loaded&&executor&&<ScheduleExecutionPanel executor={executor} records={rows} />}
  {editor&&value&&<Panel title={names[value.kind]+" 편집"}><form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy}>
   {value.kind!=="CONTENT"&&<Toggle title="이 설정 사용" checked={Boolean(value.enabled)} onChange={enabled=>change({enabled})}/>}
   {value.kind==="CONTENT"&&<>
    {internalFeatures.map(([feature_id,title,description])=><Toggle key={feature_id} title={title} description={description} checked={(value.features as Feature[]).find(f=>f.feature_id===feature_id)?.enabled??false} onChange={enabled=>change({features:[...(value.features as Feature[]).filter(f=>f.feature_id!==feature_id),{feature_id,enabled,required:true}]})}/>)}
    <Toggle title="URL 키워드 제한" checked={Boolean((value.keyword as Nested).enabled)} onChange={enabled=>nested("keyword",{enabled})}/>
    <label>키워드 · 한 줄에 하나<textarea value={keywordText} onChange={e=>{setKeywordText(e.target.value);nested("keyword",{terms:e.target.value.split("\n").map(s=>s.trim()).filter(Boolean)});}}/></label>
    <HostScopeEditor title="키워드 예외" rows={(value.keyword as Nested).exceptions as HostScope[]} onChange={exceptions=>nested("keyword",{exceptions})}/>
    <Toggle title="성인 사이트 제한" checked={Boolean((value.adult as Nested).enabled)} onChange={enabled=>nested("adult",{enabled})}/>
    <HostScopeEditor title="성인 사이트 직접 목록" rows={(value.adult as Nested).custom_hosts as HostScope[]} onChange={custom_hosts=>nested("adult",{custom_hosts})}/>
    <HostScopeEditor title="성인 사이트 예외" rows={(value.adult as Nested).exceptions as HostScope[]} onChange={exceptions=>nested("adult",{exceptions})}/>
    <Toggle title="이미지 블러" checked={Boolean((value.blur as Nested).enabled)} onChange={enabled=>nested("blur",{enabled})}/><p>블러 민감도는 높음입니다. 검증된 모델·목록이 없으면 실행이 제한되며 저장만으로 활성화되지 않습니다.</p>
   </>}
   {value.kind==="CADENCE"&&<><label>집중 시간(분)<input type="number" min={1} max={180} value={Number(value.focus_minutes)} onChange={e=>change({focus_minutes:e.target.valueAsNumber})}/></label><label>휴식 시간(분)<input type="number" min={1} max={180} value={Number(value.rest_minutes)} onChange={e=>change({rest_minutes:e.target.valueAsNumber})}/></label><label>반복 횟수<input type="number" min={1} max={12} value={Number(value.cycles)} onChange={e=>change({cycles:e.target.valueAsNumber})}/></label><Toggle title="다음 집중 자동 시작" checked={Boolean(value.auto_start_next)} onChange={auto_start_next=>change({auto_start_next})}/><p>놓친 집중은 사용자 확인을 기다립니다. 휴식은 실제 경과 시간을 사용합니다.</p></>}
   {value.kind==="SITE_TIME"&&<><label>사이트 도메인<input required value={String((value.scope as Nested).host)} onChange={e=>nested("scope",{host:e.target.value})} onBlur={e=>{try{nested("scope",{host:canonicalDraftHost(e.target.value)});}catch{setError("사이트 도메인을 확인하세요.");}}}/></label><Toggle title="하위 도메인 포함" checked={Boolean((value.scope as Nested).include_subdomains)} onChange={include_subdomains=>nested("scope",{include_subdomains})}/><label>하루 한도(분) · 비우면 무제한<input type="number" min={1} max={1440} value={value.daily_limit_ms===null?"":Number(value.daily_limit_ms)/60000} onChange={e=>change({daily_limit_ms:e.target.value===""?null:e.target.valueAsNumber*60000})}/></label><TimeRuleEditor windows={value.windows as TimeWindow[]} onChange={windows=>change({windows})}/><p>일일 한도는 해당 설치 기준입니다.</p></>}
   {value.kind==="FOCUS_SCHEDULE"&&<><label>예약 이름<input required maxLength={80} value={String(value.name)} onChange={e=>change({name:e.target.value})}/></label><label>집중 시간(분)<input type="number" min={1} max={180} value={Number(value.duration_minutes)} onChange={e=>change({duration_minutes:e.target.valueAsNumber})}/></label><WhenEditor value={value.when as RuleWhen} onChange={when=>change({when})}/><p>기존 집중이 우선하며 예약의 종료 시각을 연장하지 않습니다. 실행 결과는 Core 연결 후 별도로 확인합니다.</p></>}
   <div className="additional-actions"><button disabled={busy} type="submit">{pending.current?"같은 저장 요청 결과 다시 확인":"설정 저장"}</button><button type="button" disabled={busy} onClick={()=>{pending.current=null;deletePending.current=null;setEditor(null);}}>편집 닫기</button></div>
  </fieldset></form></Panel>}
 </section>;
}
