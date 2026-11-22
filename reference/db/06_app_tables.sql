-- =====================================================================
-- ITGEO 앱 테이블 통합본 (2026-11-18)  01 ~ 05 다음에 실행
--   06_app_tables.sql(설계안) + 2026-11-18 DDL(모바일 앱 실제 저장용)을 합친 것
--   원칙 : 앱 코드가 실제로 쓰는 테이블(survey_record_detail, survey_photo)은 그대로 살리고,
--          06에서 겹치지 않는 것만 가져온다. 겹치던 survey_bld_check / survey_hh_check / attachment 는 뺀다.
--     [A] visit_history        : residency_id FK 추가                         (06 [A])
--     [B] survey_record        : 작성 상태·완료 잠금·AI 요약·오프라인 컬럼   (06 [B])
--     [C] survey_record_detail : 항목별 점수·거주자 상태·필요한 지원          (11-18 [A] 그대로)
--     [D] field_report         : 현장 신고                                    (06 [E])
--     [E] survey_photo         : 현장 사진. 신고 사진도 받도록 report_id 추가 (11-18 [B] + 06 [F])
--     [F] survey_schedule      : 달력                                         (06 [G])
--   [A][B]는 없는 칸 · 키만 추가, 나머지는 IF NOT EXISTS → 여러 번 실행해도 됨
-- =====================================================================
USE itgeo;
SET SQL_SAFE_UPDATES = 0;

-- [A] 방문이력 : 방문 호실 FK
-- (칸 · 키는 없을 때만 추가 → 여러 번 실행해도 됨)
SET @s = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'visit_history' AND index_name = 'idx_visit_residency') = 0,
  'ALTER TABLE visit_history ADD KEY idx_visit_residency (residency_id)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'visit_history' AND constraint_name = 'fk_visit_residency') = 0,
  'ALTER TABLE visit_history ADD CONSTRAINT fk_visit_residency FOREIGN KEY (residency_id) REFERENCES residency (residency_id) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- [B] 현장 기록 : 앱 컬럼
--   [확인] 앱이 방문 1번에 기록을 1개만 만드는지. 여러 개 만들면 uq_record_visit 줄을 지울 것
--   SELECT visit_id, COUNT(*) FROM survey_record GROUP BY visit_id HAVING COUNT(*) > 1;  -- 0줄이어야 함
SET @s = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND column_name = 'status') = 0,
  'ALTER TABLE survey_record ADD COLUMN status ENUM(''DRAFT'',''DONE'') NOT NULL DEFAULT ''DONE'' COMMENT ''작성 중 / 완료 (완료 = 잠금)'' AFTER score_adj', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND column_name = 'completed_at') = 0,
  'ALTER TABLE survey_record ADD COLUMN completed_at DATETIME NULL COMMENT ''완료(잠금) 시각'' AFTER status', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND column_name = 'ai_summary') = 0,
  'ALTER TABLE survey_record ADD COLUMN ai_summary TEXT NULL COMMENT ''AI 녹취 요약·보고서 초안'' AFTER completed_at', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND column_name = 'is_temp') = 0,
  'ALTER TABLE survey_record ADD COLUMN is_temp TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''오프라인 [임시] 기록 1/0'' AFTER ai_summary', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND column_name = 'client_uuid') = 0,
  'ALTER TABLE survey_record ADD COLUMN client_uuid CHAR(36) NULL COMMENT ''앱이 만든 ID (오프라인 재전송 중복 방지)'' AFTER is_temp', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND index_name = 'uq_record_visit') = 0,
  'ALTER TABLE survey_record ADD UNIQUE KEY uq_record_visit (visit_id)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
SET @s = IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'survey_record' AND index_name = 'uq_record_client') = 0,
  'ALTER TABLE survey_record ADD UNIQUE KEY uq_record_client (client_uuid)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
UPDATE survey_record SET completed_at = created_at WHERE status = 'DONE' AND completed_at IS NULL;

