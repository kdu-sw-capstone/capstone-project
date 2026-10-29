import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildA1} from '../scripts/build-a1.mjs';
import {buildMemberA1} from '../scripts/build-member-a1.mjs';
test('guest sender fix sources reproduce the shipped content and worker bundles',async()=>{
 const actual=buildA1();assert.equal(actual.content,await readFile(new URL('../a1/content.bundle.js',import.meta.url),'utf8'));assert.equal(actual.core,await readFile(new URL('../background/a1-core.bundle.js',import.meta.url),'utf8'));
});
test('member sources reproduce the shipped content and worker bundles',async()=>{
 const actual=buildMemberA1();assert.equal(actual.content,await readFile(new URL('../member-a1/content.bundle.js',import.meta.url),'utf8'));assert.equal(actual.core,await readFile(new URL('../background/member-a1-core.bundle.js',import.meta.url),'utf8'));
});
