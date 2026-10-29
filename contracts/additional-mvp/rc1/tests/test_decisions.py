"""Only changed decision boundaries. All browser/clock authority is synthetic."""
import copy,json,unittest
from pathlib import Path
from reference_model import digest,Focus
from review_reference import ContentOperationRegistry,verify_direction
from decision_reference import ContentQueries,ProofPorts,ConservativeBudget,IdleMeasurement
from test_contract import validator

P=Path(__file__).resolve().parents[1]
def fixtures():return json.loads((P/'decision-fixtures.json').read_text('utf8'))
def effect(name='media'):return json.loads((P/'content-review-fixtures.json').read_text('utf8'))[name]
def uid(n):return f'00000000-0000-4000-8000-{n:012}'
def seal(q):q['query_sha256']=digest(q,('query_sha256','channel_credential'));return q

class QueryDecisions(unittest.TestCase):
    def setup_query(self,name='media',seq=None):
        f=effect(name);p=f['control']['payload']
        if seq is not None:p['control_seq']=seq;p['semantic_sha256']=digest(p,('semantic_sha256','channel_credential'))
        reg=ContentOperationRegistry();reg.issue(f['control'],f.get('prior_claims'),f.get('prior_footprint_sha256'))
        q=fixtures()['query'];q.update(scope=copy.deepcopy(p['scope']),target_operation_id=p['operation_id'],target_semantic_sha256=p['semantic_sha256'],cleanup_grant_id=p['cleanup_grant_id'] if p.get('release_mode')=='CLEANUP_ONLY' else None);seal(q)
        oracle=ContentQueries(reg)
        def authority(request):
            if request['scope']!=q['scope'] or request['channel_credential']!=q['channel_credential']:raise ValueError('UNAUTHORIZED_QUERY')
        return f,q,oracle,authority
    def run_query(self,o,q,authority,**kw):return o.query(q,authorize=authority,as_of='2026-10-29T00:01:00.000Z',**kw)
    def test_strict_positive_and_negative_query_fixtures(self):
        f=fixtures();validator('ContentQuery').validate(f['query']);validator('ContentQueryResult').validate(f['response'])
        for x in f['invalid']:
            with self.subTest(x['case']):self.assertFalse(validator(x['schema']).is_valid(x['value']))
    def test_query_at_max_and_seq_gap_does_not_write_issuer(self):
        for seq in (9007199254740991,7):
            f,q,o,a=self.setup_query(seq=seq);before=copy.deepcopy(o.issued.issued)
            self.assertEqual(self.run_query(o,q,a)['lookup_state'],'FOUND');self.assertEqual(o.issued.issued,before)
            self.assertNotIn('control_seq',q)
    def test_query_null_cleanup_without_consuming_or_releasing(self):
        f,q,o,a=self.setup_query('blur_release');self.assertIsNone(f['control']['payload']['control_seq'])
        before=copy.deepcopy(o.issued.issued);self.assertEqual(self.run_query(o,q,a)['lookup_state'],'FOUND');self.assertEqual(o.issued.issued,before)
    def test_query_request_hash_target_and_scope_response_binding(self):
        f,q,o,a=self.setup_query();r=self.run_query(o,q,a)
        for field,value in [('request_id',uid(900)),('query_sha256','1'*64),('target_operation_id',uid(901)),('target_semantic_sha256','1'*64),('scope',dict(q['scope'],generation=2))]:
            with self.subTest(field=field),self.assertRaises(ValueError):o.validate_response(q,dict(r,**{field:value}))
    def test_target_hash_tamper_and_query_hash_tamper_rejected(self):
        for field in ('target_semantic_sha256','query_sha256'):
            f,q,o,a=self.setup_query();bad=copy.deepcopy(q);bad[field]='1'*64
            if field!='query_sha256':seal(bad)
            with self.subTest(field=field),self.assertRaises(ValueError):self.run_query(o,bad,a)
    def test_lost_response_replay_and_conflicting_query_id(self):
        f,q,o,a=self.setup_query();r=self.run_query(o,q,a,progress='IN_DOUBT')
        self.assertEqual(self.run_query(o,q,a,progress='TERMINAL'),r)
        bad=seal(dict(q,target_operation_id=uid(902)))
        with self.assertRaisesRegex(ValueError,'QUERY_ID_CONFLICT'):self.run_query(o,bad,a)
    def test_replay_rechecks_current_authority(self):
        f,q,o,a=self.setup_query();self.run_query(o,q,a)
        def revoked(_):raise ValueError('AUTH_REVOKED')
        with self.assertRaisesRegex(ValueError,'AUTH_REVOKED'):self.run_query(o,q,revoked)
    def test_historical_applied_is_not_current_effect(self):
        f,q,o,a=self.setup_query();o.receipt(f['result']);r=self.run_query(o,q,a,progress='IN_DOUBT')
        self.assertEqual(r['historical_receipt']['result_state'],'APPLIED');self.assertIsNone(r['current_effect'])
        self.assertEqual(o.validate_response(q,r),'FOUND')
        bad=copy.deepcopy(r);bad['historical_receipt']['operation_id']=uid(903)
        with self.assertRaises(ValueError):o.validate_response(q,bad)
    def test_fresh_effect_requires_independent_document_observation(self):
        f,q,o,a=self.setup_query();obs={'document_verified':True,'scope_sha256':digest(q['scope']),'state':'RELEASED','footprint_sha256':'1'*64,'observed_at':'2026-10-29T00:01:00.000Z'}
        r=self.run_query(o,q,a,observation=obs);self.assertEqual(r['current_effect']['state'],'RELEASED')
        q=seal(dict(q,request_id=uid(904)));obs['scope_sha256']='0'*64
        with self.assertRaises(ValueError):self.run_query(o,q,a,observation=obs)
    def test_missing_evicted_and_storage_unknown_are_distinct(self):
        for expected,store in [('NOT_FOUND',True),('EVICTED',True),('UNKNOWN',False)]:
            f,q,o,a=self.setup_query();o.issued.issued.clear()
            if expected=='EVICTED':o.evicted.add(q['target_operation_id'])
            r=self.run_query(o,q,a,store_available=store);self.assertEqual(r['lookup_state'],expected)
            self.assertIsNone(r['historical_receipt']);self.assertIsNone(r['current_effect'])
            self.assertEqual(r['status'],'NACK' if expected=='UNKNOWN' else 'ACK')
    def test_storage_recovery_does_not_cache_unknown_as_success(self):
        f,q,o,a=self.setup_query();self.assertEqual(self.run_query(o,q,a,store_available=False)['lookup_state'],'UNKNOWN')
        self.assertEqual(self.run_query(o,q,a)['lookup_state'],'FOUND')

