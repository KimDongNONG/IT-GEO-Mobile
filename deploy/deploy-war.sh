#!/usr/bin/env bash
# =====================================================================
#  이클립스에서 만든 WAR 를 서버에 올리기 (웹을 고친 뒤 업데이트할 때도 이걸로)
#
#  사용법 (서버에 root 로)
#    bash deploy-war.sh ~/wellfair.war
#  파일 이름이 달라도 항상 /wellfair 주소로 올라가요. 이전 WAR 는 /opt/tomcat/backup 에 3개까지 보관.
#  되돌리기:  bash deploy-war.sh /opt/tomcat/backup/<이전파일>.war
# =====================================================================
set -euo pipefail
umask 022
APP=wellfair
TOMCAT_HOME=/opt/tomcat
SKIP_SERVICES="${SKIP_SERVICES:-0}"
WAR="${1:-}"

if [ "$(id -u)" -ne 0 ]; then echo "root 로 실행해 주세요:  sudo bash $0 $*"; exit 1; fi
[ -n "$WAR" ] && [ -f "$WAR" ] || { echo "사용법: bash $0 <wellfair.war>"; exit 1; }
[ -x "$TOMCAT_HOME/bin/catalina.sh" ] || { echo "톰캣이 없어요. setup-server.sh 를 먼저 실행하세요."; exit 1; }
[ "$(head -c2 "$WAR")" = PK ] || { echo "WAR(zip) 파일이 아니에요: $WAR"; exit 1; }
WAR=$(readlink -f "$WAR")

tc_stop()  { if [ "$SKIP_SERVICES" = 1 ]; then su -s /bin/bash tomcat -c "$TOMCAT_HOME/bin/shutdown.sh" >/dev/null 2>&1 || true; sleep 3
             else systemctl stop tomcat; fi; }
tc_start() { if [ "$SKIP_SERVICES" = 1 ]; then su -s /bin/bash tomcat -c "$TOMCAT_HOME/bin/startup.sh" >/dev/null
             else systemctl start tomcat; fi; }

echo "▶ 톰캣 멈춤"
tc_stop

mkdir -p "$TOMCAT_HOME/backup"
if [ -f "$TOMCAT_HOME/webapps/$APP.war" ] && [ "$WAR" != "$(readlink -f "$TOMCAT_HOME/webapps/$APP.war")" ]; then
  mv "$TOMCAT_HOME/webapps/$APP.war" "$TOMCAT_HOME/backup/$APP-$(date +%Y%m%d-%H%M%S).war"
  ls -1t "$TOMCAT_HOME"/backup/$APP-*.war 2>/dev/null | tail -n +4 | xargs -r rm -f
  echo "✓ 이전 버전 보관 → $TOMCAT_HOME/backup/"
fi
rm -rf "$TOMCAT_HOME/webapps/$APP"
cp "$WAR" "$TOMCAT_HOME/webapps/$APP.war"
chown -R tomcat:tomcat "$TOMCAT_HOME/webapps" "$TOMCAT_HOME/backup"

echo "▶ 톰캣 시작 (처음엔 30초쯤 걸려요)"
LOGLINE=$(wc -l < "$TOMCAT_HOME/logs/catalina.out" 2>/dev/null || echo 0)
tc_start

CODE=000
for _ in $(seq 1 90); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8080/$APP/" || true)
  case "$CODE" in 000|404) sleep 1 ;; *) break ;; esac
done

case "$CODE" in
  2??|3??)
    echo "✓ 올리기 완료 (응답 $CODE)"
    echo "  브라우저에서 서버 주소/$APP 로 들어가 보세요." ;;
  *)
    echo "! 웹이 정상 응답하지 않아요 (응답 $CODE). 로그 마지막 부분:"
    tail -n +"$((LOGLINE + 1))" "$TOMCAT_HOME/logs/catalina.out" 2>/dev/null | grep -E 'SEVERE|ERROR|Exception|Caused by' | tail -n 15 || true
    echo
    echo "  전체 로그: tail -n 200 $TOMCAT_HOME/logs/catalina.out"
    ls -1t "$TOMCAT_HOME"/backup/$APP-*.war 2>/dev/null | head -1 | sed 's|^|  되돌리기: bash '"$0"' |'
    exit 1 ;;
esac
