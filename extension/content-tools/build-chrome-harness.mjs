import {mkdir, copyFile, cp} from 'node:fs/promises';
const output = new URL('../build/content-harness/', import.meta.url);
await mkdir(new URL('content/',output),{recursive:true});
await cp(new URL('./chrome-harness/',import.meta.url),output,{recursive:true});
for (const name of ['changes','entry','shorts','features','keyword','controller']) {
  await copyFile(new URL(`../content/${name}.mjs`,import.meta.url),new URL(`content/${name}.mjs`,output));
}
console.log('TEST ONLY unpacked extension: ' + decodeURIComponent(output.pathname));
