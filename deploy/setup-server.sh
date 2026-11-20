#!/usr/bin/env bash
# =====================================================================
#  ItGEO 서버 한 번에 설치 (네이버 클라우드 Ubuntu 22.04 / 24.04)
#
#  설치하는 것 : Java 17 · Tomcat 10.1 · MySQL 8 · Nginx · https 인증서(Let's Encrypt)
#
#  사용법 (서버에 root 로 접속해서)
#    bash setup-server.sh <도메인> <이메일>
#      예) bash setup-server.sh it-geo.duckdns.org me@example.com
#    bash setup-server.sh            ← 도메인 없이 IP 로만 (http, 테스트용)
#
#  여러 번 실행해도 괜찮아요. 이미 만든 DB 비밀번호·톰캣·올린 WAR 는 그대로 둡니다.
#  https 인증서만 실패했으면 도메인 연결을 확인한 뒤 같은 명령을 다시 실행하면 돼요.
# =====================================================================
set -euo pipefail
umask 022

DOMAIN="${1:-}"
EMAIL="${2:-}"

APP=itgeo                          # WAR 이름 = 주소 경로 (/itgeo)
TOMCAT_HOME=/opt/tomcat
TOMCAT_FALLBACK=10.1.34               # 최신 버전을 못 찾으면 이 버전
UPLOAD_DIR=/srv/itgeo-upload       # 앱 현장 사진 저장 폴더
CRED_FILE=/root/itgeo-db.txt       # DB 계정 메모 (root 만 읽기)
SKIP_SERVICES="${SKIP_SERVICES:-0}"   # 1 = systemd 없는 테스트 환경(도커)용. 평소엔 건드리지 마세요

