package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;import org.springframework.context.annotation.Profile;
import java.util.*;import static kr.ac.kdu.focurve.MemberAuth.*;import static kr.ac.kdu.focurve.MemberIntervals.*;

/** Explicit selection only. No code path from login or token exchange invokes this service. */
@Profile("member-runtime | local-integration") @Component
class MemberImports {
 final MemberAuth a;final MemberExecution e;final MemberSites sites;
 MemberImports(MemberAuth a,MemberExecution e,MemberSites sites){this.a=a;this.e=e;this.sites=sites;}
 static JsonNode canonicalValue(JsonNode value,int depth){
  check(value!=null&&depth<=64,422,"INVALID_IMPORT_ITEM");
  if(value.isObject()){ObjectNode sorted=JsonNodeFactory.instance.objectNode();var keys=new TreeSet<String>();value.fieldNames().forEachRemaining(keys::add);for(String k:keys)sorted.set(k,canonicalValue(value.get(k),depth+1));return sorted;}
  if(value.isArray()){ArrayNode ordered=JsonNodeFactory.instance.arrayNode();for(JsonNode item:value)ordered.add(canonicalValue(item,depth+1));return ordered;}
  if(value.isNumber())check(value.isIntegralNumber()&&value.canConvertToLong()&&value.asLong()>=-9007199254740991L&&value.asLong()<=9007199254740991L,422,"INVALID_IMPORT_ITEM");
  check(value.isNull()||value.isBoolean()||value.isTextual()||value.isNumber(),422,"INVALID_IMPORT_ITEM");return value.deepCopy();
 }
 static String canonicalHash(JsonNode payload){return hash(canonicalValue(payload,0).toString());}
 void extension(Identity i){check(i.executor()!=null,401,"EXTENSION_AUTH_REQUIRED");}
 ObjectNode create(Identity i,JsonNode body){
  extension(i);keys(body,"source_installation_id","manifest");String source=text(body,"source_installation_id");uuid(source);
  // A linked installation may submit only its own retained Guest originals.
  check(source.equals(i.executor()),403,"EXECUTOR_MISMATCH");
  check(a.one("SELECT id FROM extension_installations WHERE id=? AND current_user_id=? FOR UPDATE",source,i.user())!=null,403,"EXECUTOR_MISMATCH");
  JsonNode manifest=body.path("manifest");check(manifest.isArray()&&!manifest.isEmpty()&&manifest.size()<=100,422,"INVALID_IMPORT_MANIFEST");
  Set<String> seen=new HashSet<>();for(JsonNode item:manifest){descriptor(item);check(seen.add(text(item,"source_item_id")),422,"INVALID_IMPORT_MANIFEST");
   var old=a.one("SELECT * FROM guest_import_items WHERE source_executor_id=? AND source_item_id=? FOR UPDATE",source,text(item,"source_item_id"));
   if(old!=null){check(((Number)old.get("bound_user_id")).longValue()==i.user(),409,"SOURCE_BOUND_TO_OTHER_ACCOUNT");check(old.get("source_hash").equals(text(item,"source_hash"))&&old.get("item_type").equals(text(item,"type")),409,"SOURCE_CONFLICT");}
  }
  String batch=id();a.db.update("INSERT INTO guest_import_batches VALUES(?,?,?,'PENDING',?,NULL)",batch,i.user(),i.executor(),now());
  for(JsonNode item:manifest){var old=a.one("SELECT id FROM guest_import_items WHERE source_executor_id=? AND source_item_id=?",source,text(item,"source_item_id"));String itemId=old==null?id():old.get("id").toString();
   if(old==null)a.db.update("INSERT INTO guest_import_items(id,batch_id,source_executor_id,source_item_id,source_hash,item_type,bound_user_id,status) VALUES(?,?,?,?,?,?,?,'PENDING')",itemId,batch,source,text(item,"source_item_id"),text(item,"source_hash"),text(item,"type"),i.user());
   a.db.update("INSERT INTO guest_import_selection VALUES(?,?)",batch,itemId);
  }
  for(String itemId:a.db.queryForList("SELECT item_id FROM guest_import_selection WHERE batch_id=?",String.class,batch))refresh(itemId);return get(i,batch);
 }
 void descriptor(JsonNode item){keys(item,"type","source_item_id","source_hash");uuid(text(item,"source_item_id"));check(Set.of("SITE","CONTENT_POLICY","SCHEDULE","SESSION").contains(text(item,"type"))&&text(item,"source_hash").matches("[a-f0-9]{64}"),422,"INVALID_IMPORT_MANIFEST");}
 Map<String,Object> batch(Identity i,String id){uuid(id);var row=a.one("SELECT * FROM guest_import_batches WHERE id=? AND user_id=? FOR UPDATE",id,i.user());check(row!=null,404,"IMPORT_NOT_FOUND");check(i.executor()==null||i.executor().equals(row.get("executor_id")),403,"EXECUTOR_MISMATCH");return row;}
 ObjectNode item(Map<String,Object> row){return a.obj("source_item_id",row.get("source_item_id"),"status",row.get("status"),"result_id",row.get("result_id"),"error_code",row.get("error_code"));}
 void refresh(String itemId){for(String id:a.db.queryForList("SELECT batch_id FROM guest_import_selection WHERE item_id=?",String.class,itemId)){var rows=a.db.queryForList("SELECT x.status FROM guest_import_selection s JOIN guest_import_items x ON x.id=s.item_id WHERE s.batch_id=?",id);long pending=0,failed=0,done=0;for(var row:rows){String status=row.get("status").toString();if(status.equals("PENDING"))pending++;else if(status.equals("FAILED"))failed++;else done++;}String status=pending>0?(done+failed==0?"PENDING":"PROCESSING"):failed>0?(done>0?"PARTIAL":"FAILED"):"SUCCEEDED";a.db.update("UPDATE guest_import_batches SET status=?,completed_at=CASE WHEN ? THEN NULL ELSE COALESCE(completed_at,?) END WHERE id=?",status,pending>0,now(),id);}}
 ObjectNode get(Identity i,String id){var batch=batch(i,id);ArrayNode items=a.json.createArrayNode();for(var row:a.db.queryForList("SELECT x.* FROM guest_import_selection s JOIN guest_import_items x ON x.id=s.item_id WHERE s.batch_id=? ORDER BY x.source_item_id",id))items.add(item(row));return a.obj("batch_id",id,"status",batch.get("status"),"items",items,"created_at",instant(batch.get("created_at")),"completed_at",batch.get("completed_at")==null?null:instant(batch.get("completed_at")));}
 ObjectNode list(Identity i,Map<String,String[]>q){Query.allowed(q,"cursor","limit");String context="IMPORT:"+i.user()+":"+Objects.toString(i.executor(),"WEB");long after=Query.cursor(q,context);int limit=Query.limit(q);var rows=i.executor()==null?a.db.queryForList("SELECT id FROM guest_import_batches WHERE user_id=? ORDER BY created_at,id",i.user()):a.db.queryForList("SELECT id FROM guest_import_batches WHERE user_id=? AND executor_id=? ORDER BY created_at,id",i.user(),i.executor());ArrayNode items=a.json.createArrayNode();for(int n=(int)Math.min(after,rows.size());n<rows.size()&&items.size()<limit;n++)items.add(get(i,rows.get(n).get("id").toString()));boolean more=after+items.size()<rows.size();return Query.page(a,items,more,more?Query.encode(context,after+items.size()):null);}
 ObjectNode put(Identity i,String batchId,String sourceId,JsonNode body){
  extension(i);var selectedBatch=batch(i,batchId);uuid(sourceId);keys(body,"type","source_item_id","source_hash","payload");
  ObjectNode description=body.deepCopy();description.remove("payload");descriptor(description);check(sourceId.equals(text(body,"source_item_id"))&&body.path("payload").isObject(),422,"INVALID_IMPORT_ITEM");
  var row=a.one("SELECT x.* FROM guest_import_items x JOIN guest_import_selection s ON s.item_id=x.id WHERE s.batch_id=? AND x.source_item_id=? AND x.bound_user_id=? FOR UPDATE",batchId,sourceId,i.user());check(row!=null,404,"IMPORT_ITEM_NOT_SELECTED");
  check(row.get("source_hash").equals(text(body,"source_hash"))&&row.get("item_type").equals(text(body,"type")),409,"SOURCE_CONFLICT");
  String rawHash=hash(body.path("payload").toString());
  // Preserve exact historical completed results; never rewrite their source or
  // payload hashes. New transfers bind the selected canonical source bytes.
  if(Set.of("SUCCEEDED","SKIPPED_CONFLICT").contains(row.get("status"))){check(Objects.equals(row.get("payload_hash"),rawHash)||Objects.equals(row.get("payload_hash"),canonicalHash(body.path("payload"))),409,"SOURCE_CONFLICT");return item(row);}
  String type=text(body,"type"),result=null,status="SUCCEEDED";JsonNode payload=body.path("payload");
  check(Set.of("SITE","SESSION").contains(type),422,"IMPORT_TYPE_UNSUPPORTED");String payloadHash=canonicalHash(payload);check(row.get("source_hash").equals(payloadHash)&&(row.get("payload_hash")==null||row.get("payload_hash").equals(payloadHash)||row.get("payload_hash").equals(rawHash)),409,"SOURCE_CONFLICT");e.ownerLock(i);
  if(type.equals("SITE")){
   validateSite(payload);String host=MemberSites.host(text(payload,"url"));boolean overlap=false;
   for(var site:a.db.queryForList("SELECT canonical_host FROM sites WHERE user_id=?",i.user()))overlap|=host.equals(site.get("canonical_host").toString());
   if(overlap){status="SKIPPED_CONFLICT";}else result=text(sites.write(i,null,payload,null),"site_id");
  }else if(type.equals("SESSION")){var firstSelection=a.one("SELECT created_at FROM guest_import_batches WHERE id=?",row.get("batch_id"));result=MemberImportedSession.copy(a,e,i,payload,sourceId,java.time.Instant.parse(instant(firstSelection.get("created_at"))).toEpochMilli());
  }
  a.db.update("UPDATE guest_import_items SET status=?,result_id=?,error_code=NULL,payload_hash=? WHERE id=?",status,result,payloadHash,row.get("id"));
  refresh(row.get("id").toString());return item(a.one("SELECT * FROM guest_import_items WHERE id=?",row.get("id")));
 }
 static void validateSite(JsonNode p){
  keys(p,"url","display_name","include_subdomains","purpose","access_policy","feature_policies");String host=MemberSites.host(text(p,"url")),purpose=text(p,"purpose"),policy=text(p,"access_policy"),display=text(p,"display_name");
  check(text(p,"url").equals(host),422,"INVALID_SITE_URL");
  check(MemberSites.validDisplayName(display)&&(!p.has("include_subdomains")||p.path("include_subdomains").isBoolean())&&Set.of("FOCUS","GENERAL","DISTRACTION").contains(purpose)&&Set.of("ALLOW","BLOCK","RECORD").contains(policy),422,"VALIDATION_FAILED");
  check(purpose.equals("DISTRACTION")?!policy.equals("ALLOW"):policy.equals("ALLOW"),422,"INVALID_POLICY_COMBINATION");
  check(p.path("feature_policies").isArray()&&p.path("feature_policies").size()<=6,422,"VALIDATION_FAILED");Set<String> seen=new HashSet<>();
  for(JsonNode feature:p.path("feature_policies")){keys(feature,"feature_code","enabled");String code=text(feature,"feature_code");check(feature.path("enabled").isBoolean()&&seen.add(code)&&Set.of("YOUTUBE_SHORTS","YOUTUBE_RECOMMENDATIONS","YOUTUBE_COMMENTS","YOUTUBE_AUTOPLAY","INSTAGRAM_REELS","INSTAGRAM_RECOMMENDATIONS").contains(code),422,"VALIDATION_FAILED");check(code.startsWith("YOUTUBE_")?Set.of("youtube.com","www.youtube.com").contains(host):Set.of("instagram.com","www.instagram.com").contains(host),422,"INVALID_SCOPE");}
 }
}
