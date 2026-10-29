package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;

/** Exercises the dashboard projection with synthetic owned events; no HTTP/DB/browser. */
class DashboardEventOrderingTest {
 final ObjectMapper json=new ObjectMapper();
 final MemberAuth auth=new MemberAuth(new JdbcTemplate(),json,"https://localhost:29511",
   Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://"+"a".repeat(32)+"/popup/popup.html") {
  @Override Map<String,Object> one(String sql,Object...args){return null;}
 };
 ObjectNode event(String id,String at,long sequence){return auth.obj("event_id",id,"occurred_at",at,"access_seq",sequence);}
 List<String> recent(List<ObjectNode> rows){
  var read=new MemberReadModel(auth,null){
   @Override ObjectNode sessions(MemberAuth.Identity actor,Map<String,String[]> query){return auth.obj("items",List.of());}
   @Override List<ObjectNode> accesses(MemberAuth.Identity actor){return new ArrayList<>(rows);}
   @Override ObjectNode metrics(MemberAuth.Identity actor,Map<String,String[]> query){return auth.obj("quality","NO_DATA");}
  };
  List<String> ids=new ArrayList<>();
  read.dashboard(new MemberAuth.Identity(1,null)).path("recent_access").forEach(row->ids.add(row.path("event_id").asText()));
  return ids;
 }
 @Test void latestFiveUseActualInstantsAcrossFractionPrecision(){
  assertThat(recent(List.of(
   event("whole","2026-10-29T10:00:00Z",1),
   event("millis","2026-10-29T10:00:00.001Z",2),
   event("tenth","2026-10-29T10:00:00.1Z",3),
   event("ninth","2026-10-29T10:00:00.9Z",4),
   event("older","2026-10-29T09:59:59Z",5),
   event("next","2026-10-29T10:01:00Z",6))))
   .containsExactly("next","ninth","tenth","millis","whole");
 }
 @Test void equalInstantsUseSequenceThenIdInsteadOfTimestampSpelling(){
  assertThat(recent(List.of(
   event("a","2026-10-29T10:00:00Z",1),
   event("b","2026-10-29T10:00:00.000Z",2),
   event("c","2026-10-29T10:00:00.000000000Z",2))))
   .containsExactly("c","b","a");
 }
}
