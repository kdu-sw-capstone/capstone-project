"""Independent RC1 contract tests, not product acceptance or Chrome simulation."""
import copy
import hashlib
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
import sqlglot
from reference_model import (digest,host,matches,keyword_matches,reasons,day_bounds,transition,weekly_local,
    validate_semantics,Receiver,Claims,ControlReceiver,Imports,negotiate,window_duration,Focus)

P=Path(__file__).resolve().parents[1];ROOT=P.parents[2]
def load(name):return json.loads((P/name).read_text('utf8'))
SCHEMA=load('schema.json'); API=load('api.json');EX=load('examples.json')
REGISTRY=Registry().with_resource(SCHEMA['$id'],Resource.from_contents(SCHEMA))
FORMATS=FormatChecker()
@FORMATS.checks('date-time')
def is_utc(value):
    if not isinstance(value,str):return True # type is validated separately
    try:
        return value.endswith('Z') and datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo==timezone.utc
    except ValueError:return False
@FORMATS.checks('iana-zone')
def is_zone(value):
    try:ZoneInfo(value);return True
    except (ZoneInfoNotFoundError,ValueError,TypeError):return False
def validator(name):
    return Draft202012Validator({'$ref':SCHEMA['$id']+'#/$defs/'+name},registry=REGISTRY,format_checker=FORMATS)
def segment(n=1,**kw):
    s=copy.deepcopy(EX['definitions']['UsageSegment']);s.update(segment_id=f'00000000-0000-4000-8000-{n:012d}',
      local_usage_seq=n,day_start_at='2026-10-29T00:00:00.000Z',day_end_at='2026-10-30T00:00:00.000Z',
      start_at=f'2026-10-29T00:00:{(n-1)*5:02d}.000Z',end_at=f'2026-10-29T00:00:{n*5:02d}.000Z',confirmed_ms=5000,
      uncertain_ms=0,previous_segment_sha256=None)
    s.update(kw);s['payload_sha256']=digest(s,('payload_sha256',));return s

# Approved PR25 additions only. These are exact source contexts, not regexes or
# an updated product hash. Restoring them must still reproduce the locked bytes.
CREATE_ADDITIONS=(
    (b'export function request<T>(path: string, method = "GET", body?: unknown, options: {key?: string; version?: number; create?: boolean; challenge?: boolean; signal?: AbortSignal} = {}): Promise<T> {\n',
     b'export function request<T>(path: string, method = "GET", body?: unknown, options: {key?: string; version?: number; challenge?: boolean; signal?: AbortSignal} = {}): Promise<T> {\n'),
    (b'    version?: number;\n    create?: boolean;\n    challenge?: boolean;\n',
     b'    version?: number;\n    challenge?: boolean;\n'),
    (b'  if (options.key) headers["Idempotency-Key"] = options.key;\n  if (options.create) headers["If-None-Match"] = "*";\n  if (options.version !== undefined)\n',
     b'  if (options.key) headers["Idempotency-Key"] = options.key;\n  if (options.version !== undefined)\n'),
)

def legacy_bytes_preserved(name,content,locked_sha):
    original=content.replace(b'\r\n',b'\n')
    if hashlib.sha256(original).hexdigest()==locked_sha:return True
    if name!='frontend/src/api.ts':return False
    for added,prior in CREATE_ADDITIONS:
        if original.count(added)!=1:return False
        original=original.replace(added,prior,1)
    return hashlib.sha256(original).hexdigest()==locked_sha

