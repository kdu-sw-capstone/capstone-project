-- Additive: legacy verification links and all existing users remain intact.
CREATE TABLE email_signup_codes (
 id CHAR(36) COLLATE ascii_bin NOT NULL PRIMARY KEY,
 owner_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 email VARCHAR(254) COLLATE utf8mb4_0900_bin NOT NULL,
 code_hash CHAR(64) COLLATE ascii_bin NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 expires_at DATETIME(3) NOT NULL,
 verified_at DATETIME(3) NULL,
 proof_hash CHAR(64) COLLATE ascii_bin NULL,
 proof_expires_at DATETIME(3) NULL,
 consumed_at DATETIME(3) NULL,
 superseded_at DATETIME(3) NULL,
 UNIQUE KEY uq_email_signup_proof(proof_hash),
 KEY ix_email_signup_owner(owner_hash,email),
 CHECK(attempts BETWEEN 0 AND 5)
) ENGINE=InnoDB;
