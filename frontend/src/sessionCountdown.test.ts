import {expect,it} from 'vitest';
import {receiveCountdown,remainingAt} from './sessionCountdown';
const session={session_id:'s',execution_status:'RUNNING',duration_minutes:3,active_duration_ms:10000};
it('advances every second without planned_end_at',()=>{const a=receiveCountdown(null,session,100,1000);expect(remainingAt(a,1100)).toBe(169000);expect(remainingAt(a,2100)).toBe(168000);});
it('duplicate accounting does not rewind at the five second poll',()=>{const a=receiveCountdown(null,session,0,0),b=receiveCountdown(a,session,5000,5000);expect(remainingAt(b,6000)).toBe(164000);});
it('stops estimation after missing updates for fifteen seconds',()=>{const a=receiveCountdown(null,session,0,0);expect(remainingAt(a,100000)).toBe(155000);});
it('UNKNOWN and ENDING do not continue a running clock',()=>{for(const execution_status of ['UNKNOWN','ENDING']){const a=receiveCountdown(null,{...session,execution_status},0,0);expect(remainingAt(a,10000)).toBe(170000);}});
it('new session or recovery can establish authoritative remaining time',()=>{const a=receiveCountdown(null,session,0,0);const b=receiveCountdown(a,{...session,session_id:'new',active_duration_ms:0},10000,10000);expect(remainingAt(b,10000)).toBe(180000);});
it('deadline estimate uses monotonic elapsed time and never goes negative',()=>{const a=receiveCountdown(null,{...session,planned_end_at:'1970-01-01T00:00:05Z'},0,0);expect(remainingAt(a,6000)).toBe(0);});

it.each(['NATIVE_VERIFYING','EFFECT_VERIFYING'])('does not rewind across %s and resumes from the displayed remainder',execution_status=>{
 const running=receiveCountdown(null,session,0,0);
 const waiting=receiveCountdown(running,{...session,execution_status},5000,5000);
 expect(remainingAt(waiting,5000)).toBe(165000);
 expect(remainingAt(waiting,8000)).toBe(165000);
 const resumed=receiveCountdown(waiting,session,8000,8000);
 expect(remainingAt(resumed,9000)).toBe(164000);
 expect(resumed.status).toBe('RUNNING');
});
