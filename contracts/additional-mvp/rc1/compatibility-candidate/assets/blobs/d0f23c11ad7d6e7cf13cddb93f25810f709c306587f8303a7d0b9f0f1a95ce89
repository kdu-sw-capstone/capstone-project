package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import java.net.*;import java.util.*;
import com.ibm.icu.text.IDNA;
import static kr.ac.kdu.focurve.MemberAuth.*;
import static kr.ac.kdu.focurve.MemberIntervals.*;

@Profile("member-runtime | local-integration") @Component
class MemberSites {
 static final IDNA HOST_IDNA=IDNA.getUTS46Instance(IDNA.USE_STD3_RULES|IDNA.NONTRANSITIONAL_TO_ASCII|IDNA.CHECK_BIDI|IDNA.CHECK_CONTEXTJ);
 final MemberAuth a;final MemberExecution e;
 MemberSites(MemberAuth a,MemberExecution e){this.a=a;this.e=e;}
 static String host(String value){
  check(value!=null&&!value.isBlank()&&value.length()<=2048,422,"INVALID_SITE_URL");
  try{String input=value.trim();URI u=new URI(input.contains("://")?input:"https://"+input);
   check(Set.of("http","https").contains(u.getScheme())&&u.getRawUserInfo()==null&&u.getPort()==-1,422,"INVALID_SITE_URL");
   String authority=u.getRawAuthority();check(authority!=null&&!authority.contains("@")&&!authority.contains(":")&&!authority.contains("%"),422,"INVALID_SITE_URL");
   var info=new IDNA.Info();String h=HOST_IDNA.nameToASCII(authority,new StringBuilder(),info).toString().toLowerCase(Locale.ROOT);check(!info.hasErrors(),422,"INVALID_SITE_URL");if(h.endsWith("."))h=h.substring(0,h.length()-1);
   check(h.length()<=253&&h.contains(".")&&!h.equals("localhost")&&!h.endsWith(".localhost")&&!h.matches("[0-9.]+"),422,"INVALID_SITE_URL");
   for(String label:h.split("\\."))check(!label.isBlank()&&label.length()<=63,422,"INVALID_SITE_URL");return h;
  }catch(Failure f){throw f;}catch(Exception x){throw new Failure(422,"INVALID_SITE_URL");}
 }
 static boolean validDisplayName(String value){
  if(value==null)return false;int count=0;boolean visible=false;
  for(int i=0;i<value.length();i++){char c=value.charAt(i);int cp=c;
   if(Character.isHighSurrogate(c)){if(i+1>=value.length()||!Character.isLowSurrogate(value.charAt(i+1)))return false;cp=Character.toCodePoint(c,value.charAt(++i));}
   else if(Character.isLowSurrogate(c))return false;
   if(++count>100)return false;
   if(!Character.isWhitespace(cp)&&!Character.isSpaceChar(cp)&&cp!=0xfeff)visible=true;
  }return count>0&&visible;
 }
 static boolean overlap(String x,boolean xs,String y,boolean ys){return x.equals(y)||xs&&y.endsWith("."+x)||ys&&x.endsWith("."+y);}
 static void version(String etag,long current){check(etag!=null,428,"PRECONDITION_REQUIRED");check(etag.equals("\""+current+"\""),412,"VERSION_CONFLICT");}
 ObjectNode site(Map<String,Object> row){ArrayNode f=a.json.createArrayNode();for(var p:a.db.queryForList("SELECT feature_code,enabled FROM site_feature_policies WHERE site_id=? ORDER BY feature_code",row.get("id")))f.add(a.obj("feature_code",p.get("feature_code"),"enabled",p.get("enabled")));return a.obj("site_id",row.get("id").toString(),"canonical_host",row.get("canonical_host"),"display_name",row.get("display_name"),"include_subdomains",row.get("include_subdomains"),"purpose",row.get("purpose"),"access_policy",row.get("access_policy"),"feature_policies",f,"version",row.get("version"),"created_at",instant(row.get("created_at")),"updated_at",instant(row.get("updated_at")),"deleted_at",row.get("deleted_at")==null?null:instant(row.get("deleted_at")));}
 Map<String,Object> owned(long user,String id){check(id.matches("[1-9][0-9]{0,18}"),404,"SITE_NOT_FOUND");var row=a.one("SELECT * FROM sites WHERE id=? AND user_id=? AND deleted_at IS NULL FOR UPDATE",id,user);check(row!=null,404,"SITE_NOT_FOUND");return row;}
 ObjectNode get(Identity i,String id){return site(owned(i.user(),id));}
 ObjectNode list(Identity i,Map<String,String[]> q){int limit=Query.limit(q);long after=Query.cursor(q,"SITE:"+i.user());String purpose=Query.single(q,"purpose",null);check(purpose==null||Set.of("FOCUS","DISTRACTION","GENERAL").contains(purpose),422,"VALIDATION_FAILED");List<Object>args=new ArrayList<>(List.of(i.user(),after));String where="";if(purpose!=null){where=" AND purpose=?";args.add(purpose);}args.add(limit+1);var rows=a.db.queryForList("SELECT * FROM sites WHERE user_id=? AND id>? AND deleted_at IS NULL"+where+" ORDER BY id LIMIT ?",args.toArray());ArrayNode items=a.json.createArrayNode();for(int n=0;n<Math.min(limit,rows.size());n++)items.add(site(rows.get(n)));return Query.page(a,items,rows.size()>limit,rows.size()>limit?Query.encode("SITE:"+i.user(),Long.parseLong(items.get(items.size()-1).path("site_id").asText())):null);}
 ObjectNode write(Identity i,String id,JsonNode b,String etag){e.ownerLock(i);Map<String,Object> old=id==null?null:owned(i.user(),id);ObjectNode merged=old==null?a.obj("include_subdomains",true,"feature_policies",List.of()):site(old);keys(b,"url","display_name","include_subdomains","purpose","access_policy","feature_policies");b.fields().forEachRemaining(x->merged.set(x.getKey(),x.getValue()));String h=b.has("url")?host(text(b,"url")):old==null?"":old.get("canonical_host").toString();check(!h.isBlank(),422,"VALIDATION_FAILED");String display=text(merged,"display_name"),purpose=text(merged,"purpose"),policy=text(merged,"access_policy");check(validDisplayName(display)&&merged.path("include_subdomains").isBoolean()&&Set.of("FOCUS","DISTRACTION","GENERAL").contains(purpose)&&Set.of("ALLOW","BLOCK","RECORD").contains(policy),422,"VALIDATION_FAILED");check(purpose.equals("DISTRACTION")?!policy.equals("ALLOW"):policy.equals("ALLOW"),422,"INVALID_POLICY_COMBINATION");boolean sub=merged.path("include_subdomains").asBoolean();for(var row:a.db.queryForList("SELECT * FROM sites WHERE user_id=? AND deleted_at IS NULL",i.user()))check(old!=null&&row.get("id").equals(old.get("id"))||!h.equals(row.get("canonical_host").toString()),409,"SITE_SCOPE_CONFLICT");check(merged.path("feature_policies").isArray(),422,"VALIDATION_FAILED");ArrayNode features=(ArrayNode)merged.path("feature_policies");check(features.size()<=6,422,"VALIDATION_FAILED");Set<String>seen=new HashSet<>();for(JsonNode f:features){keys(f,"feature_code","enabled");String code=text(f,"feature_code");check(f.path("enabled").isBoolean()&&seen.add(code)&&Set.of("YOUTUBE_SHORTS","YOUTUBE_RECOMMENDATIONS","YOUTUBE_COMMENTS","YOUTUBE_AUTOPLAY","INSTAGRAM_REELS","INSTAGRAM_RECOMMENDATIONS").contains(code),422,"VALIDATION_FAILED");check(code.startsWith("YOUTUBE_")?Set.of("youtube.com","www.youtube.com").contains(h):Set.of("instagram.com","www.instagram.com").contains(h),422,"INVALID_SCOPE");}
  if(old!=null){version(etag,((Number)old.get("version")).longValue());a.db.update("UPDATE sites SET canonical_host=?,display_name=?,include_subdomains=?,purpose=?,access_policy=?,version=version+1,updated_at=? WHERE id=?",h,display,sub,purpose,policy,now(),id);}
  else{var deleted=a.one("SELECT * FROM sites WHERE user_id=? AND canonical_host=? FOR UPDATE",i.user(),h);if(deleted!=null){id=deleted.get("id").toString();a.db.update("UPDATE sites SET display_name=?,include_subdomains=?,purpose=?,access_policy=?,version=version+1,updated_at=?,deleted_at=NULL WHERE id=?",display,sub,purpose,policy,now(),id);}else{a.db.update("INSERT INTO sites(user_id,canonical_host,display_name,include_subdomains,purpose,access_policy,version,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)",i.user(),h,display,sub,purpose,policy,now(),now());id=a.db.queryForObject("SELECT id FROM sites WHERE user_id=? AND canonical_host=?",String.class,i.user(),h);}}
  a.db.update("DELETE FROM site_feature_policies WHERE site_id=?",id);for(JsonNode f:features)a.db.update("INSERT INTO site_feature_policies VALUES(?,?,?)",id,text(f,"feature_code"),f.path("enabled").asBoolean());return get(i,id);
 }
 ObjectNode delete(Identity i,String id,String etag){e.ownerLock(i);var row=owned(i.user(),id);version(etag,((Number)row.get("version")).longValue());a.db.update("UPDATE sites SET deleted_at=?,updated_at=?,version=version+1 WHERE id=?",now(),now(),id);return null;}
}
