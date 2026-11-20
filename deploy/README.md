# 클라우드 서버에 올리기 (네이버 클라우드 Ubuntu)

PC 없이도 폰 앱과 웹이 인터넷만 되면 동작하도록, 웹(스프링 + MySQL)을 클라우드 서버 한 대에 올리는 스크립트예요.

```
폰 앱 / 브라우저 ──https──▶ Nginx(80·443) ──▶ Tomcat 10.1(8080, 서버 안에서만) ──▶ MySQL 8 (itgeo)
```

| 파일 | 하는 일 | 언제 |
| --- | --- | --- |
| `setup-server.sh` | Java 17 · Tomcat 10.1 · MySQL 8 · Nginx · https 인증서 설치, DB 계정 생성 | 처음 한 번 (다시 실행해도 됨) |
| `import-db.sh` | PC 에서 백업한 `.sql` 을 서버 DB 에 넣기 (기존 서버 DB 는 자동 백업) | DB 옮길 때 |
| `deploy-war.sh` | 이클립스에서 만든 WAR 를 `/itgeo` 로 올리기 (이전 WAR 3개 보관) | 웹 고칠 때마다 |

## 순서 요약

1. 네이버 클라우드에서 Ubuntu 서버 생성, 공인 IP 할당, ACG 에 22·80·443 열기
2. DuckDNS 에서 도메인(예: `it-geo.duckdns.org`)을 만들고 서버 공인 IP 입력
3. PC 에서 파일 올리기
   ```powershell
   scp -r deploy itgeo.sql itgeo.war root@<공인IP>:~/
   ```
4. 서버에서
   ```bash
   ssh root@<공인IP>
   cd ~/deploy
   bash setup-server.sh it-geo.duckdns.org 내메일@example.com
   bash import-db.sh ~/itgeo.sql
   bash deploy-war.sh ~/itgeo.war
   ```
5. 네이버 클라우드 콘솔 > Maps Application > Web 서비스 URL 에 `https://it-geo.duckdns.org` 추가
6. 앱: `mobile/.env.production` 에 `VITE_API_BASE=https://it-geo.duckdns.org/itgeo` 넣고 APK 다시 빌드

## 서버 설정이 들어가는 곳

| 항목 | 위치 |
| --- | --- |
| DB 계정 (`itgeo` / 랜덤 비밀번호) | `/root/itgeo-db.txt`, 톰캣은 `/opt/tomcat/bin/setenv.sh` 의 `DB_USERNAME`·`DB_PASSWORD` 로 읽음 |
| 앱 현장 사진 | `/srv/itgeo-upload` (`APP_UPLOAD_DIR`) |
| 톰캣 로그 | `/opt/tomcat/logs/catalina.out` |
| Nginx 설정 | `/etc/nginx/sites-available/itgeo` |

`root-context.xml` 은 `${db.username:root}` · `${db.password:rootroot}` 로 바뀌어서, 로컬(이클립스)은 예전처럼 root/rootroot 로 접속하고
서버에서는 환경변수 값이 우선해요. 스프링은 `DB_PASSWORD` 환경변수를 `db.password` 로 읽어요.

## 자주 쓰는 명령

```bash
systemctl restart tomcat                 # 톰캣 재시작
tail -f /opt/tomcat/logs/catalina.out    # 로그 보기
systemctl status tomcat nginx mysql      # 상태
certbot renew --dry-run                  # 인증서 자동 갱신 점검
```
