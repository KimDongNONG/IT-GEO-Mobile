package itgeo.to;

import java.util.List;

import lombok.Data;

/**
 * 취약 점수 기준값 + 지도 조회 조건 (쿼리 파라미터 → 그대로 바인딩).
 * 점수 SQL 은 mapper-building.xml 의 scoreExpr 한 곳. 여기 값이 #{...} 로 들어간다.
 * 가중치는 위험 유형 4묶음(기본 주거 공간 45 · 건물 상태 20 · 침수 위험 25 · 경제 여건 10). 묶음마다 0~100 을 따로 정하고,
 * 점수에는 비율로 환산해 넣는다 (getSpacePt … : 내 값 ÷ 켜진 묶음 값의 합 × 100). 100·100·100·100 → 25씩, 100·50·100·50 → 2:1:2:1
 */
@Data
public class AnalysisCriteriaTO {

	// ---- 요인 on/off · 기준값 (왼쪽 패널) ----
	private boolean ugrndOn = true;                              // 지하층 거주 (ugrnd_res = 1)          → 주거 공간
	private boolean gosiwonOn = true;                            // 고시원 (sp_type = '고시원')          → 주거 공간
	private boolean rooftopOn = true;                            // 옥탑 (bld_resident_stat.rooftop_hh_cnt > 0) → 주거 공간
	private boolean oldOn = true;     private int oldYears = 30; // 노후 (사용승인 N년+)                 → 건물 상태
	private boolean violOn = true;                               // 위반건축물 (viol_yn = '1')          → 건물 상태
	private boolean floodOn = true;   private int floodCnt = 1;  // 침수 (flood_cnt N회+)               → 침수 위험
	private boolean lowOn = true;     private double lowElev = 15; // 저지대 (elev_m N m 이하)          → 침수 위험
	private boolean cheapOn = true;   private double cheapPct = 20; // 저가 (price_pct N% 이하)         → 경제 여건

	// ---- 가중치 = 위험 유형 4묶음, 묶음마다 0~100 (2026-11-23). 점수 SQL 은 아래 get*Pt (합 100 으로 환산한 값) 를 쓴다 ----
	private int spaceW = 45;          // 주거 공간 (지하층 · 옥탑 · 고시원)
	private int bldW = 20;            // 건물 상태 (노후 · 위반건축물)
	private int floodW = 25;          // 침수 위험 (침수 이력 · 저지대)
	private int econW = 10;           // 경제 여건 (저가 주택)

	/** 묶음 요인이 하나라도 켜져 있나 (전부 꺼진 묶음은 가중치를 0 으로 보고 비율 계산에서 뺀다) */
	public boolean isSpaceActive() { return ugrndOn || gosiwonOn || rooftopOn; }
	public boolean isBldActive() { return oldOn || violOn; }
	public boolean isFloodActive() { return floodOn || lowOn; }
	public boolean isEconActive() { return cheapOn; }

	/** 켜진 묶음 가중치의 합 (0 이면 분석할 수 없음 → MapService.assertWeights 가 막는다) */
	public int getWeightSum() {
		return (isSpaceActive() ? spaceW : 0) + (isBldActive() ? bldW : 0) + (isFloodActive() ? floodW : 0) + (isEconActive() ? econW : 0);
	}
	private double pt(boolean active, int w) {
		int sum = getWeightSum();
		return !active || sum <= 0 ? 0 : w * 100.0 / sum;
	}
	/** 점수에 실제로 반영하는 묶음 점수 (합 100). mapper-building.xml 의 pt* 가 #{spacePt} … 로 쓴다 */
	public double getSpacePt() { return pt(isSpaceActive(), spaceW); }
	public double getBldPt() { return pt(isBldActive(), bldW); }
	public double getFloodPt() { return pt(isFloodActive(), floodW); }
	public double getEconPt() { return pt(isEconActive(), econW); }

	private int checkedMonths = 3;    // 현장 확인됨 기간 (9단계) : 3 | 12 | 0 = 전체 | -1 = 끄기. 범례의 "현장 확인됨" 에서 고른다
	private int scoreMin = 80;        // 이 점수 이상만 "위험" (결과 리스트 · 도넛 가운데 숫자 · 80점 이상만 보기)

