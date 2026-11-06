package kr.ac.kdu.focurve;
import org.junit.jupiter.api.*;import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.*;
/** Intentional failure probe; opt-in, local marker files only, NEVER database/network. */
@EnabledIfSystemProperty(named="p1.failfast.probe",matches="true")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class) @Execution(ExecutionMode.SAME_THREAD)
class P1FailFastProbeTest {
 @org.junit.jupiter.api.extension.RegisterExtension static final P1StopOnFirstFailure stopOnFirstFailure=new P1StopOnFirstFailure();

 @Test @Order(1) void firstFailure(){Assertions.fail("intentional first failure, must prevent following method");}
 @Test @Order(2) void secondMustNotRun()throws Exception{
  java.nio.file.Files.writeString(java.nio.file.Path.of(System.getProperty("p1.failfast.marker")),"SECOND METHOD EXECUTED");
 }
}