class SchemaTests(unittest.TestCase):
    def test_schema_is_draft202012(self):Draft202012Validator.check_schema(SCHEMA)
    def test_api_paths_unique(self):
        keys=[(o['method'],o['path']) for o in API['operations']];self.assertEqual(len(keys),len(set(keys)))
    def test_legacy_bytes_preserved(self):
        for name,sha in load('legacy-lock.json')['files'].items():
            with self.subTest(name=name):self.assertTrue(legacy_bytes_preserved(name,(ROOT/name).read_bytes(),sha),name)
    def test_legacy_create_allowlist_is_exact(self):
        name='frontend/src/api.ts';locked=load('legacy-lock.json')['files'][name]
        source=(ROOT/name).read_bytes().replace(b'\r\n',b'\n')
        if hashlib.sha256(source).hexdigest()!=locked:
            for added,prior in CREATE_ADDITIONS:source=source.replace(added,prior,1)
        self.assertEqual(hashlib.sha256(source).hexdigest(),locked)
        approved=source
        for added,prior in CREATE_ADDITIONS:
            self.assertEqual(approved.count(prior),1)
            approved=approved.replace(prior,added,1)
        for valid in (source,approved,approved.replace(b'\n',b'\r\n')):
            self.assertTrue(legacy_bytes_preserved(name,valid,locked))
        mutations={
            'credentials':(b'credentials: "same-origin"',b'credentials: "include"'),
            'csrf':(b'"X-CSRF-Token"',b'"X-Unapproved-CSRF"'),
            'idempotency':(b'headers["Idempotency-Key"] = options.key',b'headers["Idempotency-Key"] = "changed"'),
            'version-header':(b'headers["If-Match"]',b'headers["If-Changed"]'),
            'retry':(b'!(method === "GET" || options.key)',b'!(method === "GET")'),
            'duplicate':(b'    create?: boolean;\n',b'    create?: boolean;\n    create?: boolean;\n'),
            'relocated':(CREATE_ADDITIONS[1][0],b'    create?: boolean;\n    version?: number;\n    challenge?: boolean;\n'),
        }
        for label,(before,after) in mutations.items():
            with self.subTest(label=label):
                self.assertIn(before,approved)
                self.assertFalse(legacy_bytes_preserved(name,approved.replace(before,after,1),locked))
        for added,prior in CREATE_ADDITIONS:
            with self.subTest(partial=prior):self.assertFalse(legacy_bytes_preserved(name,approved.replace(added,prior,1),locked))
        self.assertFalse(legacy_bytes_preserved('another/api.ts',approved,locked))
    def test_traceability_all_18(self):
        ids={o['id'] for o in API['operations']}
        features=load('traceability.json')['features'];self.assertEqual([f['id'] for f in features],[f'F{i:02d}' for i in range(1,19)])
        for f in features:
            self.assertIn(f['api_id'],ids);self.assertEqual(f['product_acceptance'],'NOT_RUN')
    def test_16_options(self):
        features=load('feature-registry.json')['features'];self.assertEqual([f['id'] for f in features],[f'YT-{i:02d}' for i in range(1,11)]+[f'IG-{i:02d}' for i in range(1,7)])
        for f in features:
            self.assertEqual(f['requirement'],'USER_CONFIRMED');self.assertEqual(f['detail'],'REVIEW_PENDING')
            for k in ['on','off','failure','spa','evidence','acceptance_ids','target']:self.assertTrue(f[k])
    def test_sql_mysql_static_parse(self):
        statements=sqlglot.parse((P/'mysql-candidate.sql').read_text('utf8'),read='mysql',error_level='RAISE')
        self.assertGreaterEqual(len(statements),12)
        for st in statements:self.assertEqual(st.key,'create')
    def test_old_d06_has_no_pause(self):
        for folder in ['a1','member-a1']:
            old=json.loads((ROOT/'extension'/folder/'schema.json').read_text('utf8'))
            # Explicit regression against silently broadening the legacy status enum.
            aggregate=old['$defs']['aggregate']['properties']['session_status']
            self.assertNotIn('PAUSED',aggregate['enum'])
    def test_targets_remain_unverified(self):
        h=load('source-evidence.json')['poc_history'];self.assertEqual(h['checkpoint_5_seconds'],'FAIL')
        self.assertEqual(h['new_chrome_in_this_pr'],'NOT_RUN');self.assertEqual(h['foreground_2h'],'NOT_RUN')
    def test_coherent_wire_fixtures(self):
        messages=load('wire-fixtures.json')['messages']
        for m in messages:
            validator(m['schema']).validate(m['value'])
            if m['schema']=='ContentResult':validate_semantics('ContentResult',m['value'],issued=messages[m['issued_control_index']]['value'],prior_claims=m.get('prior_claims'),prior_footprint_sha256=m.get('prior_footprint_sha256'))
            else:
                p=m['value']['payload'];self.assertEqual(p['semantic_sha256'],digest(p,('semantic_sha256','channel_credential')))
    def test_both_sql_candidates_differ_only_executor_collation(self):
        one=(P/'mysql-candidate.sql').read_text('utf8').strip()
        two=(P/'mysql-runtime-candidate.sql').read_text('utf-8-sig').strip()
        self.assertEqual(one.replace('executor_id CHAR(36) COLLATE ascii_bin','executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin'),two)
    def test_document_links(self):
        import re
        folder=ROOT/'docs/design/additional-mvp-contracts'
        for p in folder.glob('*.md'):
            for target in re.findall(r'\]\(([^)]+)\)',p.read_text('utf8')):
                if not target.startswith(('https://','http://','#')):
                    self.assertTrue((p.parent/target.split('#')[0]).exists(),(p.name,target))
    def test_task_card_refs_exist(self):
        for f in load('traceability.json')['features']:
            for card in f['task_card_refs']:self.assertTrue((ROOT/'docs/implementation/tasks'/f'{card}.md').exists(),card)
    def test_api_error_codes_are_defined(self):
        known=set(SCHEMA['$defs']['Error']['properties']['error']['properties']['code']['enum'])
        for op in API['operations']:
            for codes in op['errors'].values():self.assertLessEqual(set(codes),known)
    def test_legacy_schedule_adapter_preserves_status_and_trigger(self):
        a=API['legacy_adapters']['focus_schedule']
        self.assertEqual(a['expired'],{'status':'SKIPPED','reason':'EXPIRED'})
        self.assertNotIn('EXPIRED',a['occurrence_statuses'])
        for variant in SCHEMA['$defs']['FocusSchedule']['properties']['when']['oneOf']:
            self.assertNotIn('end_at',variant['properties']);self.assertNotIn('end_local',variant['properties'])
        self.assertEqual(a['public_create_fields'],['name','weekdays','start_local','duration_minutes','timezone','executor_id','enabled'])
    def test_http_positive_examples_cross_field_invariants(self):
        validate_semantics('UsageSegment',EX['definitions']['UsageSegment'])
        validate_semantics('FocusCommand',EX['definitions']['FocusCommand'])
        self.assertEqual(window_duration(EX['definitions']['Window']['when']),60)
        for row in EX['api']:
            if row['id'] in ['USG-01','RPT-01','EVT-01']:
                key={'USG-01':'segments','RPT-01':'reports','EVT-01':'events'}[row['id']]
                item=row['request'][key][0]
                self.assertEqual(item['payload_sha256'],digest(item,('payload_sha256',)))
                self.assertEqual(row['response']['items'][0]['payload_sha256'],item['payload_sha256'])
    def test_revision_manifest(self):
        m=load('revision-manifest.json')
        for name,sha in m['sha256_lf_text'].items():
            with self.subTest(name=name):self.assertEqual(hashlib.sha256((ROOT/name).read_bytes().replace(b'\r\n',b'\n')).hexdigest(),sha)

