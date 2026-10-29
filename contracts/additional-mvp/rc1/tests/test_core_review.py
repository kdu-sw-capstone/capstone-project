"""Core review counterexamples. Fake authority/browser evidence is never product proof."""
import copy
import importlib.util
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
import reference_model as legacy
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

P=Path(__file__).resolve().parents[1]
S=json.loads((P/'schema.json').read_text('utf8'))
EX=json.loads((P/'examples.json').read_text('utf8'))['definitions']
spec=importlib.util.find_spec('review_reference')
if spec:
    import review_reference as revised
else:
    revised=None
MAX=9007199254740991
OWNER='00000000-0000-4000-8000-000000000001'
INSTALL='00000000-0000-4000-8000-000000000002'
def uid(n):return f'00000000-0000-4000-8000-{n:012d}'
def valid(name,value):
    registry=Registry().with_resource(S['$id'],Resource.from_contents(S))
    return Draft202012Validator({'$ref':S['$id']+'#/$defs/'+name},registry=registry).is_valid(value)
def clocked(n=1,mono_start=0,utc_start='2026-10-29T00:00:00.000Z',anchor_id='a',quality='TRUSTED',epoch='clock-1',boot='boot-1'):
    x=copy.deepcopy(EX['UsageSegment']);t=datetime.fromisoformat(utc_start.replace('Z','+00:00'))
    x.update(segment_id=uid(100+n),owner_binding_id=OWNER,executor_id=INSTALL,local_usage_seq=n,
        start_at=utc_start,end_at=(t+timedelta(seconds=5)).isoformat(timespec='milliseconds').replace('+00:00','Z'),
        day_start_at='2026-10-29T00:00:00.000Z',day_end_at='2026-10-30T00:00:00.000Z',timezone='UTC',
        confirmed_ms=5000,uncertain_ms=0,previous_segment_sha256=None,
        clock={'clock_epoch':epoch,'boot_id':boot,'anchor_id':anchor_id,'anchor_utc':utc_start,
          'anchor_mono_ms':mono_start,'mono_start_ms':mono_start,'mono_end_ms':mono_start+5000,
          'quality':quality,'observed_wall_start_at':utc_start,'observed_wall_end_at':(t+timedelta(seconds=5)).isoformat(timespec='milliseconds').replace('+00:00','Z')})
    if quality!='TRUSTED':x.update(confirmed_ms=0,uncertain_ms=5000,quality='PARTIAL')
    return seal(x)
def seal(x):x['payload_sha256']=legacy.digest(x,('payload_sha256',));return x
def trust(receiver,item):
    if revised:receiver.trust_anchor(item['clock']['anchor_id'],item['clock'])
def receiver():return revised.ClockedReceiver(OWNER,INSTALL) if revised else legacy.Receiver(OWNER,INSTALL)
def scope():return {'tab_id':7,'frame_id':0,'document_id':'document-a','scope_epoch':'epoch-a','generation':2,'owner_binding_id':OWNER}
def evidence():return {'extension_id':'extension-fixture','channel_bound':True,'scope':scope(),'current_scope':scope(),'request_id':'req','operation_id':'op','semantic_sha256':'hash','transport':'PRIVATE_PORT','sender':{'id':'extension-fixture'}}
def rule():return {'id':100000,'priority':1,'action':{'type':'block'},'condition':{'urlFilter':'||example.test^'}}

