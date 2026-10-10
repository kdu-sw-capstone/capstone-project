import { afterEach, expect, it, vi } from 'vitest';
import { connectExecution, wakeExecution } from './executionWake';
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

it('CONNECT accepts a matched installation reply, rejects stale/invalid replies and times out',async()=>{
  vi.stubEnv('VITE_EXTENSION_ID','a'.repeat(32));
  const executor='11111111-1111-4111-8111-111111111111';
  const sendMessage=vi.fn((_id,message,callback)=>callback({request_id:message.request_id,status:'OK',data:{executor_id:executor}}));
  vi.stubGlobal('chrome',{runtime:{sendMessage}});
  expect(await connectExecution()).toBe(executor);
  expect(sendMessage.mock.calls[0][1].payload).toEqual({});
  sendMessage.mockImplementation((_id,_message,callback)=>callback({request_id:'stale',status:'OK',data:{executor_id:executor}}));
  expect(await connectExecution()).toBeNull();
  sendMessage.mockImplementation((_id,message,callback)=>callback({request_id:message.request_id,status:'OK',data:{executor_id:'invalid'}}));
  expect(await connectExecution()).toBeNull();
  vi.useFakeTimers();sendMessage.mockImplementation(()=>{});
  const pending=connectExecution();await vi.advanceTimersByTimeAsync(12000);expect(await pending).toBeNull();
});
