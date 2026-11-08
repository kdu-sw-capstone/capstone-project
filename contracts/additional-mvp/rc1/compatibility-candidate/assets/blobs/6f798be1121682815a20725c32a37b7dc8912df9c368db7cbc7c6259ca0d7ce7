CREATE TABLE link_evidence (
 link_request_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 status VARCHAR(20) NOT NULL,
 evidence JSON NULL,
 observed_at DATETIME(3) NULL,
 received_at DATETIME(3) NULL,
 FOREIGN KEY(link_request_id) REFERENCES link_requests(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE execution_reconciliations (
 executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
 action_id CHAR(36) COLLATE ascii_bin NOT NULL,
 session_id BIGINT NOT NULL,
 local_action_seq BIGINT NOT NULL,
 payload_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 payload JSON NOT NULL,
 response JSON NOT NULL,
 PRIMARY KEY(executor_id,action_id),
 UNIQUE KEY uq_reconcile_sequence(session_id,local_action_seq),
 FOREIGN KEY(executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE session_watermarks (
 session_id BIGINT PRIMARY KEY,
 last_access_seq BIGINT NOT NULL,
 last_local_seq BIGINT NOT NULL,
 observed_at DATETIME(3) NOT NULL,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
