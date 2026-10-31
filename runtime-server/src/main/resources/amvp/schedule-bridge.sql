-- Opt-in schedule actor persistence; apply only alongside the existing RC2 runtime schema.
-- No startup initializer or production migration is registered by this change.
CREATE TABLE schedules (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 owner_binding_id CHAR(36) COLLATE ascii_bin NOT NULL,
 user_id BIGINT NOT NULL,
 executor_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
 name VARCHAR(80) NOT NULL, weekdays JSON NOT NULL, start_local CHAR(5) NOT NULL,
 timezone VARCHAR(80) NOT NULL, duration_minutes INT NOT NULL, enabled BOOLEAN NOT NULL,
 version BIGINT NOT NULL, created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
 deleted_at DATETIME(3) NULL,
 FOREIGN KEY(owner_binding_id,executor_id) REFERENCES amvp_owner_bindings(binding_id,executor_id),
 FOREIGN KEY(user_id) REFERENCES users(id),
 CHECK(duration_minutes BETWEEN 1 AND 180 AND version>0)
) ENGINE=InnoDB;
CREATE TABLE schedule_occurrences (
 id CHAR(36) COLLATE ascii_bin PRIMARY KEY, schedule_id CHAR(36) COLLATE ascii_bin NOT NULL,
 schedule_version BIGINT NOT NULL, scheduled_start_at DATETIME(3) NOT NULL,
 scheduled_end_at DATETIME(3) NOT NULL, status VARCHAR(24) NOT NULL,
 reason VARCHAR(80) NULL, session_id BIGINT NULL,
 UNIQUE KEY uq_schedule_occurrence(schedule_id,scheduled_start_at),
 UNIQUE KEY uq_schedule_actor_session(session_id),
 FOREIGN KEY(schedule_id) REFERENCES schedules(id),
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id),
 CHECK(status IN ('PENDING','WAITING_CONFLICT','STARTING','RUNNING','FINISHED','SKIPPED')),
 CHECK(scheduled_end_at>scheduled_start_at)
) ENGINE=InnoDB;