class PortDecisions(unittest.TestCase):
    def setup_port(self):
        scope=fixtures()['query']['scope'];scope['url_sha256']='1'*64
        sender={'id':'own-extension','tab_id':scope['tab_id'],'frame_id':0,'document_id':scope['document_id'],'origin':'https://video.example.test','url_hash':'1'*64}
        frame={k:sender[k] for k in ('tab_id','frame_id','document_id','origin','url_hash')};frame.update(lifecycle='active',boot_id='boot-1')
        proof={'attested':True,'proof_id':'proof-1','boot_id':'boot-1','scope_hash':digest(scope),'credential_hash':digest({'credential':'credential-1'}),'registered_sender_url_hash':'1'*64,'native_url_hash':'1'*64}
        ports=ProofPorts();ports.register('private-handle',scope,sender,frame,proof,'credential-1','own-extension')
        return ports,scope,sender,frame,proof
    def test_normal_apply_and_forged_port_name_body_url_are_not_authority(self):
        p,s,_,f,_=self.setup_port();self.assertTrue(p.authorize('private-handle',s,'credential-1',f))
        with self.assertRaises(ValueError):p.authorize('same-port-name',s,'credential-1',f)
        with self.assertRaises(ValueError):p.authorize('private-handle',dict(s,document_id='other'),'credential-1',f)
    def test_unattested_endpoint_and_bad_registration_url_rejected(self):
        for field,value in [('attested',False),('registered_sender_url_hash','9'*64)]:
            p,s,sender,f,proof=self.setup_port();proof[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):p.register('forged',s,sender,f,proof,'credential-1','own-extension')
    def test_spa_requires_committed_revalidated_scope_not_body_handoff(self):
        p,s,sender,f,proof=self.setup_port();f['url_hash']='2'*64
        with self.assertRaises(ValueError):p.authorize('private-handle',s,'credential-1',f,handoff={'verified':True})
        s['generation']=2;s['url_sha256']='2'*64
        proof.update(scope_hash=digest(s),credential_hash=digest({'credential':'credential-2'}),native_url_hash='2'*64,navigation_revalidated=True,proof_id='proof-2')
        p.register('new-handle',s,sender,f,proof,'credential-2','own-extension')
        self.assertTrue(p.authorize('new-handle',s,'credential-2',f,sender_hash='1'*64))
        with self.assertRaises(ValueError):p.authorize('private-handle',s,'credential-1',f)
    def test_bfcache_boot_and_url_mismatch_rejected(self):
        for change in ({'lifecycle':'cached'},{'boot_id':'boot-2'},{'url_hash':'3'*64},{'document_id':'other'}):
            p,s,_,f,_=self.setup_port()
            with self.subTest(change=change),self.assertRaises(ValueError):p.authorize('private-handle',s,'credential-1',dict(f,**change))
    def test_old_scope_grant_is_exact_target_expiring_and_read_only(self):
        p,s,_,f,proof=self.setup_port();p.live['private-handle']['active']=False
        grant={'scope_hash':digest(s),'target':'old-operation','proof_id':proof['proof_id'],'expires':10,'exact_old_document_verified':True}
        self.assertTrue(p.authorize('private-handle',s,'credential-1',f,old_grant=grant,target='old-operation',now=5))
        for target,now in [('other-operation',5),('old-operation',10)]:
            with self.assertRaises(ValueError):p.authorize('private-handle',s,'credential-1',f,old_grant=grant,target=target,now=now)
        with self.assertRaises(ValueError):p.authorize('private-handle',s,'credential-1',f)
    def test_direction_adapter_old_scope_query_binds_grant_and_target(self):
        q=fixtures()['query'];q['cleanup_grant_id']=uid(600)
        e={'extension_id':'own','sender':{'id':'own'},'scope':q['scope'],'current_scope':dict(q['scope'],generation=2),
           'channel_bound':True,'transport':'PRIVATE_PORT','cleanup_grant_verified':True,'exact_old_document_verified':True,
           'cleanup_grant_id':q['cleanup_grant_id'],'target_operation_id':q['target_operation_id'],'target_semantic_sha256':q['target_semantic_sha256']}
        self.assertTrue(verify_direction('WORKER_TO_CONTENT',q,e))
        self.assertFalse(verify_direction('WORKER_TO_CONTENT',dict(q,target_operation_id=uid(601)),e))
    def test_reconnect_revalidates_and_rotates(self):
        p,s,sender,f,proof=self.setup_port()
        with self.assertRaises(ValueError):p.register('new',s,sender,f,proof,'credential-1','own-extension')
        proof.update(credential_hash=digest({'credential':'credential-2'}),proof_id='proof-2');p.register('new',s,sender,f,proof,'credential-2','own-extension')
        self.assertTrue(p.authorize('new',s,'credential-2',f));self.assertNotIn('private-handle',p.live)

