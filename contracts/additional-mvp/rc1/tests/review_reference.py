"""Executable review oracle only. Trust registries are fixture-owned, never message bodies.
No Chrome, Native, HTTP, product database or installed profile is accessed.
"""
import copy
import json
from datetime import datetime, timedelta
from pathlib import Path
from reference_model import digest, day_bounds

MAX_SAFE=9007199254740991
def instant(s):return datetime.fromisoformat(s.replace('Z','+00:00'))
def safe(n,minimum=0):return isinstance(n,int) and not isinstance(n,bool) and minimum<=n<=MAX_SAFE

class CleanupLane:
    """Reservation/receipt identity is fixed before APPLY, separate from normal sequence."""
    def __init__(self,owner,generation,binding,footprint,scope_digest='fixture-scope'):
        self.scope=(owner,generation,binding,footprint);self.normal_seq=0
        self.grants={};self.receipts={};self.operations={};self.effects=0
        self.physical_remaining=True;self.obligation_pending=True
        self.scope_digest=scope_digest
    def reserve(self,grant,operation,receipt,capacity=1,receipt_capacity=1):
        if grant in self.grants or operation in self.operations or any(g['receipt']==receipt for g in self.grants.values()):raise ValueError('RESERVATION_CONFLICT')
        self.grants[grant]={'operation':operation,'receipt':receipt,'capacity':capacity,'receipt_capacity':receipt_capacity,'valid':True,'claimed':False}
        self.operations[operation]={'lane':'CLEANUP','hash':None}
    def normal(self,operation,semantic,seq):
        if operation in self.operations:
            old=self.operations[operation]
            if old!={'lane':'NORMAL','hash':semantic}:raise ValueError('IDEMPOTENCY_CONFLICT')
            return 'DUPLICATE'
        if not safe(seq,1):raise ValueError('CONTROL_SEQUENCE_LIMIT')
        if seq<=self.normal_seq:raise ValueError('STALE_SEQUENCE')
        if seq!=self.normal_seq+1:return 'PENDING_DEPENDENCY'
        self.operations[operation]={'lane':'NORMAL','hash':semantic};self.normal_seq=seq;return 'APPLIED'
    def revalidate(self,grant,operation,receipt,owner,generation,binding,footprint,scope_digest='fixture-scope',native_verified=False,exact_old_document_verified=False):
        # These booleans stand for privileged adapter evidence, never message fields.
        if not native_verified or not exact_old_document_verified:raise ValueError('CLEANUP_REVALIDATION_UNCONFIRMED')
        if (owner,generation,binding,footprint)!=self.scope or scope_digest!=self.scope_digest:raise ValueError('CLEANUP_OWNER_OR_SCOPE_MISMATCH')
        g=self.grants.get(grant)
        if not g or (g['operation'],g['receipt'])!=(operation,receipt):raise ValueError('RESERVATION_MISMATCH')
        g['valid']=True # Renew authority only; never reset identity, slots, intent or receipt.
    def release(self,grant,operation,semantic,receipt,owner,generation,binding,footprint,seq,
                sender_verified=True,persist=True,receipt_fail=False,scope_digest='fixture-scope'):
        if seq is not None:raise ValueError('CLEANUP_SEQUENCE_MUST_BE_NULL')
        if not sender_verified or (owner,generation,binding,footprint)!=self.scope:raise ValueError('CLEANUP_OWNER_OR_SCOPE_MISMATCH')
        if scope_digest!=self.scope_digest:raise ValueError('CLEANUP_SCOPE_DIGEST_MISMATCH')
        g=self.grants.get(grant)
        if not g or not g['valid']:raise ValueError('INVALID_CLEANUP_GRANT')
        if (g['operation'],g['receipt'])!=(operation,receipt):raise ValueError('RESERVATION_MISMATCH')
        old=self.operations[operation]
        if old['lane']!='CLEANUP' or old['hash'] not in (None,semantic):raise ValueError('IDEMPOTENCY_CONFLICT')
        if self.receipts.get(receipt)=='RELEASED':return 'DUPLICATE'
        if not g['claimed'] and (g['capacity']<1 or g['receipt_capacity']<1):raise ValueError('CLEANUP_RESERVATION_EXHAUSTED')
        if not persist:raise ValueError('STORAGE_UNCONFIRMED')
        # Durable reserved INTENT precedes side effects; a retry reuses this slot.
        if not g['claimed']:g['capacity']-=1;g['receipt_capacity']-=1;g['claimed']=True
        old['hash']=semantic;self.receipts[receipt]='IN_DOUBT'
        if self.physical_remaining:self.effects+=1;self.physical_remaining=False
        if receipt_fail:return 'IN_DOUBT'
        self.receipts[receipt]='RELEASED';self.obligation_pending=False
        return 'RELEASED'

