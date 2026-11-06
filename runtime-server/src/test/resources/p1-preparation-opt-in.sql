-- INTERNAL PREPARATION DRAFT ONLY. Not a Flyway migration, not executed by this unit.
-- Existing extension_installations and approved amvp_owner_bindings must exist.
-- Names/storage are private implementation candidates; no public RC2 schema changes.
CREATE TABLE amvp_p1_request_results (
 executor_id CHAR(36) NOT NULL,
 user_id BIGINT NOT NULL,
 request_id CHAR(36) NOT NULL,
 request_original LONGTEXT NOT NULL,
 request_sha256 CHAR(64) COLLATE ascii_bin NOT NULL,
 fingerprint CHAR(64) COLLATE ascii_bin NOT NULL,
 result_kind VARCHAR(24) NOT NULL,
 result_json JSON NOT NULL,
 PRIMARY KEY(executor_id,user_id,request_id)
) ENGINE=InnoDB;
CREATE TABLE amvp_p1_preparations (
 preparation_id CHAR(36) PRIMARY KEY,
 executor_id CHAR(36) NOT NULL,
 user_id BIGINT NOT NULL,
 creation_json JSON NOT NULL,
 cas_revision BIGINT NOT NULL,
 termination_json JSON NULL,
 CHECK(cas_revision BETWEEN 1 AND 9007199254740991)
) ENGINE=InnoDB;
