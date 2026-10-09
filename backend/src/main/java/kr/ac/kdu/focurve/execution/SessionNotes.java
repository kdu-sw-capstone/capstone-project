package kr.ac.kdu.focurve.execution;

import java.util.*;
import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.api.DbTime;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionNotes {
  private final JdbcTemplate db;
  private final ExecutionService sessions;
  public SessionNotes(JdbcTemplate db, ExecutionService sessions) { this.db=db;this.sessions=sessions; }

  public Map<String,Object> get(long owner,String uuid) {
    long id=((Number)sessions.byUuid(owner,uuid).get("id")).longValue();
    var rows=db.queryForList("SELECT text,version,updated_at FROM session_notes WHERE session_id=?",id);
    var out=new LinkedHashMap<String,Object>();out.put("session_id",uuid);
    if(rows.isEmpty()){out.put("text","");out.put("version",0L);}else{var row=rows.getFirst();out.put("text",row.get("text"));out.put("version",row.get("version"));out.put("updated_at",DbTime.instant(row.get("updated_at")).toString());}
    return out;
  }
  @Transactional
  public Map<String,Object> put(long owner,String uuid,String match,Map<String,Object> input) {
    long id=((Number)sessions.byUuid(owner,uuid).get("id")).longValue();
    // Lock the owning session so two first writes to an absent note serialize too.
    db.queryForList("SELECT id FROM focus_sessions WHERE id=? AND user_id=? FOR UPDATE",id,owner);
    var old=get(owner,uuid);
    if(match==null)throw new ApiFailure(428,"PRECONDITION_REQUIRED");
    if(!match.equals("\""+old.get("version")+"\""))throw new ApiFailure(412,"VERSION_CONFLICT");
    if(!input.keySet().equals(Set.of("text"))||!(input.get("text") instanceof String text)||text.codePointCount(0,text.length())>2000)throw new ApiFailure(422,"VALIDATION_FAILED");
    db.update("INSERT INTO session_notes(session_id,text,version,updated_at) VALUES (?,?,1,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE text=?,version=version+1,updated_at=UTC_TIMESTAMP(3)",id,text,text);
    return get(owner,uuid);
  }
}
