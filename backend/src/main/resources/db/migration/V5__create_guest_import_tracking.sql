-- Import provenance is permanent. The shared manifest/upload contract is still under coordination.
CREATE TABLE guest_import_batches (
    id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
    user_id BIGINT NOT NULL,
    executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    completed_at DATETIME(3) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
    KEY ix_import_owner (user_id, created_at, id)
) ENGINE=InnoDB;
CREATE TABLE guest_import_items (
    id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
    batch_id CHAR(36) COLLATE ascii_bin NOT NULL,
    source_executor_id CHAR(36) COLLATE ascii_bin NOT NULL,
    source_item_id CHAR(36) COLLATE ascii_bin NOT NULL,
    source_hash CHAR(64) COLLATE ascii_bin NOT NULL,
    item_type VARCHAR(24) NOT NULL,
    bound_user_id BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL,
    result_id VARCHAR(80) NULL,
    error_code VARCHAR(80) NULL,
    UNIQUE KEY uq_import_source (source_executor_id, source_item_id),
    FOREIGN KEY (batch_id) REFERENCES guest_import_batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (bound_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (source_executor_id) REFERENCES extension_installations(id) ON DELETE RESTRICT,
    KEY ix_import_status (batch_id, status)
) ENGINE=InnoDB;
