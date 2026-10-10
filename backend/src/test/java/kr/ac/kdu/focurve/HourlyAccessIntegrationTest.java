package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import kr.ac.kdu.focurve.records.RecordQueries;
import kr.ac.kdu.focurve.auth.MailDelivery;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@ActiveProfiles("test")
@SpringBootTest(properties="AUTH_PUBLIC_URL=http://127.0.0.1:5173")
@Transactional
class HourlyAccessIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired RecordQueries records;
  @MockitoBean MailDelivery mail;
  String id(){return UUID.randomUUID().toString();}
  record Fixture(long owner,long session,String executor,String snapshot){}
  Fixture fixture(String status) {
    String email=id()+"@example.invalid",executor=id(),snapshot=id(),session=id();
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES('hourly fixture',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
    long owner=db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
    db.update("INSERT INTO extension_installations(id,proof_hash,client_version,last_seen_at) VALUES(?,REPEAT('a',64),'synthetic',UTC_TIMESTAMP(3))",executor);
    db.update("INSERT INTO policy_snapshots(id,user_id,executor_id,format_version,payload,source_version,created_at) VALUES(?,?,?,'1.1',JSON_OBJECT(),1,UTC_TIMESTAMP(3))",snapshot,owner,executor);
    db.update("INSERT INTO focus_sessions(source_session_id,user_id,executor_id,policy_snapshot_id,source,origin,execution_status,record_status,duration_minutes,active_duration_ms,overrun_ms,desired_revision,version,started_at,ended_at) VALUES(?,?,?,?,'MEMBER','MANUAL','ENDED',?,25,0,0,2,1,'1980-01-01','2026-10-11')",session,owner,executor,snapshot,status);
    return new Fixture(owner,db.queryForObject("SELECT id FROM focus_sessions WHERE source_session_id=?",Long.class,session),executor,snapshot);
  }
  void event(Fixture f,int seq,String at,String version,String host,String key,String type) {
    String event=id();
    db.update("INSERT INTO event_receipts(event_id,owner_user_id,executor_id,resolved_session_id,schema_version,event_type,payload_hash,payload,status,received_at) VALUES(?,?,?,?,?,?,REPEAT('b',64),JSON_OBJECT('payload',JSON_OBJECT('blocked_reasons',JSON_ARRAY('KEYWORD','FEATURE'))),'ACCEPTED',UTC_TIMESTAMP(3))",event,f.owner,f.executor,f.session,version,type);
    db.update("INSERT INTO access_events(event_id,session_id,occurred_at,access_seq,target_kind,target_host,target_key,reason,navigation_id,policy_snapshot_id) VALUES(?,?,?,?,'SITE',?,?,'KEYWORD',?,?)",event,f.session,Timestamp.from(Instant.parse(at)),seq,host,key,id(),f.snapshot);
  }
  long sum(List<Map<String,Object>> rows,String key){return rows.stream().filter(r->r.get(key)!=null).mapToLong(r->((Number)r.get(key)).longValue()).sum();}
  @Test void seoulBoundariesPreserveTotalRepeatsActualHostAndMultipleReasonsCountOnce() {
    var f=fixture("COMPLETE");
    event(f,1,"2026-10-09T14:59:59.999Z","1.2","a.example.org","a.example.org","RECORDED_ACCESS");
    event(f,3,"2026-10-10T14:59:59.999Z","1.2","a.example.org","a.example.org","BLOCKED_FEATURE_ACCESS");
    event(f,2,"2026-10-09T15:00:00Z","1.2","a.example.org","a.example.org","RECORDED_ACCESS");
    event(f,4,"2026-10-10T15:00:00Z","1.2","a.example.org","a.example.org","RECORDED_ACCESS");
    event(f,5,"2026-10-10T00:00:00Z","1.2","b.example.org","b.example.org","RECORDED_ACCESS");
    var rows=records.hourly(f.owner,"2026-10-10","2026-10-10");
    assertThat(rows).hasSize(24);assertThat(sum(rows,"total_access")).isEqualTo(3);
    assertThat(sum(rows,"repeat_access")).isEqualTo(2);assertThat(sum(rows,"blocked_access")).isEqualTo(1);
    assertThat(rows.get(0).get("total_access")).isEqualTo(1L);
    assertThat(rows.get(9).get("repeat_access")).isEqualTo(0L);
    assertThat(rows.get(23).get("total_access")).isEqualTo(1L);
    assertThat(rows).allSatisfy(r->{assertThat(r.get("quality")).isEqualTo("COMPLETE");assertThat(r.get("active_duration_ms")).isNull();});
    assertThat(records.summary(f.owner,"2026-10-10","2026-10-10").get("total_access")).isEqualTo(3L);
  }
  @Test void legacyTargetKeyRepeatSemanticsAndOtherOwnersRemainSeparate() {
    var a=fixture("COMPLETE");var b=fixture("COMPLETE");
    event(a,1,"2026-10-10T00:00:00Z","1.1","a.example.org","SITE:example.org","RECORDED_ACCESS");
    event(a,2,"2026-10-10T01:00:00Z","1.1","b.example.org","SITE:example.org","RECORDED_ACCESS");
    event(b,1,"2026-10-10T00:00:00Z","1.2","a.example.org","a.example.org","RECORDED_ACCESS");
    assertThat(sum(records.hourly(a.owner,"2026-10-10","2026-10-10"),"repeat_access")).isEqualTo(1);
    assertThat(sum(records.hourly(b.owner,"2026-10-10","2026-10-10"),"total_access")).isEqualTo(1);
  }
  @Test void incompleteEmptyBucketsAreUnknownAndNoDataIsExplicit() {
    var empty=fixture("COMPLETE");var partial=fixture("PARTIAL");
    assertThat(records.hourly(empty.owner,"2026-10-10","2026-10-10")).allSatisfy(r->{assertThat(r.get("total_access")).isEqualTo(0L);assertThat(r.get("quality")).isEqualTo("NO_DATA");assertThat(r.get("repeat_ratio")).isNull();});
    event(partial,1,"2026-10-10T00:00:00Z","1.2","a.example.org","a.example.org","RECORDED_ACCESS");
    var rows=records.hourly(partial.owner,"2026-10-10","2026-10-10");
    assertThat(rows.get(0).get("total_access")).isNull();assertThat(rows.get(9).get("total_access")).isEqualTo(1L);
    assertThat(rows).allSatisfy(r->assertThat(r.get("quality")).isEqualTo("PARTIAL"));
  }
  @Test void historicalSeoulDaylightSavingUsesZoneRulesNotFixedNineHours() {
    var f=fixture("COMPLETE");
    event(f,1,"1988-06-01T14:00:00Z","1.1","a.example.org","SITE:a.example.org","RECORDED_ACCESS");
    assertThat(records.hourly(f.owner,"1988-06-02","1988-06-02").get(0).get("total_access")).isEqualTo(1L);
  }
  void window(Fixture f,String start,String end,String execution) {
    db.update("UPDATE focus_sessions SET started_at=?,ended_at=?,execution_status=? WHERE id=?",
        start==null?null:Timestamp.from(Instant.parse(start)),
        end==null?null:Timestamp.from(Instant.parse(end)),execution,f.session);
  }
  void emptyQuality(Fixture f,String expected) {
    var rows=records.hourly(f.owner,"2026-10-10","2026-10-10");
    assertThat(rows).hasSize(24).allSatisfy(r->{
      assertThat(r.get("quality")).isEqualTo(expected);
      assertThat(r.get("total_access")).isEqualTo("PARTIAL".equals(expected)?null:0L);
      assertThat(r.get("repeat_access")).isEqualTo("PARTIAL".equals(expected)?null:0L);
      assertThat(r.get("blocked_access")).isEqualTo("PARTIAL".equals(expected)?null:0L);
    });
    var summary=records.summary(f.owner,"2026-10-10","2026-10-10");
    assertThat(summary.get("quality")).isEqualTo(expected);
    assertThat(summary.get("total_access")).isEqualTo("PARTIAL".equals(expected)?null:0L);
  }
  @Test void partialSessionEndBeforeOrAtLowerBoundaryDoesNotOverlapButOneMillisecondAfterDoes() {
    var f=fixture("PARTIAL");
    window(f,"2026-10-09T14:00:00Z","2026-10-09T14:59:59.999Z","ENDED");
    emptyQuality(f,"NO_DATA");
    window(f,"2026-10-09T14:00:00Z","2026-10-09T15:00:00Z","ENDED");
    emptyQuality(f,"NO_DATA");
    window(f,"2026-10-09T14:00:00Z","2026-10-09T15:00:00.001Z","ENDED");
    emptyQuality(f,"PARTIAL");
  }
  @Test void partialSessionStartingAtUpperBoundaryDoesNotOverlapButInsideDoes() {
    var f=fixture("PARTIAL");
    window(f,"2026-10-10T15:00:00Z","2026-10-10T16:00:00Z","ENDED");
    emptyQuality(f,"NO_DATA");
    window(f,"2026-10-10T14:59:59.999Z","2026-10-10T16:00:00Z","ENDED");
    emptyQuality(f,"PARTIAL");
    window(f,"2026-10-10T00:00:00Z","2026-10-10T01:00:00Z","ENDED");
    emptyQuality(f,"PARTIAL");
  }
  @Test void openAndPendingSessionsRetainUnknownDataWithoutTreatingFutureSessionsAsOverlapping() {
    for(String status:List.of("PARTIAL","PENDING","REVIEW_REQUIRED")) {
      var f=fixture(status);
      window(f,"2026-10-10T00:00:00Z",null,"RUNNING");
      emptyQuality(f,"PARTIAL");
      window(f,null,null,"STARTING");
      emptyQuality(f,"PARTIAL");
      window(f,"2026-10-10T15:00:00Z",null,"STARTING");
      emptyQuality(f,"NO_DATA");
    }
  }
  @Test void completedAndOtherOwnersPartialSessionsDoNotPoisonEmptyDay() {
    var complete=fixture("COMPLETE");var other=fixture("PARTIAL");
    window(complete,"2026-10-10T00:00:00Z","2026-10-10T01:00:00Z","ENDED");
    window(other,"2026-10-10T00:00:00Z",null,"RUNNING");
    emptyQuality(complete,"NO_DATA");
    emptyQuality(other,"PARTIAL");
  }
  @Test void historicalOffsetTransitionWithinTheRangeSplitsHoursCorrectly() {
    var f=fixture("COMPLETE");
    event(f,1,"1988-10-08T15:30:00Z","1.1","a.example.org","SITE:a.example.org","RECORDED_ACCESS");
    event(f,2,"1988-10-08T17:30:00Z","1.1","a.example.org","SITE:a.example.org","RECORDED_ACCESS");
    var rows=records.hourly(f.owner,"1988-10-09","1988-10-09");
    assertThat(rows.get(1).get("total_access")).isEqualTo(1L);
    assertThat(rows.get(2).get("total_access")).isEqualTo(1L);
    assertThat(sum(rows,"total_access")).isEqualTo(2);
  }
  @Test void paginationAndLateArrivalDoNotChangeHourlyTotals() {
    var f=fixture("COMPLETE");
    for(int i=1;i<=250;i++)event(f,i,"2026-10-10T00:00:00Z","1.2","a.example.org","a.example.org","RECORDED_ACCESS");
    var rows=records.hourly(f.owner,"2026-10-10","2026-10-10");
    assertThat(sum(rows,"total_access")).isEqualTo(250);assertThat(sum(rows,"repeat_access")).isEqualTo(249);
    String cursor=null;int total=0;
    do {var page=records.list(f.owner,"2026-10-10","2026-10-10",null,null,null,cursor,20);total+=((List<?>)page.get("items")).size();cursor=(String)page.get("next_cursor");}while(cursor!=null);
    assertThat(total).isEqualTo(250);
  }
}