class CoreCounterexamples(unittest.TestCase):
    def test_cleanup_after_max_safe_sequence(self):
        message=copy.deepcopy(json.loads((P/'wire-fixtures.json').read_text('utf8'))['messages'][2]['value'])
        message['payload'].update(release_mode='CLEANUP_ONLY',control_seq=None)
        self.assertTrue(valid('Control',message),'RC1 rejects cleanup-only null sequence at normal sequence exhaustion')
        if revised:
            c=revised.CleanupLane(OWNER,2,'binding','footprint');c.normal_seq=MAX
            c.reserve('grant','op','receipt')
            self.assertEqual(c.release('grant','op','hash','receipt',OWNER,2,'binding','footprint',None),'RELEASED')
        else:
            c=legacy.ControlReceiver(OWNER,2);c.seq=MAX
            self.assertEqual(c.apply('op','hash',OWNER,2,None),'RELEASED')
    def test_clock_rollback_does_not_drop_distinct_real_interval(self):
        a=clocked();b=clocked(2,5000,anchor_id='b');b['previous_segment_sha256']=a['payload_sha256'];seal(b)
        r=receiver();trust(r,a);trust(r,b)
        self.assertEqual(r.receive(a),'ACCEPTED')
        self.assertEqual(r.receive(b),'ACCEPTED')
        self.assertEqual(r.total,10000)
    def test_worker_to_content_does_not_require_nonexistent_sender_tab(self):
        e=evidence();body={'scope':scope(),'request_id':'req','operation_id':'op','semantic_sha256':'hash'}
        if revised:accepted=revised.verify_direction('WORKER_TO_CONTENT',body,e)
        else:
            # Literal RC1 prose predicate; RC1 had no implemented direction-aware oracle.
            sender=e['sender'];accepted=sender.get('id')==e['extension_id'] and sender.get('tab',{}).get('id')==7 and sender.get('frameId')==0
        self.assertTrue(accepted)
    def test_focus_session_end_preserves_same_id_dynamic_runtime(self):
        if revised:
            d=revised.DnrCoordinator();d.seed('SESSION',rule());d.seed('DYNAMIC',rule())
            d.adopt('SESSION',100000,'focus',1,rule(),legacy_guarded=True,ownership_verified=True)
            d.adopt('DYNAMIC',100000,'runtime',1,rule(),legacy_guarded=True,ownership_verified=True)
            self.assertEqual(d.release_owner('focus',1,'end',d.writer_epoch),'RELEASED')
            self.assertFalse(d.banks['SESSION']);self.assertIn(100000,d.banks['DYNAMIC'])
        else:
            # Faithful counterexample to RC1's dynamic-only compiler description.
            banks={'SESSION':{100000:rule()},'DYNAMIC':{100000:rule()}}
            banks['DYNAMIC'].pop(100000)
            self.assertFalse(banks['SESSION']);self.assertIn(100000,banks['DYNAMIC'])

