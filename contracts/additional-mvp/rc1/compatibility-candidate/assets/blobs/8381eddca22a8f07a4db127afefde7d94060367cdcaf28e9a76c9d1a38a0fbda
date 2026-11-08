-- Independent candidate only. Additive migration; original reports/receipts/body remain intact.
CREATE TABLE auth_challenges (
 id CHAR(36) PRIMARY KEY,user_id BIGINT NULL,kind VARCHAR(24) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,provider VARCHAR(16) NULL,state_hash CHAR(64) NULL,
 nonce_hash CHAR(64) NULL,payload JSON NOT NULL,expires_at DATETIME(3) NOT NULL,
 consumed_at DATETIME(3) NULL,FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE auth_mail_outbox (
 id CHAR(36) PRIMARY KEY,challenge_id CHAR(36) NOT NULL UNIQUE,recipient VARCHAR(254) NOT NULL,
 kind VARCHAR(24) NOT NULL,token_cipher TEXT NOT NULL,status VARCHAR(24) NOT NULL,
 created_at DATETIME(3) NOT NULL,sent_at DATETIME(3) NULL,
 FOREIGN KEY(challenge_id) REFERENCES auth_challenges(id)
);
CREATE INDEX ix_auth_challenge_user_kind ON auth_challenges(user_id,kind,expires_at);
ALTER TABLE web_sessions ADD reauthenticated_at DATETIME(3) NULL;
ALTER TABLE web_sessions ADD logout_executor_id CHAR(36) NULL,
 ADD FOREIGN KEY(logout_executor_id) REFERENCES extension_installations(id);
ALTER TABLE policy_snapshots ADD source_version BIGINT NOT NULL DEFAULT 1,
 ADD catalog_version VARCHAR(80) NULL,ADD model_profile_version VARCHAR(80) NULL;
UPDATE policy_snapshots SET source_version=COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.source_version')) AS UNSIGNED),1);
ALTER TABLE focus_sessions ADD source VARCHAR(16) NULL,ADD origin VARCHAR(16) NULL,
 ADD record_status VARCHAR(24) NULL,ADD active_duration_ms BIGINT NOT NULL DEFAULT 0,
 ADD overrun_ms BIGINT NOT NULL DEFAULT 0,ADD version BIGINT NOT NULL DEFAULT 1,
 ADD started_at DATETIME(3) NULL,ADD planned_end_at DATETIME(3) NULL,
 ADD ended_at DATETIME(3) NULL,ADD policy_released_at DATETIME(3) NULL,
 ADD end_reason VARCHAR(40) NULL,ADD last_error_code VARCHAR(80) NULL;
UPDATE focus_sessions SET source=JSON_UNQUOTE(JSON_EXTRACT(body,'$.source')),
 origin=JSON_UNQUOTE(JSON_EXTRACT(body,'$.origin')),
 record_status=JSON_UNQUOTE(JSON_EXTRACT(body,'$.record_status')),
 active_duration_ms=COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(body,'$.active_duration_ms')) AS UNSIGNED),0),
 overrun_ms=COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(body,'$.overrun_ms')) AS UNSIGNED),0),
 version=COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(body,'$.version')) AS UNSIGNED),1),
 started_at=STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(body,'$.started_at')),'null'),'%Y-%m-%dT%H:%i:%s.%fZ'),
 planned_end_at=STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(body,'$.planned_end_at')),'null'),'%Y-%m-%dT%H:%i:%s.%fZ'),
 ended_at=STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(body,'$.ended_at')),'null'),'%Y-%m-%dT%H:%i:%s.%fZ'),
 policy_released_at=STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(body,'$.policy_released_at')),'null'),'%Y-%m-%dT%H:%i:%s.%fZ'),
 end_reason=NULLIF(JSON_UNQUOTE(JSON_EXTRACT(body,'$.end_reason')),'null'),
 last_error_code=NULLIF(JSON_UNQUOTE(JSON_EXTRACT(body,'$.last_error_code')),'null');
ALTER TABLE focus_sessions MODIFY source VARCHAR(16) NOT NULL,MODIFY origin VARCHAR(16) NOT NULL,
 MODIFY record_status VARCHAR(24) NOT NULL,
 ADD CHECK(active_duration_ms>=0 AND overrun_ms>=0 AND version>=1);
ALTER TABLE content_policies ADD keywords JSON NULL,ADD adult_domains JSON NULL,
 ADD image_blur JSON NULL,ADD usage_tracking JSON NULL;
UPDATE content_policies SET keywords=JSON_EXTRACT(payload,'$.keywords'),
 adult_domains=JSON_EXTRACT(payload,'$.adult_domains'),image_blur=JSON_EXTRACT(payload,'$.image_blur'),
 usage_tracking=JSON_EXTRACT(payload,'$.usage_tracking');
ALTER TABLE access_events ADD feature_code VARCHAR(50) NULL;
ALTER TABLE operations ADD error_code VARCHAR(80) NULL;
CREATE INDEX ix_sessions_user_started ON focus_sessions(user_id,started_at,id);
CREATE INDEX ix_access_host_time ON access_events(target_host,occurred_at);
CREATE INDEX ix_commands_executor_state ON execution_commands(executor_id,status,created_at);
