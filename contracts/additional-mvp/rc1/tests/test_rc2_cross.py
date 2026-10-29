"""Independent RC2 cross-checks. All browser/authority objects are synthetic."""
import copy
import json
import unittest
from pathlib import Path
from reference_model import digest
from review_reference import CleanupLane, ClockedReceiver, ContentOperationRegistry, DnrCoordinator, verify_direction
from test_core_review import OWNER, INSTALL, MAX, clocked, seal, trust, uid, rule, valid

P=Path(__file__).resolve().parents[1]
def case(name):return copy.deepcopy(json.loads((P/'content-review-fixtures.json').read_text('utf8'))[name])
def reseal(f):
    f['control']['payload']['semantic_sha256']=digest(f['control']['payload'],('semantic_sha256','channel_credential'))
    f['result']['semantic_sha256']=f['control']['payload']['semantic_sha256']
def registry(f):
    r=ContentOperationRegistry();r.issue(f['control'],f.get('prior_claims'),f.get('prior_footprint_sha256'));return r

class CrossCounterexamples(unittest.TestCase):
    def test_apply_cannot_succeed_with_released_effect(self):
        for name in ('media','blur','keyword'):
            f=case(name);f['result']['effects'][0].update(result='RELEASED',remaining_claim_count=0);f['result']['remaining_claim_count']=0
            with self.subTest(kind=name),self.assertRaises(ValueError):registry(f).validate(f['result'])
    def test_cleanup_receipt_cannot_be_reserved_twice(self):
        c=CleanupLane(OWNER,2,'binding','footprint');c.reserve('g1','op1','receipt')
        with self.assertRaises(ValueError):c.reserve('g2','op2','receipt')
    def test_rejected_chain_does_not_poison_valid_sequence(self):
        bad=clocked();bad['previous_segment_sha256']='1'*64;seal(bad)
        r=ClockedReceiver(OWNER,INSTALL)
        with self.assertRaises(ValueError):r.receive(bad)
        good=clocked();good['segment_id']=uid(999);seal(good);trust(r,good)
        self.assertEqual(r.receive(good),'ACCEPTED')
    def test_same_boot_epoch_rename_does_not_hide_physical_overlap(self):
        a=clocked();b=clocked(2,0,epoch='renamed-clock',anchor_id='b');b['previous_segment_sha256']=a['payload_sha256'];seal(b)
        r=ClockedReceiver(OWNER,INSTALL);trust(r,a);trust(r,b);r.receive(a)
        with self.assertRaises(ValueError):r.receive(b)
    def test_resolution_id_binds_full_envelope(self):
        x=clocked(quality='ROLLBACK');r=ClockedReceiver(OWNER,INSTALL);r.receive(x);c=x['clock']
        proof={k:c[k] for k in ('clock_epoch','boot_id','mono_start_ms','mono_end_ms')}
        proof.update({k:x[k] for k in ('day_start_at','day_end_at','timezone','timezone_version','enforcement_day_chain_id')})
        proof.update(source_hash=x['payload_sha256'],resolved_start_at=x['start_at'],resolved_end_at=x['end_at'])
        r.trust_anchor('a',c);r.trust_anchor('equivalent-anchor',c)
        res=copy.deepcopy(json.loads((P/'examples.json').read_text('utf8'))['definitions']['ClockResolution'])
        res.update({k:proof[k] for k in ('source_hash','day_start_at','day_end_at','resolved_start_at','resolved_end_at','timezone','timezone_version','enforcement_day_chain_id')})
        res.update(segment_id=x['segment_id'],anchor_id='a',evidence_sha256=digest(proof),confirmed_ms=5000)
        self.assertEqual(r.resolve_wire(res,proof,verified=True),'RESOLVED')
        with self.assertRaises(ValueError):r.resolve_wire(dict(res,anchor_id='equivalent-anchor'),proof,verified=True)
    def test_adoption_reserves_cleanup_before_taking_claim(self):
        d=DnrCoordinator(cleanup_capacity=0);d.seed('SESSION',rule())
        with self.assertRaises(ValueError):d.adopt('SESSION',100000,'focus',1,rule(),legacy_guarded=True,ownership_verified=True)
        self.assertFalse(d.claims);self.assertIn(100000,d.banks['SESSION'])
    def test_confirmed_dnr_release_returns_unresolved_budget(self):
        d=DnrCoordinator(cleanup_capacity=1);d.install('DYNAMIC',dict(rule(),id=1000000),'runtime',1,'apply',1)
        d.release_owner('runtime',1,'release',1)
        self.assertEqual(d.install('DYNAMIC',dict(rule(),id=1000001),'runtime',2,'next',1),'APPLIED')
        self.assertEqual(d.release_owner('runtime',1,'release',1),'DUPLICATE')
    def test_direct_context_requires_viewer_identity(self):
        context=case('media')['control']['payload']['projection']['document_context'];context['viewer_feature_id']=None
        self.assertFalse(valid('DocumentContext',context))
    def test_missing_browser_identity_fails_closed(self):
        self.assertFalse(verify_direction('WORKER_TO_CONTENT',{},dict(channel_bound=True,transport='PRIVATE_PORT')))

