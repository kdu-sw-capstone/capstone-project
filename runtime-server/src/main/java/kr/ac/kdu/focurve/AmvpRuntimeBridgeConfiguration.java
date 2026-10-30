package kr.ac.kdu.focurve;

import org.springframework.boot.autoconfigure.condition.*;
import org.springframework.context.annotation.*;

/** Deliberately has no default CapabilitySource bean or embedded fixture issuer. */
@Configuration(proxyBeanMethods=false) @Profile("member-runtime | local-integration")
@ConditionalOnProperty(name="focurve.additional.runtime-bridge.enabled",havingValue="true")
@ConditionalOnBean(AmvpBridgeSupport.CapabilitySource.class)
class AmvpRuntimeBridgeConfiguration {
 @Bean AdditionalConfigStore.Admission amvpCanonicalPublisher(MemberAuth auth,AmvpBridgeSupport.CapabilitySource source){return new AmvpScheduleBridge(auth,new AmvpPolicyPublisher(auth,source),null,java.time.Clock.systemUTC());}
}
