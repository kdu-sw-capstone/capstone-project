// Public per-instance configuration, never credentials or profile state.
(() => {
 function config(){
  const c=globalThis.FOCURVE_DEPLOYMENT;
  if(!c||c.contract!=='STANDALONE_API_1')throw Error('RELEASE_CONFIG_MISSING');
  let api,web;try{api=new URL(c.api);web=new URL(c.origin);}catch{throw Error('RELEASE_CONFIG_INVALID');}
  if(api.protocol!=='https:'||api.hostname!=='localhost'||api.pathname!=='/api/v1'||api.search||api.hash||api.username||api.password||
    web.href!==api.origin+'/'||web.search||web.hash||web.username||web.password)throw Error('RELEASE_CONFIG_INVALID');
  return Object.freeze({server_url:api.href,web_origin:web.origin});
 }
 function assertInput(input){
  const pinned=config();
  if(input?.server_url!==pinned.server_url||input?.web_origin!==pinned.web_origin)throw Error('RELEASE_API_MISMATCH');
  return pinned;
 }
 function stateMatches(state){
  const pinned=config();
  return state?.phase==='UNREGISTERED'&&!state.executor_id||
   state?.server_url===pinned.server_url&&state?.web_origin===pinned.web_origin;
 }
 globalThis.FocurveDeploymentBinding=Object.freeze({config,assertInput,stateMatches});
})();
