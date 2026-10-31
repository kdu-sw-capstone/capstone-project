import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyStart, evaluateOccurrence } from '../src/additional-schedule-plan.js';
const weekly = (localDate,startLocal,timezone) => weeklyStart({localDate,startLocal,timezone,weekdays:[1,2,3,4,5,6,7]});
test('IANA timezone local date and weekday are preserved', () => {
  assert.equal(weekly('2026-11-02','09:00','Asia/Seoul').startAt,'2026-11-02T00:00:00.000Z');
  assert.equal(weeklyStart({localDate:'2026-11-02',startLocal:'09:00',timezone:'Asia/Seoul',weekdays:[7]}).status,'NOT_SCHEDULED');
});
test('US spring gap skips; fall fold selects earlier occurrence exactly once', () => {
  assert.equal(weekly('2026-03-08','02:30','America/New_York').reason,'DST_GAP');
  assert.equal(weekly('2026-11-01','01:30','America/New_York').startAt,'2026-11-01T05:30:00.000Z');
});
test('half-hour DST and full skipped civil date are not shifted into another time', () => {
  assert.equal(weekly('2026-10-04','02:15','Australia/Lord_Howe').status,'SKIPPED');
  assert.equal(weekly('2026-04-05','01:45','Australia/Lord_Howe').startAt,'2026-04-04T14:45:00.000Z');
  assert.equal(weekly('2011-12-30','12:00','Pacific/Apia').status,'SKIPPED');
});
const input = {startAt:'2026-11-02T00:00:00.000Z',durationMinutes:5,nowAt:'2026-11-02T00:00:00.000Z',
  activeSession:false,alreadyIssued:false,recovered:false};
test('exact 60 seconds can start; less than 60 seconds expires without moving fixed end', () => {
  const ready=evaluateOccurrence({...input,nowAt:'2026-11-02T00:04:00.000Z'});
  assert.equal(ready.decision,'READY');assert.equal(ready.fixedEndAt,'2026-11-02T00:05:00.000Z');
  assert.equal(evaluateOccurrence({...input,nowAt:'2026-11-02T00:04:00.001Z'}).reason,'EXPIRED');
  assert.equal(evaluateOccurrence({...input,nowAt:'2026-11-02T00:05:00.000Z'}).decision,'SKIPPED');
});
test('active session wins, conflict retry retains fixed end and does not create extra duration', () => {
  assert.equal(evaluateOccurrence({...input,activeSession:true}).decision,'WAITING_CONFLICT');
  assert.equal(evaluateOccurrence({...input,activeSession:true,nowAt:'2026-11-02T00:04:01.000Z'}).decision,'SKIPPED');
  assert.equal(evaluateOccurrence({...input,nowAt:'2026-11-02T00:02:00.000Z'}).fixedEndAt,'2026-11-02T00:05:00.000Z');
});
test('restart cannot auto catch up; duplicate already issued remains issued even after deadline', () => {
  assert.equal(evaluateOccurrence({...input,recovered:true}).decision,'WAIT_USER');
  assert.equal(evaluateOccurrence({...input,alreadyIssued:true,nowAt:'2026-11-02T00:10:00.000Z'}).decision,'ALREADY_ISSUED');
  assert.equal(evaluateOccurrence({...input,nowAt:'2026-11-01T23:59:59.999Z'}).decision,'NOT_DUE');
});
test('overnight physical end and DST elapsed duration are retained', () => {
  assert.equal(evaluateOccurrence({...input,startAt:'2026-11-01T05:30:00.000Z',nowAt:'2026-11-01T05:30:00.000Z',durationMinutes:120}).fixedEndAt,'2026-11-01T07:30:00.000Z');
});
test('invalid dates, zones, inputs and implicit authorization flags fail closed', () => {
  for (const [date,time,zone] of [['2026-02-30','09:00','UTC'],['2026-11-01','24:00','UTC'],['2026-11-01','09:00','Invalid/Zone']]) assert.throws(()=>weekly(date,time,zone),/INVALID/);
  assert.throws(()=>evaluateOccurrence({...input,durationMinutes:181}),/INVALID/);
  assert.throws(()=>evaluateOccurrence({...input,alreadyIssued:undefined}),/INVALID/);
});
