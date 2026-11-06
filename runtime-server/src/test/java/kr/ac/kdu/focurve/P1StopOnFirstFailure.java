package kr.ac.kdu.focurve;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.extension.*;
/** Per-class latch. Pair with SAME_THREAD; never retries or suppresses the original failure. */
final class P1StopOnFirstFailure implements ExecutionCondition,TestWatcher {
 private final AtomicBoolean failed=new AtomicBoolean();
 @Override public ConditionEvaluationResult evaluateExecutionCondition(ExtensionContext context){
  return failed.get()?ConditionEvaluationResult.disabled("Prior method failed; remaining execution prohibited"):
    ConditionEvaluationResult.enabled("No prior failure");
 }
 @Override public void testFailed(ExtensionContext context,Throwable cause){failed.set(true);}
 @Override public void testAborted(ExtensionContext context,Throwable cause){failed.set(true);}
}
