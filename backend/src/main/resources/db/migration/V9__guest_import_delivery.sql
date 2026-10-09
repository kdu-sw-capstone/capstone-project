CREATE TABLE guest_import_batch_items (
 batch_id CHAR(36) COLLATE ascii_bin NOT NULL,
 item_id CHAR(36) COLLATE ascii_bin NOT NULL,
 PRIMARY KEY(batch_id,item_id),
 FOREIGN KEY(batch_id) REFERENCES guest_import_batches(id) ON DELETE RESTRICT,
 FOREIGN KEY(item_id) REFERENCES guest_import_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
INSERT INTO guest_import_batch_items SELECT batch_id,id FROM guest_import_items;
CREATE TABLE guest_import_payloads (
 item_id CHAR(36) COLLATE ascii_bin PRIMARY KEY,
 payload JSON NOT NULL,
 FOREIGN KEY(item_id) REFERENCES guest_import_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
