package kr.ac.kdu.focurve;
import jakarta.servlet.*;import jakarta.servlet.http.*;import org.springframework.stereotype.Component;import org.springframework.context.annotation.Profile;import org.springframework.web.filter.OncePerRequestFilter;import org.springframework.core.Ordered;import org.springframework.core.annotation.Order;import java.io.IOException;import java.time.Instant;import java.util.UUID;
@Component @Profile("member-runtime | local-integration")
@Order(Ordered.HIGHEST_PRECEDENCE)
class MemberHttpAudit extends OncePerRequestFilter {
 static void rejected(HttpServletRequest request,String stage,String code){request.setAttribute("focurve.audit.stage",stage);request.setAttribute("focurve.audit.code",code!=null&&code.matches("[A-Z][A-Z0-9_]{0,79}")?code:"UNCLASSIFIED");}
 protected void doFilterInternal(HttpServletRequest r,HttpServletResponse s,FilterChain chain)throws ServletException,IOException{
  if(!r.getRequestURI().startsWith("/api/v1/")){chain.doFilter(r,s);return;}
  long start=System.nanoTime();String at=Instant.now().toString(),id=UUID.randomUUID().toString();s.setHeader("X-FOCURVE-Request-ID",id);
  try{chain.doFilter(r,s);}finally{
   String path=r.getRequestURI().replaceAll("/[a-fA-F0-9-]{36}(?=/|$)","/{id}").replaceAll("/[0-9]+(?=/|$)","/{id}").replaceAll("[^A-Za-z0-9_/{}/.-]","_");if(path.length()>240)path=path.substring(0,240);
   Object stage=r.getAttribute("focurve.audit.stage"),code=r.getAttribute("focurve.audit.code");
   System.out.println("MEMBER_HTTP at="+at+" request_id="+id+" method="+r.getMethod()+" path="+path+" status="+s.getStatus()+" stage="+(stage==null?"FILTER_CHAIN":stage)+" code="+(code==null?"UNRECORDED":code)+" elapsed_ms="+(System.nanoTime()-start)/1000000);
  }
 }
}
