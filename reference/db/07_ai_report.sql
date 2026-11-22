-- =====================================================================
-- ITGEO DB 변경 : AI 현장 확인보고서 + 대시보드  (01 ~ 06 다음에 실행)
--   여러 번 실행해도 됨 (IF NOT EXISTS · IF EXISTS)
--     예전 [A][B] mobile_link_record · mobile_link_photo : 지운다 (모바일 앱 기록은 06 의 survey_record_detail · survey_photo)
--     [C] ai_report      : 05 건물 확인 이력에서 만든 AI 현장 확인보고서 (파일은 app.report.dir 아래)
--     recent_view · monthly_report : 대시보드 "이어서 보기" · 월간 현황 보고서
-- =====================================================================
USE itgeo;
SET GLOBAL local_infile = 1;

-- 예전 [A][B] 모바일 연동 수신함은 06 의 survey_record_detail · survey_photo (dongnong 앱 방식) 로 바꿔 지운다
DROP TABLE IF EXISTS mobile_link_photo;
DROP TABLE IF EXISTS mobile_link_record;

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
 WHERE table_schema = 'itgeo' AND table_name IN ('ai_report');
 
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
DROP TABLE ai_report; DROP TABLE recent_view; DROP TABLE monthly_report;
*/
