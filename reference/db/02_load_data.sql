-- =====================================================================
-- itgeo 데이터 적재  (01_create_tables.sql 실행 후)
--
-- 준비
--   * MySQL Workbench: 연결 편집 > Advanced > Others 에  OPT_LOCAL_INFILE=1  추가 후 재접속
--   * 서버도 허용:  SET GLOBAL local_infile = 1;   (root로 한 번)
--   * 파일 위치 (다르면 경로만 고치기)
--       C:/final_data/itgeo_db/3gu_bld_db.csv                         UTF-8, 콤마
--       C:/final_data/itgeo_db/{guro,yangcheon}_population_dummy.csv   EUC-KR(cp949), 탭
--       C:/final_data/itgeo_db/yeongdeungpo_population_dummy.csv        UTF-8, 쉼표 (컬럼 순서 다름)
--       C:/final_data/itgeo_db/bld_adm_dong.csv                       UTF-8, 콤마 (03에서 사용)
--
-- 흐름
--   building  ← 3gu_bld_db.csv 바로
--   더미 3개  → stg_pop (임시, 한 줄 = 한 사람)
--             → household (가구당 1줄) / person (사람당 1줄) / residency (가구당 1줄) / arrears (가구당 1줄)
--   ID 오프셋: 구로 +1,000,000 / 양천 +2,000,000 / 영등포 +3,000,000  (원본 ID 최대 40만이라 안 겹침)
-- =====================================================================
USE itgeo;
SET GLOBAL local_infile = 1;

-- ---------------------------------------------------------------------
-- 1. 건물 72,961행
-- ---------------------------------------------------------------------
LOAD DATA LOCAL INFILE 'C:/final_data/itgeo_db/3gu_bld_db.csv' INTO TABLE building
  CHARACTER SET utf8mb4
  FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"'
  LINES TERMINATED BY '\n'
  IGNORE 1 LINES
  (bld_id, sgg_cd, emd_nm, addr, @bld_nm, @dong_nm, @use_cd, @use_nm, @grnd_flr, @ugrnd_flr, @useapr_day, @viol_yn, @units,
   ugrnd_res, nonres_hh, @sp_type, @sp_nm, elev_m, slope_deg, flood_cnt, flood_depth, @price_type, @price_pct,
   hosp_nm, hosp_dist, bus_nm, bus_dist, welf_nm, welf_dist, lng, lat,
   @rent_yn, @narrow_rd, @strct_nm, @ugrnd_units)   -- 11/16 추가 4컬럼 (db csv 35컬럼)
  SET bld_nm     = NULLIF(@bld_nm,''),     dong_nm    = NULLIF(@dong_nm,''),
      use_cd     = NULLIF(@use_cd,''),     use_nm     = NULLIF(@use_nm,''),
      grnd_flr   = NULLIF(@grnd_flr,''),   ugrnd_flr  = NULLIF(@ugrnd_flr,''),
      useapr_day = NULLIF(@useapr_day,''), viol_yn    = NULLIF(@viol_yn,''),
      units      = NULLIF(@units,''),      sp_type    = NULLIF(@sp_type,''),
      sp_nm      = NULLIF(@sp_nm,''),      price_type = NULLIF(@price_type,''),
      price_pct  = NULLIF(@price_pct,''),
      rent_yn    = NULLIF(@rent_yn,''),    narrow_rd   = NULLIF(@narrow_rd,''),
      strct_nm   = NULLIF(@strct_nm,''),   ugrnd_units = NULLIF(@ugrnd_units,'');

