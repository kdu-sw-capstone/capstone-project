import {mkdir, copyFile, cp} from 'node:fs/promises';
const output = new URL('../build/content-harness/', import.meta.url);
await mkdir(new URL('content/',output),{recursive:true});
await cp(new URL('./chrome-harness/',import.meta.url),output,{recursive:true});
for (const name of ['changes','entry','shorts','features','keyword','controller','claim-ledger','navigation-surface','home','subscriptions','explore','explore-profile','masthead','watch-panels','autoplay','endcards','grayscale']) {
  await copyFile(new URL(`../content/${name}.mjs`,import.meta.url),new URL(`content/${name}.mjs`,output));
}
await mkdir(new URL('ui/',output),{recursive:true});
await copyFile(new URL('../ui/restriction.mjs',import.meta.url),new URL('ui/restriction.mjs',output));
console.log('TEST ONLY unpacked extension: ' + decodeURIComponent(output.pathname));
