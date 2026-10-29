"""Contract-only oracle. Never imported by product; no Chrome/network/storage access."""
import copy
import hashlib
import ipaddress
import json
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit, unquote, parse_qsl
from zoneinfo import ZoneInfo, reset_tzpath
import idna

# Test-process-only: use the locked PyPI tzdata package on Windows and Linux alike.
reset_tzpath([])

UTC = timezone.utc
def digest(value, excluded=()):
    clean = {k: v for k, v in value.items() if k not in excluded}
    return hashlib.sha256(json.dumps(clean, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()

def host(raw):
    h = idna.encode(raw.rstrip('.'), uts46=True, transitional=False, std3_rules=True).decode().lower()
    try:
        ipaddress.ip_address(h)
    except ValueError:
        pass
    else:
        raise ValueError('IP_NOT_POLICY_HOST')
    if '.' not in h or len(h)>253: raise ValueError('HOST_INVALID')
    return h

def matches(actual, policy, subdomains=True):
    a, p = host(actual), host(policy)
    return a == p or (subdomains and a.endswith('.' + p))

def boundary_match(text, term):
    normalize = lambda s: unicodedata.normalize('NFKC', s).casefold()
    text, term = normalize(text), normalize(term)
    for m in re.finditer(re.escape(term), text):
        lo,hi=m.span()
        if (lo==0 or not text[lo-1].isalnum()) and (hi==len(text) or not text[hi].isalnum()):return True
    return False

def keyword_matches(url, term):
    u=urlsplit(url)
    if u.scheme not in ('http','https') or not u.hostname:return False
    if re.search(r'%(?![0-9a-fA-F]{2})',url): raise ValueError('INVALID_URL_ENCODING')
    # Query values only; '+' means query-space. Other components decode exactly once.
    pieces=[host(u.hostname), unquote(u.path, errors='strict'), unquote(u.fragment, errors='strict')]
    pieces += [v for _,v in parse_qsl(u.query,keep_blank_values=True,errors='strict')]
    return any(boundary_match(p,term) for p in pieces)

def reasons(focus, quota=False, block_window=False, outside=False, adult=False, keyword=False, adult_except=False, keyword_except=False):
    result=set()
    if quota:result.add('DAILY_LIMIT')
    if block_window:result.add('BLOCK_WINDOW')
    if outside:result.add('OUTSIDE_ALLOW_WINDOW')
    if adult and not adult_except:result.add('ADULT_DOMAIN')
    if keyword and not keyword_except:result.add('KEYWORD')
    if focus=='BLOCK':result.add('USER_SITE')
    return ('BLOCK' if result else focus), sorted(result)

def day_bounds(instant, zone):
    z=ZoneInfo(zone);local=instant.astimezone(z)
    start=datetime(local.year,local.month,local.day,tzinfo=z)
    return start.astimezone(UTC),(start+timedelta(days=1)).astimezone(UTC)

def transition(day_end, newzone, old_remaining, new_limit):
    _,end=day_bounds(day_end,newzone)
    # At exact new local midnight use next midnight; this is one transition chain.
    remaining=max(0,min(old_remaining,new_limit))
    return {'start':day_end,'end':end,'remaining':remaining,'carry_debit':new_limit-remaining}

def weekly_local(date, hour, zone):
    naive=datetime.fromisoformat(date+'T'+hour)
    z=ZoneInfo(zone)
    candidate=naive.replace(tzinfo=z,fold=0)
    if candidate.astimezone(UTC).astimezone(z).replace(tzinfo=None)!=naive:return None
    return candidate.astimezone(UTC) # earlier fold only

def validate_semantics(kind, x, issued=None, prior_claims=None, prior_footprint_sha256=None):
    """Additional semantic invariants; Schema validation must run first."""
    if kind=='ContentConfig':
        ids=[f['feature_id'] for f in x['features']]
        if len(ids)!=len(set(ids)):raise ValueError('DUPLICATE_FEATURE_ID')
        terms=[unicodedata.normalize('NFKC',t.strip()).casefold() for t in x['keyword']['terms']]
        if len(terms)!=len(set(terms)) or any(not t for t in terms):raise ValueError('DUPLICATE_OR_EMPTY_KEYWORD')
        if x['keyword']['enabled'] and not terms:raise ValueError('EMPTY_ACTIVE_KEYWORD')
        if x['adult']['enabled'] and not(x['adult']['artifact_id'] and x['adult']['artifact_sha256']):raise ValueError('ARTIFACT_UNVERIFIED')
        if x['blur']['enabled'] and not(x['blur']['model_profile_id'] and x['blur']['profile_sha256']):raise ValueError('MODEL_PROFILE_UNVERIFIED')
    elif kind=='SiteTimePolicy':
        n=x['daily_limit_ms']
        if n is not None and n%60000:raise ValueError('NOT_MINUTE_ALIGNED')
    elif kind=='UsageSegment':
        at=lambda v:datetime.fromisoformat(v.replace('Z','+00:00'))
        start,end=at(x['start_at']),at(x['end_at'])
        if not(at(x['day_start_at'])<=start<end<=at(x['day_end_at'])):raise ValueError('DAY_BOUNDARY')
        if x['confirmed_ms']+x['uncertain_ms']>round((end-start).total_seconds()*1000):raise ValueError('IMPOSSIBLE_DURATION')
        if x['local_usage_seq']==1 and x['previous_segment_sha256'] is not None:raise ValueError('INVALID_CHAIN_ROOT')
        if x['local_usage_seq']>1 and x['previous_segment_sha256'] is None:raise ValueError('MISSING_CHAIN_HASH')
    elif kind=='AccessEvent':
        if x['target_host']!=x['target_key']:raise ValueError('TARGET_KEY_NOT_ACTUAL_HOST')
        if (x['target_kind']=='FEATURE') != (x['feature_id'] is not None):raise ValueError('FEATURE_KIND_MISMATCH')
        if x['event_type']=='RECORDED_ACCESS' and (x['blocked_reasons'] or x['target_kind']!='SITE'):raise ValueError('RECORDED_BLOCK_MISMATCH')
        if x['event_type']!='RECORDED_ACCESS' and not x['blocked_reasons']:raise ValueError('BLOCK_REASON_REQUIRED')
        if (x['event_type']=='BLOCKED_FEATURE_ACCESS') != (x['target_kind']=='FEATURE'):raise ValueError('EVENT_KIND_MISMATCH')
    elif kind=='ContentResult':
        ack_states={'RECEIVED','APPLYING','OBSERVING','APPLIED','NOT_APPLICABLE','RELEASED'}
        if (x['status']=='ACK') != (x['result_state'] in ack_states):raise ValueError('ACK_STATE_MISMATCH')
        from review_reference import ContentOperationRegistry
        if issued is None:raise ValueError('MISSING_ISSUED_OPERATION')
        registry=ContentOperationRegistry();registry.issue(issued,prior_claims,prior_footprint_sha256)
        registry.validate(x)
    elif kind=='TransferState':
        if x['new_capture_open'] and not(x['state']=='COMMITTED' and x['old_capture_closed'] and x['old_rules_released']):raise ValueError('DUAL_OWNER')
    elif kind=='FocusCommand':
        if (x['action']=='START') != (x['duration_minutes'] is not None):raise ValueError('DURATION_ACTION_MISMATCH')
    elif kind=='OperationState':
        if x['actual_effect_confirmed'] != (x['state']=='CONFIRMED'):raise ValueError('FALSE_APPLIED')
    return x

def negotiate(supported,server,required,verified):
    if not verified:raise ValueError('CAPABILITY_NOT_VERIFIED')
    result={}
    for stream in required:
        common=set(supported.get(stream,[])) & set(server.get(stream,[]))
        if not common:raise ValueError('UNSUPPORTED_CONTRACT')
        # RC1 has exactly one version per stream. Future revisions must define preference.
        result[stream]=sorted(common)[-1]
    return result

def window_duration(when):
    if when['recurrence']=='ONCE':
        at=lambda s:datetime.fromisoformat(s.replace('Z','+00:00'))
        minutes=(at(when['end_at'])-at(when['start_at'])).total_seconds()/60
    else:
        minute=lambda s:int(s[:2])*60+int(s[3:])
        minutes=minute(when['end_local'])-minute(when['start_local'])+1440*when['end_day_offset']
    if not 0<minutes<=1440:raise ValueError('INVALID_WINDOW_DURATION')
    return minutes

class Focus:
    def __init__(self,snapshot,remaining):self.state='STARTING';self.snapshot=snapshot;self.remaining=remaining;self.runtime_active=True
    def applied(self,verified):self.state='RUNNING' if verified else 'UNKNOWN'
    def pause(self,released):
        if self.state!='RUNNING':raise ValueError('INVALID_TRANSITION')
        self.state='PAUSED' if released else 'UNKNOWN'
    def resume(self,snapshot,verified):
        if self.state!='PAUSED' or snapshot!=self.snapshot:raise ValueError('FROZEN_SNAPSHOT_MISMATCH')
        self.state='RUNNING' if verified else 'UNKNOWN'
    def end(self,released):self.state='ENDED' if released else 'UNKNOWN'

class Receiver:
    """RC1 legacy fixture oracle only. New usage-v2 uses review_reference.ClockedReceiver."""
    def __init__(self, owner, executor):
        self.owner,self.executor=owner,executor;self.items={};self.positions={};self.last={};self.intervals=[];self.total=0
    def receive(self,item):
        validate_semantics('UsageSegment',item)
        if item['owner_binding_id']!=self.owner or item['executor_id']!=self.executor:raise ValueError('FORBIDDEN_EXECUTOR')
        expected=digest(item,('payload_sha256',))
        if item['payload_sha256']!=expected:raise ValueError('HASH_MISMATCH')
        identity=item['segment_id']
        if identity in self.items:
            if self.items[identity]!=expected:raise ValueError('SOURCE_CONFLICT')
            return 'DUPLICATE'
        epoch,seq=item['collector_epoch'],item['local_usage_seq']
        key=(epoch,seq)
        if key in self.positions:raise ValueError('SEQUENCE_REUSE')
        last_seq,last_hash=self.last.get(epoch,(0,None))
        if seq!=last_seq+1:return 'PENDING_DEPENDENCY'
        if item['previous_segment_sha256']!=last_hash:raise ValueError('CHAIN_CONFLICT')
        start,end=item['start_at'],item['end_at']
        if any(start<b and end>a for a,b in self.intervals):raise ValueError('OVERLAPPING_USAGE')
        self.items[identity]=expected;self.positions[key]=identity;self.last[epoch]=(seq,expected)
        self.intervals.append((start,end));self.total+=item['confirmed_ms']
        return 'ACCEPTED'

class Claims:
    def __init__(self):self.claims={}
    def apply(self,resource,owner):self.claims.setdefault(resource,set()).add(owner)
    def release(self,resource,owner):
        self.claims.get(resource,set()).discard(owner)
        return bool(self.claims.get(resource))

class ControlReceiver:
    def __init__(self,owner,generation):self.owner=owner;self.generation=generation;self.seq=0;self.receipts={};self.effects=0
    def apply(self,operation,semantic,owner,generation,seq,sender_verified=True,supported=True):
        if not sender_verified:raise ValueError('INVALID_SENDER')
        if not supported:raise ValueError('UNSUPPORTED_CONTRACT')
        if owner!=self.owner or generation!=self.generation:raise ValueError('STALE_SCOPE')
        if operation in self.receipts:
            if self.receipts[operation]!=semantic:raise ValueError('IDEMPOTENCY_CONFLICT')
            return 'DUPLICATE'
        if not isinstance(seq,int) or isinstance(seq,bool) or not 1<=seq<=9007199254740991:raise ValueError('CONTROL_SEQUENCE_LIMIT')
        if seq<=self.seq:raise ValueError('STALE_SEQUENCE')
        if seq!=self.seq+1:return 'PENDING_DEPENDENCY'
        self.receipts[operation]=semantic;self.seq=seq;self.effects+=1
        return 'APPLIED'

class Imports:
    def __init__(self):self.records={};self.quota_debit=0
    def select(self,member,source,record,hash_,state,explicit):
        if not explicit or state!='COMPLETED':raise ValueError('EXPLICIT_COMPLETED_ONLY')
        k=(member,source,record)
        if k in self.records:
            if self.records[k]!=hash_:raise ValueError('SOURCE_CONFLICT')
            return 'DUPLICATE'
        self.records[k]=hash_;return 'ACCEPTED'
