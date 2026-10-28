package kr.ac.kdu.focurve;
import java.util.*;import java.nio.charset.StandardCharsets;import java.time.*;import com.fasterxml.jackson.databind.node.*;
import static kr.ac.kdu.focurve.MemberAuth.*;
final class Query {
 static String single(Map<String,String[]> q,String k,String fallback){String[] v=q.get(k);check(v==null||v.length==1,422,"VALIDATION_FAILED");return v==null?fallback:v[0];}
 static int limit(Map<String,String[]> q){try{int n=Integer.parseInt(single(q,"limit","20"));check(n>=1&&n<=100,422,"VALIDATION_FAILED");return n;}catch(NumberFormatException x){throw new Failure(422,"VALIDATION_FAILED");}}
 static long cursor(Map<String,String[]> q,String context){String c=single(q,"cursor",null);if(c==null)return 0;try{String s=new String(Base64.getUrlDecoder().decode(c),StandardCharsets.UTF_8),prefix=context+":";check(s.startsWith(prefix),400,"INVALID_CURSOR");long n=Long.parseLong(s.substring(prefix.length()));check(n>=0,400,"INVALID_CURSOR");return n;}catch(Exception x){throw new Failure(400,"INVALID_CURSOR");}}
 static String encode(String context,long value){return Base64.getUrlEncoder().withoutPadding().encodeToString((context+":"+value).getBytes(StandardCharsets.UTF_8));}
 static ObjectNode page(MemberAuth a,ArrayNode rows,boolean more,String cursor){return a.obj("items",rows,"next_cursor",cursor,"has_more",more);}
 static LocalDate[] dates(Map<String,String[]>q){String from=single(q,"from_date",null),to=single(q,"to_date",null);check(from!=null&&to!=null,422,"DATE_RANGE_REQUIRED");try{LocalDate a=LocalDate.parse(from),b=LocalDate.parse(to);check(!b.isBefore(a)&&java.time.temporal.ChronoUnit.DAYS.between(a,b)<366,422,"INVALID_DATE_RANGE");return new LocalDate[]{a,b};}catch(java.time.DateTimeException x){throw new Failure(422,"INVALID_DATE_RANGE");}}
 static void allowed(Map<String,String[]>q,String...names){Set<String> allow=Set.of(names);for(String k:q.keySet())check(allow.contains(k),422,"UNSUPPORTED_QUERY");}
}