class CleanupBoundaryTests(unittest.TestCase):
    def setup_lane(self,**kwargs):
        c=revised.CleanupLane(OWNER,2,'binding','footprint');c.reserve('g','op','r',**kwargs);return c
    def call(self,c,**kwargs):
        args=dict(grant='g',operation='op',semantic='hash',receipt='r',owner=OWNER,generation=2,binding='binding',footprint='footprint',seq=None)
        args.update(kwargs);return c.release(**args)
    def test_safe_integer_and_gap_normal_lane(self):
        c=self.setup_lane();c.normal_seq=MAX-1
        self.assertEqual(c.normal('n','h',MAX),'APPLIED')
        with self.assertRaisesRegex(ValueError,'CONTROL_SEQUENCE_LIMIT'):c.normal('overflow','h',MAX+1)
        self.assertEqual(self.call(c),'RELEASED');self.assertEqual(c.normal_seq,MAX)
        c=self.setup_lane();self.assertEqual(c.normal('n','h',2),'PENDING_DEPENDENCY');self.assertEqual(self.call(c),'RELEASED')
    def test_lost_ack_and_duplicate_are_idempotent(self):
        c=self.setup_lane();self.assertEqual(self.call(c),'RELEASED');self.assertEqual(self.call(c),'DUPLICATE');self.assertEqual(c.effects,1)
        with self.assertRaisesRegex(ValueError,'IDEMPOTENCY_CONFLICT'):self.call(c,semantic='tampered')
    def test_reservation_and_receipt_exhaustion_preserve_obligation(self):
        for kwargs in [{'capacity':0},{'receipt_capacity':0}]:
            c=self.setup_lane(**kwargs)
            with self.assertRaisesRegex(ValueError,'CLEANUP_RESERVATION_EXHAUSTED'):self.call(c)
            self.assertTrue(c.obligation_pending);self.assertTrue(c.physical_remaining);self.assertEqual(c.effects,0)
    def test_owner_binding_footprint_generation_grant_receipt_checks(self):
        for kwargs in [{'owner':'foreign'},{'binding':'foreign'},{'footprint':'changed'},{'generation':3},{'grant':'unissued'},{'receipt':'wrong'},{'operation':'other'},{'sender_verified':False},{'seq':MAX},{'scope_digest':'changed-document'}]:
            c=self.setup_lane()
            with self.assertRaises(ValueError):self.call(c,**kwargs)
            self.assertTrue(c.obligation_pending);self.assertEqual(c.effects,0)
    def test_storage_and_receipt_failure_retry(self):
        c=self.setup_lane()
        with self.assertRaisesRegex(ValueError,'STORAGE_UNCONFIRMED'):self.call(c,persist=False)
        self.assertEqual(c.effects,0);self.assertEqual(self.call(c,receipt_fail=True),'IN_DOUBT');self.assertTrue(c.obligation_pending)
        restored=copy.deepcopy(c);self.assertEqual(self.call(restored),'RELEASED');self.assertEqual(restored.effects,1)
    def test_expiry_and_cross_lane_operation_reuse(self):
        c=self.setup_lane();c.grants['g']['valid']=False
        with self.assertRaises(ValueError):self.call(c)
        self.assertTrue(c.obligation_pending)
        c=self.setup_lane()
        with self.assertRaisesRegex(ValueError,'IDEMPOTENCY_CONFLICT'):c.normal('op','hash',1)
    def test_null_apply_and_normal_release_rejected(self):
        m=copy.deepcopy(json.loads((P/'wire-fixtures.json').read_text('utf8'))['messages'][0]['value']);m['payload']['control_seq']=None
        self.assertFalse(valid('Control',m))
        m=copy.deepcopy(json.loads((P/'wire-fixtures.json').read_text('utf8'))['messages'][2]['value']);m['payload']['control_seq']=None
        self.assertFalse(valid('Control',m))

