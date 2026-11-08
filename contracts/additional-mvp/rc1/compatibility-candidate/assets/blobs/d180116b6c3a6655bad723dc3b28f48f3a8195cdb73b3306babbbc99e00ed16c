-- Additive independent-candidate migration; no Guest/legacy execution data is rewritten.
CREATE TABLE guest_import_batches (
 id CHAR(36) PRIMARY KEY, user_id BIGINT NOT NULL, executor_id CHAR(36) NOT NULL,
 status VARCHAR(24) NOT NULL, created_at DATETIME(3) NOT NULL, completed_at DATETIME(3) NULL,
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(executor_id) REFERENCES extension_installations(id)
);
CREATE TABLE guest_import_items (
 id CHAR(36) PRIMARY KEY, batch_id CHAR(36) NOT NULL, source_executor_id CHAR(36) NOT NULL,
 source_item_id CHAR(36) NOT NULL, source_hash CHAR(64) NOT NULL, item_type VARCHAR(24) NOT NULL,
 bound_user_id BIGINT NOT NULL, status VARCHAR(24) NOT NULL, result_id VARCHAR(80) NULL,
 error_code VARCHAR(80) NULL, payload_hash CHAR(64) NULL,
 UNIQUE(source_executor_id,source_item_id), FOREIGN KEY(batch_id) REFERENCES guest_import_batches(id),
 FOREIGN KEY(bound_user_id) REFERENCES users(id)
);
CREATE TABLE guest_import_selection (
 batch_id CHAR(36) NOT NULL, item_id CHAR(36) NOT NULL,
 PRIMARY KEY(batch_id,item_id), FOREIGN KEY(batch_id) REFERENCES guest_import_batches(id),
 FOREIGN KEY(item_id) REFERENCES guest_import_items(id)
);
CREATE INDEX idx_guest_import_items_batch_status ON guest_import_items(batch_id,status);
