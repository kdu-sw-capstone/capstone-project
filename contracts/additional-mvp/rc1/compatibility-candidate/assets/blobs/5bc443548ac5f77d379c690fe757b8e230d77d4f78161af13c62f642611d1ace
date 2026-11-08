-- Independent candidate only. Existing execution, policy and recovery records are untouched.
ALTER TABLE users ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 1;
-- Pre-generation credentials have no generation proof. Keep their bytes/records, fail closed.
ALTER TABLE web_sessions ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE extension_tokens ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE link_requests ADD COLUMN approved_auth_version BIGINT NULL;
