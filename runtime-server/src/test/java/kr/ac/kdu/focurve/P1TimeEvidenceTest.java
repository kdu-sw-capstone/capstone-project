package kr.ac.kdu.focurve;
import org.junit.jupiter.api.*;import org.junit.jupiter.api.io.TempDir;import java.nio.file.*;import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class P1TimeEvidenceTest {
 @TempDir Path temp;
 @Test void onlyTimeLiteralsAreWrittenAndNestedOriginalIsSupported()throws Exception{
  var p=temp.resolve("times.json");var e=new P1TimeEvidence(p);
  e.payload("bind","{\"original\":{\"createdAt\":\"2026-11-06T00:00:00.149Z\",\"expiresAt\":\"2026-11-06T00:05:00.149Z\",\"user\":123,\"secret\":\"DO_NOT_WRITE\"},\"access_token\":\"DO_NOT_WRITE\"}");
  e.assertExact("2026-11-06T00:00:00.149Z","2026-11-06T00:05:00.149Z");
  e.payload("cancel","{\"storedTermination\":{\"at\":\"2026-11-06T00:00:00.149Z\"},\"refresh_token\":\"DO_NOT_WRITE\"}");e.assertTermination("2026-11-06T00:00:00.149Z");
  String text=Files.readString(p);assertFalse(text.contains("DO_NOT_WRITE"));assertFalse(text.contains("123"));assertFalse(text.contains("access_token"));
 }
 @Test void precisionMismatchAndNumericTimestampAreNotHiddenByEvidence(){
  var e=new P1TimeEvidence(temp.resolve("times.json"));e.payload("db","{\"createdAt\":1793939979.149012}");
  assertThrows(AssertionError.class,()->e.assertExact("2026-11-06T04:39:39.149Z","unused"));
 }
 @Test void safeClockInputAndCasCanBeCapturedWithoutArbitraryMetadata()throws Exception{
  var p=temp.resolve("times.json");var e=new P1TimeEvidence(p);e.literals("input",Map.of("inputClock","clock","casRevision","2","Authorization","NEVER"));
  assertFalse(Files.readString(p).contains("NEVER"));
 }
 @Test void numericTimeLexemeIsCapturedWithoutFloatingConversionAndExistingEvidenceIsProtected()throws Exception{
  var p=temp.resolve("exact.jsonl");var e=new P1TimeEvidence(p);e.payload("jdbc","{\"createdAt\":1793939979.149011900}");
  assertTrue(Files.readString(p).contains("1793939979.149011900"));
  assertThrows(IllegalStateException.class,()->new P1TimeEvidence(p));assertThrows(AssertionError.class,()->e.requireStages("missing"));
 }

}
