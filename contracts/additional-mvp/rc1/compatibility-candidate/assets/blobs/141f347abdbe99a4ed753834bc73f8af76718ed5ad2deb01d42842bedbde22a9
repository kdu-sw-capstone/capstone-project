ALTER TABLE auth_mail_outbox ADD attempts INT NOT NULL DEFAULT 0,
 ADD retry_after DATETIME(3) NULL,ADD last_error_code VARCHAR(40) NULL;
CREATE INDEX ix_mail_pending ON auth_mail_outbox(status,retry_after,created_at);
