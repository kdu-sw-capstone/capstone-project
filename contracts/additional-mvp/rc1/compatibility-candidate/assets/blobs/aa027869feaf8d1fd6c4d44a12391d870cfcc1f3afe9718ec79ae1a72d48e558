CREATE TABLE extension_installations (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 current_user_id BIGINT NULL,
 proof_hash VARCHAR(255) NOT NULL,
 client_version VARCHAR(40) NOT NULL,
 last_seen_at DATETIME(3) NULL,
 FOREIGN KEY(current_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE link_requests (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 approved_user_id BIGINT NULL,
 code_challenge VARCHAR(128) NOT NULL,
 callback_uri VARCHAR(2048) NOT NULL,
 state_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 code_hash CHAR(64) COLLATE ascii_bin NULL,
 expires_at DATETIME(3) NOT NULL,
 consumed_at DATETIME(3) NULL,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(approved_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE extension_tokens (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 user_id BIGINT NOT NULL,
 refresh_hash CHAR(64) COLLATE ascii_bin NOT NULL UNIQUE,
 family_id CHAR(36) COLLATE ascii_bin NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 revoked_at DATETIME(3) NULL,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE extension_access_tokens (
 token_hash CHAR(64) COLLATE ascii_bin PRIMARY KEY,
 refresh_id CHAR(36) COLLATE ascii_bin NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 FOREIGN KEY(refresh_id) REFERENCES extension_tokens(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE policy_snapshots (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 user_id BIGINT NOT NULL,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 format_version VARCHAR(8) NOT NULL,
 payload JSON NOT NULL,
 source_version BIGINT NOT NULL,
 catalog_version VARCHAR(80) NULL,
 model_profile_version VARCHAR(80) NULL,
 created_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_snapshot_owner(id,user_id,executor_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE focus_sessions (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 source_session_id CHAR(36) COLLATE ascii_bin NOT NULL,
 user_id BIGINT NOT NULL,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 policy_snapshot_id CHAR(36) COLLATE ascii_bin NOT NULL,
 source VARCHAR(16) NOT NULL,
 origin VARCHAR(16) NOT NULL,
 execution_status VARCHAR(24) NOT NULL,
 record_status VARCHAR(24) NOT NULL,
 duration_minutes INT NOT NULL,
 active_duration_ms BIGINT NOT NULL,
 overrun_ms BIGINT NOT NULL,
 desired_revision BIGINT NOT NULL,
 version BIGINT NOT NULL,
 started_at DATETIME(3) NULL,
 planned_end_at DATETIME(3) NULL,
 ended_at DATETIME(3) NULL,
 policy_released_at DATETIME(3) NULL,
 end_reason VARCHAR(40) NULL,
 last_error_code VARCHAR(80) NULL,
 UNIQUE KEY uq_session_source(user_id,executor_id,source_session_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(policy_snapshot_id,user_id,executor_id) REFERENCES policy_snapshots(id,user_id,executor_id) ON DELETE RESTRICT,
 CHECK(duration_minutes BETWEEN 1 AND 180), CHECK(active_duration_ms>=0),CHECK(overrun_ms>=0),
 KEY ix_session_date(user_id,started_at,id)
) ENGINE=InnoDB;
CREATE TABLE session_intervals (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 session_id BIGINT NOT NULL,
 kind VARCHAR(8) NOT NULL,
 start_at DATETIME(3) NOT NULL,
 end_at DATETIME(3) NULL,
 duration_ms BIGINT NULL,
 quality VARCHAR(20) NOT NULL,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT,
 CHECK(duration_ms IS NULL OR duration_ms>=0)
) ENGINE=InnoDB;
CREATE TABLE active_execution_locks (
 user_id BIGINT PRIMARY KEY,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL UNIQUE,
 session_id BIGINT NOT NULL UNIQUE,
 revision BIGINT NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE execution_commands (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 session_id BIGINT NOT NULL,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 desired_revision BIGINT NOT NULL,
 kind VARCHAR(24) NOT NULL,
 payload JSON NOT NULL,
 status VARCHAR(20) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 execute_before DATETIME(3) NULL,
 UNIQUE KEY uq_command_revision(session_id,desired_revision,kind),
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE execution_reports (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 session_id BIGINT NOT NULL,
 command_id CHAR(36) COLLATE ascii_bin NULL,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 desired_revision BIGINT NOT NULL,
 payload_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 result VARCHAR(24) NOT NULL,
 observed_at DATETIME(3) NOT NULL,
 payload JSON NOT NULL,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT,
 FOREIGN KEY(command_id) REFERENCES execution_commands(id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE operations (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 user_id BIGINT NOT NULL,
 resource_id VARCHAR(80) NOT NULL,
 status VARCHAR(20) NOT NULL,
 error_code VARCHAR(80) NULL,
 created_at DATETIME(3) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE event_receipts (
 event_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_user_id BIGINT NOT NULL,
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 resolved_session_id BIGINT NULL,
 schema_version VARCHAR(8) NOT NULL,
 event_type VARCHAR(40) NOT NULL,
 payload_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 payload JSON NOT NULL,
 status VARCHAR(24) NOT NULL,
 received_at DATETIME(3) NOT NULL,
 FOREIGN KEY(owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(resolved_session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE access_events (
 event_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 session_id BIGINT NOT NULL,
 occurred_at DATETIME(3) NOT NULL,
 access_seq BIGINT NOT NULL,
 target_kind VARCHAR(16) NOT NULL,
 target_host VARCHAR(253) NOT NULL,
 target_key VARCHAR(320) NOT NULL,
 feature_code VARCHAR(50) NULL,
 reason VARCHAR(40) NOT NULL,
 navigation_id CHAR(36) COLLATE ascii_bin NOT NULL,
 policy_snapshot_id CHAR(36) COLLATE ascii_bin NOT NULL,
 UNIQUE KEY uq_access_seq(session_id,access_seq),
 UNIQUE KEY uq_navigation_target(session_id,navigation_id,target_key),
 FOREIGN KEY(event_id) REFERENCES event_receipts(event_id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT,
 FOREIGN KEY(policy_snapshot_id) REFERENCES policy_snapshots(id) ON DELETE RESTRICT,
 CHECK(access_seq>0),KEY ix_access_target(target_host,occurred_at)
) ENGINE=InnoDB;
CREATE TABLE session_lifecycle_events (
 event_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 session_id BIGINT NOT NULL,
 occurred_at DATETIME(3) NOT NULL,
 event_type VARCHAR(40) NOT NULL,
 desired_revision BIGINT NOT NULL,
 FOREIGN KEY(event_id) REFERENCES event_receipts(event_id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