class ClockBoundaryTests(unittest.TestCase):
    def chain(self,*items):
        for a,b in zip(items,items[1:]):b['previous_segment_sha256']=a['payload_sha256'];seal(b)
        return items
    def test_rollback_quarantine_then_normal_sequence_advances(self):
        a,b,c=self.chain(clocked(),clocked(2,5000,quality='ROLLBACK'),clocked(3,10000,utc_start='2026-10-29T00:00:10.000Z',anchor_id='c'))
        r=receiver();trust(r,a);trust(r,c)
        self.assertEqual(r.receive(a),'ACCEPTED');self.assertEqual(r.receive(b),'ACCEPTED_QUARANTINED');self.assertEqual(r.receive(c),'ACCEPTED')
        self.assertEqual(r.total,10000);self.assertEqual(r.last[c['collector_epoch']][0],3)
    def test_forward_clock_jump_is_not_confirmed(self):
        x=clocked(quality='FORWARD_JUMP');r=receiver();trust(r,x)
        self.assertEqual(r.receive(x),'ACCEPTED_QUARANTINED');self.assertEqual(r.total,0)
    def test_unknown_anchor_or_wall_drift_cannot_self_attest(self):
        x=clocked();r=receiver();self.assertEqual(r.receive(x),'ACCEPTED_QUARANTINED');self.assertEqual(r.total,0)
        x=clocked();r=receiver();trust(r,x);x['clock']['observed_wall_end_at']='2026-10-29T00:10:05.000Z';seal(x)
        self.assertEqual(r.receive(x),'ACCEPTED_QUARANTINED');self.assertEqual(r.total,0)
        x=clocked();r=receiver();trust(r,x)
        tampered=copy.deepcopy(x['clock']);tampered['anchor_mono_ms']=1
        with self.assertRaisesRegex(ValueError,'ANCHOR_ID_CONFLICT'):r.trust_anchor(x['clock']['anchor_id'],tampered)
    def test_pending_gap_duplicate_and_same_seq_conflict(self):
        a,b=self.chain(clocked(),clocked(2,5000,utc_start='2026-10-29T00:00:05.000Z',anchor_id='b'))
        r=receiver();trust(r,a);trust(r,b);self.assertEqual(r.receive(b),'PENDING_DEPENDENCY')
        altered=copy.deepcopy(b);altered['actual_host']='other.example.test';seal(altered)
        with self.assertRaisesRegex(ValueError,'SOURCE_CONFLICT'):r.receive(altered)
        self.assertEqual(r.receive(a),'ACCEPTED');self.assertEqual(r.receive(b),'ACCEPTED');self.assertEqual(r.receive(b),'DUPLICATE');self.assertEqual(r.total,10000)
        other=copy.deepcopy(b);other['segment_id']=uid(999);seal(other)
        with self.assertRaisesRegex(ValueError,'SEQUENCE_REUSE'):r.receive(other)
    def test_physical_overlap_still_rejected_despite_different_utc(self):
        a,b=self.chain(clocked(),clocked(2,0,utc_start='2026-10-29T00:00:10.000Z',anchor_id='b'))
        r=receiver();trust(r,a);trust(r,b);r.receive(a)
        with self.assertRaisesRegex(ValueError,'MONOTONIC_OVERLAP'):r.receive(b)
    def test_resolution_is_separate_idempotent_and_verified(self):
        x=clocked(quality='ROLLBACK');r=receiver();r.receive(x);original=copy.deepcopy(r.raw[x['segment_id']]['value'])
        c=x['clock'];proof={k:c[k] for k in ['clock_epoch','boot_id','mono_start_ms','mono_end_ms']}
        proof.update(source_hash=x['payload_sha256'],day_start_at=x['day_start_at'],day_end_at=x['day_end_at'],resolved_start_at=x['start_at'],resolved_end_at=x['end_at'],timezone=x['timezone'],timezone_version=x['timezone_version'],enforcement_day_chain_id=x['enforcement_day_chain_id'])
        with self.assertRaisesRegex(ValueError,'CLOCK_EVIDENCE_UNVERIFIED'):r.resolve(x['segment_id'],'resolution',proof)
        self.assertEqual(r.total,0);self.assertEqual(r.resolve(x['segment_id'],'resolution',proof,verified=True),'RESOLVED')
        self.assertEqual(r.resolve(x['segment_id'],'resolution',proof,verified=True),'DUPLICATE');self.assertEqual(r.total,5000)
        self.assertEqual(r.raw[x['segment_id']]['value'],original)
        with self.assertRaisesRegex(ValueError,'RESOLUTION_CONFLICT'):r.resolve(x['segment_id'],'resolution',dict(proof,source_hash='different'),verified=True)
        with self.assertRaisesRegex(ValueError,'ALREADY_COUNTED'):r.resolve(x['segment_id'],'another',proof,verified=True)
    def test_worker_restart_requires_reanchor_proof_and_keeps_seq(self):
        a,b,c=self.chain(clocked(),clocked(2,0,utc_start='2026-10-29T00:00:05.000Z',epoch='clock-2',boot='boot-2',anchor_id='b',quality='RESTART_UNCONFIRMED'),clocked(3,5000,utc_start='2026-10-29T00:00:10.000Z',epoch='clock-2',boot='boot-2',anchor_id='c'))
        r=receiver();trust(r,a);r.receive(a);restored=copy.deepcopy(r)
        self.assertEqual(restored.receive(b),'ACCEPTED_QUARANTINED');trust(restored,c)
        self.assertEqual(restored.receive(c),'ACCEPTED_QUARANTINED');self.assertEqual(restored.total,5000)
        r=receiver();trust(r,a);r.receive(a);r.receive(b)
        r.trust_anchor(c['clock']['anchor_id'],c['clock'],predecessor_hash=b['payload_sha256'],restart_verified=True)
        self.assertEqual(r.receive(c),'ACCEPTED');self.assertEqual(r.total,10000)
    def test_midnight_split_and_dst_bucket(self):
        x=clocked(utc_start='2026-10-29T23:59:57.000Z');r=receiver();trust(r,x)
        with self.assertRaisesRegex(ValueError,'DAY_BOUNDARY_SPLIT_REQUIRED'):r.receive(x)
        x=clocked(utc_start='2026-03-08T12:00:00.000Z');x.update(timezone='America/New_York',day_start_at='2026-03-08T05:00:00.000Z',day_end_at='2026-03-09T04:00:00.000Z');seal(x)
        r=receiver();trust(r,x);self.assertEqual(r.receive(x),'ACCEPTED')
        x=clocked(utc_start='2026-11-01T12:00:00.000Z');x.update(timezone='America/New_York',day_start_at='2026-11-01T04:00:00.000Z',day_end_at='2026-11-02T05:00:00.000Z');seal(x)
        r=receiver();trust(r,x);self.assertEqual(r.receive(x),'ACCEPTED')
    def test_safe_monotonic_boundary_and_projection_tamper(self):
        x=clocked(mono_start=MAX-5000);r=receiver();trust(r,x);self.assertEqual(r.receive(x),'ACCEPTED')
        x=clocked();x['clock']['mono_end_ms']=MAX+1;seal(x)
        with self.assertRaisesRegex(ValueError,'INVALID_MONOTONIC_INTERVAL'):receiver().receive(x)
        x=clocked();x['clock']['anchor_utc']='2026-10-29T00:10:00.000Z';seal(x)
        with self.assertRaisesRegex(ValueError,'ANCHOR_PROJECTION_MISMATCH'):receiver().receive(x)
    def test_midnight_normal_split_does_not_lose_next_day(self):
        a=clocked(utc_start='2026-10-29T23:59:55.000Z')
        b=clocked(2,5000,utc_start='2026-10-30T00:00:00.000Z',anchor_id='b')
        b.update(day_start_at='2026-10-30T00:00:00.000Z',day_end_at='2026-10-31T00:00:00.000Z')
        self.chain(a,b);r=receiver();trust(r,a);trust(r,b)
        self.assertEqual(r.receive(a),'ACCEPTED');self.assertEqual(r.receive(b),'ACCEPTED')
        self.assertEqual(sorted(r.day_totals.values()),[5000,5000])
    def test_verified_resolution_can_correct_day_without_mutating_raw(self):
        x=clocked(quality='ROLLBACK');r=receiver();r.receive(x);c=x['clock']
        proof={k:c[k] for k in ['clock_epoch','boot_id','mono_start_ms','mono_end_ms']}
        proof.update(source_hash=x['payload_sha256'],day_start_at='2026-10-30T00:00:00.000Z',day_end_at='2026-10-31T00:00:00.000Z',resolved_start_at='2026-10-30T00:00:00.000Z',resolved_end_at='2026-10-30T00:00:05.000Z',timezone='UTC',timezone_version=x['timezone_version'],enforcement_day_chain_id=x['enforcement_day_chain_id'])
        corrected=copy.deepcopy(c);corrected.update(anchor_utc=proof['resolved_start_at'],anchor_mono_ms=c['mono_start_ms'])
        r.trust_anchor('verified-corrected',corrected)
        resolution=copy.deepcopy(EX['ClockResolution']);resolution.update({k:proof[k] for k in ['source_hash','day_start_at','day_end_at','resolved_start_at','resolved_end_at','timezone','timezone_version','enforcement_day_chain_id']})
        resolution.update(resolution_id=uid(900),segment_id=x['segment_id'],anchor_id='verified-corrected',evidence_sha256=legacy.digest(proof),confirmed_ms=5000)
        self.assertTrue(valid('ClockResolution',resolution))
        for changed in [{'evidence_sha256':'1'*64},{'confirmed_ms':4000},{'anchor_id':'unknown'},{'source_hash':'1'*64}]:
            with self.subTest(changed=changed),self.assertRaises(ValueError):r.resolve_wire(dict(resolution,**changed),proof,verified=True)
        with self.assertRaises(ValueError):r.resolve_wire(resolution,proof,verified=False)
        self.assertEqual(r.resolve_wire(resolution,proof,verified=True),'RESOLVED')
        self.assertEqual(r.resolve_wire(resolution,proof,verified=True),'DUPLICATE')
        self.assertEqual(r.raw[x['segment_id']]['value']['start_at'],x['start_at'])
        self.assertEqual(next(iter(r.day_totals))[0],proof['day_start_at'])
    def test_negative_wall_clock_interval_is_quarantined_not_counted(self):
        x=clocked(quality='ROLLBACK');x['clock']['observed_wall_end_at']='2026-10-28T23:59:55.000Z';seal(x)
        r=receiver();self.assertEqual(r.receive(x),'ACCEPTED_QUARANTINED');self.assertEqual(r.total,0)

