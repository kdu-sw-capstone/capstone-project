package kr.ac.kdu.focurve.events;

import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;

/** Selection is made from the immutable session snapshot, never current site settings. */
public final class SnapshotAccess {
  private SnapshotAccess() {}

  public static Map<?, ?> select(Map<String, Object> snapshot, String host) {
    if (!(snapshot.get("sites") instanceof List<?> sites))
      throw new ApiFailure(422, "INVALID_SNAPSHOT");
    Map<?, ?> winner = null;
    for (Object value : sites) {
      if (!(value instanceof Map<?, ?> site)
          || !(site.get("canonical_host") instanceof String domain))
        throw new ApiFailure(422, "INVALID_SNAPSHOT");
      if ((host.equals(domain)
              || Boolean.TRUE.equals(site.get("include_subdomains")) && host.endsWith("." + domain))
          && (winner == null || domain.length() > winner.get("canonical_host").toString().length()))
        winner = site;
    }
    return winner;
  }

  public static void validate(
      Map<String, Object> snapshot, String type, Map<String, Object> payload) {
    String host = Objects.toString(payload.get("target_host"), ""),
        kind = Objects.toString(payload.get("target_kind"), "");
    String expected =
        kind
            + ":"
            + host
            + (kind.equals("FEATURE")
                ? ":" + Objects.toString(payload.get("feature_code"), "")
                : "");
    if (!expected.equals(payload.get("target_key")))
      throw new ApiFailure(422, "INVALID_TARGET_KEY");
    var site = select(snapshot, host);
    if (site == null) throw new ApiFailure(422, "POLICY_MISMATCH");
    String policy = Objects.toString(site.get("access_policy"), "");
    boolean feature = false;
    if (site.get("feature_policies") instanceof List<?> features)
      for (Object item : features)
        if (item instanceof Map<?, ?> f
            && Objects.equals(f.get("feature_code"), payload.get("feature_code"))
            && Boolean.TRUE.equals(f.get("enabled"))) feature = true;
    boolean valid =
        switch (type) {
          case "BLOCKED_SITE_ACCESS" -> policy.equals("BLOCK");
          case "RECORDED_ACCESS" -> policy.equals("RECORD");
          case "BLOCKED_FEATURE_ACCESS" -> !policy.equals("BLOCK") && feature;
          default -> false;
        };
    if (!valid) throw new ApiFailure(422, "POLICY_MISMATCH");
  }

  public static void validate12(Map<String,Object> snapshot,String type,Map<String,Object> payload) {
    kr.ac.kdu.focurve.execution.SnapshotValidation.validate(snapshot);
    String host=Objects.toString(payload.get("target_host"),"");
    if(!host.equals(payload.get("target_key"))) throw new ApiFailure(422,"INVALID_TARGET_KEY");
    var selected=select(snapshot,host);
    Object matched=selected==null?null:selected.get("canonical_host");
    if(!payload.containsKey("matched_policy_host")||!Objects.equals(matched,payload.get("matched_policy_host")))
      throw new ApiFailure(422,"POLICY_MISMATCH");
    if(!(payload.get("blocked_reasons") instanceof List<?> reasons)) throw new ApiFailure(422,"INVALID_SCHEMA");
    if(reasons.stream().anyMatch(r->!(r instanceof String))) throw new ApiFailure(422,"INVALID_SCHEMA");
    if(new HashSet<>(reasons).size()!=reasons.size()) throw new ApiFailure(422,"INVALID_SCHEMA");
    String primary=Objects.toString(payload.get("reason"),"");
    if(type.equals("RECORDED_ACCESS")) {
      if(!reasons.isEmpty()||selected==null||!"RECORD".equals(selected.get("access_policy"))||!primary.equals("RECORD"))
        throw new ApiFailure(422,"POLICY_MISMATCH");
      return;
    }
    var order=List.of("USER_SITE","ADULT_DOMAIN","KEYWORD","FEATURE");
    if(reasons.isEmpty()||!order.containsAll(reasons)||!primary.equals(order.stream().filter(reasons::contains).findFirst().orElse("")))
      throw new ApiFailure(422,"INVALID_SCHEMA");
    for(Object reason:reasons) {
      if(reason.equals("USER_SITE")) {
        if(selected==null||!"BLOCK".equals(selected.get("access_policy"))) throw new ApiFailure(422,"POLICY_MISMATCH");
      } else if(reason.equals("FEATURE")) {
        var legacy=new LinkedHashMap<String,Object>(payload);
        legacy.put("target_key","FEATURE:"+host+":"+payload.get("feature_code"));
        validate(snapshot,"BLOCKED_FEATURE_ACCESS",legacy);
      } else {
        String key=reason.equals("ADULT_DOMAIN")?"adult_domains":"keywords";
        var content=(Map<?,?>)snapshot.get("content_policy");var policy=(Map<?,?>)content.get(key);
        if(!Boolean.TRUE.equals(policy.get("enabled"))) throw new ApiFailure(422,"POLICY_MISMATCH");
        for(Object item:(List<?>)policy.get("exceptions")) {
          if(!(item instanceof Map<?,?> exception)||!(exception.get("host") instanceof String domain)
              ||!(exception.get("include_subdomains") instanceof Boolean)) throw new ApiFailure(422,"INVALID_SNAPSHOT");
          if(host.equals(domain)||Boolean.TRUE.equals(exception.get("include_subdomains"))&&host.endsWith("."+domain))
            throw new ApiFailure(422,"POLICY_MISMATCH");
        }
      }
    }
  }
}
