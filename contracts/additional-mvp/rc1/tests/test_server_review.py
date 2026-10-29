"""Web/Server/DB contract tests, not HTTP/product implementation acceptance."""
import copy,json,unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from jsonschema import Draft202012Validator
P=Path(__file__).resolve().parents[1]
API=json.loads((P/'api.json').read_text('utf8'))
def op(id):return next(x for x in API['operations'] if x['id']==id)
def query(id):return API['query_definitions'][op(id)['query_schema']]
try:from server_reference import Principal,Binding,authorize,ConfigStore,Failure
except ImportError:Principal=Binding=authorize=ConfigStore=Failure=None

class ServerCounterexamples(unittest.TestCase):
    def test_timezone_operations_select_exact_executor(self):
        for id in ('TZ-01','TZ-02'):
            self.assertIn('executor_id',query(id).get('required',[]),id)
    def test_installation_statistics_requires_executor(self):
        q={'scope':'INSTALLATION','from_date':'2026-10-29','to_date':'2026-10-29'}
        self.assertFalse(Draft202012Validator(query('STA-01')).is_valid(q))
    def test_existing_idempotency_precedes_mutation_precondition(self):
        text=(P.parents[2]/'docs/design/additional-mvp-contracts/02_API_DB.md').read_text('utf8')
        # Baseline document-order reproduction, not a fabricated product HTTP failure.
        order=API.get('transaction_contract',{}).get('steps',[])
        if not order:order=['AUTH','CAPABILITY','OWNER_LOCK','PRECONDITION','IDEMPOTENCY','VALIDATE','COMMIT']
        self.assertLess(order.index('EXISTING_IDEMPOTENCY') if 'EXISTING_IDEMPOTENCY' in order else order.index('IDEMPOTENCY'),order.index('PRECONDITION'))

class ServerBoundaryTests(unittest.TestCase):
    def setUp(self):
        if ConfigStore is None:self.skipTest('server reference not yet implemented')
        self.w=Principal('W',1);self.e=Principal('E',1,'install',1);self.b=Binding('binding',1,'install',1)
    def test_owner_guest_token_and_body_identity_boundaries(self):
        for actor in (Principal('I',None),Principal('W',2),Principal('E',1,'other',1),Principal('E',1,'install',2),Principal('E',2,'install',1)):
            with self.subTest(actor=actor),self.assertRaises(Failure):authorize(actor,self.b,current_user=1,current_epoch=1,mutation=True)
        self.assertTrue(authorize(self.w,self.b,current_user=1,current_epoch=1,mutation=True))
        with self.assertRaises(Failure):authorize(self.e,self.b,current_user=1,current_epoch=1,account_total=True)
    def test_old_member_history_survives_installation_transfer(self):
        self.assertTrue(authorize(self.w,self.b,current_user=2,current_epoch=2,historical=True))
        for actor in (self.w,self.e):
            with self.assertRaises(Failure):authorize(actor,self.b,current_user=2,current_epoch=2,mutation=True)
        with self.assertRaises(Failure):authorize(self.e,self.b,current_user=2,current_epoch=2,historical=True)
    def test_csrf_origin_and_capability_always_before_cached_replay(self):
        s=ConfigStore();s.write(self.w,self.b,'id',None,'key',{'x':1},create=True)
        for actor in (Principal('W',1,origin_ok=False),Principal('W',1,csrf_ok=False),Principal('W',2)):
            with self.assertRaises(Failure):s.write(actor,self.b,'id',None,'key',{'x':1},create=True)
        with self.assertRaises(Failure):s.write(self.w,self.b,'id',None,'key',{'x':1},create=True,capability=False)
    def test_success_retry_returns_original_response_before_stale_etag(self):
        s=ConfigStore();s.write(self.w,self.b,'id',None,'create',{'x':1},create=True)
        self.assertEqual(s.write(self.w,self.b,'id',1,'update',{'x':2})['version'],2)
        s.write(self.w,self.b,'id',2,'later',{'x':3})
        self.assertEqual(s.write(self.w,self.b,'id',1,'update',{'x':2})['version'],2)
        self.assertEqual(s.configs['id']['version'],3)
    def test_idempotency_route_precondition_and_hash_conflicts(self):
        s=ConfigStore();s.write(self.w,self.b,'id',None,'key',{'x':1},create=True)
        for value,expected in [({'x':2},None),({'x':1},1)]:
            with self.assertRaises(Failure):s.write(self.w,self.b,'id',expected,'key',value,create=True)
        self.assertEqual(s.write(self.w,self.b,'other',None,'key',{'x':1},create=True)['version'],1)
    def test_concurrent_cas_and_same_key_replay(self):
        s=ConfigStore();s.write(self.w,self.b,'id',None,'create',{'x':1},create=True)
        def update(key):
            try:return s.write(self.w,self.b,'id',1,key,{'x':2})['version']
            except Failure as e:return e.code
        with ThreadPoolExecutor(2) as pool:self.assertEqual(sorted(map(str,pool.map(update,['a','b']))),['2','VERSION_CONFLICT'])
        t=ConfigStore();t.write(self.w,self.b,'id',None,'create',{'x':1},create=True)
        with ThreadPoolExecutor(2) as pool:r=list(pool.map(lambda _:t.write(self.w,self.b,'id',1,'same',{'x':2}),range(2)))
        self.assertEqual(r,[{'version':2},{'version':2}]);self.assertEqual(len(t.outbox),2)
    def test_failure_rolls_back_version_history_receipt_and_outbox(self):
        s=ConfigStore();s.write(self.w,self.b,'id',None,'create',{'x':1},create=True);before=copy.deepcopy(s.snapshot())
        with self.assertRaises(Failure):s.write(self.w,self.b,'id',1,'update',{'x':2},fail_after_history=True)
        self.assertEqual(s.snapshot(),before);self.assertEqual(s.write(self.w,self.b,'id',1,'update',{'x':2})['version'],2)
    def test_safe_version_and_target_binding_are_immutable(self):
        s=ConfigStore();s.write(self.w,self.b,'id',None,'key',{'x':1},create=True);s.configs['id']['version']=9007199254740991
        with self.assertRaises(Failure):s.write(self.w,self.b,'id',9007199254740991,'max',{'x':2})
        foreign=Binding('other',1,'install',1)
        with self.assertRaises(Failure):s.write(self.w,foreign,'id',1,'foreign',{'x':2})

if __name__=='__main__':unittest.main()