class ClockedReceiver:
    """Immutable raw admission is separate from countable time and resolution projections."""
    def __init__(self,owner,executor):
        self.owner=owner;self.executor=executor;self.raw={};self.positions={};self.pending={}
        self.last={};self.last_clock=None;self.last_verified_clock=None;self.physical=[];self.anchors={};self.day_buckets=set()
        self.resolutions={};self.resolution_envelopes={};self.segment_resolution={};self.total=0;self.day_totals={}
    def _count(self,amount,day):
        self.total+=amount;self.day_totals[day]=self.day_totals.get(day,0)+amount
    def trust_anchor(self,anchor_id,clock,predecessor_hash=None,restart_verified=False,tolerance_ms=0):
        # Privileged fixture setup: a real implementation needs authenticated calibration evidence.
        record={'clock_epoch':clock['clock_epoch'],'boot_id':clock['boot_id'],
          'anchor_utc':clock['anchor_utc'],'anchor_mono_ms':clock['anchor_mono_ms'],
          'predecessor_hash':predecessor_hash,'restart_verified':restart_verified,'tolerance_ms':tolerance_ms}
        if anchor_id in self.anchors and self.anchors[anchor_id]!=record:raise ValueError('ANCHOR_ID_CONFLICT')
        self.anchors[anchor_id]=record
    def trust_day_bucket(self,start,end,zone,version):self.day_buckets.add((start,end,zone,version))
    def _geometry(self,x):
        c=x['clock'];lo,hi=c['mono_start_ms'],c['mono_end_ms']
        if not all(safe(c[k]) for k in ['mono_start_ms','mono_end_ms','anchor_mono_ms']) or lo>=hi:raise ValueError('INVALID_MONOTONIC_INTERVAL')
        start=instant(c['anchor_utc'])+timedelta(milliseconds=lo-c['anchor_mono_ms'])
        end=instant(c['anchor_utc'])+timedelta(milliseconds=hi-c['anchor_mono_ms'])
        if (instant(x['start_at']),instant(x['end_at']))!=(start,end):raise ValueError('ANCHOR_PROJECTION_MISMATCH')
        if not instant(x['day_start_at'])<=start<end<=instant(x['day_end_at']):raise ValueError('DAY_BOUNDARY_SPLIT_REQUIRED')
        if x['confirmed_ms']+x['uncertain_ms']!=hi-lo:raise ValueError('DURATION_MISMATCH')
        if c['quality']=='TRUSTED' and x['uncertain_ms']!=0:raise ValueError('MIXED_CLOCK_QUALITY_SPLIT_REQUIRED')
        if c['quality']!='TRUSTED' and x['confirmed_ms']!=0:raise ValueError('ANOMALY_CANNOT_CLAIM_CONFIRMED_TIME')
        return (c['clock_epoch'],c['boot_id'],lo,hi)
    def _trusted(self,x,previous):
        c=x['clock'];a=self.anchors.get(c['anchor_id'])
        if c['quality']!='TRUSTED' or not a:return False
        if any(c[k]!=a[k] for k in ['clock_epoch','boot_id','anchor_utc','anchor_mono_ms']):return False
        if self.last_verified_clock and (c['clock_epoch'],c['boot_id'])!=self.last_verified_clock:
            if not(a['restart_verified'] and a['predecessor_hash']==previous and c['boot_id']!=self.last_verified_clock[1]):return False
        standard=day_bounds(instant(x['start_at']),x['timezone'])
        declared=(instant(x['day_start_at']),instant(x['day_end_at']))
        if declared!=standard and (x['day_start_at'],x['day_end_at'],x['timezone'],x['timezone_version']) not in self.day_buckets:return False
        for field,target in [('observed_wall_start_at',x['start_at']),('observed_wall_end_at',x['end_at'])]:
            if abs((instant(c[field])-instant(target)).total_seconds()*1000)>a['tolerance_ms']:return False
        return True
    def receive(self,x):
        if (x['owner_binding_id'],x['executor_id'])!=(self.owner,self.executor):raise ValueError('FORBIDDEN_EXECUTOR')
        if digest(x,('payload_sha256',))!=x['payload_sha256']:raise ValueError('HASH_MISMATCH')
        segment=x['segment_id'];h=x['payload_sha256'];epoch=x['collector_epoch'];seq=x['local_usage_seq']
        if not safe(seq,1):raise ValueError('INVALID_SEQUENCE')
        if segment in self.raw:
            old=self.raw[segment]
            if old['hash']!=h:raise ValueError('SOURCE_CONFLICT')
            return 'DUPLICATE' if old['state']=='COUNTED' else 'DUPLICATE_QUARANTINED'
        key=(epoch,seq)
        if key in self.positions and self.positions[key]!=segment:raise ValueError('SEQUENCE_REUSE')
        if segment in self.pending and self.pending[segment]['payload_sha256']!=h:raise ValueError('SOURCE_CONFLICT')
        interval=self._geometry(x)
        number,previous=self.last.get(epoch,(0,None))
        if seq!=number+1:
            if seq<=number:raise ValueError('STALE_SEQUENCE')
            self.positions[key]=segment
            self.pending[segment]=copy.deepcopy(x);return 'PENDING_DEPENDENCY'
        if x['previous_segment_sha256']!=previous:raise ValueError('CHAIN_CONFLICT')
        ce,boot,lo,hi=interval
        if any(boot==b and lo<d and hi>c for a,b,c,d in self.physical):raise ValueError('MONOTONIC_OVERLAP')
        trusted=self._trusted(x,previous)
        self.positions[key]=segment
        self.physical.append(interval);self.pending.pop(segment,None)
        self.raw[segment]={'hash':h,'value':copy.deepcopy(x),'state':'COUNTED' if trusted else 'QUARANTINED'}
        self.last[epoch]=(seq,h);self.last_clock=(ce,boot)
        if trusted:
            self._count(x['confirmed_ms'],(x['day_start_at'],x['day_end_at'],x['timezone'],x['timezone_version']))
            self.last_verified_clock=(ce,boot);return 'ACCEPTED'
        return 'ACCEPTED_QUARANTINED'
    def resolve_wire(self,resolution,evidence,verified=False):
        _wire_shape('ClockResolution',resolution)
        if not verified:raise ValueError('CLOCK_EVIDENCE_UNVERIFIED')
        resolution_id=resolution['resolution_id'];envelope_hash=digest(resolution)
        if resolution_id in self.resolution_envelopes and self.resolution_envelopes[resolution_id]!=envelope_hash:raise ValueError('RESOLUTION_ENVELOPE_CONFLICT')
        anchor=self.anchors.get(resolution['anchor_id'])
        if not anchor or any(anchor[k]!=evidence[k] for k in ('clock_epoch','boot_id')):raise ValueError('RESOLUTION_ANCHOR_UNVERIFIED')
        if resolution['evidence_sha256']!=digest(evidence):raise ValueError('RESOLUTION_EVIDENCE_HASH_MISMATCH')
        fields=('source_hash','day_start_at','day_end_at','resolved_start_at','resolved_end_at','timezone','timezone_version','enforcement_day_chain_id')
        if any(resolution[k]!=evidence[k] for k in fields):raise ValueError('RESOLUTION_ENVELOPE_MISMATCH')
        if resolution['confirmed_ms']!=evidence['mono_end_ms']-evidence['mono_start_ms']:raise ValueError('RESOLUTION_DURATION_MISMATCH')
        for field,mono in [('resolved_start_at','mono_start_ms'),('resolved_end_at','mono_end_ms')]:
            if instant(resolution[field])!=instant(anchor['anchor_utc'])+timedelta(milliseconds=evidence[mono]-anchor['anchor_mono_ms']):raise ValueError('RESOLUTION_ANCHOR_PROJECTION_MISMATCH')
        result=self.resolve(resolution['segment_id'],resolution_id,evidence,verified=True)
        self.resolution_envelopes[resolution_id]=envelope_hash
        return result
    def resolve(self,segment,resolution_id,evidence,verified=False):
        # Separate immutable resolution, never rewrite the original segment or chain hash.
        old=self.raw[segment];x=old['value'];c=x['clock']
        signature=digest({'segment_id':segment,'source_hash':old['hash'],'evidence':evidence})
        if resolution_id in self.resolutions:
            if self.resolutions[resolution_id]!=signature:raise ValueError('RESOLUTION_CONFLICT')
            return 'DUPLICATE'
        if not verified:raise ValueError('CLOCK_EVIDENCE_UNVERIFIED')
        if old['state']!='QUARANTINED':raise ValueError('ALREADY_COUNTED')
        # Trusted verifier must prove exact physical capture and an immutable day allocation.
        expected={'source_hash':old['hash'],'clock_epoch':c['clock_epoch'],'boot_id':c['boot_id'],
          'mono_start_ms':c['mono_start_ms'],'mono_end_ms':c['mono_end_ms'],
          'timezone':x['timezone'],'timezone_version':x['timezone_version'],'enforcement_day_chain_id':x['enforcement_day_chain_id']}
        if any(evidence.get(k)!=v for k,v in expected.items()):raise ValueError('RESOLUTION_SCOPE_MISMATCH')
        start,end=instant(evidence['resolved_start_at']),instant(evidence['resolved_end_at'])
        lo,hi=instant(evidence['day_start_at']),instant(evidence['day_end_at'])
        if not lo<=start<end<=hi or round((end-start).total_seconds()*1000)!=c['mono_end_ms']-c['mono_start_ms']:raise ValueError('RESOLUTION_INTERVAL_MISMATCH')
        day=(evidence['day_start_at'],evidence['day_end_at'],evidence['timezone'],evidence['timezone_version'])
        if (lo,hi)!=day_bounds(start,x['timezone']) and day not in self.day_buckets:raise ValueError('UNVERIFIED_DAY_ALLOCATION')
        self.resolutions[resolution_id]=signature;self.segment_resolution[segment]=resolution_id
        old['state']='COUNTED';self._count(c['mono_end_ms']-c['mono_start_ms'],day);return 'RESOLVED'

