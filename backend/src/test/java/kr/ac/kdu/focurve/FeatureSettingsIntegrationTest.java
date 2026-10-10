package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import kr.ac.kdu.focurve.sites.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FeatureSettingsIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired SiteService sites;
  @Autowired ExecutionService execution;
  @Autowired com.fasterxml.jackson.databind.ObjectMapper mapper;
  @MockitoBean MailDelivery mail;
  String key(){return UUID.randomUUID().toString();}
  long user(){
    String email=key()+"@example.invalid";
    db.update("INSERT INTO users(display_name,email,email_verified,status,created_at,terms_version,terms_accepted_at) VALUES ('feature synthetic',?,true,'ACTIVE',UTC_TIMESTAMP(3),'dev-v1',UTC_TIMESTAMP(3))",email);
    return db.queryForObject("SELECT id FROM users WHERE email=?",Long.class,email);
  }
  SiteInput input(String host, List<SiteInput.Feature> features){return new SiteInput(host,"feature test",true,"GENERAL","ALLOW",features);}
  List<SiteInput.Feature> youtube(boolean enabled){return List.of("YOUTUBE_SHORTS","YOUTUBE_RECOMMENDATIONS","YOUTUBE_COMMENTS","YOUTUBE_AUTOPLAY").stream().map(c->new SiteInput.Feature(c,enabled)).toList();}
  @Test void allSixCodesRoundTripFalseAndTrueWithoutChangingApiOrDb() throws Exception {
    long owner=user();
    for(String host:List.of("youtube.com","instagram.com")){
      var features=host.equals("youtube.com")?youtube(false):List.of(new SiteInput.Feature("INSTAGRAM_REELS",false),new SiteInput.Feature("INSTAGRAM_RECOMMENDATIONS",true));
      String request=key();var site=sites.create(owner,request,input(host,features));long id=Long.parseLong(site.get("site_id").toString());
      assertThat(mapper.readTree(mapper.writeValueAsString(sites.create(owner,request,input(host,features)))))
          .isEqualTo(mapper.readTree(mapper.writeValueAsString(site)));
      assertThat(sites.get(owner,id).get("feature_policies")).isEqualTo(site.get("feature_policies"));
      assertThat(db.queryForObject("SELECT COUNT(*) FROM site_feature_policies WHERE site_id=?",Integer.class,id)).isEqualTo(features.size());
      assertThatThrownBy(()->sites.get(user(),id)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(404));
      var patch=Map.<String,Object>of("feature_policies",host.equals("youtube.com")?youtube(true):features);
      var updated=sites.patch(owner,id,key(),"\"1\"",patch);
      assertThat(updated.get("version")).isEqualTo(2L);
      assertThatThrownBy(()->sites.patch(owner,id,key(),"\"1\"",patch)).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.status).isEqualTo(412));
    }
  }
  @Test void invalidCodesTypesDuplicatesAndHostBoundariesDoNotWrite(){
    long owner=user();
    for(var bad:List.of(new SiteInput.Feature("UNKNOWN",true),new SiteInput.Feature("YOUTUBE_COMMENTS",null),new SiteInput.Feature("INSTAGRAM_REELS",true))){
      assertThatThrownBy(()->sites.create(owner,key(),input("youtube.com",List.of(bad)))).isInstanceOf(ApiFailure.class);
    }
    assertThatThrownBy(()->sites.create(owner,key(),input("youtube.com",List.of(new SiteInput.Feature("YOUTUBE_COMMENTS",true),new SiteInput.Feature("YOUTUBE_COMMENTS",false))))).isInstanceOf(ApiFailure.class);
    assertThatThrownBy(()->sites.create(owner,key(),input("notyoutube.com",youtube(true)))).isInstanceOf(ApiFailure.class);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM sites WHERE user_id=?",Integer.class,owner)).isZero();
  }
  @Test void failedPatchPreservesAllFeaturesAndVersion(){
    long owner=user();var before=sites.create(owner,key(),input("youtube.com",youtube(true)));long id=Long.parseLong(before.get("site_id").toString());
    assertThatThrownBy(()->sites.patch(owner,id,key(),"\"1\"",Map.of("feature_policies",List.of(Map.of("feature_code","YOUTUBE_COMMENTS","enabled",false),Map.of("feature_code","UNKNOWN","enabled",true))))).isInstanceOf(ApiFailure.class);
    assertThat(sites.get(owner,id)).isEqualTo(before);
  }
  @Test void enabledAdditionalFeatureCannotIssueEvenWithTestGateEnabledAndActiveSnapshotStaysFrozen() throws Exception {
    long owner=user();String executor=key();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'synthetic-test',UTC_TIMESTAMP(3))",executor,owner,AuthSupport.hash(key()));
    var site=sites.create(owner,key(),input("youtube.com",youtube(false)));long id=Long.parseLong(site.get("site_id").toString());
    var started=execution.start(owner,executor,25,key());
    String frozen=db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,started.get("policy_snapshot_id"));
    assertThat(mapper.readTree(frozen).get("sites").get(0).get("feature_policies").size()).isEqualTo(1);
    assertThat(db.queryForObject("SELECT COUNT(*) FROM site_feature_policies WHERE site_id=?",Integer.class,id)).isEqualTo(4);
    sites.patch(owner,id,key(),"\"1\"",Map.of("feature_policies",youtube(true)));
    assertThat(db.queryForObject("SELECT payload FROM policy_snapshots WHERE id=?",String.class,started.get("policy_snapshot_id"))).isEqualTo(frozen);
    // Separate owner exercises pre-issuance rejection without an active-session conflict.
    long other=user();String otherExecutor=key();
    db.update("INSERT INTO extension_installations VALUES (?,?,?,'synthetic-test',UTC_TIMESTAMP(3))",otherExecutor,other,AuthSupport.hash(key()));
    sites.create(other,key(),input("youtube.com",youtube(true)));
    assertThatThrownBy(()->execution.start(other,otherExecutor,25,key())).isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.code).isEqualTo("SNAPSHOT_COMPATIBILITY_REQUIRED"));
    assertThat(db.queryForObject("SELECT COUNT(*) FROM policy_snapshots WHERE user_id=?",Integer.class,other)).isZero();
    assertThat(db.queryForObject("SELECT COUNT(*) FROM focus_sessions WHERE user_id=?",Integer.class,other)).isZero();
  }
}
