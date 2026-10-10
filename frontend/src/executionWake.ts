// The authenticated Server command remains authoritative; bridge replies are not execution evidence.
type Runtime = { lastError?: { message?: string }; sendMessage: (id:string, message:unknown, callback:(reply:unknown)=>void)=>void };
type Reply = { request_id?:string; status?:string; data?:{received?:boolean;executor_id?:string} };
const extensionId = () => import.meta.env.VITE_EXTENSION_ID ?? '';
export const executionBridgeConfigured = () => /^[a-p]{32}$/.test(extensionId());
function bridge(type:string, payload:Record<string,string>, timeout:number):Promise<Reply|null> {
  const runtime = (globalThis as typeof globalThis & {chrome?:{runtime?:Runtime}}).chrome?.runtime;
  if (!executionBridgeConfigured() || !runtime?.sendMessage) return Promise.resolve(null);
  const requestId = crypto.randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), timeout);
    try {
      runtime.sendMessage(extensionId(), {request_id:requestId,type,owner_context:null,payload}, reply => {
        clearTimeout(timer);
        const result = reply as Reply | null;
        resolve(!runtime.lastError && result?.request_id===requestId && result.status==='OK' ? result : null);
      });
    } catch { clearTimeout(timer); resolve(null); }
  });
}
// CONNECT completes an authenticated command lookup (heartbeat) before returning this installation only.
export async function connectExecution():Promise<string|null> {
  const result = await bridge('FOCURVE_EXECUTION_CONNECT', {}, 12000);
  const id = result?.data?.executor_id;
  return typeof id==='string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
export async function wakeExecution(executorId:string):Promise<boolean> {
  return (await bridge('FOCURVE_EXECUTION_WAKE', {executor_id:executorId}, 2000))?.data?.received===true;
}
