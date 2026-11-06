package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.*;import java.util.*;import java.nio.file.*;
/** Test-only allowlisted timing evidence; never serializes a complete request, row or token. */
final class P1TimeEvidence {
 final ObjectMapper json=new ObjectMapper();final List<Map<String,String>> stages=new ArrayList<>();private final Path path;
 P1TimeEvidence(Path path){this.path=path;try{Files.createDirectories(path.getParent());Files.createFile(path);}catch(java.io.IOException e){throw new IllegalStateException("EVIDENCE_PATH_MUST_BE_NEW",e);}}
 synchronized void payload(String stage,String payload){
  var values=new LinkedHashMap<String,String>();
  try(var parser=json.getFactory().createParser(payload)){
   com.fasterxml.jackson.core.JsonToken token;
   while((token=parser.nextToken())!=null){
    if(!token.isScalarValue())continue;
    var context=parser.getParsingContext();var parent=context.getParent();
    String field=parser.currentName();boolean top=parent!=null&&parent.inRoot();
    boolean original=parent!=null&&parent.inObject()&&"original".equals(parent.getCurrentName());
    boolean termination=parent!=null&&parent.inObject()&&"storedTermination".equals(parent.getCurrentName());
    String key=null;
    if((top||original)&&("createdAt".equals(field)||"expiresAt".equals(field)))key=field+"_json_literal";
    if((top||termination)&&"at".equals(field))key="terminationAt_json_literal";
    if(key!=null){String literal=token==com.fasterxml.jackson.core.JsonToken.VALUE_STRING?json.writeValueAsString(parser.getText()):parser.getText();values.put(key,literal);}
   }
   literals(stage,values);
  }catch(java.io.IOException e){throw new IllegalStateException("TIMING_EVIDENCE_UNCONFIRMED",e);}
 }
 synchronized void literals(String stage,Map<String,String> input){
  var row=new LinkedHashMap<String,String>();row.put("stage",stage);
  Set<String> allowed=Set.of("inputClock","expectedCreatedAt","expectedExpiresAt","createdAt_json_literal","expiresAt_json_literal","terminationAt_json_literal","casRevision");
  input.forEach((key,value)->{if(allowed.contains(key)&&value!=null)row.put(key,value);});stages.add(Map.copyOf(row));
  try{Files.writeString(path,json.writeValueAsString(row)+"\n",StandardOpenOption.APPEND);}catch(java.io.IOException e){throw new IllegalStateException("TIMING_EVIDENCE_UNCONFIRMED",e);}
 }
 void assertExact(String created,String expires){
  for(var row:stages){
   if(row.containsKey("createdAt_json_literal"))org.junit.jupiter.api.Assertions.assertEquals(json.valueToTree(created).toString(),row.get("createdAt_json_literal"),row.get("stage"));
   if(row.containsKey("expiresAt_json_literal"))org.junit.jupiter.api.Assertions.assertEquals(json.valueToTree(expires).toString(),row.get("expiresAt_json_literal"),row.get("stage"));
  }
 }
 void assertTermination(String value){
  for(var row:stages)if(row.containsKey("terminationAt_json_literal"))org.junit.jupiter.api.Assertions.assertEquals(json.valueToTree(value).toString(),row.get("terminationAt_json_literal"),row.get("stage"));
 }

 void requireStages(String... expected){
  var actual=stages.stream().map(row->row.get("stage")).collect(java.util.stream.Collectors.toSet());
  for(String stage:expected)org.junit.jupiter.api.Assertions.assertTrue(actual.contains(stage),"Missing evidence stage: "+stage);
 }

}
