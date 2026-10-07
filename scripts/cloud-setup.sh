#!/usr/bin/env bash
# Optional onboarding helper for Linux x86_64 Codex cloud machines.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
[[ "$(uname -s)/$(uname -m)" == "Linux/x86_64" ]] || { echo 'Use a Java 21 JDK locally; this helper targets Linux x86_64.' >&2; exit 1; }
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major!==24 || minor<19) process.exit(1)'
mkdir -p /workspace/.tools /workspace/.cache/npm /workspace/.cache/m2 /workspace/.cache/maven .local
jdk=/workspace/.tools/jdk-21.0.12.1+1
if [[ ! -x "$jdk/bin/javac" ]]; then
  archive=/workspace/.tools/focurve-jdk.tar.gz
  curl --fail --silent --show-error --location 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz' --output "$archive"
  printf '%s  %s\n' 'ce79869e1307ed8ee1e2baa86a412b1eb5b75d10a01006d788a6f968bcfaee94' "$archive" | sha256sum --check --status
  tar -xzf "$archive" -C /workspace/.tools
fi
python3 - <<'PYCODE'
from pathlib import Path
from urllib.parse import urlsplit
import os, secrets
from xml.sax.saxutils import escape
root=Path.cwd()
u=urlsplit(os.environ.get('HTTPS_PROXY',''))
proxies=''
if u.hostname:
    if u.username or u.password:
        raise SystemExit('Credential-bearing proxy needs separate secure Maven configuration.')
    proxies=f'<proxies><proxy><id>cloud</id><active>true</active><protocol>http</protocol><host>{escape(u.hostname)}</host><port>{u.port or 80}</port><nonProxyHosts>localhost|127.0.0.1</nonProxyHosts></proxy></proxies>'
(root/'.local/maven-settings.xml').write_text('<settings>'+proxies+'<localRepository>/workspace/.cache/maven</localRepository></settings>')
p=root/'.local/cloud-env.sh'
p.write_text('export JAVA_HOME=/workspace/.tools/jdk-21.0.12.1+1\nexport PATH="$JAVA_HOME/bin:$PATH"\nexport MAVEN_USER_HOME=/workspace/.cache/m2\nexport npm_config_cache=/workspace/.cache/npm\nexport MAVEN_OPTS=\"${MAVEN_OPTS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts\"\nexport MAVEN_ARGS="-s '+str(root/'.local/maven-settings.xml')+'"\n')
if not (root/'.env').exists():
    text=(root/'.env.example').read_text().replace('DB_PASSWORD=\n','DB_PASSWORD='+secrets.token_hex(24)+'\n').replace('MYSQL_ROOT_PASSWORD=\n','MYSQL_ROOT_PASSWORD='+secrets.token_hex(24)+'\n')
    (root/'.env').write_text(text)
    (root/'.env').chmod(0o600)
PYCODE
source .local/cloud-env.sh
npm --prefix frontend ci
./backend/mvnw -f backend/pom.xml -B -ntp -DskipTests package
