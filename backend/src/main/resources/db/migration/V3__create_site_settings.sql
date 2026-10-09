CREATE TABLE sites (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT NOT NULL,
 canonical_host VARCHAR(253) COLLATE utf8mb4_0900_bin NOT NULL,
 display_name VARCHAR(100) NOT NULL,
 include_subdomains BOOLEAN NOT NULL,
 purpose VARCHAR(16) NOT NULL,
 access_policy VARCHAR(16) NOT NULL,
 version BIGINT NOT NULL,
 created_at DATETIME(3) NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 deleted_at DATETIME(3) NULL,
 UNIQUE KEY uq_site_host(user_id,canonical_host),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT,
 CHECK(version>=1),
 CHECK((purpose IN ('FOCUS','GENERAL') AND access_policy='ALLOW') OR (purpose='DISTRACTION' AND access_policy IN ('BLOCK','RECORD')))
) ENGINE=InnoDB;
CREATE TABLE site_feature_policies (
 site_id BIGINT NOT NULL,
 feature_code VARCHAR(50) NOT NULL,
 enabled BOOLEAN NOT NULL,
 PRIMARY KEY(site_id,feature_code),
 FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
