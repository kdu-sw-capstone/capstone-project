package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.AuthSupport;
import kr.ac.kdu.focurve.execution.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SessionNotesIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired ExecutionService sessions;
  @Autowired SessionNotes notes;
  private String id(){return UUID.randomUUID().toString();}
  private long owner(){String email=id()+"@example.invalid";db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('Note synthetic test',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);return db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);}
  private String session(long user){String executor=id();db.update("INSERT INTO extension_installations VALUES (?,?,?,'synthetic-note-test',UTC_TIMESTAMP(3))",executor,user,AuthSupport.hash(id()));return sessions.start(user,executor,5,id()).get("session_id").toString();}
  @Test void noteVersionsEmptyClearAndUnicodeLimit(){long user=owner();String sid=session(user);assertThat(notes.get(user,sid)).containsEntry("text","").containsEntry("version",0L);var n=notes.put(user,sid,"\"0\"",Map.of("text","🌲".repeat(2000)));assertThat(n).containsEntry("version",1L);assertThat(notes.get(user,sid).get("text")).isEqualTo("🌲".repeat(2000));assertThatThrownBy(()->notes.put(user,sid,"\"1\"",Map.of("text","가".repeat(2001)))).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(422));assertThat(notes.put(user,sid,"\"1\"",Map.of("text",""))).containsEntry("text","").containsEntry("version",2L);}
  @Test void staleAndMissingVersionDoNotOverwrite(){long user=owner();String sid=session(user);notes.put(user,sid,"\"0\"",Map.of("text","winner"));assertThatThrownBy(()->notes.put(user,sid,"\"0\"",Map.of("text","loser"))).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(412));assertThatThrownBy(()->notes.put(user,sid,null,Map.of("text","loser"))).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(428));assertThat(notes.get(user,sid)).containsEntry("text","winner");}
  @Test void foreignSessionCannotReadOrWriteNotes(){long user=owner(),other=owner();String sid=session(user);notes.put(user,sid,"\"0\"",Map.of("text","private test note"));assertThatThrownBy(()->notes.get(other,sid)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(404));assertThatThrownBy(()->notes.put(other,sid,"\"1\"",Map.of("text","bad"))).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(404));assertThat(notes.get(user,sid)).containsEntry("text","private test note");}
}