def verify_direction(direction,body,e):
    """Evidence is trusted adapter state, never an RPC body or a sender-supplied flag."""
    sender=e.get('sender',{});extension_id=e.get('extension_id')
    own=isinstance(extension_id,str) and bool(extension_id) and sender.get('id')==extension_id
    s=e.get('scope');current=e.get('current_scope')
    if direction in ('WORKER_TO_CONTENT','CONTENT_TO_WORKER','CONTENT_RESPONSE_TO_WORKER'):
        if not e.get('channel_bound') or not isinstance(s,dict) or not s or body.get('scope')!=s:return False
        old_cleanup=body.get('operation')=='RELEASE' and body.get('release_mode')=='CLEANUP_ONLY'
        old_query=(body.get('type')=='D06_ADDITIONAL_QUERY' and body.get('cleanup_grant_id') is not None
          and body.get('cleanup_grant_id')==e.get('cleanup_grant_id')
          and all(body.get(k) is not None and body.get(k)==e.get(k) for k in ('target_operation_id','target_semantic_sha256')))
        if s!=current and not((old_cleanup or old_query) and e.get('cleanup_grant_verified') and e.get('exact_old_document_verified')):return False
        if direction=='WORKER_TO_CONTENT':return own and e.get('transport')=='PRIVATE_PORT'
        if direction=='CONTENT_TO_WORKER':
            return own and sender.get('tab',{}).get('id')==s['tab_id'] and sender.get('frameId')==s['frame_id'] and sender.get('documentId')==s['document_id'] and e.get('native_navigation_verified') is True
        return e.get('transport')=='TABS_SEND_MESSAGE_RESPONSE' and e.get('pending_call_bound') is True and all(body.get(k)==e.get(k) for k in ['request_id','operation_id','semantic_sha256'])
    if direction=='WORKER_TO_CORE':return e.get('trusted_internal_call') is True and e.get('upstream_authorized') is True
    if direction=='CORE_TO_NATIVE':return e.get('native_host_allowlist_verified') is True and e.get('native_channel_bound') is True and e.get('native_target_verified') is True
    if direction=='NATIVE_TO_SERVER':return e.get('pinned_server_verified') is True and e.get('installation_proof_verified') is True and e.get('operation_scope_verified') is True
    return False

