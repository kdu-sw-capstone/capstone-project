import {VERSION,valid,same,fail} from './contract.mjs';
import {id} from './domain.mjs';
export class A1Client {
 constructor(runtime,config,{timeout=5000}={}){this.runtime=runtime;this.config=structuredClone(config);this.timeout=timeout;this.recordVersion=null;this.tail=Promise.resolve();}
 message(action,extra){const c=this.config;return {request_id:id(),type:'D06_MEMBER_A1_STORAGE',owner_context:c.scope.owner_context,payload:{protocol_version:VERSION,action,scope:structuredClone(c.scope),registration_id:c.registration_id,registration_epoch:c.registration_epoch,channel_credential:c.channel_credential,...(this.domCapability?{dom_cap:this.domCapability}:{}),...extra}};}
 async rpc(original){for(let attempt=0;attempt<3;attempt++){
  const m={...structuredClone(original),request_id:id()};let timer,r;
  try{r=await Promise.race([this.runtime.sendMessage(m),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('STORE_UNCONFIRMED')),this.timeout);})]);}catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,attempt===0?250:1000));continue;}finally{clearTimeout(timer);}
  if(!valid(r,r?.status==='ERROR'?'error':m.payload.action==='READ'?'read_result':'write_result')||r.request_id!==m.request_id)fail('INVALID_CURRENT_RESPONSE');
  if(r.status==='ERROR'){if(r.error.retryable&&attempt<2){await new Promise(r=>setTimeout(r,attempt===0?250:1000));continue;}fail(r.error.code);}
  const d=r.data,c=this.config;if(d.registration_id!==c.registration_id||d.registration_epoch!==c.registration_epoch||d.action!==m.payload.action||d.write_id!==(m.payload.write_id??null))fail('SCOPE_MISMATCH');this.recordVersion=d.record_version;if(d.view&&Object.hasOwn(d.view,'dom_cap'))this.domCapability=d.view.dom_cap;return d.view;
 }fail('STORE_UNCONFIRMED');}
 read(selector='SUMMARY',selected_id=null){return this.rpc(this.message('READ',{selector,selected_id}));}
 commit(change){const original=structuredClone(change);const work=this.tail.then(async()=>{
  for(let attempt=0;;attempt++){
   const summary=await this.read();if(['CHECKPOINT','LEDGER_PLAN'].includes(original.kind)&&summary.view==='SUMMARY'&&summary.lifecycle==='INACTIVE'&&!summary.dom_cap)throw new Error('INACTIVE_SCOPE',{cause:{source:'ROOT_SUMMARY'}});const m=this.message('COMMIT',{write_id:id(),expected_record_version:this.recordVersion,change:structuredClone(original)});
   try{return await this.rpc(m);}catch(e){
    // Only a verified CAS rejection is known to have aborted. Re-read once;
    // BEGIN/owner/native/END guards still decide permission in the transaction.
    // Unconfirmed transport/storage keeps rpc's original write ID and stops.
    if(e.message!=='STORE_CAS_CONFLICT'||attempt>=1)throw e;
   }
  }
 });this.tail=work.catch(()=>{});return work;}
}
