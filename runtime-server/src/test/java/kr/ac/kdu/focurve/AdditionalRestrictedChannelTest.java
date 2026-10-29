package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.*;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Authenticated synthetic principal, no SQL: restricted service must not reach the capability adapter. */
class AdditionalRestrictedChannelTest {
 MemberAuth authentication(){return new MemberAuth(new JdbcTemplate(),new ObjectMapper(),"https://localhost:33339",Base64.getEncoder().encodeToString(new byte[32]),""){
  @Override Identity identity(HttpServletRequest request,boolean mutate){return new Identity(1,null);}
 };}
 AbstractPlatformTransactionManager transactions(){return new AbstractPlatformTransactionManager(){
  protected Object doGetTransaction(){return new Object();}
  protected void doBegin(Object tx,TransactionDefinition definition){}
  protected void doCommit(DefaultTransactionStatus status){}
  protected void doRollback(DefaultTransactionStatus status){}
 };}
 @Test void restrictedReauthenticationServiceCannotUseTheConfigApi()throws Exception {
  var auth=authentication();auth.recoveryGrant="synthetic-test-only";var beans=new StaticListableBeanFactory();
  var http=MockMvcBuilders.standaloneSetup(new AdditionalConfigApi(auth,transactions(),beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  http.perform(get("/api/v1/amvp/configs")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("UNSUPPORTED_CONTRACT"));
 }
 @Test void preservedEndServiceCannotOpenTheNewStatisticsChannel()throws Exception {
  var auth=authentication();auth.preservedEndGrant="synthetic-test-only";var beans=new StaticListableBeanFactory();
  var http=MockMvcBuilders.standaloneSetup(new AdditionalStatisticsApi(auth,transactions(),beans.getBeanProvider(AdditionalConfigStore.Admission.class))).build();
  http.perform(get("/api/v1/amvp/statistics/browser-usage")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("UNSUPPORTED_CONTRACT"));
 }
}
