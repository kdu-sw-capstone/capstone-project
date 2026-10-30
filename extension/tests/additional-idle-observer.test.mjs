import test from 'node:test';
import assert from 'node:assert/strict';
import { AdditionalIdleObserver } from '../src/additional-idle-observer.js';
const event = () => {
  const listeners = new Set();
  return { addListener: f => listeners.add(f), removeListener: f => listeners.delete(f),
    fire: value => [...listeners].forEach(f => f(value)), size: () => listeners.size };
};
function setup() {
  const observations = [], queried = [], intervals = [];
  const idle = { onStateChanged: event(), setDetectionInterval: n => intervals.push(n),
    queryState: async n => { queried.push(n); return 'active'; } };
  const permissions = { contains: async () => true, onRemoved: event() };
  let mono = 0;
  const observer = new AdditionalIdleObserver({ idle, permissions,
    onObservation: o => observations.push(o), now: () => mono });
  return { observer, idle, permissions, observations, queried, intervals, clock: n => { mono = n; } };
}
test('first observation is unavailable; threshold is 60 and no retroactive subtraction', async () => {
  const h = setup(); await h.observer.start();
  assert.deepEqual(h.queried, [60]); assert.deepEqual(h.intervals, [60]);
  assert.equal(h.observations[0].requiresLimitedSiteHold, true);
  h.clock(60000); h.idle.onStateChanged.fire('idle');
  h.clock(90000); h.idle.onStateChanged.fire('active');
  assert.deepEqual(h.observations.map(o => [o.state, o.observedMonoMs]),
    [['UNAVAILABLE',0],['active',0],['idle',60000],['active',90000]]);
});
test('locked stops eligibility, invalid state requires hold', async () => {
  const h = setup(); await h.observer.start(); h.idle.onStateChanged.fire('locked');
  assert.equal(h.observations.at(-1).collectionEligible, false);
  h.idle.onStateChanged.fire('unexpected'); assert.equal(h.observations.at(-1).quality, 'UNKNOWN');
});
test('denied permission and failed query never produce active observations', async () => {
  for (const fault of ['permission','query']) {
    const h = setup();
    if (fault === 'permission') h.permissions.contains = async () => false;
    else h.idle.queryState = async () => { throw Error('API failure'); };
    await h.observer.start(); assert.ok(h.observations.every(o => !o.collectionEligible));
  }
});
test('new state event wins over delayed initial query', async () => {
  const h = setup(); let resolve;
  h.idle.queryState = () => new Promise(r => { resolve = r; });
  const starting = h.observer.start(); await Promise.resolve();
  h.idle.onStateChanged.fire('locked'); resolve('active'); await starting;
  assert.equal(h.observations.at(-1).state, 'locked');
});
test('revocation invalidates in-flight query and requires fresh startup', async () => {
  const h = setup(); let resolve;
  h.idle.queryState = () => new Promise(r => { resolve = r; });
  const starting = h.observer.start(); await Promise.resolve();
  h.permissions.onRemoved.fire({ permissions: ['idle'] }); resolve('active'); await starting;
  assert.equal(h.observations.at(-1).state, 'UNAVAILABLE');
  h.idle.onStateChanged.fire('active');
  assert.equal(h.observations.at(-1).state, 'UNAVAILABLE');
});
test('stopped query cannot emit, repeated start has one listener', async () => {
  const h = setup(); let resolve;
  h.idle.queryState = () => new Promise(r => { resolve = r; });
  const starting = h.observer.start(); await Promise.resolve(); h.observer.stop();
  const count = h.observations.length; resolve('active'); await starting;
  assert.equal(h.observations.length, count);
  h.idle.queryState = async () => 'active'; await h.observer.start(); await h.observer.start();
  assert.equal(h.idle.onStateChanged.size(), 1); assert.equal(h.permissions.onRemoved.size(), 1);
});
