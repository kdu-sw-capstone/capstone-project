package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.*;
import java.util.Map;
import static kr.ac.kdu.focurve.MemberAuth.*;

/** Concrete conservative verifier for an already-registered, unchanged boot and a natural day.
 * Registration/restart/transition-day and quota-carry proof remain the Core/clock authority's job.
 * No bean is auto-enabled and the skew tolerance must be selected by the server's approved profile. */
final class AmvpRegisteredClockProof implements AmvpUsageReceiver.ClockProof {
 private final MemberAuth auth;private final Duration skew;
 AmvpRegisteredClockProof(MemberAuth auth,Duration approvedWallSkew){this.auth=auth;skew=java.util.Objects.requireNonNull(approvedWallSkew);check(!skew.isNegative(),422,"VALIDATION_FAILED");}
 public AmvpUsageReceiver.VerifiedCapture verify(Identity principal,AmvpBridgeSupport.Binding binding,ObjectNode segment,String predecessor){
  var uncertain=AmvpUsageReceiver.VerifiedCapture.quarantine();var c=segment.path("clock");if(!c.path("quality").asText().equals("TRUSTED"))return uncertain;
  var anchor=auth.one("SELECT * FROM amvp_clock_anchors WHERE anchor_id=? AND owner_binding_id=? AND executor_id=? AND verification_state='VERIFIED'",c.path("anchor_id").asText(),binding.id(),binding.executor());
  if(anchor==null||!anchor.get("clock_epoch").equals(c.path("clock_epoch").asText())||!anchor.get("boot_id").equals(c.path("boot_id").asText())||((Number)anchor.get("anchor_mono_ms")).longValue()!=c.path("anchor_mono_ms").asLong()||!Instant.parse(instant(anchor.get("anchor_utc"))).equals(Instant.parse(c.path("anchor_utc").asText())))return uncertain;
  // Resetting collector_epoch is not restart proof. Preserve uncertainty across every collector.
  var incompatible=auth.one("SELECT segment_id FROM amvp_usage_segments WHERE executor_id=? AND (clock_epoch IS NULL OR clock_boot_id IS NULL OR clock_epoch<>? OR clock_boot_id<>?) LIMIT 1",binding.executor(),c.path("clock_epoch").asText(),c.path("boot_id").asText());if(incompatible!=null)return uncertain;
  Instant start=Instant.parse(segment.path("start_at").asText()),end=Instant.parse(segment.path("end_at").asText());ZoneId zone=ZoneId.of(segment.path("timezone").asText());var date=start.atZone(zone).toLocalDate();
  if(!date.atStartOfDay(zone).toInstant().equals(Instant.parse(segment.path("day_start_at").asText()))||!date.plusDays(1).atStartOfDay(zone).toInstant().equals(Instant.parse(segment.path("day_end_at").asText())))return uncertain;
  if(Duration.between(start,Instant.parse(c.path("observed_wall_start_at").asText())).abs().compareTo(skew)>0||Duration.between(end,Instant.parse(c.path("observed_wall_end_at").asText())).abs().compareTo(skew)>0)return uncertain;
  return new AmvpUsageReceiver.VerifiedCapture(true,Map.of());
 }
}
