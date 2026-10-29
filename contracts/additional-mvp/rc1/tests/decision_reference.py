"""RC2 decision oracles only. Browser observations/proofs below are privileged fixtures.
Not a product adapter, authentication implementation or clock calibration service.
"""
import copy
from reference_model import digest
from review_reference import _wire_shape, safe

class ProofPorts:
    """Worker-owned live handles; raw wire/body fields never register an endpoint."""
    def __init__(self):self.live={}
    def register(self,handle,scope,sender,frame,proof,credential,own_id):
        _wire_shape('BindingScope',scope)
        if not own_id or sender.get('id')!=own_id or not proof.get('attested'):raise ValueError('ENDPOINT_UNVERIFIED')
        expected=(scope['tab_id'],0,scope['document_id'])
        if (sender.get('tab_id'),sender.get('frame_id'),sender.get('document_id'))!=expected:raise ValueError('DOCUMENT_MISMATCH')
        if (frame.get('tab_id'),frame.get('frame_id'),frame.get('document_id'))!=expected or frame.get('lifecycle')!='active':raise ValueError('NATIVE_DOCUMENT_UNVERIFIED')
        if not sender.get('url_hash') or sender.get('origin')!=frame.get('origin'):raise ValueError('SENDER_URL_UNVERIFIED')
        if proof.get('registered_sender_url_hash')!=sender['url_hash'] or proof.get('native_url_hash')!=frame.get('url_hash'):raise ValueError('URL_PROOF_MISMATCH')
        if sender['url_hash']!=frame['url_hash'] and not proof.get('navigation_revalidated'):raise ValueError('NAVIGATION_REVALIDATION_REQUIRED')
        if proof.get('scope_hash')!=digest(scope) or proof.get('credential_hash')!=digest({'credential':credential}):raise ValueError('PROOF_BINDING_MISMATCH')
        if scope['url_sha256']!=frame['url_hash'] or not proof.get('proof_id') or not proof.get('boot_id'):raise ValueError('SCOPE_PROOF_MISMATCH')
        # Reconnection rotates credential and invalidates every old live handle for this binding.
        old=[h for h,r in self.live.items() if r['scope']['binding_id']==scope['binding_id']]
        if any(self.live[h]['credential']==credential for h in old):raise ValueError('CREDENTIAL_ROTATION_REQUIRED')
        for h in old:self.live.pop(h)
        self.live[handle]={'scope':copy.deepcopy(scope),'credential':credential,'sender_hash':sender['url_hash'],
          'native_hash':frame['url_hash'],'proof':copy.deepcopy(proof),'active':True}
    def authorize(self,handle,scope,credential,frame,*,sender_hash=None,handoff=None,old_grant=None,target=None,now=0):
        r=self.live.get(handle)
        if not r or r['scope']!=scope or r['credential']!=credential:raise ValueError('CHANNEL_SCOPE_MISMATCH')
        p=r['proof'];old=old_grant is not None
        if not r['active'] and not old:raise ValueError('INACTIVE_DOCUMENT')
        if (frame.get('tab_id'),frame.get('frame_id'),frame.get('document_id'))!=(scope['tab_id'],0,scope['document_id']):raise ValueError('DOCUMENT_MISMATCH')
        if frame.get('boot_id')!=p['boot_id']:raise ValueError('BOOT_REVALIDATION_REQUIRED')
        if old:
            required=(digest(scope),target,p['proof_id'])
            if (old_grant.get('scope_hash'),old_grant.get('target'),old_grant.get('proof_id'))!=required or old_grant.get('expires',0)<=now or not old_grant.get('exact_old_document_verified'):raise ValueError('OLD_SCOPE_GRANT_REJECTED')
            return True # Specific target read/cleanup only, never a new APPLY authorization.
        if frame.get('lifecycle')!='active':raise ValueError('INACTIVE_DOCUMENT')
        if frame.get('url_hash')!=r['native_hash']:
            # A handoff/body claim is not a committed current-generation proof.
            # Register the independently revalidated new scope/credential before APPLY.
            raise ValueError('NAVIGATION_REVALIDATION_REQUIRED')
        allowed={r['sender_hash']}
        if sender_hash is not None and sender_hash not in allowed:raise ValueError('SENDER_URL_MISMATCH')
        return True

