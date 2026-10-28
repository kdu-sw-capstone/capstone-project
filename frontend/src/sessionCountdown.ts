// Display estimate only. Never persists time or changes execution status.
export type CountdownSession={session_id:string;execution_status:string;duration_minutes:number;active_duration_ms:number;planned_end_at?:string|null;remaining_ms?:number;version?:number|string};
export type CountdownAnchor={id:string;status:string;remaining:number;mono:number;received:number;version?:number|string};
export const MAX_ESTIMATE_MS=15000;
export function remainingAt(a:CountdownAnchor,mono:number){return Math.max(0,a.remaining-(a.status==='RUNNING'?Math.min(MAX_ESTIMATE_MS,Math.max(0,mono-a.mono)):0));}
export function receiveCountdown(previous:CountdownAnchor|null,s:CountdownSession,mono:number,wall:number):CountdownAnchor{
 const total=Math.max(0,s.duration_minutes*60000);
 const deadline=s.planned_end_at?Date.parse(s.planned_end_at):NaN;
 const raw=s.execution_status==='RUNNING'&&Number.isFinite(deadline)?deadline-wall:s.remaining_ms??total-s.active_duration_ms;
 let remaining=Math.max(0,Math.min(total,raw));
 if(previous?.id===s.session_id&&['RUNNING','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(previous.status)&&['RUNNING','NATIVE_VERIFYING','EFFECT_VERIFYING'].includes(s.execution_status)){
  // Native/effect verification pauses the estimate; delayed accounting must
  // not rewind it when the same session resumes. This grants no run authority.
  remaining=Math.min(remaining,remainingAt(previous,mono));
 }
 return {id:s.session_id,status:s.execution_status,remaining,mono,received:mono,version:s.version};
}
