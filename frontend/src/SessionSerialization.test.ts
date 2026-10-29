import{afterEach,expect,it,vi}from'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'Content-Type':'application/json'}});
const settle=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
it('login cookie rotation excludes concurrent CSRF bootstrap until response settles',async()=>{
 const{request,refreshCsrf}=await import('./api');let csrfCalls=0,loginStarted=false,release!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.endsWith('/csrf')){csrfCalls++;return json({csrf_token:'synthetic-csrf'});}if(url.endsWith('/login')){loginStarted=true;return new Promise<Response>(r=>release=r);}throw Error('unexpected');}));
 const login=request('/auth/login','POST',{email:'synthetic@example.invalid',password:'synthetic-only'});await settle();expect(loginStarted).toBe(true);const csrf=refreshCsrf();await settle();const during=csrfCalls;release(json({user_id:'1'}));await Promise.all([login,csrf]);expect(during).toBe(1);expect(csrfCalls).toBe(2);
});
it('inflight provider availability request finishes before login can rotate its cookie',async()=>{
 const{request,socialAuthorizationPath}=await import('./api');let providerStarted=false,loginCalls=0,release!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.endsWith('/csrf'))return json({csrf_token:'synthetic'});if(url.includes('/social/')){providerStarted=true;return new Promise<Response>(r=>release=r);}if(url.endsWith('/login')){loginCalls++;return json({user_id:'1'});}throw Error('unexpected');}));
 const provider=socialAuthorizationPath('google','login').catch(()=>null);await settle();expect(providerStarted).toBe(true);const login=request('/auth/login','POST',{});await settle();const during=loginCalls;release(json({error:{code:'PROVIDER_NOT_CONFIGURED'}},503));await Promise.all([provider,login]);expect(during).toBe(0);expect(loginCalls).toBe(1);
});
it('failed login releases the queue and never retries invalid credentials',async()=>{
 const{request,refreshCsrf}=await import('./api');let posts=0;vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.endsWith('/csrf')?json({csrf_token:'synthetic'}):(posts++,json({error:{code:'INVALID_CREDENTIALS'}},401))));await expect(request('/auth/login','POST',{})).rejects.toMatchObject({status:401});await expect(refreshCsrf()).resolves.toBe('synthetic');expect(posts).toBe(1);
});
it('logout cannot race an already in-flight login session replacement',async()=>{
 const{request}=await import('./api');let logoutCalls=0,release!:(r:Response)=>void;vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.endsWith('/csrf'))return json({csrf_token:'synthetic'});if(url.endsWith('/login'))return new Promise<Response>(r=>release=r);if(url.endsWith('/logout')){logoutCalls++;return new Response(null,{status:204});}throw Error('unexpected');}));const login=request('/auth/login','POST',{});await settle();const logout=request('/auth/logout','POST',{});await settle();const during=logoutCalls;release(json({user_id:'1'}));await Promise.all([login,logout]);expect(during).toBe(0);expect(logoutCalls).toBe(1);
});
