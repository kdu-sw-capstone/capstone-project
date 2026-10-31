package kr.ac.kdu.focurve;

import java.net.*;
import java.net.http.*;
import java.time.Duration;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.servlet.context.AnnotationConfigServletWebServerApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

/** Test-only real TCP transport for the production controllers, never a product bootstrap.
 * The caller supplies SYNTHETIC capabilities/effects; OAuth, mail and Native are absent.
 */
final class AmvpLoopbackHttp implements AutoCloseable {
 @Configuration(proxyBeanMethods=false) @EnableWebMvc static class Mvc {}
 private final AnnotationConfigServletWebServerApplicationContext context;
 private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
 private final URI origin;
 AmvpLoopbackHttp(MemberAuth auth, org.springframework.transaction.PlatformTransactionManager manager,
   AdditionalConfigStore.Admission admission, AmvpBridgeSupport.CapabilitySource capabilities,
   AmvpReportReceiver.EvidenceVerifier effects, AmvpUsageReceiver.ClockProof clock) throws Exception {
  context=new AnnotationConfigServletWebServerApplicationContext();
  try {
   context.getEnvironment().setActiveProfiles("local-integration");
   context.register(Mvc.class);
   context.registerBean("dispatcherServletRegistration",org.springframework.boot.web.servlet.ServletRegistrationBean.class,
    ()->new org.springframework.boot.web.servlet.ServletRegistrationBean<>(new org.springframework.web.servlet.DispatcherServlet(context),"/"));
   context.registerBean("webServerFactory",TomcatServletWebServerFactory.class,()->{
    var factory=new TomcatServletWebServerFactory(0);
    factory.setAddress(InetAddress.getLoopbackAddress());return factory;
   });
   context.registerBean("admission",AdditionalConfigStore.Admission.class,()->admission);
   context.registerBean("capabilities",AmvpBridgeSupport.CapabilitySource.class,()->capabilities);
   context.registerBean("effects",AmvpReportReceiver.EvidenceVerifier.class,()->effects);
   context.registerBean("clock",AmvpUsageReceiver.ClockProof.class,()->clock);
   var beans=context.getDefaultListableBeanFactory();
   context.registerBean(AdditionalConfigApi.class,()->new AdditionalConfigApi(auth,manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class)));
   context.registerBean(AmvpWebDeletionApi.class,()->new AmvpWebDeletionApi(auth,manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class)));
   context.registerBean(AmvpDailyUsageApi.class,()->new AmvpDailyUsageApi(auth,manager,beans.getBeanProvider(AdditionalConfigStore.Admission.class)));
   context.registerBean(AmvpReportApi.class,()->new AmvpReportApi(auth,manager,beans.getBeanProvider(AmvpBridgeSupport.CapabilitySource.class),beans.getBeanProvider(AmvpReportReceiver.EvidenceVerifier.class)));
   context.registerBean(AmvpRuntimeBridgeApi.class,()->new AmvpRuntimeBridgeApi(auth,manager,beans.getBeanProvider(AmvpBridgeSupport.CapabilitySource.class),beans.getBeanProvider(AmvpUsageReceiver.ClockProof.class),beans.getBeanProvider(AmvpFocusAttachments.FrozenFocusProof.class)));
   context.refresh();
   origin=new URI("http",null,InetAddress.getLoopbackAddress().getHostAddress(),context.getWebServer().getPort(),null,null,null);
  } catch(Exception failure){context.close();client.close();throw failure;}
 }
 HttpResponse<String> send(String method,String path,String token,String body,String...headers)throws Exception{
  var request=HttpRequest.newBuilder(origin.resolve(path)).timeout(Duration.ofSeconds(10));
  if(token!=null)request.header("Authorization","Bearer "+token);
  if(body!=null)request.header("Content-Type","application/json");
  for(int i=0;i<headers.length;i+=2)request.header(headers[i],headers[i+1]);
  return client.send(request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body)).build(),HttpResponse.BodyHandlers.ofString());
 }
 @Override public void close(){try{client.close();}finally{context.close();}}
}