class ContentQueries:
    """Read-only issuer/receipt projection; no effects, normal seq or cleanup slots mutated."""
    def __init__(self,issued):
        self.issued=issued;self.receipts={};self.cache={};self.evicted=set()
    def receipt(self,value):
        self.issued.validate(value)
        self.receipts.setdefault(value['operation_id'],copy.deepcopy(value))
    def query(self,q,*,authorize,as_of,store_available=True,progress='UNKNOWN',observation=None):
        _wire_shape('ContentQuery',q)
        authorize(q) # Trusted adapter callback, not a request field. Recheck even on cache hit.
        h=digest(q,('query_sha256','channel_credential'))
        if h!=q['query_sha256']:raise ValueError('QUERY_HASH_MISMATCH')
        previous=self.cache.get(q['request_id'])
        if previous:
            if previous['query_sha256']!=h:raise ValueError('QUERY_ID_CONFLICT')
            return copy.deepcopy(previous)
        record=self.issued.issued.get(q['target_operation_id']) if store_available else None
        if record:
            p=record['control']['payload']
            if p['scope']!=q['scope'] or p['semantic_sha256']!=q['target_semantic_sha256']:raise ValueError('QUERY_TARGET_MISMATCH')
        state='UNKNOWN' if not store_available else ('FOUND' if record else ('EVICTED' if q['target_operation_id'] in self.evicted else 'NOT_FOUND'))
        effect=None
        if state=='FOUND' and observation is not None:
            if not observation.get('document_verified') or observation.get('scope_sha256')!=digest(q['scope']):raise ValueError('EFFECT_OBSERVATION_UNVERIFIED')
            effect={k:observation[k] for k in ('state','footprint_sha256','observed_at')}
        response={'type':'D06_ADDITIONAL_QUERY_RESULT','schema_version':'AMVP_CONTENT_2','stream':'ADDITIONAL_CONTENT',
          **{k:q[k] for k in ('request_id','query_sha256','scope','target_operation_id','target_semantic_sha256')},
          'lookup_state':state,'status':'NACK' if state=='UNKNOWN' else 'ACK','error_code':'STORE_UNCONFIRMED' if state=='UNKNOWN' else None,
          'historical_receipt':copy.deepcopy(self.receipts.get(q['target_operation_id'])) if state=='FOUND' else None,
          'progress_state':progress if state=='FOUND' else 'UNKNOWN','current_effect':effect,'observed_at':as_of}
        _wire_shape('ContentQueryResult',response)
        # A transient storage failure is never an immutable successful query receipt.
        if state!='UNKNOWN':self.cache[q['request_id']]=copy.deepcopy(response)
        return response
    def validate_response(self,q,r):
        _wire_shape('ContentQuery',q)
        if digest(q,('query_sha256','channel_credential'))!=q['query_sha256']:raise ValueError('QUERY_HASH_MISMATCH')
        _wire_shape('ContentQueryResult',r)
        if any(r[k]!=q[k] for k in ('request_id','query_sha256','scope','target_operation_id','target_semantic_sha256')):raise ValueError('QUERY_RESPONSE_BINDING_MISMATCH')
        receipt=r['historical_receipt']
        if receipt is not None:
            if receipt!=self.receipts.get(q['target_operation_id']):raise ValueError('HISTORICAL_RECEIPT_MISMATCH')
            if receipt['operation_id']!=q['target_operation_id'] or receipt['semantic_sha256']!=q['target_semantic_sha256'] or receipt['scope']!=q['scope']:raise ValueError('HISTORICAL_TARGET_MISMATCH')
        return r['lookup_state']

class ConservativeBudget:
    """Local durable sidecar reservation oracle. Never counts uncertain time as confirmed."""
    def __init__(self,limit,existing_debit=0):
        if not safe(limit) or not safe(existing_debit):raise ValueError('INVALID_BUDGET')
        self.limit=limit;self.existing=existing_debit;self.confirmed=0;self.reserved={};self.resolved={}
    def reserve(self,item,source_hash,duration,day_verified=True):
        if duration is not None and not safe(duration):raise ValueError('INVALID_DURATION')
        record=(source_hash,duration if day_verified else None)
        if item in self.resolved:
            if self.resolved[item]['source']!=record:raise ValueError('RESERVATION_ID_CONFLICT')
            return 'DUPLICATE'
        if item in self.reserved and self.reserved[item]!=record:raise ValueError('RESERVATION_ID_CONFLICT')
        self.reserved[item]=record
        return 'RESERVED' if record[1] is not None else 'BLOCKED_UNCONFIRMED'
    def resolve(self,item,source_hash,confirmed,*,verified=False):
        if not verified or not safe(confirmed,1):raise ValueError('RESOLUTION_UNVERIFIED')
        if item in self.resolved:
            r=self.resolved[item]
            if r['source'][0]!=source_hash or r['confirmed']!=confirmed:raise ValueError('RESOLUTION_CONFLICT')
            return 'DUPLICATE'
        old=self.reserved.get(item)
        if old is None or old[0]!=source_hash:raise ValueError('RESOLUTION_SOURCE_MISMATCH')
        # Existing ClockResolution preserves the exact positive physical capture duration.
        if old[1] is not None and confirmed!=old[1]:raise ValueError('RESOLUTION_DURATION_MISMATCH')
        self.reserved.pop(item);self.confirmed+=confirmed
        self.resolved[item]={'source':old,'confirmed':confirmed};return 'RESOLVED'
    def remaining(self):
        if any(amount is None for _,amount in self.reserved.values()):return 0
        return max(0,self.limit-self.existing-self.confirmed-sum(amount for _,amount in self.reserved.values()))

class IdleMeasurement:
    """First 60s count until observed idle; no browser last-input timestamp is invented."""
    def __init__(self):self.state='UNAVAILABLE';self.quality='UNKNOWN';self.observed_debit=0
    def observe(self,elapsed,state,*,available=True,foreground=True):
        if not safe(elapsed):raise ValueError('INVALID_INTERVAL')
        if not available or state not in ('active','idle','locked'):
            self.state='UNAVAILABLE';self.quality='UNKNOWN';return 'RESTRICT_QUOTA_SITES'
        # Settle preceding verified active foreground interval, including the first 60 seconds.
        if self.state=='active' and foreground:self.observed_debit+=elapsed
        self.state=state;self.quality='PARTIAL' if elapsed>60000 and state=='idle' else 'COMPLETE'
        return 'IDLE_DELAY_UNCERTAIN' if self.quality=='PARTIAL' else 'OBSERVED'
