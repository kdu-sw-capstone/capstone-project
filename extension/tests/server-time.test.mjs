import test from 'node:test';
import assert from 'node:assert/strict';
import { parseServerTime } from '../src/server-time.js';
test('Server UTC precision 0 through 9 fractional digits preserves millisecond floor',()=>{
 const prefix='2026-10-10T08:00:00';
 for(let digits=0;digits<=9;digits++){
  const fraction='123456789'.slice(0,digits);
  const value=prefix+(fraction?'.'+fraction:'')+'Z';
  const expected=Date.parse(prefix+'.'+fraction.padEnd(3,'0').slice(0,3)+'Z');
  assert.equal(parseServerTime(value),expected,value);
 }
 assert.equal(parseServerTime(prefix+'.000999999Z'),Date.parse(prefix+'Z'));
});
test('malformed dates and unsupported timestamp forms rejected instead of rollover',()=>{
 for(const value of [null,0,'2026-02-30T00:00:00Z','2026-13-01T00:00:00Z','2026-10-10T24:00:00Z','2026-10-10T00:00:60Z','2026-10-10T00:00:00.1234567890Z','2026-10-10T00:00:00+09:00','2026-10-10T00:00:00Zjunk'])assert.ok(Number.isNaN(parseServerTime(value)),String(value));
 assert.ok(Number.isFinite(parseServerTime('2024-02-29T00:00:00.123456789Z')));
});