class FrozenAndBudgetDecisions(unittest.TestCase):
    def test_resume_freezes_both_snapshot_and_attachment(self):
        attachment={'id':'frozen','options':{'YT-01':True}};snapshot={'id':'snapshot'}
        f=Focus(snapshot,100,attachment);f.applied(True);f.pause(True)
        attachment['options']['YT-01']=False
        with self.assertRaisesRegex(ValueError,'ATTACHMENT'):f.resume(snapshot,True,attachment)
        self.assertEqual(f.state,'PAUSED');f.resume(snapshot,True,{'id':'frozen','options':{'YT-01':True}})
        self.assertEqual(f.state,'RUNNING');self.assertTrue(f.runtime_active)
    def test_uncertain_reservation_keeps_existing_debit_and_no_confirmed_increase(self):
        b=ConservativeBudget(60000,10000);before=b.remaining();b.reserve('segment','hash',5000)
        self.assertEqual(b.confirmed,0);self.assertEqual(b.remaining(),before-5000)
        b.reserve('segment','hash',5000);self.assertEqual(b.remaining(),45000)
        with self.assertRaises(ValueError):b.reserve('segment','different',5000)
    def test_unknown_length_or_day_blocks_only_until_verified_resolution(self):
        for duration,day in [(None,True),(5000,False)]:
            b=ConservativeBudget(60000,10000);b.reserve('gap','hash',duration,day)
            self.assertEqual(b.remaining(),0)
            with self.assertRaises(ValueError):b.resolve('gap','hash',5000)
            b.resolve('gap','hash',5000,verified=True);self.assertEqual(b.remaining(),45000)
    def test_resolution_replaces_reservation_once_and_preserves_prior_debit(self):
        b=ConservativeBudget(60000,10000);b.reserve('segment','hash',5000)
        with self.assertRaises(ValueError):b.resolve('segment','hash',3000,verified=True)
        self.assertEqual(b.resolve('segment','hash',5000,verified=True),'RESOLVED')
        self.assertEqual(b.existing,10000);self.assertEqual(b.confirmed,5000);self.assertEqual(b.remaining(),45000)
        self.assertEqual(b.resolve('segment','hash',5000,verified=True),'DUPLICATE')
        with self.assertRaises(ValueError):b.resolve('segment','hash',0,verified=True)
    def test_idle_first_sixty_seconds_is_not_retroactively_free(self):
        m=IdleMeasurement();m.observe(0,'active');m.observe(60000,'idle');self.assertEqual(m.observed_debit,60000)
        m.observe(120000,'idle');self.assertEqual(m.observed_debit,60000)
        m.observe(0,'active');m.observe(5000,'active');self.assertEqual(m.observed_debit,65000)
    def test_idle_permission_or_api_failure_is_unknown_not_zero_success(self):
        m=IdleMeasurement();m.observe(0,'active');m.observe(5000,'active')
        self.assertEqual(m.observe(5000,'active',available=False),'RESTRICT_QUOTA_SITES')
        self.assertEqual(m.quality,'UNKNOWN');self.assertEqual(m.observed_debit,5000)
    def test_idle_callback_delay_is_not_performance_success(self):
        m=IdleMeasurement();m.observe(0,'active');self.assertEqual(m.observe(61000,'idle'),'IDLE_DELAY_UNCERTAIN')
        self.assertEqual(m.quality,'PARTIAL')

if __name__=='__main__':unittest.main()