class DirectionBoundaryTests(unittest.TestCase):
    def body(self):return {'scope':scope(),'request_id':'req','operation_id':'op','semantic_sha256':'hash'}
    def test_content_sender_uses_real_browser_tuple(self):
        e=evidence();e['native_navigation_verified']=True;e['sender'].update(tab={'id':7},frameId=0,documentId='document-a')
        self.assertTrue(revised.verify_direction('CONTENT_TO_WORKER',self.body(),e))
        for change in [{'tab':{'id':99}},{'frameId':1},{'documentId':'old'},{'id':'other-extension'}]:
            bad=copy.deepcopy(e);bad['sender'].update(change)
            self.assertFalse(revised.verify_direction('CONTENT_TO_WORKER',self.body(),bad))
        e['sender']={'id':'extension-fixture'}
        self.assertFalse(revised.verify_direction('CONTENT_TO_WORKER',self.body(),e))
    def test_private_channel_and_pending_response_binding(self):
        e=evidence();e['channel_bound']=False
        self.assertFalse(revised.verify_direction('WORKER_TO_CONTENT',self.body(),e))
        e=evidence();e.update(transport='TABS_SEND_MESSAGE_RESPONSE',pending_call_bound=True)
        self.assertTrue(revised.verify_direction('CONTENT_RESPONSE_TO_WORKER',self.body(),e))
        b=self.body();b['request_id']='old';self.assertFalse(revised.verify_direction('CONTENT_RESPONSE_TO_WORKER',b,e))
        e['pending_call_bound']=False;self.assertFalse(revised.verify_direction('CONTENT_RESPONSE_TO_WORKER',self.body(),e))
    def test_spa_bfcache_and_old_scope_cleanup(self):
        e=evidence();e['current_scope']=dict(scope(),generation=3);b=self.body()
        self.assertFalse(revised.verify_direction('WORKER_TO_CONTENT',b,e))
        b.update(operation='RELEASE',release_mode='CLEANUP_ONLY');e.update(cleanup_grant_verified=True,exact_old_document_verified=True)
        self.assertTrue(revised.verify_direction('WORKER_TO_CONTENT',b,e))
        e['exact_old_document_verified']=False;self.assertFalse(revised.verify_direction('WORKER_TO_CONTENT',b,e))
    def test_internal_native_and_server_boundaries_are_distinct(self):
        self.assertFalse(revised.verify_direction('WORKER_TO_CORE',{'sender':'worker'},{}))
        self.assertTrue(revised.verify_direction('WORKER_TO_CORE',{},dict(trusted_internal_call=True,upstream_authorized=True)))
        native=dict(native_host_allowlist_verified=True,native_channel_bound=True,native_target_verified=True)
        self.assertTrue(revised.verify_direction('CORE_TO_NATIVE',{},native));native['native_target_verified']=False
        self.assertFalse(revised.verify_direction('CORE_TO_NATIVE',{},native))
        server=dict(pinned_server_verified=True,installation_proof_verified=True,operation_scope_verified=True)
        self.assertTrue(revised.verify_direction('NATIVE_TO_SERVER',{},server));server['operation_scope_verified']=False
        self.assertFalse(revised.verify_direction('NATIVE_TO_SERVER',{},server))