-- [C] 현장 기록 상세 (앱에서 저장한 기록만 한 줄)  ※ 11-18 DDL 그대로
CREATE TABLE IF NOT EXISTS survey_record_detail (
  record_id       BIGINT UNSIGNED NOT NULL COMMENT '기록ID (PK, survey_record FK)',
  resident_status VARCHAR(10)     NULL     COMMENT '거주자 상태 : 양호 / 주의 / 긴급 / 부재',
  scores          VARCHAR(500)    NULL     COMMENT '항목별 점수 JSON {"주변 환경":3,"침수 위험":4,…} (1~5)',
  supports        VARCHAR(300)    NULL     COMMENT '필요한 지원 (쉼표 구분) 예: 주거 지원,돌봄 연계',
  source          VARCHAR(10)     NOT NULL DEFAULT 'APP' COMMENT '어디서 저장했나 (APP)',
  PRIMARY KEY (record_id),
  CONSTRAINT fk_record_detail FOREIGN KEY (record_id) REFERENCES survey_record (record_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='현장 기록 상세 (모바일 앱)';

-- [D] 현장 신고  ※ 06 [E] 그대로
CREATE TABLE IF NOT EXISTS field_report (
  report_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '신고ID (PK)',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '신고자 (FK)',
  bld_id       VARCHAR(28)     NULL     COMMENT '대상 건물 (FK, 대상 밖이면 NULL)',
  addr         VARCHAR(100)    NOT NULL COMMENT '신고 위치 주소 (지도 API로 좌표 변환)',
  report_type  ENUM('LEDGER','FLOOD','ALONE','BROKEN','DIRTY','FIRE','ETC') NOT NULL
               COMMENT '대장과 다름/침수·배수/고립 의심/건물 파손/위생·쓰레기/화재·전기/기타·문의',
  ledger_diff  VARCHAR(200)    NULL     COMMENT '대장과 다른 부분 JSON ["옥탑 증축","반지하 거주",…]',
  content      TEXT            NULL     COMMENT '신고 내용',
  urgency      ENUM('NORMAL','QUICK') NOT NULL DEFAULT 'NORMAL' COMMENT '일반 / 빠른 확인',
  status       ENUM('RECEIVED','REVIEW','CANDIDATE','DONE') NOT NULL DEFAULT 'RECEIVED'
               COMMENT '접수 / 담당자 검토 / 발굴 후보 등록 / 조치 완료',
  is_temp      TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '오프라인 [임시저장] 1/0',
  client_uuid  CHAR(36)        NULL     COMMENT '앱이 만든 ID (오프라인 재전송 중복 방지)',
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  UNIQUE KEY uq_report_client (client_uuid),
  KEY idx_report_bld (bld_id),
  KEY idx_report_status (status, created_at),
  KEY idx_report_user (user_id),
  CONSTRAINT fk_report_user     FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_report_building FOREIGN KEY (bld_id)  REFERENCES building (bld_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='현장 신고 (앱)';

-- [E] 현장 사진  ※ 11-18 [B] 에 06 attachment 의 "신고 사진" 역할만 더함
--   record_id 를 NULL 허용으로 바꾸고 report_id 추가. 기존 앱 INSERT(record_id, file_name, label)는 그대로 동작
--   record_id 와 report_id 중 하나만 채우는 건 서버(Service)에서 확인 (CHECK 불가, Error 3823)
CREATE TABLE IF NOT EXISTS survey_photo (
  photo_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사진ID (PK)',
  record_id   BIGINT UNSIGNED NULL     COMMENT '기록ID (FK, 신고 사진이면 NULL)',
  report_id   BIGINT UNSIGNED NULL     COMMENT '신고ID (FK, 기록 사진이면 NULL)',
  file_name   VARCHAR(100)    NOT NULL COMMENT '서버 저장 파일 이름 (app.upload.dir 아래)',
  label       VARCHAR(30)     NULL     COMMENT '사진 설명 (외관 / 출입구 …)',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (photo_id),
  KEY idx_photo_record (record_id),
  KEY idx_photo_report (report_id),
  CONSTRAINT fk_photo_record FOREIGN KEY (record_id) REFERENCES survey_record (record_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_photo_report FOREIGN KEY (report_id) REFERENCES field_report (report_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='현장 사진 (기록·신고)';
-- 이미 11-18 DDL 로 survey_photo 를 만든 DB 라면 위 CREATE 는 건너뛰어지므로 아래 3줄을 한 번 실행
-- ALTER TABLE survey_photo MODIFY record_id BIGINT UNSIGNED NULL COMMENT '기록ID (FK, 신고 사진이면 NULL)',
--   ADD COLUMN report_id BIGINT UNSIGNED NULL COMMENT '신고ID (FK, 기록 사진이면 NULL)' AFTER record_id, ADD KEY idx_photo_report (report_id),
--   ADD CONSTRAINT fk_photo_report FOREIGN KEY (report_id) REFERENCES field_report (report_id) ON DELETE CASCADE ON UPDATE CASCADE;

-- [F] 달력 (풀캘린더)  ※ 06 [G] 그대로
CREATE TABLE IF NOT EXISTS survey_schedule (
  schedule_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일정ID (PK)',
  user_id      BIGINT UNSIGNED NOT NULL COMMENT '달력 주인 (FK)',
  survey_id    BIGINT UNSIGNED NOT NULL COMMENT '현장확인 리스트 (FK)',
  sched_date   DATE            NOT NULL COMMENT '일정 날짜',
  memo         VARCHAR(200)    NULL     COMMENT '메모',
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_id),
  UNIQUE KEY uq_schedule_survey_date (survey_id, sched_date),
  KEY idx_schedule_user_date (user_id, sched_date),
  CONSTRAINT fk_schedule_user   FOREIGN KEY (user_id)   REFERENCES users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_survey FOREIGN KEY (survey_id) REFERENCES survey_list (survey_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='달력 일정';

SET SQL_SAFE_UPDATES = 1;

-- 확인
SELECT table_name, table_comment FROM information_schema.tables
 WHERE table_schema = 'itgeo'
   AND table_name IN ('survey_record_detail','field_report','survey_photo','survey_schedule');

/* ---------- 되돌리기 ----------
DROP TABLE survey_schedule; DROP TABLE survey_photo; DROP TABLE field_report; DROP TABLE survey_record_detail;
ALTER TABLE survey_record DROP INDEX uq_record_client, DROP INDEX uq_record_visit,
  DROP COLUMN client_uuid, DROP COLUMN is_temp, DROP COLUMN ai_summary, DROP COLUMN completed_at, DROP COLUMN status;
ALTER TABLE visit_history DROP FOREIGN KEY fk_visit_residency, DROP INDEX idx_visit_residency;
*/