-- ---------------------------------------------------------------------
-- 2. 더미 → 임시 테이블 (더미 76개 컬럼 + 구 정보)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS stg_pop;
CREATE TABLE stg_pop (
  mbr_id VARCHAR(10), hh_id VARCHAR(10), mbr_nm VARCHAR(50), hh_head_nm VARCHAR(50), head_rel VARCHAR(10),
  hh_mbr_cnt VARCHAR(5), single_hh_yn VARCHAR(1), sex VARCHAR(2), age VARCHAR(5), birth_day VARCHAR(6),
  res_area VARCHAR(20), res_unknown_yn VARCHAR(1), risk_grade VARCHAR(10), bld_id VARCHAR(28), addr VARCHAR(100),
  use_nm VARCHAR(30), res_flr VARCHAR(10), dsbl_yn VARCHAR(1), dsbl_grade_nm VARCHAR(20), single_parent_yn VARCHAR(1),
  basic_pension_yn VARCHAR(1), near_poor_yn VARCHAR(1), nhis_arrears_yn VARCHAR(1), care_burden_yn VARCHAR(1), dsbl_type VARCHAR(10),
  basic_living_yn VARCHAR(1), hh_type VARCHAR(10), blind_spot_yn VARCHAR(1), blind_spot_type VARCHAR(10), sys_detect_yn VARCHAR(1),
  detect_cnt VARCHAR(5), crisis_info VARCHAR(200), detect_result VARCHAR(10), non_target_rsn VARCHAR(20), support_type VARCHAR(10),
  dong_nm VARCHAR(50), ho_nm VARCHAR(30), orig_res_flr VARCHAR(10), match_how VARCHAR(50), move_how VARCHAR(30),
  vet_type VARCHAR(30), vet_rel_type VARCHAR(30), vet_mon_amt VARCHAR(30), wage_tot_amt VARCHAR(30), biz_close_yn VARCHAR(30), biz_close_ind_nm VARCHAR(30),
  biz_open_day VARCHAR(30), biz_close_day VARCHAR(30), gi_rpt_yn VARCHAR(30), gi_amt VARCHAR(30), nps_type VARCHAR(30), nps_mon_amt VARCHAR(30),
  eitc_yn VARCHAR(30), eitc_amt VARCHAR(30), ctc_yn VARCHAR(30), ctc_amt VARCHAR(30), natl_tax_arrears_yn VARCHAR(30), natl_tax_arrears_amt VARCHAR(30),
  natl_tax_cert_yn VARCHAR(30), local_tax_arrears_yn VARCHAR(30), local_tax_arrears_amt VARCHAR(30), local_tax_cert_yn VARCHAR(30), ei_insured_yn VARCHAR(30), ei_loss_day VARCHAR(30),
  ui_yn VARCHAR(30), ui_mon_amt VARCHAR(30), recog_inc_mon_amt VARCHAR(30), med_inc_ratio VARCHAR(30), near_poor_copay_yn VARCHAR(30), dsbl_pension_type VARCHAR(30),
  dsbl_pension_mon_amt VARCHAR(30), nhis_qual_type VARCHAR(30), nhis_qual_chg_day VARCHAR(30), nhis_prem_mon_amt VARCHAR(30), elec_arrears_yn VARCHAR(30), gas_dc_type VARCHAR(30),
  sgg_cd CHAR(5), mbr_key BIGINT UNSIGNED, hh_key BIGINT UNSIGNED,
  KEY idx_stg_hh (hh_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 구로 11530  +1,000,000
LOAD DATA LOCAL INFILE 'C:/final_data/itgeo_db/guro_population_dummy.csv' INTO TABLE stg_pop
  CHARACTER SET euckr FIELDS TERMINATED BY '\t' LINES TERMINATED BY '\n' IGNORE 1 LINES
  (mbr_id, hh_id, mbr_nm, hh_head_nm, head_rel, hh_mbr_cnt, single_hh_yn, sex, age, birth_day,
   res_area, res_unknown_yn, risk_grade, bld_id, addr, use_nm, res_flr, dsbl_yn, dsbl_grade_nm, single_parent_yn,
   basic_pension_yn, near_poor_yn, nhis_arrears_yn, care_burden_yn, dsbl_type, basic_living_yn, hh_type, blind_spot_yn, blind_spot_type, sys_detect_yn,
   detect_cnt, crisis_info, detect_result, non_target_rsn, support_type, dong_nm, ho_nm, orig_res_flr, match_how, move_how,
   vet_type, vet_rel_type, vet_mon_amt, wage_tot_amt, biz_close_yn, biz_close_ind_nm, biz_open_day, biz_close_day, gi_rpt_yn,
   gi_amt, nps_type, nps_mon_amt, eitc_yn, eitc_amt, ctc_yn, ctc_amt, natl_tax_arrears_yn, natl_tax_arrears_amt,
   natl_tax_cert_yn, local_tax_arrears_yn, local_tax_arrears_amt, local_tax_cert_yn, ei_insured_yn, ei_loss_day, ui_yn, ui_mon_amt, recog_inc_mon_amt,
   med_inc_ratio, near_poor_copay_yn, dsbl_pension_type, dsbl_pension_mon_amt, nhis_qual_type, nhis_qual_chg_day, nhis_prem_mon_amt, elec_arrears_yn, gas_dc_type)
  SET sgg_cd = '11530', mbr_key = mbr_id + 1000000, hh_key = hh_id + 1000000;

-- 양천 11470  +2,000,000
LOAD DATA LOCAL INFILE 'C:/final_data/itgeo_db/yangcheon_population_dummy.csv' INTO TABLE stg_pop
  CHARACTER SET euckr FIELDS TERMINATED BY '\t' LINES TERMINATED BY '\n' IGNORE 1 LINES
  (mbr_id, hh_id, mbr_nm, hh_head_nm, head_rel, hh_mbr_cnt, single_hh_yn, sex, age, birth_day,
   res_area, res_unknown_yn, risk_grade, bld_id, addr, use_nm, res_flr, dsbl_yn, dsbl_grade_nm, single_parent_yn,
   basic_pension_yn, near_poor_yn, nhis_arrears_yn, care_burden_yn, dsbl_type, basic_living_yn, hh_type, blind_spot_yn, blind_spot_type, sys_detect_yn,
   detect_cnt, crisis_info, detect_result, non_target_rsn, support_type, dong_nm, ho_nm, orig_res_flr, match_how, move_how,
   vet_type, vet_rel_type, vet_mon_amt, wage_tot_amt, biz_close_yn, biz_close_ind_nm, biz_open_day, biz_close_day, gi_rpt_yn,
   gi_amt, nps_type, nps_mon_amt, eitc_yn, eitc_amt, ctc_yn, ctc_amt, natl_tax_arrears_yn, natl_tax_arrears_amt,
   natl_tax_cert_yn, local_tax_arrears_yn, local_tax_arrears_amt, local_tax_cert_yn, ei_insured_yn, ei_loss_day, ui_yn, ui_mon_amt, recog_inc_mon_amt,
   med_inc_ratio, near_poor_copay_yn, dsbl_pension_type, dsbl_pension_mon_amt, nhis_qual_type, nhis_qual_chg_day, nhis_prem_mon_amt, elec_arrears_yn, gas_dc_type)
  SET sgg_cd = '11470', mbr_key = mbr_id + 2000000, hh_key = hh_id + 2000000;

-- 영등포 11560  +3,000,000  (UTF-8, 쉼표, 아파트_동~세대이동_방식 5개가 층수 바로 뒤)
LOAD DATA LOCAL INFILE 'C:/final_data/itgeo_db/yeongdeungpo_population_dummy.csv' INTO TABLE stg_pop
  CHARACTER SET utf8mb4 FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' LINES TERMINATED BY '\n' IGNORE 1 LINES
  (mbr_id, hh_id, mbr_nm, hh_head_nm, head_rel, hh_mbr_cnt, single_hh_yn, sex, age, birth_day,
   res_area, res_unknown_yn, risk_grade, bld_id, addr, use_nm, res_flr, dong_nm, ho_nm, orig_res_flr, match_how, move_how,
   dsbl_yn, dsbl_grade_nm, single_parent_yn,
   basic_pension_yn, near_poor_yn, nhis_arrears_yn, care_burden_yn, dsbl_type, basic_living_yn, hh_type, blind_spot_yn, blind_spot_type, sys_detect_yn,
   detect_cnt, crisis_info, detect_result, non_target_rsn, support_type,
   vet_type, vet_rel_type, vet_mon_amt, wage_tot_amt, biz_close_yn, biz_close_ind_nm, biz_open_day, biz_close_day, gi_rpt_yn,
   gi_amt, nps_type, nps_mon_amt, eitc_yn, eitc_amt, ctc_yn, ctc_amt, natl_tax_arrears_yn, natl_tax_arrears_amt,
   natl_tax_cert_yn, local_tax_arrears_yn, local_tax_arrears_amt, local_tax_cert_yn, ei_insured_yn, ei_loss_day, ui_yn, ui_mon_amt, recog_inc_mon_amt,
   med_inc_ratio, near_poor_copay_yn, dsbl_pension_type, dsbl_pension_mon_amt, nhis_qual_type, nhis_qual_chg_day, nhis_prem_mon_amt, elec_arrears_yn, gas_dc_type)
  SET sgg_cd = '11560', mbr_key = mbr_id + 3000000, hh_key = hh_id + 3000000;

-- 확인 : 구마다 bad = 0 이어야 한다. 0 이 아니면 아래 3번을 실행하지 말 것 (household 에서 Error 1048)
--   bad 가 total 과 같음 → 그 구 LOAD 의 CHARACTER SET · FIELDS 가 파일과 다름 (영등포 = utf8mb4 · 쉼표)
--   bad 가 1 ~ 몇 줄     → 파일의 빈 줄. SET SQL_SAFE_UPDATES = 0; DELETE FROM stg_pop WHERE hh_key IS NULL; 후 진행
SELECT sgg_cd, COUNT(*) AS total, SUM(hh_key IS NULL) AS bad FROM stg_pop GROUP BY sgg_cd;

-- ---------------------------------------------------------------------
-- 3. 임시 → 본 테이블
-- ---------------------------------------------------------------------
-- 가구: 가구 안에서 같은 값만 담으니까 DISTINCT로 가구당 1줄
INSERT INTO household (hh_id, sgg_cd, hh_mbr_cnt, single_hh_yn, hh_type, single_parent_yn, basic_living_yn,
                       near_poor_yn, care_burden_yn, risk_grade, blind_spot_yn, blind_spot_type,
                       eitc_yn, eitc_amt, ctc_yn, ctc_amt, recog_inc_mon_amt, med_inc_ratio, elec_arrears_yn, gas_dc_type)
SELECT DISTINCT hh_key, sgg_cd, hh_mbr_cnt, single_hh_yn, NULLIF(hh_type,''), single_parent_yn, basic_living_yn,
       near_poor_yn, care_burden_yn, NULLIF(risk_grade,''), blind_spot_yn, NULLIF(blind_spot_type,''),
       NULLIF(eitc_yn,''), NULLIF(eitc_amt,''), NULLIF(ctc_yn,''), NULLIF(ctc_amt,''), NULLIF(recog_inc_mon_amt,''), NULLIF(med_inc_ratio,''), NULLIF(elec_arrears_yn,''), NULLIF(gas_dc_type,'')
FROM stg_pop;

-- 개인: 한 줄 = 한 사람
INSERT INTO person (mbr_id, hh_id, mbr_nm, head_rel, sex, age, birth_day, res_area, res_unknown_yn,
                    dsbl_yn, dsbl_grade_nm, dsbl_type, basic_pension_yn,
                    sys_detect_yn, detect_cnt, crisis_info, detect_result, non_target_rsn, support_type,
                    vet_type, vet_rel_type, vet_mon_amt, wage_tot_amt, biz_close_yn, biz_close_ind_nm, biz_open_day,
                    biz_close_day, gi_rpt_yn, gi_amt, nps_type, nps_mon_amt, natl_tax_arrears_yn, natl_tax_arrears_amt,
                    natl_tax_cert_yn, local_tax_arrears_yn, local_tax_arrears_amt, local_tax_cert_yn, ei_insured_yn, ei_loss_day, ui_yn,
                    ui_mon_amt, near_poor_copay_yn, dsbl_pension_type, dsbl_pension_mon_amt, nhis_qual_type, nhis_qual_chg_day, nhis_prem_mon_amt)
SELECT mbr_key, hh_key, mbr_nm, head_rel, sex, age, birth_day, NULLIF(res_area,''), res_unknown_yn,
       dsbl_yn, NULLIF(dsbl_grade_nm,''), NULLIF(dsbl_type,''), basic_pension_yn,
       sys_detect_yn, NULLIF(detect_cnt,''), NULLIF(crisis_info,''), NULLIF(detect_result,''),
       NULLIF(non_target_rsn,''), NULLIF(support_type,''),
       NULLIF(vet_type,''), NULLIF(vet_rel_type,''), NULLIF(vet_mon_amt,''), NULLIF(wage_tot_amt,''), NULLIF(biz_close_yn,''),
       NULLIF(biz_close_ind_nm,''), NULLIF(biz_open_day,''), NULLIF(biz_close_day,''), NULLIF(gi_rpt_yn,''), NULLIF(gi_amt,''),
       NULLIF(nps_type,''), NULLIF(nps_mon_amt,''), NULLIF(natl_tax_arrears_yn,''), NULLIF(natl_tax_arrears_amt,''), NULLIF(natl_tax_cert_yn,''),
       NULLIF(local_tax_arrears_yn,''), NULLIF(local_tax_arrears_amt,''), NULLIF(local_tax_cert_yn,''), NULLIF(ei_insured_yn,''), NULLIF(ei_loss_day,''),
       NULLIF(ui_yn,''), NULLIF(ui_mon_amt,''), NULLIF(near_poor_copay_yn,''), NULLIF(dsbl_pension_type,''), NULLIF(dsbl_pension_mon_amt,''),
       NULLIF(nhis_qual_type,''), NULLIF(nhis_qual_chg_day,''), NULLIF(nhis_prem_mon_amt,'')
FROM stg_pop;

-- 입주: 가구원 모두 같은 건물·층·동·호라서 DISTINCT로 가구당 1줄
INSERT INTO residency (hh_id, bld_id, res_flr, dong_nm, ho_nm)
SELECT DISTINCT hh_key, bld_id, NULLIF(res_flr,''), NULLIF(dong_nm,''), NULLIF(ho_nm,'')
FROM stg_pop;

-- 체납: 건보료는 세대 단위 → 가구원 중 한 명이라도 Y면 Y  ('Y' > 'N' 이라 MAX)
INSERT INTO arrears (residency_id, arrears_type, nhis_arrears_yn)
SELECT r.residency_id, 'HEALTH_INS', MAX(s.nhis_arrears_yn)
FROM stg_pop s JOIN residency r ON r.hh_id = s.hh_key
GROUP BY r.residency_id;

-- 중간점검용 로그인 계정 (비밀번호는 myabweb처럼 평문 비교. 최종 때 해시로 바꾸기)
INSERT INTO users (login_id, password_hash) VALUES ('admin', '1234');

-- ---------------------------------------------------------------------
-- 4. 확인 (기대값)
-- ---------------------------------------------------------------------
SELECT 'building'  t, COUNT(*) n FROM building    -- 72,961
UNION ALL SELECT 'household', COUNT(*) FROM household  -- 500,542
UNION ALL SELECT 'person',    COUNT(*) FROM person     -- 1,071,736
UNION ALL SELECT 'residency', COUNT(*) FROM residency  -- 500,542
UNION ALL SELECT 'arrears',   COUNT(*) FROM arrears;   -- 500,542

-- 이상 없으면 임시 테이블 삭제
-- DROP TABLE stg_pop;
