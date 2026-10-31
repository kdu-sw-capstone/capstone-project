export type Weekly={recurrence:"WEEKLY";weekdays:number[];start_local:string;timezone:string;dst_gap:"SKIP";dst_overlap:"EARLIER_ONCE";end_local?:string;end_day_offset?:number};
export type Once={recurrence:"ONCE";start_at:string;end_at?:string};
export type RuleWhen=Weekly|Once;
export type TimeWindow={window_id:string;kind:"BLOCK_WINDOW"|"ALLOW_WINDOW";enabled:boolean;when:RuleWhen};
export const defaultWeekly=():Weekly=>({recurrence:"WEEKLY",weekdays:[1,2,3,4,5],start_local:"09:00",timezone:"Asia/Seoul",dst_gap:"SKIP",dst_overlap:"EARLIER_ONCE"});
function utc(value:string){if(!value)return "";const parsed=new Date(value+"Z");return Number.isFinite(parsed.valueOf())?parsed.toISOString():value+"Z";}
export function WhenEditor({value,onChange,window=false}:{value:RuleWhen;onChange:(v:RuleWhen)=>void;window?:boolean}) {
 return <div className="additional-grid"><label>반복 방식<select value={value.recurrence} onChange={e=>onChange(e.target.value==="WEEKLY"?{...defaultWeekly(),...(window?{end_local:"10:00",end_day_offset:0}:{})}:{recurrence:"ONCE",start_at:"",...(window?{end_at:""}:{})})}><option value="WEEKLY">매주</option><option value="ONCE">한 번</option></select></label>
  {value.recurrence==="WEEKLY"?<>
   <div role="group" aria-label="실행 요일">{["월","화","수","목","금","토","일"].map((day,index)=><label key={day}><input type="checkbox" checked={value.weekdays.includes(index+1)} onChange={e=>onChange({...value,weekdays:e.target.checked?[...value.weekdays,index+1].sort():value.weekdays.filter(d=>d!==index+1)})}/>{day}</label>)}</div>
   <label>시작 시각<input type="time" required value={value.start_local} onChange={e=>onChange({...value,start_local:e.target.value})}/></label>
   {window&&<><label>종료 시각<input type="time" required value={value.end_local} onChange={e=>onChange({...value,end_local:e.target.value})}/></label><label>종료 날짜<select value={value.end_day_offset} onChange={e=>onChange({...value,end_day_offset:Number(e.target.value)})}><option value={0}>같은 날</option><option value={1}>다음 날</option></select></label></>}
   <label>시간대<input required value={value.timezone} onChange={e=>onChange({...value,timezone:e.target.value})}/></label>
  </>:<><label>시작 날짜·시각(UTC)<input type="datetime-local" step="0.001" required value={value.start_at.replace(/Z$/,"")} onChange={e=>onChange({...value,start_at:utc(e.target.value)})}/></label>{window&&<label>종료 날짜·시각(UTC)<input type="datetime-local" step="0.001" required value={(value.end_at??"").replace(/Z$/,"")} onChange={e=>onChange({...value,end_at:utc(e.target.value)})}/></label>}</>}
 </div>;
}
export default function TimeRuleEditor({windows,onChange}:{windows:TimeWindow[];onChange:(v:TimeWindow[])=>void}) {
 const update=(id:string,patch:Partial<TimeWindow>)=>onChange(windows.map(row=>row.window_id===id?{...row,...patch}:row));
 return <fieldset><legend>사이트 예약 시간창</legend><p>허용 시간창은 다른 제한을 해제하지 않습니다. DST에 없는 시각은 건너뛰고, 반복 시각은 앞선 발생 한 번만 사용합니다.</p>
  {windows.map((row,index)=><fieldset key={row.window_id}><legend>시간창 {index+1}</legend><label>종류<select value={row.kind} onChange={e=>update(row.window_id,{kind:e.target.value as TimeWindow["kind"]})}><option value="BLOCK_WINDOW">차단 시간</option><option value="ALLOW_WINDOW">허용 시간</option></select></label><label><input type="checkbox" checked={row.enabled} onChange={e=>update(row.window_id,{enabled:e.target.checked})}/>시간창 사용</label><WhenEditor window value={row.when} onChange={when=>update(row.window_id,{when})}/><button type="button" onClick={()=>onChange(windows.filter(value=>value.window_id!==row.window_id))}>시간창 {index+1} 삭제</button></fieldset>)}
  <button type="button" disabled={windows.length>=100} onClick={()=>onChange([...windows,{window_id:crypto.randomUUID(),kind:"BLOCK_WINDOW",enabled:true,when:{...defaultWeekly(),end_local:"10:00",end_day_offset:0}}])}>시간창 추가</button>
 </fieldset>;
}
