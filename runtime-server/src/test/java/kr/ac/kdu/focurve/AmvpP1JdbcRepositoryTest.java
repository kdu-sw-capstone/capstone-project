package kr.ac.kdu.focurve;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static kr.ac.kdu.focurve.AmvpP1Preparation.*;

/** Transaction-manager/SQL-boundary mocks only, not actual MySQL evidence. */
class AmvpP1JdbcRepositoryTest {
 @Test void resultIsReturnedAfterManagerCommitAndCommitFailurePropagates(){
   JdbcTemplate db=mock(JdbcTemplate.class);PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
   var status=new SimpleTransactionStatus();when(manager.getTransaction(any())).thenReturn(status);
   var repository=new AmvpP1JdbcRepository(db,manager,new ObjectMapper());
   String result=repository.atomic(true,tx->"stored");assertEquals("stored",result);verify(manager).commit(status);
   doThrow(new IllegalStateException("commit unconfirmed")).when(manager).commit(status);
   assertThrows(IllegalStateException.class,()->repository.atomic(true,tx->"not acknowledged"));
 }
 @Test void failedWorkRollsBackAndReadPathCannotWrite(){
   JdbcTemplate db=mock(JdbcTemplate.class);PlatformTransactionManager manager=mock(PlatformTransactionManager.class);
   var status=new SimpleTransactionStatus();when(manager.getTransaction(any())).thenReturn(status);
   var repository=new AmvpP1JdbcRepository(db,manager,new ObjectMapper());
   assertThrows(IllegalStateException.class,()->repository.atomic(true,tx->{throw new IllegalStateException("failed validation");}));verify(manager).rollback(status);
   assertThrows(Rejected.class,()->repository.atomic(false,tx->{tx.saveJournal(new RequestKey(UUID.randomUUID(),1,UUID.randomUUID()),new Journal("x","x","x","x",null));return null;}));
   verifyNoInteractions(db);
 }
 @Test void unknownOuterTransactionCannotProducePrematureCommitAck(){
   var repository=new AmvpP1JdbcRepository(mock(JdbcTemplate.class),mock(PlatformTransactionManager.class),new ObjectMapper());
   TransactionSynchronizationManager.setActualTransactionActive(true);
   try {assertEquals("OUTERMOST_COMMIT_REQUIRED",assertThrows(Rejected.class,()->repository.atomic(true,tx->"early")).internalReason);}
   finally {TransactionSynchronizationManager.setActualTransactionActive(false);}
 }
}
