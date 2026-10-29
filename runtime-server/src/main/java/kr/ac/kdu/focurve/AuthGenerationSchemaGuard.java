package kr.ac.kdu.focurve;
import org.springframework.stereotype.Component;import org.springframework.context.annotation.Profile;import org.springframework.jdbc.core.JdbcTemplate;
@Component @Profile("member-runtime | local-integration")
class AuthGenerationSchemaGuard {
 final JdbcTemplate db;AuthGenerationSchemaGuard(JdbcTemplate db){this.db=db;}
 @jakarta.annotation.PostConstruct void verify(){Long count=db.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name IN ('users','web_sessions','extension_tokens') AND column_name='auth_version') OR (table_name='link_requests' AND column_name='approved_auth_version'))",Long.class);if(count==null||count!=4)throw new IllegalStateException("AUTH_GENERATION_SCHEMA_REQUIRED");}
}
