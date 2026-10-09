CREATE TABLE session_notes (
 session_id BIGINT PRIMARY KEY,
 text TEXT NOT NULL,
 version BIGINT NOT NULL,
 updated_at DATETIME(3) NOT NULL,
 FOREIGN KEY(session_id) REFERENCES focus_sessions(id) ON DELETE RESTRICT,
 CHECK(CHAR_LENGTH(text)<=2000),
 CHECK(version>=0)
) ENGINE=InnoDB;
