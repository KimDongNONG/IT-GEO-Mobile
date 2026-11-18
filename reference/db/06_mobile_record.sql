-- =====================================================================
-- WellFAIR DB 변경 (2026-11-18)  01 ~ 05 다음에 실행. 여러 번 실행해도 됨 (IF NOT EXISTS)
--   모바일 앱(mobile/) 현장 기록을 웹과 같이 보기 위한 테이블 2개.
--   기존 survey_record 한 줄(= 현장 확인 1회)에 붙는다. 기존 테이블은 바꾸지 않는다.
--     [A] survey_record_detail : 앱에서 매긴 항목별 점수 · 거주자 상태 · 필요한 지원
--     [B] survey_photo         : 현장 사진 (파일은 서버 폴더, 여기엔 경로만)
-- =====================================================================
USE wellfair;

-- [A] 현장 기록 상세 (앱에서 저장한 기록만 한 줄. 웹에서 저장한 기록은 없음)
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

-- [B] 현장 사진
CREATE TABLE IF NOT EXISTS survey_photo (
  photo_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사진ID (PK)',
  record_id   BIGINT UNSIGNED NOT NULL COMMENT '기록ID (FK)',
  file_name   VARCHAR(100)    NOT NULL COMMENT '서버 저장 파일 이름 (app.upload.dir 아래)',
  label       VARCHAR(30)     NULL     COMMENT '사진 설명 (외관 / 출입구 …)',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (photo_id),
  KEY idx_photo_record (record_id),
  CONSTRAINT fk_photo_record FOREIGN KEY (record_id) REFERENCES survey_record (record_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='현장 사진 (모바일 앱)';
