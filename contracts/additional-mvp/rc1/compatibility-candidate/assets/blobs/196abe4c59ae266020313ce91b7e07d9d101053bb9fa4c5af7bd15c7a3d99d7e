package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.*;import com.fasterxml.jackson.databind.node.*;import jakarta.servlet.http.*;
import org.springframework.web.bind.annotation.*;import org.springframework.stereotype.Component;import org.springframework.context.annotation.Profile;import org.springframework.http.*;import org.springframework.transaction.support.TransactionTemplate;import org.springframework.transaction.PlatformTransactionManager;import java.util.*;import java.util.function.Supplier;
import static kr.ac.kdu.focurve.MemberAuth.*;import static kr.ac.kdu.focurve.MemberIntervals.*;
@Profile("member-runtime | local-integration") @RestController
class MemberMvpApi {
 final MemberImports imports;final MemberAuth a;final MemberAccounts accounts;final MemberSites sites;final MemberPolicy policy;final MemberSocial social;final MemberExecution e;final TransactionTemplate tx;
 MemberMvpApi(MemberAuth a,MemberAccounts accounts,MemberSites sites,MemberPolicy policy,MemberSocial social,MemberExecution e,MemberImports imports,PlatformTransactionManager tm){this.imports=imports;this.a=a;this.accounts=accounts;this.sites=sites;this.policy=policy;this.social=social;this.e=e;tx=new TransactionTemplate(tm);}
 record Result(int status,String etag,ObjectNode body){}
 Result idem(HttpServletRequest req,String owner,JsonNode body,Supplier<Result> action){String key=Objects.toString(req.getHeader("Idempotency-Key"),"");uuid(key);String method=req.getMethod(),path=req.getRequestURI();var cached=a.one("SELECT * FROM idempotency_keys WHERE owner_key=? AND method=? AND path=? AND request_key=? FOR UPDATE",owner,method,path,key);if(cached!=null){check(cached.get("body_hash").equals(hash(body.toString())),409,"IDEMPOTENCY_CONFLICT");var r=e.parse(cached.get("response"));return new Result(r.path("status").asInt(),r.hasNonNull("etag")?text(r,"etag"):null,r.hasNonNull("body")?(ObjectNode)r.path("body"):null);}Result r=action.get();a.db.update("INSERT INTO idempotency_keys VALUES(?,?,?,?,?,?,?)",owner,method,path,key,hash(body.toString()),a.obj("status",r.status,"etag",r.etag,"body",r.body).toString(),after(604800));return r;}
 static String etag(ObjectNode body){return "\""+body.path("version").asLong()+"\"";}
 static ObjectNode error(MemberAuth a,String code){return a.obj("error",Map.of("code",code,"message",code,"field_errors",List.of(),"retryable",code.equals("PROVIDER_NOT_CONFIGURED")),"request_id",id());}
 @RequestMapping({"/api/v1/guest-imports","/api/v1/guest-imports/{batch_id}","/api/v1/guest-imports/{batch_id}/items/{source_item_id}","/api/v1/auth/signup","/api/v1/auth/logout","/api/v1/auth/email/verify","/api/v1/auth/email/verification-requests","/api/v1/auth/password/reset-requests","/api/v1/auth/password/reset","/api/v1/auth/reauthenticate","/api/v1/auth/social/{provider}/authorize","/api/v1/auth/social/{provider}/callback","/api/v1/auth/social/signup-info","/api/v1/auth/social/email-requests","/api/v1/auth/social/email/verify","/api/v1/auth/social/complete","/api/v1/auth/identities/link","/api/v1/sites","/api/v1/sites/{site_id}","/api/v1/content-policy","/api/v1/extension-installations/{executor_id}/connection","/api/v1/operations/{operation_id}"})
 ResponseEntity<?> handle(HttpServletRequest req,HttpServletResponse res,@RequestBody(required=false)String raw){try{check(raw==null||raw.getBytes(java.nio.charset.StandardCharsets.UTF_8).length<=1048576,413,"TOO_LARGE");JsonNode b=raw==null||raw.isBlank()?a.obj():a.json.readTree(raw);check(b.isObject(),422,"VALIDATION_FAILED");Result r=tx.execute(t->route(req,res,b));if(r.body!=null&&r.body.has("_http_error"))return ResponseEntity.status(r.body.path("_http_status").asInt()).body(error(a,text(r.body,"_http_error")));ResponseEntity.BodyBuilder builder=ResponseEntity.status(r.status);if(r.etag!=null)builder.eTag(r.etag);if(res.getHeader("Location")!=null)builder.header("Location",res.getHeader("Location"));return builder.body(r.body);}catch(kr.ac.kdu.focurve.api.ApiFailure f){var builder=ResponseEntity.status(f.status);if(f.retryAfterSeconds!=null)builder.header("Retry-After",f.retryAfterSeconds.toString());return builder.body(error(a,f.code));}catch(Failure f){var builder=ResponseEntity.status(f.status);if(f.status==429||f.status==503)builder.header("Retry-After","60");return builder.body(error(a,f.code));}catch(IllegalArgumentException f){return ResponseEntity.unprocessableEntity().body(error(a,"VALIDATION_FAILED"));}catch(org.springframework.dao.DuplicateKeyException x){return ResponseEntity.status(409).body(error(a,"CONFLICT"));}catch(Exception x){System.err.println("MEMBER_MVP_REJECTED "+x.getClass().getSimpleName());return ResponseEntity.status(409).body(error(a,"TRANSACTION_REJECTED"));}}
 Result socialFailure(HttpServletResponse res,String code){
  Set<String> safe=Set.of("SOCIAL_CANCELED","INVALID_STATE","INVALID_SOCIAL_TOKEN","PROVIDER_FAILED","UNAUTHENTICATED","PROVIDER_NOT_CONFIGURED","IDENTITY_CONFLICT","IDENTITY_ALREADY_LINKED","INVALID_PROVIDER");
  if(!safe.contains(code))code="INVALID_SOCIAL_TOKEN";
  res.setStatus(303);res.setHeader("Location",code.equals("SOCIAL_CANCELED")?"/#social-canceled":"/#social-error?code="+code);return new Result(303,null,null);
 }
 Result route(HttpServletRequest req,HttpServletResponse res,JsonNode b){String p=req.getRequestURI().substring(7),m=req.getMethod();String[]parts=p.split("/");
  if(p.matches("/auth/social/[^/]+/(authorize|callback)")&&m.equals("GET")){
   if(p.endsWith("/authorize")){ObjectNode data=social.authorize(req,res,parts[3]);return new Result(res.getStatus(),null,data);}
   try{ObjectNode data=social.callback(req,res,parts[3]);if(data!=null&&data.has("_http_error"))return socialFailure(res,text(data,"_http_error"));return new Result(res.getStatus(),null,data);}
   catch(Failure failure){return socialFailure(res,failure.code);}
  }
  if(p.equals("/auth/signup")&&m.equals("POST")){var w=a.web(req,true,false);return idem(req,"ANON:"+w.get("id_hash"),b,()->new Result(201,null,accounts.signup(req,res,b)));}
  if(p.equals("/auth/email/verify")&&m.equals("POST"))return new Result(200,null,accounts.verify(b));
  if(p.equals("/auth/password/reset")&&m.equals("POST"))return new Result(204,null,accounts.reset(b));
  if((p.equals("/auth/email/verification-requests")||p.equals("/auth/password/reset-requests"))&&m.equals("POST"))return new Result(202,null,accounts.requestMail(req,b,p.contains("password")));
  if(p.equals("/auth/social/email-requests")&&m.equals("POST"))return new Result(202,null,social.requestContact(req,b));
  if(p.equals("/auth/social/email/verify")&&m.equals("POST"))return new Result(200,null,social.verifyContact(b));
  if(p.equals("/auth/social/signup-info")&&m.equals("POST"))return new Result(200,null,social.signupInfo(req,b));
  if(p.equals("/auth/social/complete")&&m.equals("POST"))return new Result(201,null,social.complete(req,res,b,false));
  if(p.equals("/auth/identities/link")&&m.equals("POST")){check(b.path("consent").asBoolean(false),422,"CONSENT_REQUIRED");return new Result(200,null,social.complete(req,res,b,true));}
  if(p.equals("/auth/logout")&&m.equals("POST"))return new Result(204,null,accounts.logout(req,res));
  if(p.equals("/auth/reauthenticate")&&m.equals("POST"))return new Result(204,null,b.has("ticket")?social.reauthenticate(req,b):accounts.reauthenticate(req,b));
  Identity i=a.identity(req,!m.equals("GET"));String owner="MEMBER:"+i.user();
  if(p.equals("/guest-imports")&&m.equals("GET"))return new Result(200,null,imports.list(i,req.getParameterMap()));
  if(p.equals("/guest-imports")&&m.equals("POST")){e.ownerLock(i);return idem(req,owner,b,()->new Result(202,null,imports.create(i,b)));}
  if(p.matches("/guest-imports/[^/]+")&&m.equals("GET"))return new Result(200,null,imports.get(i,parts[2]));
  if(p.matches("/guest-imports/[^/]+/items/[^/]+")&&m.equals("PUT")){e.ownerLock(i);return idem(req,owner,b,()->new Result(200,null,imports.put(i,parts[2],parts[4],b)));}
  if(p.equals("/sites")&&m.equals("GET")){Query.allowed(req.getParameterMap(),"purpose","cursor","limit");return new Result(200,null,sites.list(i,req.getParameterMap()));}
  if(p.matches("/sites/[0-9]+")&&m.equals("GET")){ObjectNode s=sites.get(i,parts[2]);return new Result(200,etag(s),s);}
  if(p.equals("/sites")&&m.equals("POST")){e.ownerLock(i);return idem(req,owner,b,()->{var s=sites.write(i,null,b,null);return new Result(201,etag(s),s);});}
  if(p.matches("/sites/[0-9]+")&&Set.of("PATCH","DELETE").contains(m)){e.ownerLock(i);return idem(req,owner,b,()->{if(m.equals("DELETE"))return new Result(204,null,sites.delete(i,parts[2],req.getHeader("If-Match")));var s=sites.write(i,parts[2],b,req.getHeader("If-Match"));return new Result(200,etag(s),s);});}
  if(p.equals("/content-policy")&&m.equals("GET")){ObjectNode data=policy.get(i);return new Result(200,etag(data),data);}
  if(p.equals("/content-policy")&&m.equals("PUT")){e.ownerLock(i);return idem(req,owner,b,()->{var data=policy.put(i,b,req.getHeader("If-Match"));return new Result(200,etag(data),data);});}
  if(p.matches("/extension-installations/[^/]+/connection")&&m.equals("DELETE"))return new Result(204,null,accounts.disconnect(i,parts[2]));
  if(p.matches("/operations/[^/]+")&&m.equals("GET")){uuid(parts[2]);var row=a.one("SELECT * FROM operations WHERE id=? AND user_id=?",parts[2],i.user());check(row!=null,404,"OPERATION_NOT_FOUND");if(i.executor()!=null){var s=e.session(row.get("resource_id").toString(),i);}return new Result(200,null,a.obj("status",row.get("status"),"resource_id",row.get("resource_id"),"error",row.get("error_code")));}
  throw new Failure(405,"METHOD_NOT_ALLOWED");
 }
}
