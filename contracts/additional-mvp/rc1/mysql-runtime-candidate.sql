-- REVIEW_PENDING: opt-in MySQL 8.4 candidate, NOT a numbered Flyway migration.
-- Existing users/extension_installations must exist. No UPDATE/DELETE of legacy data.
CREATE TABLE amvp_owner_bindings (
 binding_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 user_id BIGINT NOT NULL,
 owner_epoch BIGINT NOT NULL,
 state VARCHAR(24) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 closed_at DATETIME(3) NULL,
 UNIQUE KEY uq_amvp_binding_executor(binding_id,executor_id),
 UNIQUE KEY uq_amvp_owner_epoch(executor_id,owner_epoch),
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 CHECK(owner_epoch BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
CREATE TABLE amvp_configs (
 config_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 kind VARCHAR(24) NOT NULL,
 version BIGINT NOT NULL,
 value_json JSON NOT NULL,
 saved_runtime_revision BIGINT NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 deleted_at DATETIME(3) NULL,
 active_singleton_kind VARCHAR(24) GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL AND kind IN ('CONTENT','CADENCE') THEN kind ELSE NULL END) STORED,
 UNIQUE KEY uq_amvp_active_singleton(owner_binding_id,active_singleton_kind),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 CHECK(version BETWEEN 1 AND 9007199254740991),
 CHECK(kind IN ('CONTENT','SITE_TIME','FOCUS_SCHEDULE','CADENCE'))
) ENGINE=InnoDB;
CREATE TABLE amvp_packages (
 package_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 runtime_revision BIGINT NOT NULL,
 payload_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 issued_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_amvp_owner_package(owner_binding_id,package_id),
 UNIQUE KEY uq_amvp_package_revision(owner_binding_id,runtime_revision),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 CHECK(runtime_revision BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
CREATE TABLE amvp_timezone_states (
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin PRIMARY KEY,
 applied_zone VARCHAR(80) NOT NULL,
 applied_version BIGINT NOT NULL,
 desired_zone VARCHAR(80) NOT NULL,
 desired_version BIGINT NOT NULL,
 effective_at DATETIME(3) NOT NULL,
 tzdb_version VARCHAR(40) NOT NULL,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 CHECK(applied_version>=1 AND desired_version>=applied_version)
) ENGINE=InnoDB;
CREATE TABLE amvp_usage_segments (
 segment_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 collector_epoch CHAR(36) COLLATE ascii_bin NOT NULL,
 local_usage_seq BIGINT NOT NULL,
 actual_host VARCHAR(253) COLLATE ascii_bin NOT NULL,
 start_at DATETIME(3) NOT NULL,
 end_at DATETIME(3) NOT NULL,
 confirmed_ms BIGINT NOT NULL,
 uncertain_ms BIGINT NOT NULL,
 payload_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 clock_epoch VARCHAR(100) COLLATE ascii_bin NULL,
 clock_boot_id VARCHAR(100) COLLATE ascii_bin NULL,
 mono_start_ms BIGINT NULL,
 mono_end_ms BIGINT NULL,
 measurement_state VARCHAR(24) NOT NULL DEFAULT 'LEGACY_UNCONFIRMED',
 UNIQUE KEY uq_amvp_segment_scope_hash(segment_id,owner_binding_id,executor_id,payload_sha256),
 UNIQUE KEY uq_amvp_usage_seq(executor_id,collector_epoch,local_usage_seq),
 KEY ix_amvp_usage_owner_time(owner_binding_id,start_at,segment_id),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_binding_id,executor_id) REFERENCES amvp_owner_bindings(binding_id,executor_id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 CHECK(start_at<end_at),
 CHECK(confirmed_ms>=0 AND uncertain_ms>=0),
 CHECK(local_usage_seq BETWEEN 1 AND 9007199254740991),
 CHECK(measurement_state IN ('LEGACY_UNCONFIRMED','QUARANTINED','COUNTED')),
 CHECK((clock_epoch IS NULL AND clock_boot_id IS NULL AND mono_start_ms IS NULL AND mono_end_ms IS NULL) OR (clock_epoch IS NOT NULL AND clock_boot_id IS NOT NULL AND mono_start_ms IS NOT NULL AND mono_end_ms IS NOT NULL AND mono_start_ms>=0 AND mono_end_ms>mono_start_ms AND mono_end_ms<=9007199254740991))
) ENGINE=InnoDB;
CREATE TABLE amvp_day_budgets (
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 policy_id CHAR(36) COLLATE ascii_bin NOT NULL,
 day_start_at DATETIME(3) NOT NULL,
 day_end_at DATETIME(3) NOT NULL,
 enforcement_day_chain_id CHAR(36) COLLATE ascii_bin NOT NULL,
 confirmed_ms BIGINT NOT NULL,
 budget_carry_debit_ms BIGINT NOT NULL,
 daily_limit_ms BIGINT NULL,
 version BIGINT NOT NULL,
 PRIMARY KEY(executor_id,policy_id,day_start_at),
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 CHECK(day_start_at<day_end_at),
 CHECK(version BETWEEN 1 AND 9007199254740991),
 CHECK(confirmed_ms BETWEEN 0 AND 9007199254740991 AND budget_carry_debit_ms BETWEEN 0 AND 9007199254740991),
 CHECK(daily_limit_ms IS NULL OR daily_limit_ms BETWEEN 60000 AND 86400000)
) ENGINE=InnoDB;
CREATE TABLE amvp_events (
 event_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 event_epoch CHAR(36) COLLATE ascii_bin NOT NULL,
 local_event_seq BIGINT NOT NULL,
 navigation_id CHAR(36) COLLATE ascii_bin NOT NULL,
 analysis_group_id CHAR(36) COLLATE ascii_bin NOT NULL,
 target_key VARCHAR(253) COLLATE ascii_bin NOT NULL,
 matched_policy_host VARCHAR(253) COLLATE ascii_bin NULL,
 occurred_at DATETIME(3) NOT NULL,
 payload_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 UNIQUE KEY uq_amvp_event_seq(executor_id,event_epoch,local_event_seq),
 UNIQUE KEY uq_amvp_event_navigation(owner_binding_id,navigation_id),
 KEY ix_amvp_event_order(owner_binding_id,occurred_at,event_epoch,local_event_seq,event_id),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_binding_id,executor_id) REFERENCES amvp_owner_bindings(binding_id,executor_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_reports (
 report_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 report_epoch CHAR(36) COLLATE ascii_bin NOT NULL,
 report_seq BIGINT NOT NULL,
 payload_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 UNIQUE KEY uq_amvp_report_seq(owner_binding_id,report_epoch,report_seq),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_import_receipts (
 user_id BIGINT NOT NULL,
 source_installation_id CHAR(36) COLLATE ascii_bin NOT NULL,
 source_record_id CHAR(36) COLLATE ascii_bin NOT NULL,
 source_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 imported_payload JSON NOT NULL,
 imported_at DATETIME(3) NOT NULL,
 PRIMARY KEY(user_id,source_installation_id,source_record_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_owner_transfers (
 transfer_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 from_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 to_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 expected_owner_epoch BIGINT NOT NULL,
 state VARCHAR(24) NOT NULL,
 payload_json JSON NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(to_binding_id,executor_id) REFERENCES amvp_owner_bindings(binding_id,executor_id) ON DELETE RESTRICT,
 CHECK(expected_owner_epoch BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
CREATE TABLE amvp_operations (
 operation_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 route VARCHAR(160) COLLATE ascii_bin NOT NULL,
 idempotency_key CHAR(36) COLLATE ascii_bin NOT NULL,
 request_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 state VARCHAR(24) NOT NULL,
 response_json JSON NULL,
 updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_amvp_idempotency(owner_binding_id,route,idempotency_key),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_outbox (
 item_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 stream VARCHAR(40) NOT NULL,
 payload_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 state VARCHAR(24) NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 next_attempt_at DATETIME(3) NOT NULL,
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 CHECK(attempts>=0)
) ENGINE=InnoDB;
CREATE TABLE amvp_config_versions (
 config_id CHAR(36) COLLATE ascii_bin NOT NULL,
 version BIGINT NOT NULL,
 value_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL,
 PRIMARY KEY(config_id,version),
 FOREIGN KEY(config_id) REFERENCES amvp_configs(config_id) ON DELETE RESTRICT,
 CHECK(version BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
CREATE TABLE amvp_capability_receipts (
 receipt_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 verified_artifact_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 selected_json JSON NOT NULL,
 verification_ref VARCHAR(120) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_amvp_owner_receipt(owner_binding_id,receipt_id),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_current_packages (
 owner_binding_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 package_id CHAR(36) COLLATE ascii_bin NOT NULL,
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_binding_id,package_id) REFERENCES amvp_packages(owner_binding_id,package_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_focus_attachments (
 attachment_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 session_uuid CHAR(36) COLLATE ascii_bin NOT NULL,
 snapshot_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 receipt_id CHAR(36) COLLATE ascii_bin NOT NULL,
 payload_json JSON NOT NULL,
 payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_binding_id,receipt_id) REFERENCES amvp_capability_receipts(owner_binding_id,receipt_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE amvp_artifacts (
 artifact_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 kind VARCHAR(24) NOT NULL,
 version BIGINT NOT NULL,
 sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 manifest_json JSON NOT NULL,
 license_review VARCHAR(16) NOT NULL,
 UNIQUE KEY uq_amvp_artifact(kind,version),
 CHECK(license_review IN ('PENDING','APPROVED'))
) ENGINE=InnoDB;
CREATE TABLE amvp_clock_anchors (
 anchor_id VARCHAR(100) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 clock_epoch VARCHAR(100) COLLATE ascii_bin NOT NULL,
 boot_id VARCHAR(100) COLLATE ascii_bin NOT NULL,
 anchor_mono_ms BIGINT NOT NULL,
 anchor_utc DATETIME(3) NOT NULL,
 verification_state VARCHAR(16) NOT NULL,
 proof_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 UNIQUE KEY uq_amvp_anchor_scope(anchor_id,owner_binding_id,executor_id),
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_binding_id,executor_id) REFERENCES amvp_owner_bindings(binding_id,executor_id) ON DELETE RESTRICT,
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 CHECK(verification_state IN ('PENDING','VERIFIED')),
 CHECK(anchor_mono_ms BETWEEN 0 AND 9007199254740991)
) ENGINE=InnoDB;
CREATE TABLE amvp_clock_resolutions (
 resolution_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 segment_id CHAR(36) COLLATE ascii_bin NOT NULL,
 anchor_id VARCHAR(100) COLLATE ascii_bin NOT NULL,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 source_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 evidence_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 confirmed_ms BIGINT NOT NULL,
 resolved_start_at DATETIME(3) NOT NULL,
 resolved_end_at DATETIME(3) NOT NULL,
 day_start_at DATETIME(3) NOT NULL,
 day_end_at DATETIME(3) NOT NULL,
 payload_json JSON NOT NULL,
 UNIQUE KEY uq_amvp_resolution_segment(segment_id),
 FOREIGN KEY(segment_id,owner_binding_id,executor_id,source_hash) REFERENCES amvp_usage_segments(segment_id,owner_binding_id,executor_id,payload_sha256) ON DELETE RESTRICT,
 FOREIGN KEY(anchor_id,owner_binding_id,executor_id) REFERENCES amvp_clock_anchors(anchor_id,owner_binding_id,executor_id) ON DELETE RESTRICT,
 CHECK(confirmed_ms BETWEEN 0 AND 9007199254740991 AND confirmed_ms=TIMESTAMPDIFF(MICROSECOND,resolved_start_at,resolved_end_at) DIV 1000),
 CHECK(day_start_at<=resolved_start_at AND resolved_start_at<resolved_end_at AND resolved_end_at<=day_end_at)
) ENGINE=InnoDB;