say()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m! %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "root 로 실행해 주세요:  sudo bash $0 $*"; exit 1
fi
if [ -n "$DOMAIN" ] && ! [[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "도메인 형식이 이상해요: $DOMAIN  (예: it-geo.duckdns.org, http:// 없이)"; exit 1
fi

# ---------------------------------------------------------------- 1. 시간대
say "1/8 서버 시간을 한국 시간으로"
if [ ! -e /usr/share/zoneinfo/Asia/Seoul ]; then
  DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tzdata >/dev/null
fi
if [ "$SKIP_SERVICES" = 1 ] || ! command -v timedatectl >/dev/null; then
  ln -sf /usr/share/zoneinfo/Asia/Seoul /etc/localtime; echo Asia/Seoul > /etc/timezone
else
  timedatectl set-timezone Asia/Seoul
fi
ok "$(date '+%Y-%m-%d %H:%M %Z')"

# ---------------------------------------------------------------- 2. 스왑 (메모리 작은 서버 보호)
say "2/8 메모리 확인"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3500 ] && [ "$SKIP_SERVICES" != 1 ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "메모리 ${MEM_MB}MB → 스왑 2GB 추가"
else
  ok "메모리 ${MEM_MB}MB"
fi
if [ "$MEM_MB" -lt 3000 ]; then HEAP=512m; else HEAP=1024m; fi

# ---------------------------------------------------------------- 3. 프로그램 설치
say "3/8 Java 17 · MySQL · Nginx · certbot 설치 (몇 분 걸려요)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openjdk-17-jre-headless mysql-server nginx certbot python3-certbot-nginx \
  curl ca-certificates openssl >/dev/null
JAVA_HOME=$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")
ok "$(java -version 2>&1 | head -1)"

# ---------------------------------------------------------------- 4. MySQL
say "4/8 MySQL: itgeo 데이터베이스와 전용 계정"
# 저장 시각(NOW, CURRENT_TIMESTAMP)이 한국 시간이 되게
cat > /etc/mysql/mysql.conf.d/zz-itgeo.cnf <<'EOF'
[mysqld]
default-time-zone = '+09:00'
character-set-server = utf8mb4
collation-server = utf8mb4_0900_ai_ci
EOF
chmod 644 /etc/mysql/mysql.conf.d/zz-itgeo.cnf
if [ "$SKIP_SERVICES" = 1 ]; then
  service mysql restart >/dev/null 2>&1 || service mysql start >/dev/null 2>&1 || true
else
  systemctl enable mysql >/dev/null 2>&1
  systemctl restart mysql
fi
for _ in $(seq 1 30); do mysqladmin ping --silent >/dev/null 2>&1 && break; sleep 1; done

if [ -f "$CRED_FILE" ] && grep -q '^DB_PASSWORD=' "$CRED_FILE"; then
  DB_PASS=$(sed -n 's/^DB_PASSWORD=//p' "$CRED_FILE")
  ok "이전에 만든 비밀번호를 그대로 씁니다 ($CRED_FILE)"
else
  DB_PASS=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 20)
fi
mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS ${APP} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '${APP}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${APP}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${APP}.* TO '${APP}'@'localhost';
FLUSH PRIVILEGES;
SQL
umask 077
cat > "$CRED_FILE" <<EOF
# ItGEO DB 계정 (setup-server.sh 가 만듦). 이 파일은 root 만 읽을 수 있어요.
DB_NAME=${APP}
DB_USERNAME=${APP}
DB_PASSWORD=${DB_PASS}
EOF
umask 022
chmod 600 "$CRED_FILE"
ok "DB ${APP} / 계정 ${APP}@localhost (비밀번호는 $CRED_FILE)"

# ---------------------------------------------------------------- 5. Tomcat 10.1
say "5/8 Tomcat 10.1"
id tomcat >/dev/null 2>&1 || useradd -r -M -d "$TOMCAT_HOME" -s /usr/sbin/nologin tomcat
if [ ! -x "$TOMCAT_HOME/bin/catalina.sh" ]; then
  VER=$(curl -fsS -m 15 https://dlcdn.apache.org/tomcat/tomcat-10/ 2>/dev/null \
        | grep -o 'v10\.1\.[0-9]*' | sort -uV | tail -1 | tr -d v || true)
  if [ -n "$VER" ]; then BASE="https://dlcdn.apache.org/tomcat/tomcat-10/v$VER/bin"
  else VER=$TOMCAT_FALLBACK; BASE="https://archive.apache.org/dist/tomcat/tomcat-10/v$VER/bin"; fi
  TGZ="apache-tomcat-$VER.tar.gz"
  cd /tmp
  curl -fsSLO "$BASE/$TGZ"
  curl -fsSLO "$BASE/$TGZ.sha512"
  sha512sum -c "$TGZ.sha512" >/dev/null || { echo "톰캣 파일 검증 실패. 다시 실행해 주세요."; exit 1; }
  mkdir -p "$TOMCAT_HOME"
  tar -xzf "$TGZ" -C "$TOMCAT_HOME" --strip-components=1
  rm -f "$TGZ" "$TGZ.sha512"
  # 기본 예제 앱 삭제 (보안)
  rm -rf "$TOMCAT_HOME"/webapps/{ROOT,docs,examples,host-manager,manager}
  ok "Tomcat $VER 설치 → $TOMCAT_HOME"
else
  ok "이미 설치됨: $("$TOMCAT_HOME/bin/version.sh" 2>/dev/null | sed -n 's/^Server number: *//p')"
fi

SX="$TOMCAT_HOME/conf/server.xml"
# 8080 은 서버 안(Nginx)에서만 접속 가능하게
grep -q 'address="127.0.0.1"' "$SX" || \
  sed -i 's|<Connector port="8080" protocol="HTTP/1.1"|<Connector port="8080" protocol="HTTP/1.1" address="127.0.0.1"|' "$SX"
# Nginx 가 넘겨준 https 정보를 톰캣이 알도록 (redirect 가 http 로 새지 않게)
grep -q 'RemoteIpValve' "$SX" || \
  sed -i 's|</Host>|  <Valve className="org.apache.catalina.valves.RemoteIpValve" remoteIpHeader="X-Forwarded-For" protocolHeader="X-Forwarded-Proto" />\n      </Host>|' "$SX"

# DB 계정·사진 폴더는 환경변수로 (스프링이 DB_USERNAME → ${db.username} 으로 읽음)
cat > "$TOMCAT_HOME/bin/setenv.sh" <<EOF
# setup-server.sh 가 만듦. DB 비밀번호가 들어 있으니 공유하지 마세요.
export JAVA_HOME="$JAVA_HOME"
export CATALINA_PID="$TOMCAT_HOME/temp/tomcat.pid"
export JAVA_OPTS="-Xms256m -Xmx$HEAP -Djava.awt.headless=true -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Seoul"
export DB_USERNAME="${APP}"
export DB_PASSWORD="${DB_PASS}"
export APP_UPLOAD_DIR="$UPLOAD_DIR"
EOF
chmod 750 "$TOMCAT_HOME/bin/setenv.sh"

mkdir -p "$UPLOAD_DIR"
chown -R tomcat:tomcat "$TOMCAT_HOME" "$UPLOAD_DIR"
chown root:tomcat "$TOMCAT_HOME/bin/setenv.sh"
chmod 750 "$UPLOAD_DIR"
ok "8080 은 내부 전용, DB 계정·사진 폴더($UPLOAD_DIR) 연결"

if [ "$SKIP_SERVICES" != 1 ]; then
  cat > /etc/systemd/system/tomcat.service <<EOF
[Unit]
Description=ItGEO Tomcat
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=forking
User=tomcat
Group=tomcat
Environment=CATALINA_HOME=$TOMCAT_HOME
Environment=CATALINA_BASE=$TOMCAT_HOME
Environment=CATALINA_PID=$TOMCAT_HOME/temp/tomcat.pid
ExecStart=$TOMCAT_HOME/bin/startup.sh
ExecStop=$TOMCAT_HOME/bin/shutdown.sh
SuccessExitStatus=143
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable tomcat >/dev/null 2>&1
  systemctl restart tomcat
  ok "서버가 재부팅돼도 톰캣이 자동으로 켜져요"
else
  su -s /bin/bash tomcat -c "$TOMCAT_HOME/bin/startup.sh" >/dev/null
fi

# ---------------------------------------------------------------- 6. Nginx
say "6/8 Nginx (80/443 → 톰캣)"
SITE=/etc/nginx/sites-available/$APP
cat > "$SITE" <<'EOF'
server {
    listen 80;
    server_name __DOMAIN__;

    # 앱 현장 사진 업로드
    client_max_body_size 20m;

    location = / { return 302 /__APP__/; }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
EOF
sed -i "s|__DOMAIN__|${DOMAIN:-_}|; s|__APP__|$APP|" "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/$APP
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
if [ "$SKIP_SERVICES" = 1 ]; then (nginx -s reload 2>/dev/null || nginx); else systemctl enable nginx >/dev/null 2>&1; systemctl reload nginx || systemctl restart nginx; fi
ok "설정 확인 통과"

# ---------------------------------------------------------------- 7. https
say "7/8 https 인증서"
HTTPS=0
if [ -z "$DOMAIN" ]; then
  warn "도메인 없이 실행해서 http 로만 열었어요. 앱은 http://<공인IP>/$APP 로 접속합니다."
elif [ "$SKIP_SERVICES" = 1 ]; then
  warn "테스트 모드라 인증서는 건너뜀"
else
  MYIP=$(curl -fsS -m 10 https://api.ipify.org 2>/dev/null || true)
  DNSIP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}')
  if [ -n "$MYIP" ] && [ "$MYIP" != "$DNSIP" ]; then
    warn "$DOMAIN 이 이 서버($MYIP)가 아니라 '${DNSIP:-없음}' 을 가리켜요."
    warn "DuckDNS 에서 IP 를 $MYIP 로 저장하고 1~2분 뒤 같은 명령을 다시 실행하세요."
  else
    if [ -n "$EMAIL" ]; then MAILOPT=(-m "$EMAIL"); else MAILOPT=(--register-unsafely-without-email); fi
    if certbot --nginx -d "$DOMAIN" "${MAILOPT[@]}" --agree-tos --redirect -n; then
      HTTPS=1; ok "https://$DOMAIN 인증서 발급 (90일마다 자동 갱신)"
    else
      warn "인증서 발급 실패. 네이버 클라우드 ACG 에 80·443 이 열려 있는지 확인 후 다시 실행하세요."
    fi
  fi
fi

# ---------------------------------------------------------------- 8. 확인
say "8/8 동작 확인"
# 톰캣이 뜰 때까지 (응답 코드가 000 이 아니면 켜진 것)
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/ || true)" != 000 ] && break; sleep 1
done
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN:-localhost}" http://127.0.0.1/$APP/ || true)
if [ -f "$TOMCAT_HOME/webapps/$APP.war" ] || [ -d "$TOMCAT_HOME/webapps/$APP" ]; then
  ok "웹 응답 코드: $CODE"
else
  ok "톰캣·Nginx 동작 중 (아직 WAR 를 안 올려서 /$APP 는 404 가 정상)"
fi

if [ "$HTTPS" = 1 ]; then URL="https://$DOMAIN/$APP"
elif [ -n "$DOMAIN" ]; then URL="http://$DOMAIN/$APP"
else URL="http://$(curl -fsS -m 10 https://api.ipify.org 2>/dev/null || echo '<공인IP>')/$APP"; fi

cat <<EOF

=====================================================================
 설치 끝!   서버 주소: $URL
---------------------------------------------------------------------
 다음 순서
  1) DB 옮기기   : bash import-db.sh ~/itgeo.sql
  2) 웹 올리기   : bash deploy-war.sh ~/itgeo.war
  3) 네이버 클라우드 콘솔 > Maps > Web 서비스 URL 에 추가
                   ${URL%/$APP}
  4) 앱 빌드     : mobile/.env.production 에
                   VITE_API_BASE=$URL

 자주 쓰는 명령
  톰캣 재시작    : systemctl restart tomcat
  톰캣 로그      : tail -f $TOMCAT_HOME/logs/catalina.out
  DB 계정 보기   : cat $CRED_FILE
=====================================================================
EOF