def make_schema_case(name):
    def case(self):
        value=EX['definitions'][name];v=validator(name);v.validate(value)
        schema=SCHEMA['$defs'][name]
        if schema.get('type')=='object':
            bad=copy.deepcopy(value);bad['unexpected']=1;self.assertFalse(v.is_valid(bad))
            for field in schema.get('required',[]):
                bad=copy.deepcopy(value);del bad[field]
                with self.subTest(missing=field):self.assertFalse(v.is_valid(bad))
    return case
for name in SCHEMA['$defs']:setattr(SchemaTests,'test_shape_'+name,make_schema_case(name))
def make_api_case(o):
    def case(self):
        e=next(e for e in EX['api'] if e['id']==o['id'])
        validator(o['body_schema']).validate(e['request']);validator(o['response_schema']).validate(e['response'])
        q=API['query_definitions'][o['query_schema']]
        Draft202012Validator(q,format_checker=FORMATS).validate(e['query'])
        self.assertFalse(o['implemented_at_baseline']);self.assertTrue(o['path'].startswith('/api/v1/amvp/'))
        self.assertIn(o['auth'],['W','E','W_OR_E'])
    return case
for op in API['operations']:setattr(SchemaTests,'test_api_'+op['id'].replace('-','_'),make_api_case(op))

