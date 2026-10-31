package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.*;

class AmvpRuntimeBridgeConfigurationTest {
 ApplicationContextRunner runner(){return new ApplicationContextRunner().withUserConfiguration(AmvpRuntimeBridgeConfiguration.class).withBean(MemberAuth.class,()->new AmvpRuntimeBridgeApiTest().auth(true)).withPropertyValues("spring.profiles.active=member-runtime");}
 @Test void flagAndProducerAreBothRequired(){
  runner().run(context->assertThat(context).doesNotHaveBean(AdditionalConfigStore.Admission.class));
  runner().withPropertyValues("focurve.additional.runtime-bridge.enabled=true").run(context->assertThat(context).doesNotHaveBean(AdditionalConfigStore.Admission.class));
 }
 @Test void verifiedProducerCanConnectExistingConfigStoreWithoutEditingIt(){
  runner().withPropertyValues("focurve.additional.runtime-bridge.enabled=true").withBean(AmvpBridgeSupport.CapabilitySource.class,()->new AmvpBridgeSupport.CapabilitySource(){
   public ObjectNode verifiedSelection(MemberAuth.Identity principal,AmvpBridgeSupport.Binding binding,String stream){throw new AssertionError("No synthetic selection may be queried at startup");}
   public void verifyContentProfiles(AmvpBridgeSupport.Binding binding,JsonNode content,ObjectNode selection){throw new AssertionError("No effect at startup");}
  }).run(context->assertThat(context).hasSingleBean(AdditionalConfigStore.Admission.class));
 }
}
