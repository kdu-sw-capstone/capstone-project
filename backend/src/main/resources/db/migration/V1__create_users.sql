-- Foundation for the existing users data contract; no signup/login API or seed data.
CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    display_name VARCHAR(40) NOT NULL,
    email VARCHAR(254) COLLATE utf8mb4_0900_bin NULL,
    email_verified BOOLEAN NOT NULL,
    status VARCHAR(24) NOT NULL,
    created_at DATETIME(3) NOT NULL,
    terms_version VARCHAR(40) NOT NULL,
    terms_accepted_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
