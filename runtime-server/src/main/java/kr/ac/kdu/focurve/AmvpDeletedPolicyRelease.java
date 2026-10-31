package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.AmvpBridgeSupport.*;

/** A removed SITE_TIME policy is absent from the replacement package, not automatically released.
 * EvidenceVerifier must prove release/failure of that exact previous claim/operation/generation.
 * No Content/frozen-focus obligation is covered by this runtime-policy projection. */
final class AmvpDeletedPolicyRelease {
 static List<Map<String,Object>> targets(AmvpBridgeSupport s,Binding owner,ObjectNode report,Set<String> affected,Set<String> published){
  var result=new ArrayList<Map<String,Object>>();
  for(String id:affected){if(published.contains(id))continue;
   check(Set.of("RELEASED","UNKNOWN","FAILED").contains(report.path("state").asText()),409,"INVALID_EFFECT_EVIDENCE");
   var row=s.auth.one("SELECT * FROM amvp_configs WHERE config_id=? AND owner_binding_id=? AND kind='SITE_TIME' AND deleted_at IS NOT NULL AND saved_runtime_revision<=?",id,owner.id(),report.path("runtime_revision").asLong());check(row!=null,409,"INVALID_EFFECT_EVIDENCE");
   var current=s.auth.one("SELECT * FROM amvp_config_versions WHERE config_id=? AND version=?",id,row.get("version"));var value=s.parse(row.get("value_json"));String canonical=AdditionalConfigContract.canonical(value);
   s.contract.validate("SiteTimePolicy",value);check(value.path("policy_id").asText().equals(id)&&value.path("version").asLong()==((Number)row.get("version")).longValue(),409,"STORE_UNCONFIRMED");
   check(current!=null&&hash(canonical).equals(current.get("payload_sha256"))&&AdditionalConfigContract.canonical(s.parse(current.get("value_json"))).equals(canonical),409,"STORE_UNCONFIRMED");
   var previous=s.auth.one("SELECT * FROM amvp_config_versions WHERE config_id=? AND version<? ORDER BY version DESC LIMIT 1",id,row.get("version"));check(previous!=null,409,"INVALID_EFFECT_EVIDENCE");var prior=s.parse(previous.get("value_json"));hashMatchesVersion(previous,prior);
   s.contract.validate("SiteTimePolicy",prior);check(prior.path("policy_id").asText().equals(id)&&prior.path("version").asLong()==((Number)previous.get("version")).longValue()&&((Number)previous.get("version")).longValue()+1==((Number)row.get("version")).longValue(),409,"STORE_UNCONFIRMED");
   var issued=s.auth.one("SELECT * FROM amvp_packages WHERE owner_binding_id=? AND runtime_revision<? AND JSON_CONTAINS(JSON_EXTRACT(payload_json,'$.runtime_policies'),CAST(? AS JSON))=1 ORDER BY runtime_revision DESC LIMIT 1",owner.id(),row.get("saved_runtime_revision"),AdditionalConfigContract.canonical(prior));check(issued!=null,409,"INVALID_EFFECT_EVIDENCE");
   var oldPackage=s.parse(issued.get("payload_json"));s.contract.validate("RuntimePackage",oldPackage);hashMatches(oldPackage);check(oldPackage.path("owner_binding_id").asText().equals(owner.id())&&oldPackage.path("executor_id").asText().equals(owner.executor())&&issued.get("package_id").equals(oldPackage.path("package_id").asText())&&((Number)issued.get("runtime_revision")).longValue()==oldPackage.path("runtime_revision").asLong()&&issued.get("payload_sha256").equals(oldPackage.path("payload_sha256").asText()),409,"STORE_UNCONFIRMED");result.add(row);
  }return result;
 }
 private static void hashMatchesVersion(Map<String,Object> row,ObjectNode value){check(hash(AdditionalConfigContract.canonical(value)).equals(row.get("payload_sha256")),409,"STORE_UNCONFIRMED");}
 static void project(AmvpBridgeSupport s,Binding owner,ObjectNode report,List<Map<String,Object>> rows){
  for(var row:rows){String id=row.get("config_id").toString();var old=s.auth.one("SELECT * FROM amvp_operations WHERE owner_binding_id=? AND route='RPT_STATE' AND idempotency_key=?",owner.id(),id);
   if(old!=null&&s.parse(old.get("response_json")).path("runtime_revision").asLong()>report.path("runtime_revision").asLong())continue;
   var projection=s.auth.obj("profile","AMVP_REPORT_PROJECTION_1","report_id",report.path("report_id").asText(),"config_version",row.get("version"),"runtime_revision",report.path("runtime_revision").asLong());String json=AdditionalConfigContract.canonical(projection);
   if(old==null)s.auth.db.update("INSERT INTO amvp_operations(operation_id,owner_binding_id,route,idempotency_key,request_sha256,state,response_json,updated_at) VALUES(?,?,'RPT_STATE',?,?,'PROJECTED',?,?)",MemberAuth.id(),owner.id(),id,hash(id),json,now());
   else s.auth.db.update("UPDATE amvp_operations SET response_json=?,updated_at=? WHERE operation_id=?",json,now(),old.get("operation_id"));
  }
 }
}
