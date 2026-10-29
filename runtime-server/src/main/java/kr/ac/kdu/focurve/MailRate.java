package kr.ac.kdu.focurve;
import java.util.*;import java.util.concurrent.ConcurrentHashMap;import static kr.ac.kdu.focurve.MemberAuth.*;
final class MailRate {
 private final ConcurrentHashMap<String,ArrayDeque<Long>> buckets=new ConcurrentHashMap<>();
 void admit(String hash,long now){var q=buckets.computeIfAbsent(hash,k->new ArrayDeque<>());synchronized(q){while(!q.isEmpty()&&q.getFirst()<=now-3600000)q.removeFirst();check(q.size()<5&&(q.isEmpty()||now-q.getLast()>=60000),429,"MAIL_RATE_LIMITED");q.addLast(now);}}
}
