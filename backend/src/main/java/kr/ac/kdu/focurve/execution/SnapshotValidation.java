package kr.ac.kdu.focurve.execution;

import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.sites.SiteInput;

/** Validate the complete policy before issuance; never repair or rewrite saved snapshots. */
public final class SnapshotValidation {
  private SnapshotValidation() {}
  public static void validate(Map<String,Object> value) {
    Object version=value.get("format_version");
    if(!Set.of("1.1","1.2").contains(Objects.toString(version,""))) fail();
    if("1.2".equals(version)&&!"MOST_SPECIFIC_HOST".equals(value.get("site_match_strategy"))) fail();
    for(String field:List.of("policy_snapshot_id","executor_id","created_at")) {
      if(!(value.get(field) instanceof String text)||text.isBlank()) fail();
    }
    for(String field:List.of("policy_snapshot_id","executor_id")) {
      try { if(!UUID.fromString((String)value.get(field)).toString().equals(value.get(field))) fail(); }
      catch(RuntimeException error){fail();}
    }
    try {java.time.Instant.parse((String)value.get("created_at"));}
    catch(RuntimeException error){fail();}
    if(!value.containsKey("owner_user_id")||!(value.get("source_version") instanceof Number n)||n.longValue()<1) fail();
    if(value.get("owner_user_id")!=null && (!(value.get("owner_user_id") instanceof String owner)||!owner.matches("[1-9][0-9]*"))) fail();
    if(!(value.get("source_version") instanceof Integer||value.get("source_version") instanceof Long)) fail();
    if(!(value.get("sites") instanceof List<?>)) fail();
    var hosts=new HashSet<String>();
    for(Object item:(List<?>)value.get("sites")) {
      if(!(item instanceof Map<?,?>)) fail(); var site=(Map<?,?>)item;
      if(!(site.get("site_id") instanceof String id)||!id.matches("[1-9][0-9]*")
          ||!positiveVersion(site.get("version"))
          ||!(site.get("display_name") instanceof String name)||name.isBlank()||name.length()>100) fail();
      for(String field:List.of("created_at","updated_at")) {
        if(!(site.get(field) instanceof String)) fail();
        try {java.time.Instant.parse((String)site.get(field));}catch(RuntimeException error){fail();}
      }
      if(!(site.get("canonical_host") instanceof String)) fail(); String host=(String)site.get("canonical_host");
      if(!host.equals(SiteInput.host(host))||!hosts.add(host)||!(site.get("include_subdomains") instanceof Boolean)
          ||!Set.of("BLOCK","ALLOW","RECORD").contains(Objects.toString(site.get("access_policy"),""))
          ||!Set.of("FOCUS","DISTRACTION","GENERAL").contains(Objects.toString(site.get("purpose"),""))
          ||!(site.get("feature_policies") instanceof List<?>)) fail();
      if("DISTRACTION".equals(site.get("purpose")) ? "ALLOW".equals(site.get("access_policy")) : !"ALLOW".equals(site.get("access_policy"))) fail();
      for(Object f:(List<?>)site.get("feature_policies")) {
        if(!(f instanceof Map<?,?> feature)||!"YOUTUBE_SHORTS".equals(feature.get("feature_code"))||!(feature.get("enabled") instanceof Boolean)) fail();
      }
    }
    if(!(value.get("content_policy") instanceof Map<?,?>)) fail();
    var content=(Map<?,?>)value.get("content_policy");
    if(!positiveVersion(content.get("version"))) fail();
    for(String field:List.of("keywords","adult_domains","image_blur","usage_tracking")) {
      if(!(content.get(field) instanceof Map<?,?> p)||!(p.get("enabled") instanceof Boolean)) fail();
    }
    for(String field:List.of("keywords","adult_domains")) {
      var p=(Map<?,?>)content.get(field);
      if(!(p.get("exceptions") instanceof List<?>)) fail();
      String list=field.equals("keywords")?"rules":"custom_hosts";
      if(!(p.get(list) instanceof List<?>)) fail();
      for(Object item:(List<?>)p.get("exceptions")) hostEntry(item);
      if(field.equals("adult_domains")) for(Object item:(List<?>)p.get(list)) hostEntry(item);
      else for(Object item:(List<?>)p.get(list)) {
        if(!(item instanceof Map<?,?> rule)||!(rule.get("id") instanceof String)||!(rule.get("text") instanceof String text)
          ||text.isBlank()||text.length()>80||!(rule.get("scopes") instanceof List<?> scopes)||scopes.isEmpty()||!List.of("TITLE","URL","BODY").containsAll(scopes)) fail();
      }
    }
    var image=(Map<?,?>)content.get("image_blur");
    for(String field:List.of("sensitivity","strength")) if(!List.of("LOW","MEDIUM","HIGH").contains(image.get(field))) fail();
  }
  private static void hostEntry(Object item) {
    if(!(item instanceof Map<?,?> entry)||!(entry.get("host") instanceof String host)||!(entry.get("include_subdomains") instanceof Boolean)) fail();
    var entry=(Map<?,?>)item;String host=(String)entry.get("host");if(!host.equals(SiteInput.host(host))) fail();
  }
  /** Shared incoming-version guard; guest IDs need not use server-issued site IDs. */
  public static void requirePositiveVersion(Object value) {
    if (!positiveVersion(value)) fail();
  }
  private static boolean positiveVersion(Object value) {
    return (value instanceof Integer || value instanceof Long) && ((Number)value).longValue() > 0;
  }
  private static void fail(){throw new ApiFailure(422,"INVALID_SNAPSHOT");}
}
