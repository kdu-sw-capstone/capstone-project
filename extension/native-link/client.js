/* Product-only native handshake. No AI observer, storage or service control. */
(function(root){
 'use strict';
 function create(env){
  let busy=false;
  function inspect(){
   const c=env.config;
   if(!c||c.contract!=='FOCURVE_NATIVE_LINK_CONFIG_1'||!/^[a-f0-9]{32}$/.test(c.installationId??'')||c.extensionId!==env.extensionId||c.host!=='com.focurve.install_'+c.installationId||!Number.isFinite(Date.parse(c.notAfterUTC)))return {state:'CONFIGURATION_REQUIRED',canConnect:false};
   return Date.parse(c.notAfterUTC)<=env.now()?{state:'SCOPE_EXPIRED',canConnect:false}:{state:'AVAILABLE',canConnect:true};
  }
  async function connect(){
   if(busy)throw Error('NATIVE_LINK_BUSY');
   const c=env.config,check=inspect();
   if(!check.canConnect)throw Error(check.state==='SCOPE_EXPIRED'?'NATIVE_LINK_SCOPE_EXPIRED':'NATIVE_LINK_CONFIGURATION_REQUIRED');
   busy=true;let timer;
   try{
    const nonce=env.nonce();if(!/^[a-f0-9]{32}$/.test(nonce))throw Error('NATIVE_NONCE_INVALID');
    const request={contract:'FOCURVE_NATIVE_LINK_1',operation:'HELLO',installationId:c.installationId,extensionId:c.extensionId,nonce};
    const result=await Promise.race([env.send(c.host,request),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('NATIVE_LINK_TIMEOUT')),env.timeoutMs??8000);})]);
    if(env.now()>=Date.parse(c.notAfterUTC)||result?.contract!==request.contract||result?.state!=='CONNECTED'||result?.nonce!==nonce||result?.installationId!==c.installationId||result?.extensionId!==c.extensionId||result?.capability!=='LINK_ONLY_NO_SERVICE_CONTROL')throw Error('NATIVE_REPLY_UNCONFIRMED');
    return {state:'CONNECTED',servicesReady:false};
   }finally{clearTimeout(timer);busy=false;}
  }
  return Object.freeze({connect,inspect});
 }
 const api=Object.freeze({create});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FocurveNativeLink=api;
})(typeof globalThis!=='undefined'?globalThis:this);