class DnrCoordinator:
    """Two fake Chrome stores. Epoch guards require a future reviewed writer adapter."""
    def __init__(self,session_limit=5000,dynamic_limit=5000,regex_limit=1000,unsafe_limit=5000,cleanup_capacity=1024):
        self.banks={'SESSION':{},'DYNAMIC':{}};self.claims={};self.writer_epoch=1
        self.limits={'SESSION':session_limit,'DYNAMIC':dynamic_limit};self.plans={};self.receipts={}
        self.regex_limit=regex_limit;self.unsafe_limit=unsafe_limit;self.authorized_scopes=set()
        self.id_ranges={'SESSION':(100000,999999),'DYNAMIC':(1000000,1999999)}
        self.cleanup_capacity=cleanup_capacity;self.cleanup_reserved=set()
    def allocate(self,store):
        if store not in self.banks:raise ValueError('INVALID_RULE_STORE')
        if len(self.banks[store])>=self.limits[store]:raise ValueError('DNR_QUOTA_EXCEEDED')
        lo,hi=self.id_ranges[store]
        for candidate in range(lo,hi+1):
            if candidate not in self.banks[store] and (store,candidate) not in self.claims:return candidate
        raise ValueError('DNR_ID_RESERVATION_EXHAUSTED')
    def _key(self,store,rule_id):
        if store not in self.banks or not isinstance(rule_id,int) or isinstance(rule_id,bool) or not 1<=rule_id<=2147483647:raise ValueError('INVALID_RULE_KEY')
        return (store,rule_id)
    def seed(self,store,rule):self.banks[store][rule['id']]=copy.deepcopy(rule)
    def adopt(self,store,rule_id,owner,generation,expected,legacy_guarded=False,ownership_verified=False):
        key=self._key(store,rule_id)
        if not legacy_guarded:raise ValueError('LEGACY_WRITER_NOT_FENCED')
        if not ownership_verified:raise ValueError('OWNERSHIP_PROOF_REQUIRED')
        if self.banks[store].get(rule_id)!=expected:raise ValueError('RULE_FOOTPRINT_MISMATCH')
        claim=(owner,generation)
        if key in self.claims and self.claims[key]['rule']!=expected:raise ValueError('RULE_ID_COLLISION')
        self._reserve_cleanup(key,owner,generation)
        self.claims.setdefault(key,{'rule':copy.deepcopy(expected),'owners':set()})['owners'].add(claim)
        self.authorized_scopes.add(claim)
    def _fence(self,epoch):
        if epoch!=self.writer_epoch:raise ValueError('STALE_DNR_WRITER')
    def _reserve_cleanup(self,key,owner,generation):
        reservation=(key,owner,generation)
        if reservation not in self.cleanup_reserved and len(self.cleanup_reserved)>=self.cleanup_capacity:raise ValueError('CLEANUP_RESERVATION_EXHAUSTED')
        self.cleanup_reserved.add(reservation)
    def _replay(self,operation,semantic):
        if operation in self.plans and self.plans[operation]['semantic']!=semantic:raise ValueError('IDEMPOTENCY_CONFLICT')
        return self.receipts.get(operation)
    def install(self,store,rule,owner,generation,operation,writer_epoch,persist=True,fail_after_effect=False):
        self._fence(writer_epoch);key=self._key(store,rule['id'])
        if store=='DYNAMIC' and any(k in rule.get('condition',{}) for k in ['tabIds','excludedTabIds']):raise ValueError('SESSION_ONLY_CONDITION')
        semantic=digest({'store':store,'rule':rule,'owner':owner,'generation':generation,'kind':'INSTALL'})
        if self._replay(operation,semantic):return 'DUPLICATE'
        current=self.banks[store].get(rule['id'])
        if current is not None and (key not in self.claims or self.claims[key]['rule']!=current or current!=rule):raise ValueError('RULE_ID_COLLISION')
        if current is None and len(self.banks[store])>=self.limits[store]:raise ValueError('DNR_QUOTA_EXCEEDED')
        if current is None and not self.id_ranges[store][0]<=rule['id']<=self.id_ranges[store][1]:raise ValueError('DNR_ID_RANGE_UNRESERVED')
        if current is None:
            actual=list(self.banks[store].values())
            if 'regexFilter' in rule.get('condition',{}) and sum('regexFilter' in r.get('condition',{}) for r in actual)>=self.regex_limit:raise ValueError('DNR_REGEX_QUOTA_EXCEEDED')
            safe_actions={'block','allow','allowAllRequests','upgradeScheme'}
            if rule['action']['type'] not in safe_actions and sum(r['action']['type'] not in safe_actions for r in actual)>=self.unsafe_limit:raise ValueError('DNR_UNSAFE_QUOTA_EXCEEDED')
        if not persist:raise ValueError('STORAGE_UNCONFIRMED')
        self._reserve_cleanup(key,owner,generation)
        self.plans[operation]={'semantic':semantic,'state':'PREPARED'}
        self.claims.setdefault(key,{'rule':copy.deepcopy(rule),'owners':set()})['owners'].add((owner,generation))
        self.authorized_scopes.add((owner,generation))
        self.banks[store][rule['id']]=copy.deepcopy(rule)
        if fail_after_effect:self.plans[operation]['state']='IN_DOUBT';return 'IN_DOUBT'
        self.plans[operation]['state']='CONFIRMED';self.receipts[operation]='APPLIED';return 'APPLIED'
    def release_owner(self,owner,generation,operation,writer_epoch,persist=True,fail_after_effect=False):
        self._fence(writer_epoch);semantic=digest({'kind':'RELEASE','owner':owner,'generation':generation})
        if self._replay(operation,semantic):return 'DUPLICATE'
        if (owner,generation) not in self.authorized_scopes:raise ValueError('UNOWNED_RELEASE')
        selected=[(key,value) for key,value in self.claims.items() if (owner,generation) in value['owners']]
        # Validate ALL selected footprints before any deletion; foreign or modified rows survive.
        for (store,rule_id),v in selected:
            actual=self.banks[store].get(rule_id)
            if actual is not None and actual!=v['rule']:raise ValueError('RULE_FOOTPRINT_MISMATCH')
        if not persist:raise ValueError('STORAGE_UNCONFIRMED')
        self.plans[operation]={'semantic':semantic,'state':'PREPARED'}
        for (store,rule_id),v in selected:
            if v['owners']=={(owner,generation)}:self.banks[store].pop(rule_id,None)
        if fail_after_effect:self.plans[operation]['state']='IN_DOUBT';return 'IN_DOUBT'
        for key,v in selected:
            v['owners'].remove((owner,generation))
            if not v['owners']:self.claims.pop(key)
            self.cleanup_reserved.discard((key,owner,generation))
        self.plans[operation]['state']='CONFIRMED';self.receipts[operation]='RELEASED';return 'RELEASED'
    def transition(self,owner,generation,source,target,rule,operation,writer_epoch,stop_after_target=False,policy_kind='RUNTIME'):
        if policy_kind!='RUNTIME':raise ValueError('FOCUS_STORE_MIGRATION_UNSUPPORTED')
        self._fence(writer_epoch);source=self._key(*source);target=self._key(*target)
        semantic=digest({'owner':owner,'generation':generation,'source':source,'target':target,'rule':rule})
        if self._replay(operation,semantic):return 'DUPLICATE'
        if source not in self.claims or (owner,generation) not in self.claims[source]['owners']:raise ValueError('UNOWNED_SOURCE')
        original=self.claims[source]
        if self.banks[source[0]].get(source[1])!=original['rule']:raise ValueError('RULE_FOOTPRINT_MISMATCH')
        self.plans[operation]={'semantic':semantic,'state':'PREPARED'}
        self.install(target[0],dict(rule,id=target[1]),owner,generation,operation+':target',writer_epoch)
        if self.banks[target[0]].get(target[1])!=dict(rule,id=target[1]):raise ValueError('TARGET_EFFECT_UNCONFIRMED')
        self.plans[operation]['state']='TARGET_VERIFIED'
        if stop_after_target:return 'IN_DOUBT'
        if original['owners']=={(owner,generation)}:self.banks[source[0]].pop(source[1],None)
        original['owners'].discard((owner,generation))
        if not original['owners']:self.claims.pop(source)
        self.cleanup_reserved.discard((source,owner,generation))
        self.plans[operation]['state']='CONFIRMED';self.receipts[operation]='APPLIED';return 'APPLIED'
    def restart(self,verified_browser_restart=False):
        # The fake browser, not the coordinator, cleared SESSION before this observation.
        self.writer_epoch+=1;missing=[]
        for (store,rule_id),claim in self.claims.items():
            actual=self.banks[store].get(rule_id)
            if actual is None:missing.append({'key':(store,rule_id),'evidence':'SESSION_STORE_RESET' if store=='SESSION' and verified_browser_restart else 'UNCONFIRMED'})
            elif actual!=claim['rule']:raise ValueError('RULE_FOOTPRINT_MISMATCH')
        return missing

