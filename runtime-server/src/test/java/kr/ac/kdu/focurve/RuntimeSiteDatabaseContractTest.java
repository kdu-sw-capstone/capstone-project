package kr.ac.kdu.focurve;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.mock;
import org.springframework.transaction.PlatformTransactionManager;

/** Product route -> product service -> synthetic JDBC boundary; no live DB/auth. */
class RuntimeSiteDatabaseContractTest {
 static final class Database extends JdbcTemplate {
  final List<String> sql=new ArrayList<>();final List<List<Object>> parameters=new ArrayList<>();
  public List<Map<String,Object>> queryForList(String query,Object...args){
   sql.add(query);parameters.add(Arrays.asList(args));
   if(query.contains("site_feature_policies"))return List.of();
   if(!query.contains("FROM sites"))throw new AssertionError("Unexpected SQL");
   Object owner=query.contains("WHERE id=?")?args[1]:args[0];if(!owner.equals(1L))return List.of();
   var row=new LinkedHashMap<String,Object>();row.put("id",1L);row.put("user_id",1L);row.put("canonical_host","example.com");row.put("display_name","통합 사이트");row.put("include_subdomains",true);row.put("purpose","DISTRACTION");row.put("access_policy","RECORD");row.put("version",3L);row.put("created_at",Timestamp.from(Instant.parse("2026-10-25T00:00:00Z")));row.put("updated_at",row.get("created_at"));row.put("deleted_at",null);return List.of(row);
  }
 }
 static final class Authentication extends MemberAuth {
  long user=1;boolean authenticated=true;boolean mutationRequested;
  Authentication(Database db){super(db,new ObjectMapper(),"https://localhost:18447",Base64.getEncoder().encodeToString(new byte[32]),"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/popup/popup.html");}
  @Override Identity identity(HttpServletRequest req,boolean mutate){mutationRequested=mutate;if(!authenticated)throw new Failure(401,"UNAUTHENTICATED");return new Identity(user,null);}
 }
 record Fixture(Database db,Authentication auth,MemberMvpApi route){}
 Fixture fixture(){var db=new Database();var auth=new Authentication(db);var sites=new MemberSites(auth,null);return new Fixture(db,auth,new MemberMvpApi(auth,null,sites,null,null,null,null,mock(PlatformTransactionManager.class)));}
 @Test void webListResponseUsesActualOwnerBoundSqlAndSavedPolicy(){
  var f=fixture();var req=new MockHttpServletRequest("GET","/api/v1/sites");var result=f.route.route(req,new MockHttpServletResponse(),f.auth.json.createObjectNode());
  assertThat(result.status()).isEqualTo(200);assertThat(result.body().path("items").get(0).path("access_policy").asText()).isEqualTo("RECORD");assertThat(result.body().path("items").get(0).path("version").asLong()).isEqualTo(3);assertThat(f.auth.mutationRequested).isFalse();assertThat(f.db.sql.getFirst()).contains("user_id=?");assertThat(f.db.parameters.getFirst().getFirst()).isEqualTo(1L);
 }
 @Test void anotherMemberCannotReadTheFirstMembersSite(){
  var f=fixture();f.auth.user=2;var req=new MockHttpServletRequest("GET","/api/v1/sites/1");assertThatThrownBy(()->f.route.route(req,new MockHttpServletResponse(),f.auth.json.createObjectNode())).isInstanceOf(MemberAuth.Failure.class).hasMessage("SITE_NOT_FOUND");assertThat(f.db.parameters.getFirst()).containsExactly("1",2L);
 }
 @Test void unauthenticatedReadNeverQueriesTheDatabase(){
  var f=fixture();f.auth.authenticated=false;var req=new MockHttpServletRequest("GET","/api/v1/sites");assertThatThrownBy(()->f.route.route(req,new MockHttpServletResponse(),f.auth.json.createObjectNode())).hasMessage("UNAUTHENTICATED");assertThat(f.db.sql).isEmpty();
 }
 @Test void unsupportedSearchParameterIsNotSilentlyTreatedAsServerSearch(){
  var f=fixture();var req=new MockHttpServletRequest("GET","/api/v1/sites");req.addParameter("search","private phrase");assertThatThrownBy(()->f.route.route(req,new MockHttpServletResponse(),f.auth.json.createObjectNode())).isInstanceOf(MemberAuth.Failure.class);assertThat(f.db.sql).isEmpty();
 }
 @Test void sharedWebFixtureMatchesTheActualProductRouteAndSerialization()throws Exception{
  var f=fixture();var result=f.route.route(new MockHttpServletRequest("GET","/api/v1/sites"),new MockHttpServletResponse(),f.auth.json.createObjectNode());
  var expected=f.auth.json.readTree(java.nio.file.Files.readString(java.nio.file.Path.of("../contracts/fixtures/site-list.json")));assertThat(f.auth.json.readTree(result.body().toString())).isEqualTo(expected);
 }
}
