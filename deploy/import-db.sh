#!/usr/bin/env bash
# =====================================================================
#  PC 에서 옮겨 온 DB 백업(.sql) 을 서버 MySQL(wellfair) 에 넣기
#
#  사용법 (서버에 root 로)
#    bash import-db.sh ~/wellfair.sql
#    bash import-db.sh ~/wellfair.sql ~/06_mobile_record.sql   ← 여러 개면 순서대로
#  .sql.gz 도 됩니다. 넣기 전에 서버에 있던 DB 는 /root/db-backup/ 에 자동 백업해요.
# =====================================================================
set -euo pipefail
umask 022
DB=wellfair
SKIP_SERVICES="${SKIP_SERVICES:-0}"

if [ "$(id -u)" -ne 0 ]; then echo "root 로 실행해 주세요:  sudo bash $0 $*"; exit 1; fi
if [ $# -eq 0 ]; then echo "사용법: bash $0 <백업파일.sql> [다음파일.sql ...]"; exit 1; fi
for f in "$@"; do [ -f "$f" ] || { echo "파일이 없어요: $f"; exit 1; }; done
command -v mysql >/dev/null || { echo "MySQL 이 없어요. setup-server.sh 를 먼저 실행하세요."; exit 1; }

# 1) 지금 서버 DB 백업 (테이블이 하나라도 있으면)
N=$(mysql -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB'")
if [ "$N" -gt 0 ]; then
  mkdir -p /root/db-backup && chmod 700 /root/db-backup
  B=/root/db-backup/$DB-$(date +%Y%m%d-%H%M%S).sql.gz
  mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF "$DB" | gzip > "$B"
  echo "✓ 기존 서버 DB 백업: $B"
fi

TMP=$(mktemp /tmp/wellfair-import.XXXXXX)
trap 'rm -f "$TMP" "$TMP.u8"' EXIT

for f in "$@"; do
  echo "▶ $(basename "$f") 넣는 중…"
  case "$f" in *.gz) gunzip -c "$f" > "$TMP" ;; *) cp "$f" "$TMP" ;; esac

  # PowerShell 의 '>' 로 저장한 파일은 UTF-16 이라 MySQL 이 못 읽음 → UTF-8 로 바꿈
  BOM=$(head -c2 "$TMP" | od -An -tx1 | tr -d ' \n')
  if [ "$BOM" = fffe ] || [ "$BOM" = feff ]; then
    iconv -f UTF-16 -t UTF-8 "$TMP" > "$TMP.u8" && mv "$TMP.u8" "$TMP"
    echo "  (UTF-16 파일을 UTF-8 로 변환했어요)"
  fi
  sed -i '1s/^\xEF\xBB\xBF//; s/\r$//' "$TMP"

  # PC 와 서버가 달라서 문제 되는 줄 정리
  #  - GTID_PURGED : 다른 MySQL 의 복제 정보 (여러 줄일 수 있음)
  #  - CREATE DATABASE / USE : PC 의 DB 이름이 달라도 항상 wellfair 로 넣기
  awk '
    /GTID_PURGED/            { skip = 1 }
    skip                     { if ($0 ~ /;[[:space:]]*$/) skip = 0; next }
    /^CREATE DATABASE /      { next }
    /^USE[[:space:]]/        { next }
                             { print }
  ' "$TMP" > "$TMP.u8" && mv "$TMP.u8" "$TMP"

  mysql -uroot --default-character-set=utf8mb4 "$DB" < "$TMP"
  echo "  ✓ 완료"
done

# 2) 결과 확인
echo
echo "▶ 테이블별 줄 수 (PC 의 MySQL 과 같은지 비교해 보세요)"
for t in $(mysql -uroot -N -e "SELECT table_name FROM information_schema.tables WHERE table_schema='$DB' AND table_type='BASE TABLE' ORDER BY table_name"); do
  printf '  %-24s %s\n' "$t" "$(mysql -uroot -N "$DB" -e "SELECT COUNT(*) FROM \`$t\`")"
done

MISSING=""
for t in users building survey_list survey_record survey_record_detail survey_photo; do
  [ "$(mysql -uroot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB' AND table_name='$t'")" = 1 ] \
    || MISSING="$MISSING $t"
done
if [ -n "$MISSING" ]; then
  echo
  echo "! 없는 테이블:$MISSING"
  case "$MISSING" in *survey_record_detail*|*survey_photo*)
    echo "  앱 기록용 테이블이에요. PC 의 reference/db/06_mobile_record.sql 을 서버로 올린 뒤"
    echo "  bash $0 ~/06_mobile_record.sql   로 넣어 주세요." ;;
  esac
fi

# 3) 톰캣 다시 켜서 새 DB 로 연결
if [ "$SKIP_SERVICES" != 1 ] && systemctl list-unit-files tomcat.service >/dev/null 2>&1; then
  systemctl restart tomcat && echo && echo "✓ 톰캣 재시작 (새 DB 로 연결)"
fi