class DnrBoundaryTests(unittest.TestCase):
    def adopted(self,store='SESSION',owner='focus',rule_=None):
        d=revised.DnrCoordinator();r=rule_ or rule();d.seed(store,r);d.adopt(store,r['id'],owner,1,r,legacy_guarded=True,ownership_verified=True);return d
    def test_adoption_requires_fence_exact_rule_and_owner_proof(self):
        d=revised.DnrCoordinator();d.seed('SESSION',rule())
        with self.assertRaisesRegex(ValueError,'LEGACY_WRITER_NOT_FENCED'):d.adopt('SESSION',100000,'focus',1,rule())
        with self.assertRaisesRegex(ValueError,'OWNERSHIP_PROOF_REQUIRED'):d.adopt('SESSION',100000,'focus',1,rule(),legacy_guarded=True)
        with self.assertRaisesRegex(ValueError,'RULE_FOOTPRINT_MISMATCH'):d.adopt('SESSION',100000,'focus',1,dict(rule(),priority=9),legacy_guarded=True,ownership_verified=True)
    def test_other_owner_and_shared_claims_survive(self):
        d=self.adopted();d.adopt('SESSION',100000,'another',1,rule(),legacy_guarded=True,ownership_verified=True)
        d.release_owner('focus',1,'end',1);self.assertIn(100000,d.banks['SESSION'])
        with self.assertRaisesRegex(ValueError,'UNOWNED_RELEASE'):d.release_owner('foreign',1,'foreign',1)
        d.release_owner('another',1,'end-other',1);self.assertFalse(d.banks['SESSION'])
    def test_same_store_collision_and_foreign_rule_preservation(self):
        d=self.adopted();foreign=dict(rule(),id=100001);d.seed('SESSION',foreign)
        with self.assertRaisesRegex(ValueError,'RULE_ID_COLLISION'):d.install('SESSION',dict(rule(),priority=9),'runtime',1,'op',1)
        d.release_owner('focus',1,'end',1);self.assertEqual(d.banks['SESSION'],{100001:foreign})
    def test_old_writer_restart_and_session_lifetime(self):
        d=self.adopted();d.install('DYNAMIC',dict(rule(),id=1000000),'runtime',1,'apply',1)
        self.assertEqual(d.restart(),[])
        with self.assertRaisesRegex(ValueError,'STALE_DNR_WRITER'):d.release_owner('focus',1,'old-writer',1)
        d.banks['SESSION'].clear() # fake Chrome browser shutdown, not a coordinator cleanup
        missing=d.restart(verified_browser_restart=True)
        self.assertEqual(missing[0]['evidence'],'SESSION_STORE_RESET');self.assertIn(1000000,d.banks['DYNAMIC'])
        self.assertIn(('SESSION',100000),d.claims) # absence does not erase DOM/focus obligations
    def test_storage_failure_and_lost_release_receipt(self):
        d=self.adopted()
        with self.assertRaisesRegex(ValueError,'STORAGE_UNCONFIRMED'):d.release_owner('focus',1,'end',1,persist=False)
        self.assertIn(100000,d.banks['SESSION'])
        self.assertEqual(d.release_owner('focus',1,'end',1,fail_after_effect=True),'IN_DOUBT');self.assertTrue(d.claims)
        restored=copy.deepcopy(d);self.assertEqual(restored.release_owner('focus',1,'end',1),'RELEASED');self.assertFalse(restored.claims)
        self.assertEqual(restored.release_owner('focus',1,'end',1),'DUPLICATE')
    def test_focus_store_migration_is_not_implicit(self):
        d=self.adopted()
        with self.assertRaisesRegex(ValueError,'FOCUS_STORE_MIGRATION_UNSUPPORTED'):d.transition('focus',1,('SESSION',100000),('DYNAMIC',1000000),rule(),'move',1,policy_kind='FOCUS')
        self.assertIn(100000,d.banks['SESSION']);self.assertFalse(d.banks['DYNAMIC'])
    def test_transition_crash_target_first_and_resume(self):
        d=self.adopted(owner='runtime-transition');source=('SESSION',100000);target=('DYNAMIC',1000000)
        self.assertEqual(d.transition('runtime-transition',1,source,target,rule(),'move',1,stop_after_target=True),'IN_DOUBT')
        self.assertIn(100000,d.banks['SESSION']);self.assertIn(1000000,d.banks['DYNAMIC'])
        restored=copy.deepcopy(d);self.assertEqual(restored.transition('runtime-transition',1,source,target,rule(),'move',1),'APPLIED')
        self.assertFalse(restored.banks['SESSION']);self.assertIn(1000000,restored.banks['DYNAMIC'])
        self.assertEqual(restored.transition('runtime-transition',1,source,target,rule(),'move',1),'DUPLICATE')
    def test_transition_target_loss_does_not_remove_source(self):
        d=self.adopted(owner='runtime-transition');d.transition('runtime-transition',1,('SESSION',100000),('DYNAMIC',1000000),rule(),'move',1,stop_after_target=True)
        d.banks['DYNAMIC'].clear()
        with self.assertRaisesRegex(ValueError,'TARGET_EFFECT_UNCONFIRMED'):d.transition('runtime-transition',1,('SESSION',100000),('DYNAMIC',1000000),rule(),'move',1)
        self.assertIn(100000,d.banks['SESSION'])
    def test_quota_store_constraints_and_hash_mutation(self):
        d=revised.DnrCoordinator(session_limit=0,dynamic_limit=0)
        with self.assertRaisesRegex(ValueError,'DNR_QUOTA_EXCEEDED'):d.install('DYNAMIC',rule(),'runtime',1,'op',1)
        d=revised.DnrCoordinator()
        with self.assertRaisesRegex(ValueError,'SESSION_ONLY_CONDITION'):d.install('DYNAMIC',dict(rule(),condition={'tabIds':[7]}),'runtime',1,'op',1)
        d=self.adopted();d.banks['SESSION'][100000]['priority']=9
        with self.assertRaisesRegex(ValueError,'RULE_FOOTPRINT_MISMATCH'):d.release_owner('focus',1,'end',1)
        self.assertTrue(d.claims)
    def test_store_id_allocator_and_regex_unsafe_budgets(self):
        d=revised.DnrCoordinator();d.seed('DYNAMIC',dict(rule(),id=1000000))
        self.assertEqual(d.allocate('DYNAMIC'),1000001);self.assertEqual(d.allocate('SESSION'),100000)
        d.id_ranges['DYNAMIC']=(1000000,1000000)
        with self.assertRaisesRegex(ValueError,'DNR_ID_RESERVATION_EXHAUSTED'):d.allocate('DYNAMIC')
        d=revised.DnrCoordinator(regex_limit=0)
        with self.assertRaisesRegex(ValueError,'DNR_REGEX_QUOTA_EXCEEDED'):d.install('DYNAMIC',dict(rule(),id=1000000,condition={'regexFilter':'example'}),'runtime',1,'r',1)
        d=revised.DnrCoordinator(unsafe_limit=0)
        with self.assertRaisesRegex(ValueError,'DNR_UNSAFE_QUOTA_EXCEEDED'):d.install('DYNAMIC',dict(rule(),id=1000000,action={'type':'redirect','redirect':{'url':'https://example.test/'}}),'runtime',1,'r',1)
        d=revised.DnrCoordinator(cleanup_capacity=0)
        with self.assertRaisesRegex(ValueError,'CLEANUP_RESERVATION_EXHAUSTED'):d.install('DYNAMIC',dict(rule(),id=1000000),'runtime',1,'r',1)
        self.assertFalse(d.banks['DYNAMIC']);self.assertFalse(d.claims)

if __name__=='__main__':unittest.main()