class CrossCoverage(unittest.TestCase):
    def test_shorts_and_reels_apply_fail_and_unconfirmed(self):
        for feature in ('YT-02','IG-02'):
            f=case('media');p=f['control']['payload'];p['projection']['features'][0]['feature_id']=feature
            if p['projection']['content'] is not None:p['projection']['content']['features']=copy.deepcopy(p['projection']['features'])
            p['projection']['document_context']['viewer_feature_id']=feature;f['result']['effects'][0]['feature_id']=feature;reseal(f)
            self.assertEqual(registry(f).validate(f['result']),'APPLIED')
            bad=copy.deepcopy(f);bad['result']['effects'][0]['media_stopped']=False
            with self.assertRaises(ValueError):registry(bad).validate(bad['result'])
            bad=copy.deepcopy(f);bad['result']['effects'][0].update(result='UNCONFIRMED',media_stopped=None)
            bad['result'].update(result_state='UNCONFIRMED',status='NACK',error_code='MEDIA_UNCONFIRMED')
            self.assertEqual(registry(bad).validate(bad['result']),'UNCONFIRMED')
    def test_expired_grant_renewal_preserves_operation_slots_and_receipt(self):
        c=CleanupLane(OWNER,2,'binding','footprint');c.reserve('grant','op','receipt');c.grants['grant']['valid']=False
        args=('grant','op','receipt',OWNER,2,'binding','footprint')
        with self.assertRaises(ValueError):c.revalidate(*args,native_verified=True)
        self.assertFalse(c.grants['grant']['valid']);self.assertTrue(c.obligation_pending)
        with self.assertRaises(ValueError):c.revalidate('grant','forged','receipt',OWNER,2,'binding','footprint',native_verified=True,exact_old_document_verified=True)
        c.revalidate(*args,native_verified=True,exact_old_document_verified=True)
        self.assertEqual(c.release('grant','op','semantic','receipt',OWNER,2,'binding','footprint',None,receipt_fail=True),'IN_DOUBT')
        c.grants['grant']['valid']=False;c.revalidate(*args,native_verified=True,exact_old_document_verified=True)
        self.assertEqual(c.grants['grant']['capacity'],0);self.assertEqual(c.grants['grant']['receipt_capacity'],0)
        self.assertEqual(c.release('grant','op','semantic','receipt',OWNER,2,'binding','footprint',None),'RELEASED');self.assertEqual(c.effects,1)
    def test_media_release_proof_for_both_platforms(self):
        wire=json.loads((P/'wire-fixtures.json').read_text('utf8'))['messages']
        for feature in ('YT-02','IG-02'):
            f={'control':copy.deepcopy(wire[2]['value']),'result':copy.deepcopy(wire[3]['value']),'prior_claims':copy.deepcopy(wire[3]['prior_claims']),'prior_footprint_sha256':wire[3]['prior_footprint_sha256']}
            claim=f['prior_claims'].pop('feature:YT-02');f['prior_claims']['feature:'+feature]=claim;f['result']['effects'][0]['feature_id']=feature
            self.assertEqual(registry(f).validate(f['result']),'RELEASED')
            f['result']['effects'][0]['restore']['media_restore_state']='UNCONFIRMED'
            with self.assertRaises(ValueError):registry(f).validate(f['result'])
    def test_schema_negative_and_failure_fixtures(self):
        fixtures=json.loads((P/'rc2-cross-fixtures.json').read_text('utf8'))['cases']
        self.assertEqual({f['id'] for f in fixtures},{'apply_released_feature','blur_apply_released','direct_viewer_identity_missing','blur_failed','keyword_unconfirmed','media_observing'})
        for f in fixtures:
            with self.subTest(case=f['id']):
                if f['expected']=='SCHEMA_REJECT':
                    self.assertFalse(valid(f['schema'],f['value']))
                else:self.assertEqual(registry(f).validate(f['result']),f['expected'])
    def test_sender_body_url_spa_bfcache_and_private_channel(self):
        scope={'tab_id':7,'frame_id':0,'document_id':'doc','scope_epoch':'scope','generation':2,'url_sha256':'0'*64}
        body={'scope':scope,'request_id':'req','operation_id':'op','semantic_sha256':'hash'}
        evidence={'scope':scope,'current_scope':scope,'channel_bound':True,'extension_id':'ext','sender':{'id':'ext','tab':{'id':7},'frameId':0,'documentId':'doc'},'native_navigation_verified':True}
        self.assertTrue(verify_direction('CONTENT_TO_WORKER',body,evidence))
        for changed in ({'url_sha256':'1'*64},{'generation':3},{'document_id':'other'}):
            e=copy.deepcopy(evidence);e['current_scope']=dict(scope,**changed)
            self.assertFalse(verify_direction('CONTENT_TO_WORKER',body,e))
        forged=copy.deepcopy(body);forged['scope']=dict(scope,tab_id=9)
        self.assertFalse(verify_direction('CONTENT_TO_WORKER',forged,evidence))
    def test_content_scope_update_and_operation_conflict(self):
        f=case('media');r=registry(f)
        for key in ('generation','tab_id','frame_id','url_sha256','document_id'):
            bad=copy.deepcopy(f['result']);value=bad['scope'][key]
            bad['scope'][key]=value+1 if isinstance(value,int) else ('1'*64 if key=='url_sha256' else 'other-document')
            with self.subTest(scope=key),self.assertRaises(ValueError):r.validate(bad)
        changed=copy.deepcopy(f);changed['control']['payload']['projection']['features'][0]['enabled']=False;reseal(changed)
        with self.assertRaisesRegex(ValueError,'IDEMPOTENCY_CONFLICT'):r.issue(changed['control'])
        update=copy.deepcopy(f);update['control']['payload']['operation']='UPDATE';reseal(update)
        self.assertTrue(valid('Control',update['control']))
        with self.assertRaisesRegex(ValueError,'MISSING_OWNED_FOOTPRINT'):ContentOperationRegistry().issue(update['control'])
    def test_all_features_streams_api_and_schema_catalog_preserved(self):
        def load(n):return json.loads((P/n).read_text('utf8'))
        self.assertEqual({x['id'] for x in load('traceability.json')['features']},{f'F{i:02}' for i in range(1,19)})
        self.assertEqual({x['id'] for x in load('feature-registry.json')['features']},{f'YT-{i:02}' for i in range(1,11)}|{f'IG-{i:02}' for i in range(1,7)})
        schema=load('schema.json')['$defs'];self.assertEqual(len(schema['Streams']['properties']),6)
        self.assertEqual(len(load('api.json')['operations']),25)
        for rule_id in (-1,0,True,2147483648):
            with self.subTest(rule_id=rule_id),self.assertRaises(ValueError):DnrCoordinator().install('DYNAMIC',dict(rule(),id=rule_id),'runtime',1,'invalid',1)
    def test_query_is_explicitly_unsupported_until_correlation_review(self):
        f=case('media');p=f['control']['payload']
        p['operation']='QUERY'
        for field in ('projection','cleanup_grant_id','execute_before'):p.pop(field)
        reseal(f);self.assertTrue(valid('Control',f['control']))
        with self.assertRaisesRegex(ValueError,'QUERY_CONTRACT_REVIEW_PENDING'):ContentOperationRegistry().issue(f['control'])

if __name__=='__main__':unittest.main()
