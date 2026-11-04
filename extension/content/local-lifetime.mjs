import {freezeCopy} from './local-evidence.mjs';

// Instance-local observation only. No authority, watch/cutoff/round issuer,
// durable closure, or claim completion. Finished work is compacted into totals.
export class LocalLifetime {
  #origin;#context=null;#sequence=0n;#pending=new Map();#resources=new Map();#totals=new Map();
  constructor(origin){this.#origin=freezeCopy(origin);}
  bindContext(context){if(this.#context!==null)throw Error('LOCAL_LIFETIME_ALREADY_BOUND');this.#context=freezeCopy(context);}
  begin(kind,details={}){
    const id=String(++this.#sequence),record=freezeCopy({id,kind,details});
    this.#pending.set(id,record);
    let total=this.#totals.get(kind);if(!total){total={entered:0,returned:0,threw:0};this.#totals.set(kind,total);}total.entered++;
    let finished=false;
    return Object.freeze({finish:(threw=false)=>{if(finished)return;finished=true;this.#pending.delete(id);total[threw?'threw':'returned']++;}});
  }
  run(kind,work,details={}){
    const ticket=this.begin(kind,details);
    try{const value=work();
      if(value&&typeof value.then==='function')return Promise.resolve(value).then(result=>{ticket.finish();return result;},error=>{ticket.finish(true);throw error;});
      ticket.finish();return value;
    }catch(error){ticket.finish(true);throw error;}
  }
  resource(kind){
    const id=String(++this.#sequence),record={id,kind,state:'UNCONFIRMED'};this.#resources.set(id,record);
    return Object.freeze({unknown:()=>{record.state='UNCONFIRMED';},attached:()=>{record.state='ATTACHED';},
      inactive:()=>{record.state='INACTIVE';},removed:()=>{record.state='REMOVED';}});
  }
  snapshot(){
    const pending_work=[...this.#pending.values()],resources=[...this.#resources.values()],remaining_resources=resources.filter(r=>['ATTACHED','UNCONFIRMED'].includes(r.state));
    return structuredClone({local_only:true,native_verified:false,origin:this.#origin,context:this.#context,pending_work,resources,
      totals:Object.fromEntries(this.#totals),remaining:{work:pending_work,resources:remaining_resources},
      drained:pending_work.length===0&&remaining_resources.length===0});
  }
}
