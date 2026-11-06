package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.*;
import java.nio.file.*;import java.time.*;import java.security.*;import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
/** Owner-provisioned, hash-pinned, short-lived reauthentication authority.
 * This never changes HOLD, creates focus readiness or authorizes START/END. */
final class AuthRecoveryScope {
 record Grant(String installation,String operation,String executor,String owner,String origin,String callback,Instant end){}
 static Grant read(String file,String expected,String marker,Instant now){
  try{
   check(file!=null&&!file.isBlank()&&expected!=null&&expected.matches("[a-f0-9]{64}")&&marker!=null,409,"RECOVERY_SCOPE_REQUIRED");
   Path p=Path.of(file).toAbsolutePath().normalize(),m=Path.of(marker).toAbsolutePath().normalize();
   check(p.getFileName().toString().equals("auth-recovery-grant.json")&&p.getParent().equals(m.getParent())&&!Files.isSymbolicLink(p)&&!Files.isSymbolicLink(m)&&Files.isRegularFile(m)&&Files.isRegularFile(p)&&Files.size(p)<=4096,409,"RECOVERY_SCOPE_INVALID");
   byte[] raw=Files.readAllBytes(p);check(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw)).equals(expected),409,"RECOVERY_SCOPE_CHANGED");
   JsonNode n=new ObjectMapper().readTree(raw);Set<String> keys=new HashSet<>();n.fieldNames().forEachRemaining(keys::add);
   check(keys.equals(Set.of("contract","installation_id","operation_id","executor_id","owner_user_id","origin","callback","not_before","not_after"))&&n.path("contract").asText().equals("FOCURVE_MEMBER_REAUTH_SCOPE_1"),409,"RECOVERY_SCOPE_INVALID");
   String install=n.path("installation_id").asText(),ex=n.path("executor_id").asText(),owner=n.path("owner_user_id").asText(),op=n.path("operation_id").asText(),origin=n.path("origin").asText(),callback=n.path("callback").asText();
   check(install.matches("[a-f0-9]{32}")&&p.getParent().getFileName().toString().equals(install)&&op.matches("[a-f0-9]{32}")&&ex.matches("[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}")&&owner.matches("[1-9][0-9]{0,17}")&&origin.matches("https://localhost:[0-9]{1,5}")&&callback.matches("chrome-extension://[a-p]{32}/popup/popup\\.html"),409,"RECOVERY_SCOPE_INVALID");
   Instant begin=Instant.parse(n.path("not_before").asText()),end=Instant.parse(n.path("not_after").asText());
   check(!now.isBefore(begin)&&now.isBefore(end)&&Duration.between(begin,end).toSeconds()>0&&Duration.between(begin,end).toSeconds()<=1200,409,"RECOVERY_SCOPE_EXPIRED");
   return new Grant(install,op,ex,owner,origin,callback,end);
  }catch(Failure f){throw f;}catch(Exception e){throw new Failure(409,"RECOVERY_SCOPE_INVALID");}
 }
 static boolean route(String method,String path){return method.equals("POST")&&(path.equals("/api/v1/auth/login")||path.equals("/api/v1/extension-link-requests")||path.equals("/api/v1/extension-tokens")||path.matches("/api/v1/extension-link-requests/[a-fA-F0-9-]{36}/(?:evidence|claim|approval)"));}
}
