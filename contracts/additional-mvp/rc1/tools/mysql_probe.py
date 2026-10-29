"""Disposable-schema SQL probe. Credentials remain in a private .local client file."""
import argparse,json,re,subprocess
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--mysql',required=True);p.add_argument('--client',required=True);p.add_argument('--backend-db',required=True);p.add_argument('--runtime-db',required=True);p.add_argument('--output',required=True);a=p.parse_args()
 root=Path(__file__).resolve().parents[4];package=Path(__file__).resolve().parents[1]
 evidence=[]
 def run(database,sql,success=True):
  r=subprocess.run([a.mysql,'--defaults-extra-file='+a.client,'--protocol=tcp','--batch','--skip-column-names','--default-character-set=utf8mb4',database],input=sql,encoding='utf8',capture_output=True)
  if success and r.returncode:raise RuntimeError(r.stderr[:1200])
  if not success and not r.returncode:raise AssertionError('Expected database rejection')
  return r.stdout.strip()
 for module,database,ddl in [('backend',a.backend_db,'mysql-candidate.sql'),('runtime-server',a.runtime_db,'mysql-runtime-candidate.sql')]:
  migrations=sorted((root/module/'src/main/resources/db/migration').glob('V*.sql'),key=lambda f:int(re.match(r'V(\d+)',f.name)[1]))
  for m in migrations:run(database,m.read_text('utf8'))
  before=run(database,'SHOW TABLES;').splitlines()
  run(database,(package/ddl).read_text('utf8'))
  after=run(database,'SHOW TABLES;').splitlines()
  assert set(before).issubset(after)
  assert len([x for x in after if x.startswith('amvp_')])==17
  evidence.append({'module':module,'case':'baseline migrations + additive candidate DDL','result':'PASS','legacy_tables':len(before),'new_tables':17})
  # Synthetic identity only, no credential/session/real-user data.
  run(database,"INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES('contract-fixture',NULL,false,'ACTIVE',UTC_TIMESTAMP(3),'fixture',UTC_TIMESTAMP(3));")
  executor='00000000-0000-4000-8000-000000000001';binding='00000000-0000-4000-8000-000000000002'
  run(database,f"INSERT INTO extension_installations(id,current_user_id,proof_hash,client_version) VALUES('{executor}',1,REPEAT('0',64),'contract-fixture'); INSERT INTO amvp_owner_bindings(binding_id,executor_id,user_id,owner_epoch,state,created_at) VALUES('{binding}','{executor}',1,1,'ACTIVE',UTC_TIMESTAMP(3));")
  usage=f"INSERT INTO amvp_usage_segments(segment_id,owner_binding_id,executor_id,collector_epoch,local_usage_seq,actual_host,start_at,end_at,confirmed_ms,uncertain_ms,payload_json,payload_sha256) VALUES('00000000-0000-4000-8000-000000000003','{binding}','{executor}','00000000-0000-4000-8000-000000000004',1,'video.example.test','2026-10-29 00:00:00','2026-10-29 00:00:05',5000,0,JSON_OBJECT(),REPEAT('0',64));"
  run(database,usage);run(database,usage,False)
  assert run(database,'SELECT COUNT(*),SUM(confirmed_ms) FROM amvp_usage_segments;')=='1\t5000'
  evidence.append({'module':module,'case':'same segment unique key prevents duplicate insert','result':'PASS'})
  bad=usage.replace('000000000003','000000000005').replace(',1,\'video',',2,\'video').replace("'2026-10-29 00:00:05'","'2026-10-28 23:59:59'")
  run(database,bad,False);evidence.append({'module':module,'case':'negative interval CHECK rejection','result':'PASS'})
  fk=usage.replace('000000000003','000000000006').replace(binding,'00000000-0000-4000-8000-000000000099').replace(',1,\'video',',3,\'video')
  run(database,fk,False);evidence.append({'module':module,'case':'unknown owner FK rejection','result':'PASS'})
  run(database,"START TRANSACTION; INSERT INTO amvp_artifacts VALUES('00000000-0000-4000-8000-000000000007','MODEL_PROFILE',1,REPEAT('0',64),JSON_OBJECT(),'PENDING'); ROLLBACK;")
  assert run(database,'SELECT COUNT(*) FROM amvp_artifacts;')=='0';evidence.append({'module':module,'case':'rollback leaves no artifact','result':'PASS'})
  run(database,"INSERT INTO amvp_import_receipts VALUES(1,'00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000009',REPEAT('0',64),JSON_OBJECT(),UTC_TIMESTAMP(3));")
  run(database,"INSERT INTO amvp_import_receipts VALUES(1,'00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000009',REPEAT('0',64),JSON_OBJECT(),UTC_TIMESTAMP(3));",False)
  assert run(database,'SELECT COUNT(*) FROM amvp_day_budgets;')=='0';evidence.append({'module':module,'case':'import dedup identity; no automatic quota rows','result':'PASS'})
 Path(a.output).write_text(json.dumps({'kind':'REAL_ISOLATED_MYSQL_SQL_PROBE','cases':evidence,'not_tested':['application HTTP auth','concurrent Server transactions','actual Chrome','actual production migration','raw payload schema enforced by application']},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('MySQL SQL probe:',len(evidence),'PASS; baseline schemas and new candidate tables only')
if __name__=='__main__':main()
