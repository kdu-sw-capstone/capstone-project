-- Additive historical-copy tables. Existing execution/credential state is untouched.
CREATE TABLE guest_import_session_payloads (
 session_id BIGINT PRIMARY KEY, source_executor_id CHAR(36) NOT NULL,
 source_item_id CHAR(36) NOT NULL, payload JSON NOT NULL, payload_hash CHAR(64) NOT NULL,
 UNIQUE(source_executor_id,source_item_id), FOREIGN KEY(session_id) REFERENCES focus_sessions(id)
);
CREATE TABLE session_lifecycle_events (
 event_id CHAR(36) PRIMARY KEY, session_id BIGINT NOT NULL, occurred_at DATETIME(3) NOT NULL,
 event_type VARCHAR(40) NOT NULL, desired_revision BIGINT NOT NULL,
 FOREIGN KEY(event_id) REFERENCES event_receipts(event_id), FOREIGN KEY(session_id) REFERENCES focus_sessions(id)
);
CREATE TABLE usage_segments (
 id CHAR(36) PRIMARY KEY,session_id BIGINT NOT NULL,target_host VARCHAR(253) NOT NULL,
 start_at DATETIME(3) NOT NULL,end_at DATETIME(3) NOT NULL,duration_ms BIGINT NOT NULL,
 usage_seq BIGINT NOT NULL,quality VARCHAR(20) NOT NULL,payload_hash CHAR(64) NOT NULL,
 UNIQUE(session_id,usage_seq),FOREIGN KEY(session_id) REFERENCES focus_sessions(id)
);
CREATE TABLE session_notes (
 session_id BIGINT PRIMARY KEY,text TEXT NOT NULL,version BIGINT NOT NULL,updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id)
);
