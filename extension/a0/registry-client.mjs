import { REGISTRY_VERSION, validateRegistry } from './registry.mjs';
import { canonical } from './contract.mjs';
// The credential stays in this closure. There is no key/path/list or generic save IPC.
export class A0RegistryClient {
 constructor(runtime,config,{timeout=5000,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){this.runtime=runtime;this.config=structuredClone(config);this.timeout=timeout;this.wait=wait;this.version=null;this.tail=Promise.resolve();}
 message(action,selector,change=null){const c=this.config;return {request_id:crypto.randomUUID(),type:'D06_A0_REGISTRY',owner_context:c.authority.owner_context,payload:{protocol_version:REGISTRY_VERSION,registry_id:c.registry_id,registry_epoch:c.registry_epoch,context:structuredClone(c.authority.context),content_instance_id:c.instance,channel_credential:c.credential,action,selector,write_id:action==='COMMIT'?crypto.randomUUID():null,expected_record_version:action==='COMMIT'?this.version:null,change}};}
 async rpc(original){for(let attempt=0;attempt<3;attempt++){const m={...structuredClone(original),request_id:crypto.randomUUID()};let timer,r;try{r=await Promise.race([this.runtime.sendMessage(m),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('STORE_RESPONSE_UNCONFIRMED')),this.timeout);})]);}catch(e){if(attempt===2)throw e;await this.wait(attempt===0?250:1000);continue;}finally{clearTimeout(timer);}if(!validateRegistry(r,r?.status==='OK'?'registry_ok':'registry_error')||r.request_id!==m.request_id)throw Error('STORE_INVALID_RESPONSE');if(r.status==='ERROR'){if(r.error.retryable&&attempt<2){await this.wait(attempt===0?250:1000);continue;}throw Error(r.error.code);}const d=r.data,c=this.config;if(d.registry_id!==c.registry_id||d.registry_epoch!==c.registry_epoch||d.action!==m.payload.action||d.write_id!==m.payload.write_id)throw Error('STORE_RESPONSE_SCOPE');this.version=d.record_version;return d;}throw Error('STORE_RESPONSE_UNCONFIRMED');}
 async load(){let timer;try{return await Promise.race([this.loadReady(),new Promise((_,reject)=>{timer=setTimeout(()=>{this.bootstrapExpired=true;reject(Error('STORE_NOT_READY'));},15000);})]);}finally{clearTimeout(timer);}}
 async loadReady(){for(;;){if(this.bootstrapExpired)throw Error('STORE_NOT_READY');const d=await this.rpc(this.message('READ',{view:'SUMMARY'}));if(this.bootstrapExpired)throw Error('STORE_NOT_READY');if(d.state.readiness==='READY'&&d.state.lifecycle==='ACTIVE')return null;if(d.state.readiness!=='PROVISIONAL')throw Error('STORE_NOT_READY');await this.wait(25);}}
 save(_row,change=null){if(!change)return Promise.resolve();const p=this.tail.then(async()=>{if(!this.version)throw Error('STORE_NOT_READY');
 // Worker recovery/navigation may advance CAS independently of this client.
 // Read the authoritative version before proposing a new mutation. Never alter
 // or replace an unconfirmed COMMIT: rpc still replays its identical write ID.
 await this.rpc(this.message('READ',{view:'SUMMARY'}));
 const m=this.message('COMMIT',null,structuredClone(change));if(new TextEncoder().encode(canonical(m)).length>262144)throw Error('STORE_CAPACITY');return this.rpc(m);});this.tail=p.catch(()=>{});return p;}
}
