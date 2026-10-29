"""Readonly digests of explicit application record fields, never auth tables.
Raw fields remain in MySQL; only SHA-256 row digests leave the server.
"""
import hashlib,re

FIELDS={
 'focus_sessions':('id','source_session_id','user_id','executor_id','execution_status','duration_minutes',
                   'record_status','active_duration_ms','overrun_ms','started_at','planned_end_at','ended_at',
                   'policy_released_at','end_reason','last_error_code'),
 'access_events':('event_id','session_id','occurred_at','access_seq','target_kind','target_host','target_key',
                  'reason','navigation_id','policy_snapshot_id'),
 'session_intervals':('id','session_id','kind','start_at','end_at','duration_ms','quality','confirmed_until'),
}

def capture(core,p,r,before_query=None):
 ident=r.get('id');schema=r.get('schema')
 if not isinstance(ident,str) or not re.fullmatch('[a-f0-9]{32}',ident) or schema!='focurve_user_'+ident:
  raise RuntimeError('RECORD_SNAPSHOT_SCHEMA_MISMATCH')
 tables={}
 for name,columns in FIELDS.items():
  if before_query is not None:before_query()
  # Fixed source-controlled identifiers only. Limit exhaustion is a failure,
  # never a truncated successful comparison.
  fields=','.join('`'+n+'`' for n in columns)
  sql='SELECT SHA2(CAST(JSON_ARRAY('+fields+') AS CHAR CHARACTER SET utf8mb4),256) FROM `'+schema+'`.`'+name+'` ORDER BY 1 LIMIT 50001;'
  rows=core.sql(p,r,sql).splitlines()
  if len(rows)>50000 or any(not re.fullmatch('[a-f0-9]{64}',v) for v in rows):
   raise RuntimeError('RECORD_SNAPSHOT_UNCONFIRMED')
  tables[name]={'rows':len(rows),'sha256':hashlib.sha256(('\n'.join(rows)).encode('ascii')).hexdigest()}
 return {'contract':'FOCURVE_APPLICATION_RECORD_DIGESTS_1','installationId':ident,'schema':schema,
         'fields':{n:list(v) for n,v in FIELDS.items()},'tables':tables,'credentialTablesRead':False}

def same(before,after):
 return before==after and before.get('contract')=='FOCURVE_APPLICATION_RECORD_DIGESTS_1'
