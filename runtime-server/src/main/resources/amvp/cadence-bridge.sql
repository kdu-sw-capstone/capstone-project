-- Opt-in sidecar after RC2 runtime schema; no automatic or operational migration.
CREATE TABLE amvp_cadence_definitions (
 owner_binding_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 config_id CHAR(36) COLLATE ascii_bin NOT NULL,
 config_version BIGINT NOT NULL, config_revision BIGINT NOT NULL,
 value_json JSON NOT NULL, payload_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 deleted BOOLEAN NOT NULL,
 FOREIGN KEY(owner_binding_id) REFERENCES amvp_owner_bindings(binding_id),
 FOREIGN KEY(config_id,config_version) REFERENCES amvp_config_versions(config_id,version)
) ENGINE=InnoDB;
CREATE TABLE amvp_focus_runs (
 session_uuid CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 owner_epoch BIGINT NOT NULL, actor_generation BIGINT NOT NULL,
 version BIGINT NOT NULL, frozen_json JSON NOT NULL, frozen_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 state_json JSON NOT NULL, first_failure_json JSON NULL,
 current_operation_id CHAR(36) COLLATE ascii_bin NOT NULL,
 last_receipt_seq BIGINT NOT NULL DEFAULT 0,
 FOREIGN KEY(owner_binding_id,executor_id) REFERENCES amvp_owner_bindings(binding_id,executor_id),
 CHECK(version BETWEEN 1 AND 9007199254740991 AND actor_generation>0 AND last_receipt_seq>=0)
) ENGINE=InnoDB;
CREATE TABLE amvp_focus_controls (
 operation_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 session_uuid CHAR(36) COLLATE ascii_bin NOT NULL,
 request_key CHAR(36) COLLATE ascii_bin NOT NULL, request_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 expected_version BIGINT NOT NULL, command_json JSON NOT NULL,
 issued_at DATETIME(3) NOT NULL, execute_before DATETIME(3) NOT NULL, response_json JSON NOT NULL,
 UNIQUE KEY uq_focus_request(owner_binding_id,session_uuid,request_key),
 FOREIGN KEY(session_uuid) REFERENCES amvp_focus_runs(session_uuid)
) ENGINE=InnoDB;
CREATE TABLE amvp_focus_receipts (
 receipt_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 operation_id CHAR(36) COLLATE ascii_bin NOT NULL,
 session_uuid CHAR(36) COLLATE ascii_bin NOT NULL,
 actor_generation BIGINT NOT NULL, receipt_seq BIGINT NOT NULL,
 state_json JSON NOT NULL, evidence_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 observed_at DATETIME(3) NOT NULL, projected BOOLEAN NOT NULL,
 UNIQUE KEY uq_focus_receipt_seq(session_uuid,actor_generation,receipt_seq),
 FOREIGN KEY(operation_id) REFERENCES amvp_focus_controls(operation_id),
 CHECK(receipt_seq>0)
) ENGINE=InnoDB;
