package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.MailDelivery;
import kr.ac.kdu.focurve.execution.SnapshotValidation;
import kr.ac.kdu.focurve.records.RecordQueries;
import kr.ac.kdu.focurve.sites.*;
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
class StageOneBoundaryFixIntegrationTest {
  @Autowired ObjectMapper mapper;
  @Autowired JdbcTemplate db;
  @Autowired SiteService sites;
  @MockitoBean MailDelivery mail;

  String key() { return UUID.randomUUID().toString(); }
  long user() {
    String email=key()+"@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('boundary fixture',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
    return db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
  }
  SiteInput input(String name) { return new SiteInput("youtube.com",name,true,"GENERAL","ALLOW",List.of()); }
  @SuppressWarnings("unchecked") Map<String,Object> snapshot(String format,String name) {
    var value=new PolicyContractTest().snapshot(format,"ALLOW");
    ((Map<String,Object>)((List<?>)value.get("sites")).getFirst()).put("display_name",name);
    return value;
  }
  @Test void unicodeScalarBoundariesAgreeForWritesAndBothSnapshots() {
    for (String name:List.of("a".repeat(100),"가".repeat(100),"🌲".repeat(50),"🌲".repeat(51),"🌲".repeat(100),"가🌲".repeat(50))) {
      input(name).validate();
      for (String format:List.of("1.1","1.2")) SnapshotValidation.validate(snapshot(format,name));
    }
  }
  @Test void oversizedBlankAndMalformedUnicodeNeverBecomeValidPolicies() {
    for (String name:Arrays.asList(null,""," ","a".repeat(101),"🌲".repeat(101),"\uD800","x\uDC00","\uD800x")) {
      assertThatThrownBy(()->input(name).validate()).isInstanceOf(ApiFailure.class);
      for (String format:List.of("1.1","1.2"))
        assertThatThrownBy(()->SnapshotValidation.validate(snapshot(format,name))).isInstanceOf(ApiFailure.class);
    }
  }
  @Test void unicodeNamesRoundTripWithoutTruncationOrVersionReset() {
    long owner=user();String name="🌲".repeat(100);
    var saved=sites.create(owner,key(),input(name));
    long id=Long.parseLong(saved.get("site_id").toString());
    assertThat(sites.get(owner,id).get("display_name")).isEqualTo(name);
    assertThat(db.queryForObject("SELECT CHAR_LENGTH(display_name) FROM sites WHERE id=?",Integer.class,id)).isEqualTo(100);
    for (String format:List.of("1.1","1.2")) SnapshotValidation.validate(snapshot(format,name));
  }
  @Test void explicitTrueAndFalsePersistDistinctly() {
    for (Boolean enabled:List.of(true,false)) {
      long owner=user();
      var saved=sites.create(owner,key(),new SiteInput("youtube.com","Shorts",true,"GENERAL","ALLOW",List.of(new SiteInput.Feature("YOUTUBE_SHORTS",enabled))));
      assertThat(db.queryForObject("SELECT enabled FROM site_feature_policies WHERE site_id=?",Boolean.class,saved.get("site_id"))).isEqualTo(enabled);
    }
  }
  @Test void missingAndNullEnabledAreBothRejectedWithoutAnyRows() throws Exception {
    long owner=user();
    for(String field:List.of("",",\"enabled\":null")) {
      String raw="{\"url\":\"youtube.com\",\"display_name\":\"invalid\",\"purpose\":\"GENERAL\",\"access_policy\":\"ALLOW\",\"feature_policies\":[{\"feature_code\":\"YOUTUBE_SHORTS\""+field+"}]}";
      SiteInput parsed=mapper.readValue(raw,SiteInput.class);
      assertThatThrownBy(()->sites.create(owner,key(),parsed)).isInstanceOf(ApiFailure.class);
      assertThat(db.queryForObject("SELECT COUNT(*) FROM sites WHERE user_id=?",Integer.class,owner)).isZero();
      assertThat(db.queryForObject("SELECT COUNT(*) FROM idempotency_keys WHERE owner_key=?",Integer.class,"MEMBER:"+owner)).isZero();
    }
  }
  @Test void nonBooleanEnabledTypesCannotDeserialize() {
    for(String value:List.of("\"true\"","0","1","1.0","{}","[]")) {
      String raw="{\"url\":\"youtube.com\",\"display_name\":\"invalid\",\"purpose\":\"GENERAL\",\"access_policy\":\"ALLOW\",\"feature_policies\":[{\"feature_code\":\"YOUTUBE_SHORTS\",\"enabled\":"+value+"}]}";
      assertThatThrownBy(()->mapper.readValue(raw,SiteInput.class)).isInstanceOf(com.fasterxml.jackson.core.JsonProcessingException.class);
    }
  }
  @Test void publicDateBoundariesKeepKoreanInclusiveDaysAndLeapDays() {
    for(String value:List.of("0001-01-01","1000-01-01","2024-02-29","9999-12-31")) {
      var range=RecordQueries.range(value,value);
      assertThat(Duration.between(range.from(),range.to()).toDays()).isEqualTo(1);
    }
    assertThat(RecordQueries.range("2026-10-10","2026-10-10").from()).isEqualTo(Instant.parse("2026-10-09T15:00:00Z"));
    assertThat(RecordQueries.range("2026-10-10","2026-10-10").to()).isEqualTo(Instant.parse("2026-10-10T15:00:00Z"));
    assertThat(RecordQueries.range("2024-01-01","2024-12-31")).isNotNull();
  }
  @Test void extendedYearsAndInvalidDatesAreInputFailuresNotServerExceptions() {
    for(String value:List.of("+999999999-12-31","-999999999-01-01","+10000-01-01","0000-01-01","2023-02-29","2026-13-01","2026-10-32","","2026-1-01"))
      assertThatThrownBy(()->RecordQueries.range(value,value)).isInstanceOfSatisfying(ApiFailure.class,e->{assertThat(e.status).isEqualTo(422);assertThat(e.code).isEqualTo("INVALID_DATE_RANGE");});
    assertThatThrownBy(()->RecordQueries.range("2024-01-01","2025-01-01")).isInstanceOf(ApiFailure.class);
    assertThatThrownBy(()->RecordQueries.range("2026-10-10","2026-10-09")).isInstanceOf(ApiFailure.class);
  }
}
