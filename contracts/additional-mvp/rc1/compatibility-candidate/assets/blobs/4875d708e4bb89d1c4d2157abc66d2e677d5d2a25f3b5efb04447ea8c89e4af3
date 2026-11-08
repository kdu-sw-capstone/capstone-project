CREATE TABLE auth_identities (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 provider VARCHAR(16) COLLATE utf8mb4_0900_bin NOT NULL,
 subject VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
 password_hash VARCHAR(255) NULL,
 updated_at DATETIME(3) NOT NULL,
 UNIQUE KEY uq_identity (provider,subject),
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE web_sessions (
 id_hash CHAR(64) COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id BIGINT NULL,
 csrf_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 reauthenticated_at DATETIME(3) NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE auth_challenges (
 id CHAR(36) COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id BIGINT NULL,
 kind VARCHAR(24) NOT NULL,
 token_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 provider VARCHAR(16) NULL,
 state_hash CHAR(64) COLLATE ascii_bin NULL,
 nonce_hash CHAR(64) COLLATE ascii_bin NULL,
 payload JSON NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 consumed_at DATETIME(3) NULL,
 UNIQUE KEY uq_challenge_token (token_hash),
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE idempotency_keys (
 owner_key VARCHAR(120) COLLATE utf8mb4_0900_bin NOT NULL,
 method VARCHAR(10) NOT NULL,
 path VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
 request_key CHAR(36) COLLATE ascii_bin NOT NULL,
 body_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 response JSON NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 PRIMARY KEY(owner_key,method,path,request_key)
) ENGINE=InnoDB;
-- Authentication throttling is persistent across Server restarts.
CREATE TABLE auth_rate_limits (
 bucket_hash CHAR(64) COLLATE ascii_bin NOT NULL PRIMARY KEY,
 window_start DATETIME(3) NOT NULL,
 attempts INT NOT NULL,
 last_attempt DATETIME(3) NOT NULL
) ENGINE=InnoDB;