class SemanticTests(unittest.TestCase):
    def test_partial_capability_not_self_attested(self):
        supported={'RUNTIME_USAGE':['AMVP_BROWSER_USAGE_1']}
        self.assertEqual(negotiate(supported,supported,['RUNTIME_USAGE'],True),{'RUNTIME_USAGE':'AMVP_BROWSER_USAGE_1'})
        for required,verified in [(['FOCUS_CONTROL'],True),(['RUNTIME_USAGE'],False)]:
            with self.assertRaises(ValueError):negotiate(supported,supported,required,verified)
    def test_zero_and_overnight_window(self):
        w={'recurrence':'WEEKLY','start_local':'23:00','end_local':'01:00','end_day_offset':1}
        self.assertEqual(window_duration(w),120)
        for changes in [{'end_day_offset':0},{'start_local':'01:00','end_local':'01:00','end_day_offset':0}]:
            with self.assertRaises(ValueError):window_duration(dict(w,**changes))
    def test_focus_saved_not_running_until_effect(self):
        f=Focus('frozen',120000);self.assertEqual(f.state,'STARTING');f.applied(False);self.assertEqual(f.state,'UNKNOWN')
        self.assertTrue(f.runtime_active)
    def test_focus_pause_same_snapshot_resume_and_end(self):
        f=Focus('frozen',120000);f.applied(True);f.pause(True);self.assertEqual(f.state,'PAUSED')
        with self.assertRaises(ValueError):f.resume('new-config',True)
        f.resume('frozen',True);self.assertEqual(f.remaining,120000);self.assertEqual(f.state,'RUNNING')
        f.end(True);self.assertEqual(f.state,'ENDED');self.assertTrue(f.runtime_active)
    def test_focus_release_unknown_not_ended(self):
        f=Focus('frozen',120000);f.applied(True);f.end(False);self.assertEqual(f.state,'UNKNOWN');self.assertTrue(f.runtime_active)
    def test_active_artifact_missing_is_not_safe(self):
        for field in ['adult','blur','keyword']:
            x=copy.deepcopy(EX['definitions']['ContentConfig']);x[field]['enabled']=True
            with self.assertRaises(ValueError):validate_semantics('ContentConfig',x)
    def test_repeated_access_count_order_not_dedup_by_timestamp(self):
        # Native/Core issue distinct navigation IDs; one logical event per identity.
        events=[('2026-10-29T00:00:00.000Z',1,'a'),('2026-10-29T00:00:00.000Z',2,'b')]
        unique={e[2]:e for e in events+[events[0]]}
        self.assertEqual(len(unique),2);self.assertEqual(max(len(unique)-1,0),1)
        self.assertEqual(sorted(unique.values()),events)
    def test_host_vectors(self):
        self.assertEqual(host('WWW.Example.TEST.'),'www.example.test')
        self.assertEqual(host('bücher.example'),'xn--bcher-kva.example')
        self.assertTrue(matches('a.example.test','example.test'));self.assertFalse(matches('evil-example.test','example.test'))
        self.assertFalse(matches('example.test.evil.test','example.test'));self.assertFalse(matches('a.example.test','example.test',False))
        for invalid in ['127.0.0.1','localhost','bad..test']:
            with self.assertRaises(ValueError):host(invalid)
    def test_keyword_vectors(self):
        cases=[('https://example.test/search?q=GAMING','gaming',True),('https://example.test/gamings','gaming',False),
          ('https://example.test/gaming-now','gaming',True),('https://example.test/%67aming','gaming',True),
          ('https://example.test/%2567aming','gaming',False),('https://example.test/?gaming=no','gaming',False),
          ('https://example.test/#gaming','gaming',True),('https://example.test/?q=ＡＢＣ','abc',True),
          ('https://example.test/?q=한글게임','게임',False),('https://example.test/?q=게임','게임',True)]
        for u,t,want in cases:
            with self.subTest(url=u):self.assertEqual(keyword_matches(u,t),want)
        with self.assertRaises(ValueError):keyword_matches('https://example.test/%ZZ','x')
    def test_policy_conflicts(self):
        cases=[('ALLOW',{'quota':True},['DAILY_LIMIT']),('RECORD',{'block_window':True},['BLOCK_WINDOW']),
          ('ALLOW',{'adult':True,'adult_except':True,'quota':True},['DAILY_LIMIT']),
          ('ALLOW',{'adult':True,'keyword':True,'keyword_except':True},['ADULT_DOMAIN']),
          ('BLOCK',{'quota':True},['DAILY_LIMIT','USER_SITE']),('ALLOW',{'outside':True},['OUTSIDE_ALLOW_WINDOW'])]
        for f,kwargs,expected in cases:
            with self.subTest(case=kwargs):self.assertEqual(reasons(f,**kwargs),('BLOCK',expected))
        self.assertEqual(reasons('RECORD'),('RECORD',[]))
    def test_dst_days_23_25_hours(self):
        for date,hours in [('2026-03-08T12:00:00+00:00',23),('2026-11-01T12:00:00+00:00',25)]:
            a,b=day_bounds(datetime.fromisoformat(date),'America/New_York');self.assertEqual((b-a).total_seconds()/3600,hours)
    def test_dst_gap_and_fold(self):
        self.assertIsNone(weekly_local('2026-03-08','02:30','America/New_York'))
        self.assertEqual(weekly_local('2026-11-01','01:30','America/New_York').isoformat(),'2026-11-01T05:30:00+00:00')
    def test_timezone_carry_not_reset(self):
        at=datetime(2026,10,29,15,tzinfo=timezone.utc)
        x=transition(at,'America/Los_Angeles',10000,60000)
        self.assertEqual(x['remaining'],10000);self.assertEqual(x['carry_debit'],50000)
        y=transition(x['end'],'Asia/Seoul',x['remaining'],60000);self.assertEqual(y['remaining'],10000)
        self.assertEqual(transition(at,'UTC',0,60000)['remaining'],0)
    def test_usage_exact_duplicate_once(self):
        s=segment();validator('UsageSegment').validate(s);r=Receiver(s['owner_binding_id'],s['executor_id'])
        self.assertEqual(r.receive(s),'ACCEPTED');self.assertEqual(r.receive(s),'DUPLICATE');self.assertEqual(r.total,5000)
    def test_usage_conflict_same_identity(self):
        s=segment();r=Receiver(s['owner_binding_id'],s['executor_id']);r.receive(s)
        s['confirmed_ms']=4000;s['payload_sha256']=digest(s,('payload_sha256',))
        with self.assertRaisesRegex(ValueError,'SOURCE_CONFLICT'):r.receive(s)
    def test_usage_out_of_order_and_retransmit(self):
        one=segment();two=segment(2,previous_segment_sha256=one['payload_sha256']);r=Receiver(one['owner_binding_id'],one['executor_id'])
        self.assertEqual(r.receive(two),'PENDING_DEPENDENCY');self.assertEqual(r.total,0)
        r.receive(one);self.assertEqual(r.receive(two),'ACCEPTED');self.assertEqual(r.total,10000)
    def test_worker_recovery_no_double_count(self):
        one=segment();r=Receiver(one['owner_binding_id'],one['executor_id']);r.receive(one)
        recovered=copy.deepcopy(r);self.assertEqual(recovered.receive(one),'DUPLICATE');self.assertEqual(recovered.total,5000)
    def test_usage_overlap_rejected_even_new_epoch(self):
        one=segment();r=Receiver(one['owner_binding_id'],one['executor_id']);r.receive(one)
        second=segment(segment_id='00000000-0000-4000-8000-000000000099',collector_epoch='00000000-0000-4000-8000-000000000098')
        with self.assertRaisesRegex(ValueError,'OVERLAPPING_USAGE'):r.receive(second)
    def test_usage_owner_mismatch(self):
        s=segment();r=Receiver('another-owner',s['executor_id'])
        with self.assertRaisesRegex(ValueError,'FORBIDDEN_EXECUTOR'):r.receive(s)
    def test_usage_hash_tamper(self):
        s=segment();r=Receiver(s['owner_binding_id'],s['executor_id']);s['confirmed_ms']=1
        with self.assertRaisesRegex(ValueError,'HASH_MISMATCH'):r.receive(s)
    def test_impossible_duration_and_cross_midnight(self):
        for kw in [{'confirmed_ms':6000},{'end_at':'2026-10-30T00:00:01.000Z'}]:
            with self.assertRaises(ValueError):validate_semantics('UsageSegment',segment(**kw))
    def test_claim_release_focus_not_runtime(self):
        c=Claims();c.apply('rule','focus');c.apply('rule','runtime');self.assertTrue(c.release('rule','focus'))
        self.assertEqual(c.claims['rule'],{'runtime'});self.assertFalse(c.release('rule','runtime'))
    def test_control_retry_same_operation(self):
        c=ControlReceiver('owner',1);self.assertEqual(c.apply('op','hash','owner',1,1),'APPLIED')
        self.assertEqual(c.apply('op','hash','owner',1,1),'DUPLICATE');self.assertEqual(c.effects,1)
        with self.assertRaisesRegex(ValueError,'IDEMPOTENCY_CONFLICT'):c.apply('op','changed','owner',1,1)
    def test_control_sender_owner_generation_capability(self):
        for kwargs in [{'sender_verified':False},{'supported':False}]:
            c=ControlReceiver('owner',1)
            with self.assertRaises(ValueError):c.apply('op','hash','owner',1,1,**kwargs)
            self.assertEqual(c.effects,0)
        for owner,generation in [('old',1),('owner',0)]:
            c=ControlReceiver('owner',1)
            with self.assertRaisesRegex(ValueError,'STALE_SCOPE'):c.apply('op','hash',owner,generation,1)
    def test_control_order_gap(self):
        c=ControlReceiver('owner',1);self.assertEqual(c.apply('2','h','owner',1,2),'PENDING_DEPENDENCY')
        c.apply('1','h','owner',1,1);self.assertEqual(c.apply('2','h','owner',1,2),'APPLIED')
    def test_import_explicit_completed_analytics_only(self):
        i=Imports();self.assertEqual(i.select('m','s','r','hash','COMPLETED',True),'ACCEPTED')
        self.assertEqual(i.select('m','s','r','hash','COMPLETED',True),'DUPLICATE');self.assertEqual(i.quota_debit,0)
        with self.assertRaises(ValueError):i.select('m','s','r','changed','COMPLETED',True)
        for state,explicit in [('RUNNING',True),('COMPLETED',False)]:
            with self.assertRaises(ValueError):i.select('m','s','r2','hash',state,explicit)
    def test_new_capture_requires_closed_and_released(self):
        x=copy.deepcopy(EX['definitions']['TransferState']);x.update(state='COMMITTED',new_capture_open=True,old_capture_closed=False,old_rules_released=True)
        with self.assertRaises(ValueError):validate_semantics('TransferState',x)
        x['old_capture_closed']=True;validate_semantics('TransferState',x)
    def test_event_target_and_reason(self):
        x=copy.deepcopy(EX['definitions']['AccessEvent']);x['target_key']='policy.example.test'
        with self.assertRaises(ValueError):validate_semantics('AccessEvent',x)
        x['target_key']=x['target_host'];validate_semantics('AccessEvent',x)
        x['event_type']='BLOCKED_SITE_ACCESS'
        with self.assertRaises(ValueError):validate_semantics('AccessEvent',x)
    def test_false_apply_and_release_rejected(self):
        x=copy.deepcopy(EX['definitions']['ContentResult']);x['result_state']='APPLIED'
        with self.assertRaises(ValueError):validate_semantics('ContentResult',x)
        x.update(result_state='RELEASED',remaining_claim_count=1)
        with self.assertRaises(ValueError):validate_semantics('ContentResult',x)
        x.update(result_state='FAILED',remaining_claim_count=0,status='ACK')
        with self.assertRaisesRegex(ValueError,'ACK_STATE_MISMATCH'):validate_semantics('ContentResult',x)
    def test_duplicate_feature_id_not_hidden_by_unique_items(self):
        x=copy.deepcopy(EX['definitions']['ContentConfig']);f=copy.deepcopy(EX['definitions']['FeatureSetting'])
        x['features']=[f,dict(f,enabled=True)];validator('ContentConfig').validate(x)
        with self.assertRaises(ValueError):validate_semantics('ContentConfig',x)
    def test_invalid_timezone_and_safe_integer(self):
        x=copy.deepcopy(EX['definitions']['TimezoneWrite']);x['timezone']='Not/AZone';self.assertFalse(validator('TimezoneWrite').is_valid(x))
        x=copy.deepcopy(EX['definitions']['ConfigRecord']);x['version']=9007199254740992;self.assertFalse(validator('ConfigRecord').is_valid(x))
        x['version']='1';self.assertFalse(validator('ConfigRecord').is_valid(x))
    def test_impossible_utc_date_rejected_without_optional_format_packages(self):
        self.assertFalse(validator('Utc').is_valid('2026-02-30T00:00:00.000Z'))
        self.assertFalse(validator('Utc').is_valid('2026-10-29T25:00:00.000Z'))
        self.assertFalse(validator('Utc').is_valid('2026-10-29T00:00:00.000+09:00'))
    def test_duration_minutes_and_focus_action(self):
        x=copy.deepcopy(EX['definitions']['FocusCommand']);x['duration_minutes']=25;validate_semantics('FocusCommand',x)
        x['action']='RESUME'
        with self.assertRaises(ValueError):validate_semantics('FocusCommand',x)
    def test_canonical_hash_key_order(self):
        self.assertEqual(digest({'한글':1,'a':2}),digest({'a':2,'한글':1}))
        self.assertNotEqual(digest({'a':1}),digest({'a':2}))

if __name__=='__main__':unittest.main()
