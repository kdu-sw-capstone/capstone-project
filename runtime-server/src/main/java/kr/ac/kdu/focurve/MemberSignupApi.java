package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.JsonNode;import jakarta.servlet.http.*;import org.springframework.web.bind.annotation.*;import org.springframework.context.annotation.Profile;import org.springframework.http.ResponseEntity;import kr.ac.kdu.focurve.auth.*;import kr.ac.kdu.focurve.api.ApiFailure;
/** Uses the already approved product signup-code service; no token/code response or fixture endpoint. */
@Profile("member-runtime | local-integration") @RestController
class MemberSignupApi {
 final MemberAuth auth;final EmailSignupCodes codes;
 MemberSignupApi(MemberAuth auth,EmailSignupCodes codes){this.auth=auth;this.codes=codes;}
 static void schema(JsonNode body,String...names){if(body==null||!body.isObject())throw new IllegalArgumentException("VALIDATION_FAILED");MemberIntervals.keys(body,names);for(String name:names)if(!body.path(name).isTextual())throw new IllegalArgumentException("VALIDATION_FAILED");}
 @PostMapping({"/api/v1/auth/email/signup-code-requests","/api/v1/auth/email/signup-code-verifications"})
 ResponseEntity<?> code(HttpServletRequest req,@RequestBody JsonNode body){try{auth.web(req,true,false);if(req.getRequestURI().endsWith("-requests")){schema(body,"email");return ResponseEntity.status(202).body(codes.request(MemberIntervals.text(body,"email"),auth.cookie(req),req.getRemoteAddr()));}schema(body,"request_id","email","code");return ResponseEntity.ok(codes.verify(MemberIntervals.text(body,"request_id"),MemberIntervals.text(body,"email"),MemberIntervals.text(body,"code"),auth.cookie(req),req.getRemoteAddr()));}catch(ApiFailure f){var r=ResponseEntity.status(f.status);if(f.retryAfterSeconds!=null)r.header("Retry-After",f.retryAfterSeconds.toString());return r.body(MemberMvpApi.error(auth,f.code));}catch(IllegalArgumentException f){return ResponseEntity.status(422).body(MemberMvpApi.error(auth,"VALIDATION_FAILED"));}catch(MemberAuth.Failure f){return ResponseEntity.status(f.status).body(MemberMvpApi.error(auth,f.code));}}
}
