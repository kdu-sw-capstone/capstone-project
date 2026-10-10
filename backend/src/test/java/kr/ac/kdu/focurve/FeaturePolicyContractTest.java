package kr.ac.kdu.focurve;
import static org.assertj.core.api.Assertions.*;
import java.util.*;
import kr.ac.kdu.focurve.execution.SnapshotValidation;
import kr.ac.kdu.focurve.api.ApiFailure;
import org.junit.jupiter.api.Test;

class FeaturePolicyContractTest {
  @SuppressWarnings("unchecked") Map<String,Object> snapshot(String version, String host, List<?> features){
    var snapshot=new PolicyContractTest().snapshot(version,"ALLOW");
    var site=(Map<String,Object>)((List<?>)snapshot.get("sites")).getFirst();
    site.put("canonical_host",host);site.put("feature_policies",features);return snapshot;
  }
  @Test void bothSnapshotFormatsValidateAllSixStoredCodes(){
    for(String version:List.of("1.1","1.2"))
      for(String code:List.of("YOUTUBE_SHORTS","YOUTUBE_RECOMMENDATIONS","YOUTUBE_COMMENTS","YOUTUBE_AUTOPLAY","INSTAGRAM_REELS","INSTAGRAM_RECOMMENDATIONS"))
        SnapshotValidation.validate(snapshot(version,code.startsWith("YOUTUBE")?"youtube.com":"instagram.com",List.of(Map.of("feature_code",code,"enabled",false))));
  }
  @Test void duplicateCrossServiceAndLookalikeHostsInvalidateWholeSnapshot(){
    for(String version:List.of("1.1","1.2")){
      var f=Map.of("feature_code","YOUTUBE_COMMENTS","enabled",true);
      for(String host:List.of("notyoutube.com","youtube.com.evil.org","instagram.com"))
        assertThatThrownBy(()->SnapshotValidation.validate(snapshot(version,host,List.of(f)))).isInstanceOf(ApiFailure.class);
      assertThatThrownBy(()->SnapshotValidation.validate(snapshot(version,"youtube.com",List.of(f,f)))).isInstanceOf(ApiFailure.class);
    }
  }
}
