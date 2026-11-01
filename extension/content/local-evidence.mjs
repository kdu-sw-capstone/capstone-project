// Internal canonical hashing only; this is not signature/capability verification.
export function canonical(value) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  throw Error('INVALID_LOCAL_CONTEXT');
}
export function freezeCopy(value){const copy=JSON.parse(canonical(value));const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};return freeze(copy);}
export async function localDigest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
// Structural binding only; verifyContext must still verify issued/native scope.
export function boundContext(value,owner,generation){
  const c=freezeCopy(value),s=c.scope,uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
  const keys=['owner_binding_id','owner_epoch','executor_id','runtime_execution_id','package_id','runtime_revision','binding_id','scope_epoch','generation','tab_id','frame_id','document_id','document_instance_id','url_sha256','focus_ref'];
  if(!s||Object.keys(s).length!==keys.length||keys.some(k=>!Object.hasOwn(s,k))
    ||['owner_binding_id','executor_id','runtime_execution_id','package_id','binding_id','scope_epoch','document_instance_id'].some(k=>!uuid(s[k]))
    ||['owner_epoch','runtime_revision','generation'].some(k=>!Number.isSafeInteger(s[k])||s[k]<1)
    ||s.owner_binding_id!==owner.owner_binding_id||s.binding_id!==owner.binding_id||s.generation!==generation
    ||!Number.isSafeInteger(s.tab_id)||s.tab_id<0||s.frame_id!==0||typeof s.document_id!=='string'||!s.document_id||s.document_id.length>100
    ||typeof s.url_sha256!=='string'||!/^[a-f0-9]{64}$/.test(s.url_sha256)
    ||!uuid(c.operation_id)||typeof c.semantic_sha256!=='string'||!/^[a-f0-9]{64}$/.test(c.semantic_sha256))throw Error('INVALID_BOUND_CONTEXT');
  return c;
}
