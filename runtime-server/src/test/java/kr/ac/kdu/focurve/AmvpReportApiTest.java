package kr.ac.kdu.focurve;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AmvpReportApiTest {
 MockMvc http(MemberAuth auth){var beans=new StaticListableBeanFactory();return MockMvcBuilders.standaloneSetup(new AmvpReportApi(auth,new AdditionalRestrictedChannelTest().transactions(),beans.getBeanProvider(AmvpBridgeSupport.CapabilitySource.class),beans.getBeanProvider(AmvpReportReceiver.EvidenceVerifier.class))).build();}
 @Test void verifiedProducerIsRequired()throws Exception{http(new AmvpRuntimeBridgeApiTest().auth(true)).perform(post("/api/v1/amvp/reports/batch").contentType("application/json").content("{}")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("CAPABILITY_NOT_VERIFIED"));}
 @Test void webCannotSendCoreReports()throws Exception{http(new AmvpRuntimeBridgeApiTest().auth(false)).perform(post("/api/v1/amvp/reports/batch").contentType("application/json").content("{}")).andExpect(status().isForbidden());}
 @Test void restrictedServicesCannotAcceptReports()throws Exception{for(boolean recovery:new boolean[]{true,false}){var auth=new AmvpRuntimeBridgeApiTest().auth(true);if(recovery)auth.recoveryGrant="synthetic";else auth.preservedEndGrant="synthetic";http(auth).perform(post("/api/v1/amvp/reports/batch").contentType("application/json").content("{}")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("UNSUPPORTED_CONTRACT"));}}
 @Test void duplicateJsonAndUnexpectedQueryAreRejected()throws Exception{var http=http(new AmvpRuntimeBridgeApiTest().auth(true));http.perform(post("/api/v1/amvp/reports/batch").contentType("application/json").content("{\"batch_id\":1,\"batch_id\":2}")).andExpect(status().isBadRequest());http.perform(post("/api/v1/amvp/reports/batch").param("owner","fake").contentType("application/json").content("{}")).andExpect(status().isBadRequest());}
}