def _wire_shape(name,value):
    from jsonschema import Draft202012Validator, ValidationError, FormatChecker
    from referencing import Registry, Resource
    schema=json.loads((Path(__file__).resolve().parents[1]/'schema.json').read_text('utf8'))
    registry=Registry().with_resource(schema['$id'],Resource.from_contents(schema))
    try:Draft202012Validator({'$ref':schema['$id']+'#/$defs/'+name},registry=registry,format_checker=FormatChecker()).validate(value)
    except ValidationError:raise ValueError('WIRE_SCHEMA_REJECTED') from None

def effect_key(e):return ('feature:'+e['feature_id']) if e['kind']=='FEATURE' else ('policy:'+e['policy_type'])

class ContentOperationRegistry:
    """Issuer lookup, not a self-reported request body. All authority remains fixture-only."""
    def __init__(self):self.issued={}
    def issue(self,control,prior_claims=None,prior_footprint_sha256=None):
        _wire_shape('Control',control);p=control['payload'];operation=p['operation_id']
        if digest(p,('semantic_sha256','channel_credential'))!=p['semantic_sha256']:raise ValueError('CONTROL_HASH_MISMATCH')
        if p['operation']=='QUERY':raise ValueError('QUERY_CONTRACT_REVIEW_PENDING')
        previous=self.issued.get(operation)
        if previous:
            if previous['control']['payload']['semantic_sha256']!=p['semantic_sha256']:raise ValueError('IDEMPOTENCY_CONFLICT')
            previous['requests'].add(control['request_id']);return
        expected={};hashes={}
        if p['operation'] in ('UPDATE','RELEASE') and prior_claims is None:raise ValueError('MISSING_OWNED_FOOTPRINT')
        prior_claims=copy.deepcopy(prior_claims or {})
        scope_hash=digest(p['scope'])
        for key,claim in prior_claims.items():
            if claim['owner_binding_id']!=p['scope']['owner_binding_id'] or claim['scope_sha256']!=scope_hash:raise ValueError('FOREIGN_PRIOR_CLAIM')
        if p['operation']=='RELEASE':
            if prior_footprint_sha256 is None or prior_footprint_sha256!=p['expected_footprint_sha256']:raise ValueError('FOOTPRINT_HASH_MISMATCH')
            expected={k:'RELEASE' for k in prior_claims}
        else:
            projection=p['projection'];features=projection['features']
            ids=[f['feature_id'] for f in features]
            if len(ids)!=len(set(ids)):raise ValueError('DUPLICATE_REQUEST_FEATURE')
            content=projection['content']
            if content is not None:
                mirror=content['features'];mirror_ids=[f['feature_id'] for f in mirror]
                if len(mirror_ids)!=len(set(mirror_ids)) or sorted(features,key=lambda f:f['feature_id'])!=sorted(mirror,key=lambda f:f['feature_id']):raise ValueError('FEATURE_MIRROR_CONFLICT')
            expected={'feature:'+f['feature_id']:'APPLY' for f in features if f['enabled']}
            if content is not None:
                for name,key in [('keyword','KEYWORD'),('adult','ADULT_DOMAIN'),('blur','BLUR')]:
                    if content[name]['enabled']:
                        expected['policy:'+key]='APPLY';hashes['policy:'+key]=digest(content[name])
            if projection['access_block_reasons']:
                expected['policy:PAGE_GATE']='APPLY';hashes['policy:PAGE_GATE']=digest({'blocked_reasons':projection['access_block_reasons']})
            for key in prior_claims:
                if key not in expected:expected[key]='RELEASE'
        self.issued[operation]={'control':copy.deepcopy(control),'requests':{control['request_id']},'expected':expected,'policy_hashes':hashes,'prior':prior_claims}
    def _feature(self,e,p):
        result=e['result'];eligible=e['eligible_target_count']
        if e['restricted_target_count']>eligible:raise ValueError('INVALID_COUNTS')
        context=p['projection']['document_context']
        if e['route_profile_sha256']!=context['route_profile_sha256'] or e['scan_id']!=context['scan_id']:raise ValueError('STALE_ROUTE_OR_SCAN')
        direct=e['feature_id'] in ('YT-02','IG-02') and context['route_kind']=='DIRECT_VIEWER' and context['viewer_feature_id']==e['feature_id']
        if direct and e['presentation']!='DIRECT_VIEWER':raise ValueError('DIRECT_VIEWER_PROOF_REQUIRED')
        if result in ('APPLIED','NOT_APPLICABLE') and (not e['scan_complete'] or not e['observer_ready'] or e['error_count']):raise ValueError('INVALID_EFFECT_OBSERVATION')
        if result=='NOT_APPLICABLE':
            if direct or eligible!=0:raise ValueError('INVALID_NOT_APPLICABLE')
            return
        if result=='APPLIED':
            if eligible<1 or eligible!=e['restricted_target_count']:raise ValueError('INCOMPLETE_FEATURE_EFFECT')
            if direct:
                m=e['media']
                if m is None or e['media_stopped'] is not True or m['viewer_count']<1 or m['target_count']<1:raise ValueError('MEDIA_TARGET_UNCONFIRMED')
                if any(m[k]!=m['target_count'] for k in ['stopped_count','hidden_count','inert_count']) or m['playing_count'] or m['stop_error_count']:raise ValueError('MEDIA_STOP_FAILED')
                if m['audio_verification']!='NOT_VERIFIED':raise ValueError('DOM_CANNOT_ATTEST_AUDIO_ACCEPTANCE')
    def _policy(self,e,p,key):
        result=e['result'];details=e['details'];policy=p['projection']['content']
        if result in ('APPLIED','NOT_APPLICABLE') and (not e['scan_complete'] or not e['observer_ready'] or e['error_count']):raise ValueError('INVALID_POLICY_OBSERVATION')
        if result not in ('APPLIED','NOT_APPLICABLE'):return
        if e['policy_type']=='BLUR':
            config=policy['blur']
            if details['profile_id']!=config['model_profile_id'] or details['profile_sha256']!=config['profile_sha256']:raise ValueError('BLUR_PROFILE_MISMATCH')
            if details['failed_image_count'] or details['stale_results_applied_count']:raise ValueError('BLUR_CLASSIFICATION_FAILED')
            if result=='NOT_APPLICABLE':
                if details['eligible_image_count']!=0:raise ValueError('BLUR_NOT_APPLICABLE_HAS_IMAGES')
            elif details['eligible_image_count']<1 or details['classified_image_count']!=details['eligible_image_count'] or not details['click_toggle_ready']:raise ValueError('BLUR_COVERAGE_INCOMPLETE')
            if details['masked_image_count']+details['revealed_image_count']!=details['sensitive_image_count'] or details['sensitive_image_count']>details['classified_image_count']:raise ValueError('BLUR_MASK_INCOMPLETE')
            if details['revealed_image_count'] and details['reveal_intent_sha256'] is None:raise ValueError('MISSING_REVEAL_INTENT')
        elif e['policy_type']=='KEYWORD':
            if details['checked_url_sha256']!=p['scope']['url_sha256'] or details['url_check_result']=='UNVERIFIABLE':raise ValueError('URL_CHECK_UNCONFIRMED')
            if details['url_check_result']=='MATCH' and 'KEYWORD' not in p['projection']['access_block_reasons']:raise ValueError('KEYWORD_BLOCK_NOT_AUTHORIZED_BY_CORE')
            if details['url_check_result']=='EXEMPT' and (not details['exception_scope_applied'] or 'KEYWORD' in p['projection']['access_block_reasons']):raise ValueError('KEYWORD_EXCEPTION_MISMATCH')
        elif e['policy_type']=='ADULT_DOMAIN':
            config=policy['adult']
            if details['artifact_id']!=config['artifact_id'] or details['artifact_sha256']!=config['artifact_sha256'] or details['domain_check_result']=='UNVERIFIABLE':raise ValueError('ADULT_INSPECTION_UNCONFIRMED')
            if details['dnr_effect_claimed']:raise ValueError('CONTENT_CANNOT_ATTEST_DNR')
            if details['domain_check_result']=='MATCH' and 'ADULT_DOMAIN' not in p['projection']['access_block_reasons']:raise ValueError('ADULT_BLOCK_NOT_AUTHORIZED_BY_CORE')
        elif e['policy_type']=='PAGE_GATE':
            if sorted(details['blocked_reasons'])!=sorted(p['projection']['access_block_reasons']):raise ValueError('PAGE_GATE_REASON_MISMATCH')
            if result!='APPLIED' or not all(details[k] for k in ['gate_visible','body_hidden','body_inert']) or details['stop_error_count'] or details['media_target_count']!=details['media_stopped_count']:raise ValueError('PAGE_GATE_EFFECT_UNCONFIRMED')
    def validate(self,result):
        _wire_shape('ContentResult',result)
        record=self.issued.get(result['operation_id'])
        if record is None:raise ValueError('MISSING_ISSUED_OPERATION')
        control=record['control'];p=control['payload']
        if result['request_id'] not in record['requests'] or result['semantic_sha256']!=p['semantic_sha256'] or result['scope']!=p['scope'] or result['control_seq']!=p['control_seq']:raise ValueError('CONTENT_RESULT_BINDING_MISMATCH')
        effects=result['effects'];keys=[effect_key(e) for e in effects];state=result['result_state']
        if len(keys)!=len(set(keys)):raise ValueError('DUPLICATE_EFFECT_RESULT')
        if state in ('RECEIVED','APPLYING') and not effects:return 'PENDING'
        if state in ('FAILED','UNSUPPORTED') and result['status']=='NACK' and result['error_code'] and not effects:return 'REJECTED'
        if set(keys)!=set(record['expected']):raise ValueError('MISSING_OR_UNREQUESTED_EFFECT_RESULT')
        for key,e in zip(keys,effects):
            if e['action']!=record['expected'][key] or e['owner_binding_id']!=p['scope']['owner_binding_id'] or e['evidence_scope_sha256']!=digest(p['scope']):raise ValueError('EFFECT_OWNER_SCOPE_ACTION_MISMATCH')
            allowed={'APPLY':{'APPLIED','NOT_APPLICABLE','OBSERVING','FAILED','UNCONFIRMED','UNSUPPORTED'},'RELEASE':{'RELEASED','RELEASE_FAILED','UNCONFIRMED','UNSUPPORTED'}}
            if e['result'] not in allowed[e['action']]:raise ValueError('EFFECT_ACTION_STATE_MISMATCH')
            if e['action']=='RELEASE':
                if e['kind']=='CONTENT_POLICY' and e['policy_sha256']!=record['prior'][key]['policy_sha256']:raise ValueError('RELEASE_POLICY_HASH_MISMATCH')
                if e['result']=='RELEASED':
                    restore=e['restore']
                    if not restore or e['remaining_claim_count'] or not all(restore[k] for k in ['dom_restored','own_observer_claim_removed','policy_resources_released','other_owner_claims_preserved']):raise ValueError('RESTORE_UNCONFIRMED')
                    if e['error_count']:raise ValueError('RESTORE_HAS_ERRORS')
                    if record['prior'][key].get('media_owned') and restore['media_restore_state'] not in ('USER_CONTROL_RESTORED','STILL_BLOCKED_OTHER_OWNER'):raise ValueError('MEDIA_RESTORE_UNCONFIRMED')
                    if e['kind']=='FEATURE' and e['route_profile_sha256']!=record['prior'][key]['route_profile_sha256']:raise ValueError('RELEASE_PROFILE_MISMATCH')
                    if e['scan_id']!=record['prior'][key]['scan_id']:raise ValueError('RELEASE_SCAN_MISMATCH')
            else:
                if e['restore'] is not None:raise ValueError('APPLY_CANNOT_CLAIM_RELEASE_PROOF')
                if e['result'] in ('APPLIED','NOT_APPLICABLE') and e['remaining_claim_count']<1:raise ValueError('OBSERVER_CLAIM_UNRECORDED')
                if e['scan_id']!=p['projection']['document_context']['scan_id']:raise ValueError('STALE_ROUTE_OR_SCAN')
                if e['kind']=='FEATURE':self._feature(e,p)
                else:
                    if e['policy_sha256']!=record['policy_hashes'][key]:raise ValueError('POLICY_HASH_MISMATCH')
                    self._policy(e,p,key)
        if result['remaining_claim_count']!=sum(e['remaining_claim_count'] for e in effects):raise ValueError('OWNED_CLAIM_COUNT_MISMATCH')
        states=[e['result'] for e in effects]
        if all(action=='RELEASE' for action in record['expected'].values()) and record['expected']:
            wanted='RELEASED' if all(s=='RELEASED' for s in states) else 'RELEASE_FAILED'
        elif not states or all(s=='NOT_APPLICABLE' for s in states):wanted='NOT_APPLICABLE'
        elif all(s in ('APPLIED','NOT_APPLICABLE','RELEASED') for s in states):wanted='APPLIED'
        elif all(s=='OBSERVING' for s in states):wanted='OBSERVING'
        elif any(s in ('APPLIED','NOT_APPLICABLE','RELEASED') for s in states):wanted='PARTIAL'
        else:wanted='UNCONFIRMED' if all(s=='UNCONFIRMED' for s in states) else 'FAILED'
        ack='ACK' if wanted in ('APPLIED','NOT_APPLICABLE','OBSERVING','RELEASED') else 'NACK'
        if (state,result['status'])!=(wanted,ack):raise ValueError('OVERALL_EFFECT_STATE_MISMATCH')
        if wanted=='RELEASED' and result['remaining_claim_count']!=0:raise ValueError('UNRELEASED_OWN_CLAIMS')
        return wanted