	// ---- 지역 · 검색 ----
	private String gu;                // sgg_cd (11530 구로 / 11470 양천 / 11560 영등포), 없으면 전체
	private String dong;              // 법정동 emd_nm, 없으면 전체
	private String adm;               // 행정동 adm_nm (동 선택 2단계), 없으면 법정동 전체
	private List<String> adms;        // 행정동 여러 개 "법정동|행정동" (지도 동 선택 복수 선택). 있으면 dong · adm 대신 이 목록
	private String q;                 // 건물명·주소 검색어
	private String status;            // 보관함 탭 : TODO | DOING | DONE (없으면 전체)
	private String scen;              // 보관함 구분 선택칸 : base | rain | heat | cold | custom (저장할 때 쓴 가중치 시나리오, 없으면 전체)

	// ---- 보관함 [상세 필터] (archive.do, 5-1) : 비어 있으면 조건 없음 ----
	private List<String> factors;     // 취약 요인 키 (ugrnd rooftop gosiwon viol old flood low) → t.pt_<키> > 0
	private String factorMode = "all";// all = 고른 요인을 모두 가진 건물 / any = 하나라도
	private List<String> bands;       // 점수 구간 : 80 (80+) | 60 (60~79) | 40 (40~59), 저장 점수 기준
	private String use;               // 건물 용도 (use_nm)
	private boolean resHigh;          // 거주자 조건 : 고위험고립 있음 (bld_resident_stat.high_iso_cnt > 0)
	private boolean resOld75;         // 75세 이상 있음
	private boolean resSevere;        // 심한 장애 있음
	private List<String> visits;      // 방문 결과 : MET | ABSENT | REFUSED (기록이 하나라도 있으면)
	private String savedFrom;         // 저장일 기간 (yyyy-MM-dd)
	private String savedTo;
	private boolean fopen;            // 상세 필터 펼침 상태 (화면용)

	/** 상세 필터가 하나라도 걸려 있는지 (버튼 배지 · 펼침) */
	public int getFilterCount() {
		int n = 0;
		if (factors != null && !factors.isEmpty()) n++;
		if (bands != null && !bands.isEmpty()) n++;
		if (use != null && !use.isBlank()) n++;
		if (adm != null && !adm.isBlank()) n++;
		if (resHigh || resOld75 || resSevere) n++;
		if (visits != null && !visits.isEmpty()) n++;
		if ((savedFrom != null && !savedFrom.isBlank()) || (savedTo != null && !savedTo.isBlank())) n++;
		return n;
	}

	// ---- 지도 범위 (bbox=minLng,minLat,maxLng,maxLat → 서비스에서 풀어 넣음) ----
	private String bbox;
	private Double minLng, minLat, maxLng, maxLat;
	private int limit = 1500;         // 한 화면 핀 최대 수 (BUILDING_LIMIT)

	// ---- 격자 묶음 (clusters.do) : cell = 경도 도 단위 칸 크기, cellLat = cell × cos(기준위도) (서비스가 채움) ----
	private double cell;
	private double cellLat;
	private boolean snap = true;      // bbox 를 칸 경계까지 넓혀 가장자리 묶음도 칸 전체 건물 수로

	// ---- 결과 리스트 ----
	private String sort = "score";    // score | old | addr
	private int page = 1;
	private int size = 20;

	// ---- 상세 ----
	private String bldId;
	private Long userId;              // 보관함 여부 확인용 (세션 loginMember.userId)

	public int getOffset() {
		return (Math.max(page, 1) - 1) * size;
	}

	/** 목록 page 가 1 미만이면 1 로 (15단계 D-14). Lombok 은 같은 이름의 setter 가 있으면 만들지 않는다 */
	public void setPage(int page) {
		this.page = Math.max(1, page);
	}

	/** bbox 문자열을 min/max 로 풀어 넣는다. 형식이 다르면 범위 없음 */
	public void applyBbox() {
		if (bbox == null || bbox.isBlank()) return;
		String[] p = bbox.split(",");
		if (p.length != 4) return;
		try {
			minLng = Double.parseDouble(p[0].trim());
			minLat = Double.parseDouble(p[1].trim());
			maxLng = Double.parseDouble(p[2].trim());
			maxLat = Double.parseDouble(p[3].trim());
		} catch (NumberFormatException e) {
			minLng = minLat = maxLng = maxLat = null;
		}
	}
}
