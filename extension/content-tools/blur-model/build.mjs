import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),out=new URL('../../build/blur-model/',import.meta.url);
const source=resolve(dirname(require.resolve('nsfwjs')),'../esm/models');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(out,{recursive:true});
const files={};async function put(name,bytes){await writeFile(new URL(name,out),bytes);files[name]={sha256:sha(bytes),bytes:Buffer.byteLength(bytes)};}
for(const [name,size,shards]of [['inception_v3',299,6],['mobilenet_v2',224,1]]){
  const model=(await import(pathToFileURL(resolve(source,name,'model.min.js')))).default;
  const weights=[];for(let i=1;i<=shards;i++)weights.push(Buffer.from((await import(pathToFileURL(resolve(source,name,`group1-shard${i}of${shards}.min.js`)))).default,'base64'));
  await put(name+'.json',JSON.stringify({modelTopology:model.modelTopology,weightSpecs:model.weightsManifest.flatMap(g=>g.weights),size}));
  await put(name+'.bin',Buffer.concat(weights));
}
await build({entryPoints:[fileURLToPath(new URL('worker.mjs',import.meta.url))],bundle:true,outfile:fileURLToPath(new URL('worker.js',out)),format:'iife',platform:'browser',target:'chrome120',minify:true,legalComments:'eof'});
const worker=await readFile(new URL('worker.js',out));files['worker.js']={sha256:sha(worker),bytes:worker.length};
for(const [pkg,name]of [['nsfwjs','NSFWJS-LICENSE'],['@tensorflow/tfjs','TENSORFLOW-LICENSE']]){
  const root=pkg==='nsfwjs'?resolve(dirname(require.resolve(pkg)),'../..'):dirname(require.resolve(pkg+'/package.json'));
  const bytes=await readFile(pkg==='nsfwjs'?resolve(root,'LICENSE'):new URL('TENSORFLOW-LICENSE.txt',import.meta.url));await put(name,bytes);
}
const manifest={format:'FOCURVE_BLUR_LOCAL_TEST_1',product_activation:false,level:'HIGH',threshold:0.75,
  sequence:['inception_v3','mobilenet_v2'],fusion:'SUM_PORN_HENTAI_SEXY_BOTH_MODELS_PRECISION_CANDIDATE',classes:['Drawing','Hentai','Neutral','Porn','Sexy'],
  packages:{nsfwjs:'4.2.1',tensorflow:'4.22.0'},source:'https://github.com/infinitered/nsfwjs/tree/v4.2.1',licenses:{nsfwjs:'MIT',tensorflow:'Apache-2.0'},files};
const bytes=JSON.stringify(manifest,null,2),digest=sha(bytes);await writeFile(new URL('manifest.json',out),bytes);
await writeFile(new URL('profile.mjs',out),`export const profile=Object.freeze(${JSON.stringify({id:'LOCAL_NSFWJS_421_PRECISION_CANDIDATE',sha256:digest,level:'HIGH',threshold:0.75,rule:'SUM_PORN_HENTAI_SEXY_BOTH_MODELS'})});\n`);
console.log(JSON.stringify({output:out.pathname,manifest_sha256:digest,total_bytes:Object.values(files).reduce((sum,v)=>sum+v.bytes,0)}));
