// Best-effort notification only. The authenticated Server command remains authoritative.
type Runtime = { lastError?: { message?: string }; sendMessage: (id:string, message:unknown, callback:(reply:unknown)=>void)=>void };
export function wakeExecution(executorId:string): Promise<boolean> {
  const id = import.meta.env.VITE_EXTENSION_ID ?? '';
  const runtime = (globalThis as typeof globalThis & {chrome?:{runtime?:Runtime}}).chrome?.runtime;
  if (!/^[a-p]{32}$/.test(id) || !runtime?.sendMessage) return Promise.resolve(false);
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 2000);
    try {
      runtime.sendMessage(id, {request_id:requestId,type:'FOCURVE_EXECUTION_WAKE',owner_context:null,payload:{executor_id:executorId}}, reply => {
        clearTimeout(timer);
        const result = reply as {request_id?:string;status?:string;data?:{received?:boolean}} | null;
        resolve(!runtime.lastError && result?.request_id===requestId && result.status==='OK' && result.data?.received===true);
      });
    } catch { clearTimeout(timer); resolve(false); }
  });
}
