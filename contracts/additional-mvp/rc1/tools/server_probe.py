"""Candidate SQL security/concurrency probes. Synthetic data in launcher-owned DBs only."""
import subprocess
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

def probe(args,database,module,executor,binding):
    evidence=[]
    def raw(sql):
        return subprocess.run([args.mysql,'--defaults-extra-file='+args.client,'--protocol=tcp','--batch','--skip-column-names','--default-character-set=utf8mb4',database],input=sql,text=True,encoding='utf8',capture_output=True,timeout=25)
    def run(sql):
        r=raw(sql)
        if r.returncode:raise AssertionError('Independent SQL fixture/transaction failed; inspect private DB log')
        return r.stdout.strip()
    def uid(n):return f'10000000-0000-4000-8000-{n:012d}'
    other,owner=uid(100),uid(101)
    run(f"INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES('second-fixture',NULL,false,'ACTIVE',UTC_TIMESTAMP(3),'fixture',UTC_TIMESTAMP(3)); INSERT INTO extension_installations(id,current_user_id,proof_hash,client_version) VALUES('{other}',2,REPEAT('0',64),'fixture'); INSERT INTO amvp_owner_bindings VALUES('{owner}','{other}',2,1,'ACTIVE',UTC_TIMESTAMP(3),NULL);")
    package,receipt=uid(102),uid(103)
    run(f"INSERT INTO amvp_packages VALUES('{package}','{owner}',1,JSON_OBJECT(),REPEAT('0',64),UTC_TIMESTAMP(3)); INSERT INTO amvp_capability_receipts VALUES('{receipt}','{owner}',REPEAT('0',64),JSON_OBJECT(),'fixture','2030-01-01'); INSERT INTO amvp_clock_anchors VALUES('other-anchor','{owner}','{other}','other-clock','other-boot',0,'2026-10-29','VERIFIED',REPEAT('0',64));")
    bads={
        'usage rejects binding/executor mismatch':f"INSERT INTO amvp_usage_segments(segment_id,owner_binding_id,executor_id,collector_epoch,local_usage_seq,actual_host,start_at,end_at,confirmed_ms,uncertain_ms,payload_json,payload_sha256) VALUES('{uid(110)}','{binding}','{other}','{uid(111)}',1,'example.test','2026-10-29','2026-10-29 00:00:05',5000,0,JSON_OBJECT(),REPEAT('0',64));",
        'current package rejects other owner':f"INSERT INTO amvp_current_packages VALUES('{binding}','{package}');",
        'focus attachment rejects other owner receipt':f"INSERT INTO amvp_focus_attachments VALUES('{uid(112)}','{binding}','{uid(113)}',REPEAT('0',64),'{receipt}',JSON_OBJECT(),REPEAT('0',64));",
        'clock anchor rejects binding/executor mismatch':f"INSERT INTO amvp_clock_anchors VALUES('bad-anchor','{binding}','{other}','clock','boot',0,'2026-10-29','VERIFIED',REPEAT('0',64));",
        'event rejects binding/executor mismatch':f"INSERT INTO amvp_events VALUES('{uid(114)}','{binding}','{other}','{uid(115)}',1,'{uid(116)}','{uid(117)}','example.test',NULL,'2026-10-29',JSON_OBJECT(),REPEAT('0',64));",
        'budget rejects unsafe version':f"INSERT INTO amvp_day_budgets VALUES('{executor}','{uid(118)}','2026-10-29','2026-10-30','{uid(119)}',0,0,60000,0);",
    }
    fields='resolution_id,segment_id,anchor_id,source_hash,evidence_sha256,confirmed_ms,resolved_start_at,resolved_end_at,day_start_at,day_end_at,payload_json'
    values=f"'{uid(120)}','00000000-0000-4000-8000-000000000011','other-anchor',REPEAT('0',64),REPEAT('0',64),5000,'2026-10-29','2026-10-29 00:00:05','2026-10-29','2026-10-30',JSON_OBJECT()"
    # The immutable reviewed DDL has no resolution owner columns; replay it without syntax errors.
    if 'owner_binding_id' in run('SHOW COLUMNS FROM amvp_clock_resolutions;'):
        fields+=',owner_binding_id,executor_id';values+=f",'{binding}','{executor}'"
    bads['resolution rejects cross-owner anchor']=f'INSERT INTO amvp_clock_resolutions({fields}) VALUES({values});'
    bads['resolution rejects wrong source hash']=bads['resolution rejects cross-owner anchor'].replace("'other-anchor'","'fixture-anchor'").replace("REPEAT('0',64),REPEAT('0',64)","REPEAT('1',64),REPEAT('0',64)")
    bads['resolution rejects wrong duration']=bads['resolution rejects cross-owner anchor'].replace("'other-anchor'","'fixture-anchor'").replace(',5000,',',999999,')
    for label,sql in bads.items():
        r=raw('START TRANSACTION;'+sql+'ROLLBACK;')
        expected='3819' if label in ('budget rejects unsafe version','resolution rejects wrong duration') else '1452'
        evidence.append({'module':module,'case':label,'result':'PASS' if r.returncode and ('ERROR '+expected) in r.stderr else 'FAIL','observed':'ACCEPTED' if not r.returncode else ('EXPECTED_REJECTION' if ('ERROR '+expected) in r.stderr else 'UNEXPECTED_SQL_ERROR')})
    config=uid(130)
    run(f"INSERT INTO amvp_configs VALUES('{config}','{binding}','CONTENT',1,JSON_OBJECT(),1,UTC_TIMESTAMP(3),NULL); INSERT INTO amvp_config_versions VALUES('{config}',1,JSON_OBJECT(),REPEAT('0',64),UTC_TIMESTAMP(3));")
    def parallel(scripts):
        barrier=Barrier(2)
        def work(sql):barrier.wait(timeout=10);return raw(sql)
        with ThreadPoolExecutor(max_workers=2) as pool:return list(pool.map(work,scripts))
    scripts=[]
    for n in (131,132):
        scripts.append(f"START TRANSACTION; UPDATE amvp_configs SET version=version+1 WHERE config_id='{config}' AND version=1; SET @won=ROW_COUNT(); INSERT INTO amvp_config_versions SELECT '{config}',2,JSON_OBJECT(),REPEAT('0',64),UTC_TIMESTAMP(3) WHERE @won=1; INSERT INTO amvp_outbox SELECT '{uid(n)}','{binding}','RUNTIME_POLICY',JSON_OBJECT(),REPEAT('0',64),'PENDING',0,UTC_TIMESTAMP(3) WHERE @won=1; COMMIT; SELECT @won;")
    rr=parallel(scripts);assert all(not r.returncode for r in rr) and sorted(r.stdout.strip() for r in rr)==['0','1']
    assert run(f"SELECT version FROM amvp_configs WHERE config_id='{config}';")=='2'
    assert run(f"SELECT COUNT(*) FROM amvp_config_versions WHERE config_id='{config}' AND version=2;")=='1'
    evidence.append({'module':module,'case':'two real connections CAS yield one version/history/outbox winner','result':'PASS'})
    key=uid(140);rr=parallel([f"INSERT INTO amvp_operations VALUES('{uid(n)}','{binding}','PUT /api/v1/amvp/configs/{config}','{key}',REPEAT('0',64),'COMMITTED',JSON_OBJECT('version',2),UTC_TIMESTAMP(3));" for n in (141,142)])
    assert sorted(r.returncode==0 for r in rr)==[False,True] and any('ERROR 1062' in r.stderr for r in rr)
    assert run(f"SELECT COUNT(*) FROM amvp_operations WHERE owner_binding_id='{binding}' AND idempotency_key='{key}';")=='1'
    evidence.append({'module':module,'case':'two real connections unique idempotency row; loser must re-read hash/receipt','result':'PASS'})
    run(f"START TRANSACTION; UPDATE amvp_configs SET version=3 WHERE config_id='{config}'; INSERT INTO amvp_config_versions VALUES('{config}',3,JSON_OBJECT(),REPEAT('0',64),UTC_TIMESTAMP(3)); INSERT INTO amvp_outbox VALUES('{uid(150)}','{binding}','RUNTIME_POLICY',JSON_OBJECT(),REPEAT('0',64),'PENDING',0,UTC_TIMESTAMP(3)); ROLLBACK;")
    assert run(f"SELECT version FROM amvp_configs WHERE config_id='{config}';")=='2'
    assert run(f"SELECT COUNT(*) FROM amvp_config_versions WHERE config_id='{config}' AND version=3;")=='0'
    assert run(f"SELECT COUNT(*) FROM amvp_outbox WHERE item_id='{uid(150)}';")=='0'
    evidence.append({'module':module,'case':'rollback preserves config/history/outbox atomicity','result':'PASS'})
    scripts=[]
    for n in (160,161):
        scripts.append(f"START TRANSACTION; SELECT id FROM extension_installations WHERE id='{executor}' FOR UPDATE; SELECT COUNT(*) INTO @overlap FROM amvp_usage_segments WHERE executor_id='{executor}' AND clock_boot_id='race-boot' AND mono_start_ms<5000 AND mono_end_ms>0 FOR UPDATE; INSERT INTO amvp_usage_segments(segment_id,owner_binding_id,executor_id,collector_epoch,local_usage_seq,actual_host,start_at,end_at,confirmed_ms,uncertain_ms,payload_json,payload_sha256,clock_epoch,clock_boot_id,mono_start_ms,mono_end_ms,measurement_state) SELECT '{uid(n)}','{binding}','{executor}','{uid(162)}',{n},'example.test','2026-10-29 20:00:00','2026-10-29 20:00:05',5000,0,JSON_OBJECT(),REPEAT('0',64),'race-clock','race-boot',0,5000,'COUNTED' WHERE @overlap=0; SET @won=ROW_COUNT(); COMMIT; SELECT @won;")
    rr=parallel(scripts);assert all(not r.returncode for r in rr) and sorted(r.stdout.strip().splitlines()[-1] for r in rr)==['0','1']
    evidence.append({'module':module,'case':'installation row lock serializes physical overlap admission across real connections','result':'PASS'})
    aggregate="SELECT SUM(COALESCE(r.confirmed_ms,s.confirmed_ms)) FROM amvp_usage_segments s JOIN amvp_owner_bindings b ON b.binding_id=s.owner_binding_id LEFT JOIN amvp_clock_resolutions r ON r.segment_id=s.segment_id WHERE b.user_id=1 AND s.measurement_state='COUNTED';"
    old_total=run(aggregate);assert int(old_total)>0
    run(f"UPDATE extension_installations SET current_user_id=2 WHERE id='{executor}';")
    assert run(aggregate)==old_total
    assert run('SELECT COUNT(*) FROM amvp_import_receipts;')=='1'
    assert run('SELECT COUNT(*) FROM amvp_day_budgets;')=='0'
    run(f"UPDATE extension_installations SET current_user_id=1 WHERE id='{executor}';")
    evidence.append({'module':module,'case':'historical binding aggregate survives account transfer; import never debits quota','result':'PASS'})
    return evidence
