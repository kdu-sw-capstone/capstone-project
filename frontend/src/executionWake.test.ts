import { afterEach, expect, it, vi } from 'vitest';
import { wakeExecution } from './executionWake';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
it('sends only a bounded wake hint and does not treat receipt as execution success',async()=>{
  vi.stubEnv('VITE_EXTENSION_ID','a'.repeat(32));
  const sendMessage=vi.fn((_id,message,callback)=>callback({request_id:message.request_id,status:'OK',data:{received:true}}));
  vi.stubGlobal('chrome',{runtime:{sendMessage}});
  expect(await wakeExecution('executor')).toBe(true);
  const [,body]=sendMessage.mock.calls[0];expect(body.type).toBe('FOCURVE_EXECUTION_WAKE');
  expect(body.owner_context).toBeNull();expect(body.payload).toEqual({executor_id:'executor'});
});
it('missing bridge or configured extension leaves Server polling as fallback',async()=>{
  vi.stubEnv('VITE_EXTENSION_ID','');expect(await wakeExecution('executor')).toBe(false);
  vi.stubEnv('VITE_EXTENSION_ID','a'.repeat(32));vi.stubGlobal('chrome',undefined);expect(await wakeExecution('executor')).toBe(false);
});
it('lost reply has a bounded wait and Chrome lastError or mismatched replies are never success',async()=>{
  vi.stubEnv('VITE_EXTENSION_ID','a'.repeat(32));vi.useFakeTimers();
  vi.stubGlobal('chrome',{runtime:{sendMessage:vi.fn()}});const pending=wakeExecution('executor');
  await vi.advanceTimersByTimeAsync(2000);expect(await pending).toBe(false);
  const runtime={lastError:{message:'not installed'},sendMessage:vi.fn((_id,message,callback)=>callback({request_id:message.request_id,status:'OK',data:{received:true}}))};
  vi.stubGlobal('chrome',{runtime});expect(await wakeExecution('executor')).toBe(false);
});
