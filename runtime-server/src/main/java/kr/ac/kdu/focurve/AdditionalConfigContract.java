package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.*;
import java.time.*;
import java.util.*;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Consumes the approved repository schema unchanged; never issues execution authority. */
final class AdditionalConfigContract {
 static final long MAX_VERSION=9007199254740991L;
 private final ObjectNode root;
 private final Map<String,JsonSchema> schemas=new HashMap<>();
 AdditionalConfigContract(ObjectMapper json) {
  try(var input=getClass().getResourceAsStream("/amvp/rc2/schema.json")) {
   if(input==null)throw new IllegalStateException("RC2_SCHEMA_MISSING");
   root=(ObjectNode)json.readTree(input);
  }catch(java.io.IOException e){throw new IllegalStateException("RC2_SCHEMA_UNREADABLE",e);}
 }
 synchronized void validate(String definition,JsonNode value) {
  JsonSchema schema=schemas.computeIfAbsent(definition,name->{
   if(!root.path("$defs").has(name))throw new IllegalArgumentException("UNKNOWN_DEFINITION");
   ObjectNode selected=root.deepCopy();selected.remove("oneOf");selected.put("$ref","#/$defs/"+name);
   var config=SchemaValidatorsConfig.builder().formatAssertionsEnabled(true).build();
   return JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012).getSchema(selected,config);
  });
  check(schema.validate(value).isEmpty(),422,"VALIDATION_FAILED");
  semantic(value);
 }
 private void semantic(JsonNode node) {
  check(!node.isFloatingPointNumber(),422,"VALIDATION_FAILED");
  if(node.isObject()) {
   if(node.has("timezone")) {
    try {check(ZoneId.getAvailableZoneIds().contains(node.path("timezone").asText()),422,"INVALID_TIMEZONE");}
    catch(DateTimeException e){throw new Failure(422,"INVALID_TIMEZONE");}
   }
   if(node.has("start_at")&&node.has("end_at"))
    check(Instant.parse(node.path("start_at").asText()).isBefore(Instant.parse(node.path("end_at").asText())),422,"VALIDATION_FAILED");
   if(node.has("end_local")) {
    long duration=LocalTime.parse(node.path("end_local").asText()).toSecondOfDay()-LocalTime.parse(node.path("start_local").asText()).toSecondOfDay()+86400L*node.path("end_day_offset").asInt();
    check(duration>0&&duration<=86400,422,"VALIDATION_FAILED");
   }
   // Same ID with opposite enabled values is not made distinct by JSON uniqueItems.
   for(String array:List.of("features","windows"))if(node.has(array)) {
    Set<String> ids=new HashSet<>();String field=array.equals("features")?"feature_id":"window_id";
    for(JsonNode row:node.path(array))check(ids.add(row.path(field).asText()),422,"VALIDATION_FAILED");
   }
   if(node.has("host"))check(MemberSites.host(node.path("host").asText()).equals(node.path("host").asText()),422,"VALIDATION_FAILED");
   node.elements().forEachRemaining(this::semantic);
  }else if(node.isArray())node.elements().forEachRemaining(this::semantic);
 }
 static long next(long version) {check(version>=0&&version<MAX_VERSION,422,"VERSION_LIMIT");return version+1;}
 static void precondition(String match,String none,Long current) {
  check(!(match!=null&&none!=null),422,"VALIDATION_FAILED");
  check(match!=null||none!=null,428,"PRECONDITION_REQUIRED");
  if(current==null)check("*".equals(none),412,"VERSION_CONFLICT");
  else check(('"'+Long.toString(current)+'"').equals(match),412,"VERSION_CONFLICT");
 }
 static String canonical(JsonNode node) {
  if(node.isObject()) {var keys=new ArrayList<String>();node.fieldNames().forEachRemaining(keys::add);Collections.sort(keys);var parts=new ArrayList<String>();for(String key:keys)parts.add(new com.fasterxml.jackson.databind.node.TextNode(key)+":"+canonical(node.get(key)));return "{"+String.join(",",parts)+"}";}
  if(node.isArray()){var parts=new ArrayList<String>();node.forEach(value->parts.add(canonical(value)));return "["+String.join(",",parts)+"]";}
  return node.toString();
 }
}
