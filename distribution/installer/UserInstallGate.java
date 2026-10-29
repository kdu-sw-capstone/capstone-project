package kr.ac.kdu.focurve;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
/** New installation only: drain requests and deny new mutations during normal stop. */
@Component @Profile("user-install") @Order(Ordered.HIGHEST_PRECEDENCE+5)
public final class UserInstallGate implements Filter {
 private final ReentrantReadWriteLock lock=new ReentrantReadWriteLock(true);
 private final String marker,key,deadline,ready;
 public UserInstallGate(){this(System.getenv("FOCURVE_INSTALLATION_GATE"),System.getenv("FOCURVE_INSTALLATION_GATE_KEY"),System.getenv("FOCURVE_INSTALLATION_DEADLINE"),System.getenv("FOCURVE_INSTALLATION_READY"));}
 UserInstallGate(String marker,String key,String deadline,String ready){this.marker=marker;this.key=key;this.deadline=deadline;this.ready=ready;}
 static final class Body extends HttpServletRequestWrapper {
  private final byte[] bytes;Body(HttpServletRequest req,byte[] bytes){super(req);this.bytes=bytes;}
  public ServletInputStream getInputStream(){ByteArrayInputStream in=new ByteArrayInputStream(bytes);return new ServletInputStream(){public int read(){return in.read();}public boolean isFinished(){return in.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener listener){throw new UnsupportedOperationException("ASYNC_BODY_NOT_SUPPORTED");}};}
  public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}
 }
 static boolean mutation(String method){return !method.equals("GET")&&!method.equals("HEAD")&&!method.equals("OPTIONS");}
 static boolean finishAllowed(String uri){return uri.matches("/api/v1/sessions/[a-fA-F0-9-]{36}/end")||uri.matches("/api/v1/executors/[a-fA-F0-9-]{36}/(?:reports|reconcile)")||uri.equals("/api/v1/events/batch")||uri.equals("/api/v1/events/status")||uri.equals("/actuator/shutdown");}
 private void response(HttpServletResponse res,int status,String body)throws IOException{res.setStatus(status);res.setContentType("application/json;charset=UTF-8");res.getWriter().write(body);}
 public void doFilter(ServletRequest request,ServletResponse response,FilterChain chain)throws IOException,ServletException{
  HttpServletRequest req=(HttpServletRequest)request;HttpServletResponse res=(HttpServletResponse)response;
  if(marker==null||key==null||key.length()<32){response(res,503,"{\"error\":{\"code\":\"INSTALLATION_CONFIGURATION_REQUIRED\"}}");return;}
  if(req.getRequestURI().equals("/api/v1/install/lifecycle-quiesce")){
   String provided=req.getHeader("X-FOCURVE-Installation-Key");
   if(!req.getMethod().equals("POST")||provided==null||!MessageDigest.isEqual(provided.getBytes(StandardCharsets.UTF_8),key.getBytes(StandardCharsets.UTF_8))||!Files.isRegularFile(Path.of(marker))){response(res,403,"{\"error\":{\"code\":\"INSTALLATION_OWNER_REQUIRED\"}}");return;}
   lock.writeLock().lock();try{response(res,200,"{\"quiesced\":true}");}finally{lock.writeLock().unlock();}return;
  }
  if(!mutation(req.getMethod())){chain.doFilter(request,response);return;}
  lock.readLock().lock();try{
   if(Files.exists(Path.of(marker))&&!finishAllowed(req.getRequestURI())){response(res,409,"{\"error\":{\"code\":\"INSTALLATION_STOPPING\",\"retryable\":false}}");return;}
   ServletRequest admitted=request;
   if(req.getMethod().equals("POST")&&req.getRequestURI().equals("/api/v1/sessions")){
    if(ready==null||!Files.isRegularFile(Path.of(ready))){response(res,409,"{\"error\":{\"code\":\"INSTALLATION_NOT_READY\",\"retryable\":false}}");return;}
    byte[] body=req.getInputStream().readNBytes(1048577);if(body.length>1048576){response(res,413,"{\"error\":{\"code\":\"TOO_LARGE\"}}");return;}
    try{
     var value=new ObjectMapper().readTree(body).path("duration_minutes");
     if(!value.isIntegralNumber()||!value.canConvertToInt()||value.intValue()<1||value.intValue()>180||deadline==null||Instant.now().plusSeconds(value.intValue()*60L+600).isAfter(Instant.parse(deadline))){response(res,409,"{\"error\":{\"code\":\"INSTALLATION_START_WINDOW_CLOSED\",\"retryable\":false}}");return;}
    }catch(RuntimeException|IOException e){response(res,422,"{\"error\":{\"code\":\"VALIDATION_FAILED\"}}");return;}
    admitted=new Body(req,body);
   }
   chain.doFilter(admitted,response);
  }finally{lock.readLock().unlock();}
 }
}
