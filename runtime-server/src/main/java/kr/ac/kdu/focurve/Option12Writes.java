package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.function.Supplier;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Caller holds the users row lock inside its transaction. */
final class Option12Writes {
 static final long MAX=9007199254740991L;
 static long next(long value){check(value<MAX,409,"VERSION_CONFLICT");return value+1;}
 static void expected(String match,long version){
  check(match!=null,428,"PRECONDITION_REQUIRED");check(match.equals("\""+version+"\""),412,"VERSION_CONFLICT");
 }
 static ObjectNode once(MemberAuth auth,long user,String path,JsonNode body,String match,String key,Supplier<ObjectNode> write){
  check(key!=null&&key.matches("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"),422,"VALIDATION_FAILED");
  var fields=new java.util.TreeMap<String,JsonNode>();body.fields().forEachRemaining(e->fields.put(e.getKey(),e.getValue()));
  String owner="MEMBER:"+user,fp=hash(auth.json.valueToTree(fields).toString());
  var prior=auth.one("SELECT body_hash,response FROM idempotency_keys WHERE owner_key=? AND method='PUT' AND path=? AND request_key=?",owner,path,key);
  if(prior!=null){check(fp.equals(prior.get("body_hash")),409,"IDEMPOTENCY_CONFLICT");try{return (ObjectNode)auth.json.readTree(prior.get("response").toString());}catch(java.io.IOException e){throw new Failure(409,"READ_UNCONFIRMED");}}
  ObjectNode value=write.get();
  auth.db.update("INSERT INTO idempotency_keys VALUES(?,'PUT',?,?,?,?,?)",owner,path,key,fp,value.toString(),after(604800));return value;
 }
}
