-- =====================================================================
-- DB 이름 변경 wellfair → itgeo (2026-11-19, 프로젝트 이름을 ItGEO 로 통일)
--   이미 wellfair DB 를 쓰던 PC 에서 한 번만 실행. 새로 만드는 PC 는 01 ~ 06 이 처음부터 itgeo 로 만든다.
--   테이블과 데이터를 그대로 itgeo 로 옮긴다 (복사가 아니라 이동, 한 문장이라 전부 되거나 전부 안 됨).
--   끝나면 wellfair 는 빈 DB 로 남는다. 확인 후 지워도 됨:  DROP DATABASE wellfair;
--   Workbench 에서 이 파일 전체를 실행 (번개 아이콘).
-- =====================================================================
CREATE DATABASE IF NOT EXISTS itgeo DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET SESSION group_concat_max_len = 100000;
SELECT CONCAT('RENAME TABLE ',
              GROUP_CONCAT(CONCAT('wellfair.`', table_name, '` TO itgeo.`', table_name, '`') SEPARATOR ', '))
  INTO @rename_sql
  FROM information_schema.tables
 WHERE table_schema = 'wellfair' AND table_type = 'BASE TABLE';

-- wellfair 에 테이블이 없으면 여기서 오류가 난다 (옮길 것이 없다는 뜻)
PREPARE rename_stmt FROM @rename_sql;
EXECUTE rename_stmt;
DEALLOCATE PREPARE rename_stmt;

-- 확인: 테이블 수가 PC 에 있던 것과 같으면 끝
SELECT COUNT(*) AS itgeo_tables FROM information_schema.tables WHERE table_schema = 'itgeo';
