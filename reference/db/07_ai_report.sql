-- =====================================================================
-- ITGEO DB 변경 : 모바일 현장조사기록 연동 수신함 + AI 현장 확인보고서  (01 ~ 05 다음에 실행)
--   06_app_tables.sql 과 상관없이 동작한다. 기존 테이블은 바꾸지 않는다. 여러 번 실행해도 됨 (IF NOT EXISTS)
--     [A] mobile_link_record : 모바일 앱이 JSON 으로 보낸 현장조사기록 (확인 전 = NEW, AI 정리로 이력에 기재 = DONE)
--     [B] mobile_link_photo  : 위 기록의 사진 (파일은 app.upload.dir 아래, 여기엔 파일 이름만)
--     [C] ai_report          : 05 건물 확인 이력에서 만든 AI 현장 확인보고서 (파일은 app.report.dir 아래)
-- =====================================================================
USE itgeo;
SET GLOBAL local_infile = 1;

-- [A] 모바일 현장조사기록 수신함
CREATE TABLE IF NOT EXISTS mobile_link_record (
  link_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '수신ID (PK)',
  bld_id           VARCHAR(28)     NOT NULL COMMENT '건물 (FK)',
  client_uuid      VARCHAR(64)     NULL     COMMENT '앱 기록 ID (같은 기록을 다시 보내면 중복으로 보고 저장하지 않음)',
  sender_user_id   BIGINT UNSIGNED NULL     COMMENT '보낸 사람 (users FK, 모르면 NULL)',
  author_nm        VARCHAR(50)     NULL     COMMENT '앱에 적힌 작성자 이름',
  visited_at       DATETIME        NOT NULL COMMENT '현장 방문 일시 (앱 저장 시각, 없으면 수신 시각)',
  result           ENUM('MET','ABSENT','REFUSED','OTHER') NOT NULL DEFAULT 'MET' COMMENT '방문 결과',
  resident_status  VARCHAR(10)     NULL     COMMENT '거주자 상태 : 양호 / 주의 / 긴급 / 부재',
  scores           VARCHAR(1000)   NULL     COMMENT '항목별 취약점수 JSON {"around":3,"flood":4,…} (1 양호 ~ 5 위험)',
  factor_check     VARCHAR(1000)   NULL     COMMENT '사전 탐지 요인 확인 JSON {"ugrnd":"Y","flood":"?"} (survey_record.factor_check 와 같은 형식)',
  supports         VARCHAR(300)    NULL     COMMENT '필요한 지원 (쉼표 구분)',
  memo             TEXT            NULL     COMMENT '현장 메모 (웹에서 수정 가능)',
  transcript       MEDIUMTEXT      NULL     COMMENT '녹취록 (웹에서는 삭제만)',
  status           ENUM('NEW','DONE') NOT NULL DEFAULT 'NEW' COMMENT '미확인 / AI 정리로 이력 기재 완료',
  record_id        BIGINT UNSIGNED NULL     COMMENT 'AI 정리로 만든 현장 기록 (survey_record FK)',
  ai_summary       TEXT            NULL     COMMENT 'AI 정리 결과 (= 그 기록의 관찰 메모)',
  confirmed_by     BIGINT UNSIGNED NULL     COMMENT '확인한 사람 (users FK)',
  confirmed_at     DATETIME        NULL,
  received_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '웹 수신 시각',
  updated_at       DATETIME        NULL     ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (link_id),
  UNIQUE KEY uq_link_client (client_uuid),
  KEY idx_link_bld_status (bld_id, status),
  KEY idx_link_record (record_id),
  CONSTRAINT fk_link_building FOREIGN KEY (bld_id) REFERENCES building (bld_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_link_sender FOREIGN KEY (sender_user_id) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_link_record FOREIGN KEY (record_id) REFERENCES survey_record (record_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_link_confirmer FOREIGN KEY (confirmed_by) REFERENCES users (user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='모바일 현장조사기록 수신함';

-- [B] 수신 사진
CREATE TABLE IF NOT EXISTS mobile_link_photo (
  photo_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사진ID (PK)',
  link_id     BIGINT UNSIGNED NOT NULL COMMENT '수신ID (FK)',
  file_name   VARCHAR(100)    NOT NULL COMMENT '서버 저장 파일 이름 (app.upload.dir 아래)',
  label       VARCHAR(30)     NULL     COMMENT '사진 설명 (외관 / 출입구 …)',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (photo_id),
  KEY idx_link_photo (link_id),
  CONSTRAINT fk_link_photo FOREIGN KEY (link_id) REFERENCES mobile_link_record (link_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='모바일 현장조사기록 사진';

-- [C] AI 현장 확인보고서
CREATE TABLE IF NOT EXISTS ai_report (
  report_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '보고서ID (PK)',
  bld_id       VARCHAR(28)     NOT NULL COMMENT '건물 (FK)',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '만든 사람 (FK)',
  title        VARCHAR(100)    NOT NULL COMMENT '보고서명 (예: 2025.10.14~2026.11.22 AI 보고서)',
  format       ENUM('PDF','HWPX') NOT NULL COMMENT '파일 포맷',
  period_from  DATE            NOT NULL COMMENT '사용한 현장조사이력 중 가장 오래된 날짜',
  period_to    DATE            NOT NULL COMMENT '사용한 현장조사이력 중 가장 최근 날짜',
  record_cnt   INT             NOT NULL COMMENT '사용한 현장조사이력 수',
  file_name    VARCHAR(200)    NOT NULL COMMENT '서버 저장 경로 (app.report.dir 기준 상대 경로)',
  content      MEDIUMTEXT      NULL     COMMENT '보고서 본문 JSON (미리보기와 같은 내용)',
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  KEY idx_report_bld (bld_id, created_at),
  CONSTRAINT fk_ai_report_building FOREIGN KEY (bld_id) REFERENCES building (bld_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ai_report_user FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 현장 확인보고서';

-- 확인
SELECT table_name, table_comment FROM information_schema.tables
 WHERE table_schema = 'itgeo' AND table_name IN ('mobile_link_record', 'mobile_link_photo', 'ai_report');
 
 CREATE TABLE IF NOT EXISTS itgeo.recent_view (
  user_id    BIGINT UNSIGNED NOT NULL,
  menu       ENUM('map','field','archive') NOT NULL COMMENT '상단 탭',
  url        VARCHAR(500)    NOT NULL COMMENT '다시 열 주소',
  title      VARCHAR(100)    NULL,
  sub        VARCHAR(100)    NULL,
  viewed_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, menu),
  FOREIGN KEY (user_id) REFERENCES itgeo.users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='이어서 보기';

CREATE TABLE IF NOT EXISTS itgeo.monthly_report (
  report_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  sgg_cd      CHAR(5)         NULL COMMENT '구 (NULL = 3개 구 전체)',
  ym          CHAR(7)         NOT NULL COMMENT 'yyyy-MM',
  content     MEDIUMTEXT      NOT NULL,
  status      ENUM('DRAFT','CONFIRMED') NOT NULL DEFAULT 'DRAFT',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  KEY idx_report_user_ym (user_id, ym),
  FOREIGN KEY (user_id) REFERENCES itgeo.users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='월간 현황 보고서';

SHOW TABLES FROM itgeo WHERE Tables_in_itgeo IN ('recent_view', 'monthly_report');
/* ---------- 되돌리기 ----------
DROP TABLE ai_report; DROP TABLE mobile_link_photo; DROP TABLE mobile_link_record;
*/
