package kr.ac.kdu.focurve;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.jdbc.core.JdbcTemplate;
import kr.ac.kdu.focurve.execution.ExecutionService;
import kr.ac.kdu.focurve.api.ApiFailure;
@ActiveProfiles("test")
@SpringBootTest(properties="SNAPSHOT_1_2_ENABLED=false")
class SnapshotIssuanceGateTest {
 @Autowired ExecutionService execution;@Autowired JdbcTemplate db;
 @Test void unverifiedCompatibilityCreatesNoSnapshotCommandOrSession() {
  var before=counts();
  assertThatThrownBy(()->execution.start(0,UUID.randomUUID().toString(),25,UUID.randomUUID().toString()))
    .isInstanceOfSatisfying(ApiFailure.class,e->assertThat(e.code).isEqualTo("SNAPSHOT_COMPATIBILITY_REQUIRED"));
  assertThat(counts()).isEqualTo(before);
 }
 List<Integer> counts(){return List.of(db.queryForObject("SELECT COUNT(*) FROM policy_snapshots",Integer.class),db.queryForObject("SELECT COUNT(*) FROM focus_sessions",Integer.class),db.queryForObject("SELECT COUNT(*) FROM execution_commands",Integer.class));}
}
