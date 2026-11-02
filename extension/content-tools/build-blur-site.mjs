import {mkdir,cp,copyFile} from 'node:fs/promises';
const out=new URL('../build/blur-site-harness/',import.meta.url);
await mkdir(new URL('content/',out),{recursive:true});
await cp(new URL('blur-site/',import.meta.url),out,{recursive:true});
await cp(new URL('../build/blur-model/',import.meta.url),new URL('model/',out),{recursive:true});
for(const name of ['blur-session','blur-classifier'])await copyFile(new URL('../content/'+name+'.mjs',import.meta.url),new URL('content/'+name+'.mjs',out));
console.log('TEST ONLY: '+decodeURIComponent(out.pathname));
