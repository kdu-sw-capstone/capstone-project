-- Additive migration. Existing users, identities and sessions are preserved.
ALTER TABLE users ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE web_sessions ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
