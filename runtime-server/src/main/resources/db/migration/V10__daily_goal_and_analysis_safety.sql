-- Additive OPTION-12 member settings. No existing execution or usage row is rewritten.
CREATE TABLE daily_focus_goals (
 user_id BIGINT PRIMARY KEY,
 goal_minutes INT NULL,
 timezone VARCHAR(80) NULL,
 version BIGINT NOT NULL,
 goal_effective_date DATE NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id),
 CHECK(goal_minutes IS NULL OR goal_minutes BETWEEN 1 AND 1440),
 CHECK(version BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
-- Immutable effective-time history: changing the account display zone never
-- relabels an earlier confirmed interval or changes the RC2 executor budget zone.
CREATE TABLE daily_focus_timezones (
 user_id BIGINT NOT NULL,
 version BIGINT NOT NULL,
 timezone VARCHAR(80) NOT NULL,
 effective_at DATETIME(3) NOT NULL,
 PRIMARY KEY(user_id,version),
 FOREIGN KEY(user_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE analysis_consents (
 user_id BIGINT PRIMARY KEY,
 accepted BOOLEAN NOT NULL,
 notice_version VARCHAR(40) NOT NULL,
 version BIGINT NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id),
 CHECK(version BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
CREATE TABLE analysis_jobs (
 id CHAR(36) PRIMARY KEY,
 user_id BIGINT NOT NULL,
 from_date DATE NOT NULL,
 to_date DATE NOT NULL,
 input_hash CHAR(64) NOT NULL,
 input_snapshot JSON NOT NULL,
 status VARCHAR(24) NOT NULL,
 consent_version VARCHAR(40) NOT NULL,
 provider VARCHAR(80) NOT NULL,
 model_version VARCHAR(80) NOT NULL,
 created_at DATETIME(3) NOT NULL,
 completed_at DATETIME(3) NULL,
 error_code VARCHAR(80) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id),
 INDEX analysis_owner_jobs(user_id,created_at,id),
 INDEX analysis_cache(user_id,input_hash,model_version,created_at),
 CHECK(from_date<=to_date),
 CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','INSUFFICIENT_DATA'))
) ENGINE=InnoDB;
CREATE TABLE analysis_results (
 job_id CHAR(36) PRIMARY KEY,
 result JSON NOT NULL,
 generated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(job_id) REFERENCES analysis_jobs(id)
) ENGINE=InnoDB;
