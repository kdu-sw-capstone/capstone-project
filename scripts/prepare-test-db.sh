#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Only the local Compose MySQL is addressed; no arbitrary remote DB URL is used.
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root' <<'SQL'
CREATE DATABASE IF NOT EXISTS focurve_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON focurve_test.* TO 'focurve'@'%';
SQL
