package itgeo.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import itgeo.common.BadRequestException;
import itgeo.dao.BuildingDAO;
import itgeo.to.AnalysisCriteriaTO;
import itgeo.to.BuildingDetailTO;
import itgeo.to.BuildingMarkerTO;
import itgeo.to.BuildingTO;
import itgeo.to.ClusterTO;
import itgeo.to.DongTO;
import itgeo.to.GuTO;
import itgeo.to.PageTO;
import itgeo.to.ResidentCountTO;
import itgeo.to.ScoreFactorTO;
import itgeo.to.ScoreItemTO;

// 메인(분석 지도). BuildingDAO 는 여기서만. 거주자는 ResidentService 를 거친다
@Service
public class MapService {

	/** 격자의 기준위도 (살피구로 refLat : 전체 건물 평균 위도로 고정) */
	static final double REF_LAT = 37.5;

	static final Map<String, String> GU_NAME = new LinkedHashMap<>();
	static {
		GU_NAME.put("11530", "구로구");
		GU_NAME.put("11470", "양천구");
		GU_NAME.put("11560", "영등포구");
	}

	@Autowired
	BuildingDAO dao;

	@Autowired
	ResidentService residentService;

	private Map<String, List<double[]>> ringCache;   // sgg_cd → 볼록 껍질 [[lng,lat],...] (한 번 계산)

	// 법정동 목록 (보관함 필터 등)
	public List<DongTO> getDongList() {
		return dao.getDongList(null);
	}

	/** 동 선택 2단계 (5-1) : 법정동 줄마다 행정동 목록(adms)을 단다. gu 가 없으면 3개 구 전체 */
	public List<DongTO> getDongTree(String gu) {
		List<DongTO> emds = dao.getDongList(gu);
		Map<String, DongTO> byKey = new HashMap<>();
		for (DongTO e : emds) byKey.put(e.getSggCd() + "|" + e.getEmdNm(), e);
		for (DongTO a : dao.getAdmList(gu)) {
			DongTO e = byKey.get(a.getSggCd() + "|" + a.getEmdNm());
			if (e != null && isAdmPair(a.getSggCd(), a.getEmdNm(), a.getAdmNm())) e.getAdms().add(a);
		}
		return emds;
	}

	/**
	 * 법정동 아래에 보여 줄 행정동 짝 (경계가 실제로 겹치는 짝 : 법정동 면적 10% 이상 또는 행정동 면적 30% 이상).
	 * 건물 행정동은 좌표로 붙였기 때문에 경계선 근처 건물 몇 동이 옆 행정동으로 잡혀(신월동 아래 목5동 · 신정3동 등) 목록이 섞였다.
	 * 그런 건물은 법정동 전체를 고르면 그대로 나오고, 행정동 목록에만 안 보인다. 표에 없는 법정동은 거르지 않는다
	 */
	private static final Map<String, Set<String>> ADM_PAIRS = new HashMap<>();
	static {
		// 양천구
		pair("11470", "목동", "목1동", "목2동", "목3동", "목4동", "목5동");
		pair("11470", "신월동", "신월1동", "신월2동", "신월3동", "신월4동", "신월5동", "신월6동", "신월7동");
		pair("11470", "신정동", "신정1동", "신정2동", "신정3동", "신정4동", "신정6동", "신정7동");
		// 구로구
		pair("11530", "가리봉동", "가리봉동");
		pair("11530", "개봉동", "개봉1동", "개봉2동", "개봉3동");
		pair("11530", "고척동", "고척1동", "고척2동");
		pair("11530", "구로동", "구로1동", "구로2동", "구로3동", "구로4동", "구로5동");
		pair("11530", "궁동", "수궁동");
		pair("11530", "신도림동", "신도림동");
		pair("11530", "오류동", "오류1동", "오류2동");
		pair("11530", "온수동", "수궁동");
		pair("11530", "천왕동", "오류2동");
		pair("11530", "항동", "항동");
		// 영등포구
		pair("11560", "당산동", "당산2동");
		for (String g : new String[] { "1", "2", "3" }) pair("11560", "당산동" + g + "가", "당산1동");
		for (String g : new String[] { "4", "5", "6" }) pair("11560", "당산동" + g + "가", "당산2동");
		pair("11560", "대림동", "대림1동", "대림2동", "대림3동");
		pair("11560", "도림동", "도림동");
		for (int g = 1; g <= 6; g++) pair("11560", "문래동" + g + "가", "문래동");
		pair("11560", "신길동", "신길1동", "신길3동", "신길4동", "신길5동", "신길6동", "신길7동", "영등포본동");
		pair("11560", "양평동", "양평1동", "양평2동");
		pair("11560", "양평동1가", "양평1동");
		pair("11560", "양평동2가", "양평1동");
		pair("11560", "양평동3가", "양평1동", "양평2동");
		for (String g : new String[] { "4", "5", "6" }) pair("11560", "양평동" + g + "가", "양평2동");
		pair("11560", "양화동", "양평2동");
		pair("11560", "여의도동", "여의동");
		pair("11560", "영등포동", "영등포본동", "도림동");   // 영등포동 건물 12% 가 도림동 (건물 좌표로 확인 2026-11-22)
		for (int g = 1; g <= 8; g++) pair("11560", "영등포동" + g + "가", "영등포동");
	}

	private static void pair(String sggCd, String emdNm, String... admNms) {
		ADM_PAIRS.computeIfAbsent(sggCd + "|" + emdNm, k -> new HashSet<>()).addAll(Arrays.asList(admNms));
	}

	static boolean isAdmPair(String sggCd, String emdNm, String admNm) {
		Set<String> ok = ADM_PAIRS.get(sggCd + "|" + emdNm);
		return ok == null || ok.contains(admNm);
	}

	/** 구 단위 (zoom 14 이하) : 경계 + "위험 N곳". 경계는 building 좌표의 볼록 껍질 */
	public List<GuTO> getGuList(AnalysisCriteriaTO c) {
		Map<String, List<double[]>> rings = rings();
		List<GuTO> out = new ArrayList<>();
		for (GuTO g : dao.getGuSummary(c)) {
			g.setName(GU_NAME.getOrDefault(g.getSggCd(), g.getSggCd()));
			g.setRing(rings.get(g.getSggCd()));
			out.add(g);
		}
		return out;
	}

	/** 격자 묶음 (살피구로 AnalysisService.clusters() 를 SQL 로) */
	public List<ClusterTO> getClusterList(AnalysisCriteriaTO c) {
		c.applyBbox();
		if (c.getMinLat() == null) return new ArrayList<>();
		double cell = Math.max(1e-5, Math.min(c.getCell(), 5.0));
		double cellLat = cell * Math.cos(Math.toRadians(REF_LAT));
		c.setCell(cell);
		c.setCellLat(cellLat);
		if (c.isSnap()) {   // bbox 를 칸 경계까지 넓혀서 가장자리 묶음도 칸 전체 건물 수를 보여준다
			c.setMinLng(Math.floor(c.getMinLng() / cell) * cell);
			c.setMinLat(Math.floor(c.getMinLat() / cellLat) * cellLat);
			c.setMaxLng((Math.floor(c.getMaxLng() / cell) + 1) * cell);
			c.setMaxLat((Math.floor(c.getMaxLat() / cellLat) + 1) * cellLat);
		}
		List<ClusterTO> list = dao.getClusterList(c);
		for (ClusterTO cl : list) {
			cl.setCell(new double[] { cl.getIx() * cell, cl.getIy() * cellLat, (cl.getIx() + 1) * cell, (cl.getIy() + 1) * cellLat });
			if (cl.getSize() == 1) {   // 칸에 건물이 1동이면 핀으로
				BuildingMarkerTO p = new BuildingMarkerTO();
				p.setBldId(cl.getOneBldId());
				p.setLat(cl.getLat());
				p.setLng(cl.getLng());
				p.setScore(cl.getMaxScore());
				p.setBldNm(cl.getOneBldNm());
				p.setAddr(cl.getOneAddr());
				p.setUseNm(cl.getOneUseNm());
				cl.setPoint(p);
			}
		}
		return list;
	}

	// 확대 : bbox 안 건물 핀 (점수 높은 순 limit)
	public List<BuildingMarkerTO> getMarkerList(AnalysisCriteriaTO c) {
		c.applyBbox();
		if (c.getMinLat() == null) return new ArrayList<>();   // 범위 없이는 조회하지 않음
		if (c.getLimit() <= 0 || c.getLimit() > 3000) c.setLimit(1500);
		return dao.getMarkerList(c);
	}

	// 분석 전 : 현장 확인됨 핀
	public List<BuildingMarkerTO> getCheckedList(AnalysisCriteriaTO c) {
		return dao.getCheckedList(c);
	}

	// 오른쪽 결과 리스트. 범위 = gu/dong/adm (기본 구 전체) 또는 bbox ("지도 화면 안", [이 지역에서 재검색])
	public PageTO<BuildingTO> getResultPage(AnalysisCriteriaTO c) {
		c.applyBbox();
		if (c.getSize() <= 0 || c.getSize() > 100) c.setSize(20);
		int total = dao.getResultCount(c);
		List<BuildingTO> list = dao.getResultList(c);
		int rank = c.getOffset();
		for (BuildingTO b : list) b.setRank(++rank);
		return new PageTO<>(c.getPage(), c.getSize(), total, list);
	}

	/** 가중치 4묶음은 각각 0~100, 합 100 이어야 계산한다 (15단계 B-6). 화면은 늘 100 을 맞추므로 주소를 직접 고친 경우 대비. 아니면 400 */
	public static final String MSG_WEIGHT = "가중치는 묶음마다 0~100 사이로 정해 주세요";
	public static final String MSG_WEIGHT_ZERO = "켜진 요인의 가중치를 하나 이상 0보다 크게 해 주세요";
	/** 묶음 가중치는 각각 0~100, 켜진 묶음 합은 0 보다 커야 한다 (점수에는 비율로 환산 : AnalysisCriteriaTO.getSpacePt …) */
	public static void assertWeights(AnalysisCriteriaTO c) {
		int[] w = { c.getSpaceW(), c.getBldW(), c.getFloodW(), c.getEconW() };
		for (int v : w) {
			if (v < 0 || v > 100) throw new BadRequestException(MSG_WEIGHT);
		}
		if (c.getWeightSum() <= 0) throw new BadRequestException(MSG_WEIGHT_ZERO);
	}

	// 건물의 구 코드 (없는 건물이면 null). 구청 계정 관할 확인용 (15단계 A)
	public String getBuildingSgg(String bldId) {
		return bldId == null || bldId.isBlank() ? null : dao.getBuildingSgg(bldId);
	}

	// 건물 상세 : 건물 + 점수 구성 + 거주자 집계
	public BuildingDetailTO getBuildingDetail(AnalysisCriteriaTO c) {
		BuildingTO b = dao.getBuilding(c);
		if (b == null) return null;
		BuildingDetailTO d = new BuildingDetailTO();
		d.setBuilding(b);
		d.setScoreItems(buildScoreItems(b, c));
		ResidentCountTO rc = residentService.getResidentCount(b.getBldId());
		d.setResidents(rc);
		return d;
	}

	/** 점수 구성 = 위험 유형 4묶음 (10단계 규칙). 주거 공간 · 경제 여건 = 하나라도 맞으면 전부, 건물 상태 · 침수 위험 = 맞은 수 ÷ 켜진 수.
	 *  members 한 줄 = { desc 용 이름, 요인 점수(맞으면 > 0), 켜짐, 표의 요인 이름, 이 건물 값, 기준 }.
	 *  뒤의 셋은 펼침 표(ScoreFactorTO)용이고 점수 계산에는 쓰지 않는다. 기준 숫자는 지금 분석 조건(c)의 값 그대로 (2026-11-17 K) */
	private List<ScoreItemTO> buildScoreItems(BuildingTO b, AnalysisCriteriaTO c) {
		List<ScoreItemTO> items = new ArrayList<>();
		String none = "없음";
		items.add(anyGroup("space", "주거 공간", c.getSpacePt(), new Object[][] {
				{ "반지하", b.getPtUgrnd(), c.isUgrndOn(), "반지하", b.getUgrndRes() > 0 ? "지하 거주 있음" : none, "지하 거주 등록" },
				// 옥탑 여부는 건물 자료가 아니라 거주자 요약(옥탑층 거주 가구)이라 점수로만 알 수 있다 → 꺼져 있으면 "-"
				{ "옥탑", b.getPtRooftop(), c.isRooftopOn(), "옥탑", b.getPtRooftop() > 0 ? "옥탑층 거주 있음" : c.isRooftopOn() ? none : "-", "옥탑층 거주" },
				{ "고시원", b.getPtGosiwon(), c.isGosiwonOn(), "고시원", "고시원".equals(b.getSpType()) ? "고시원" : none, "대장 유형 고시원" } }));
		items.add(ratioGroup("bld", "건물 상태", c.getBldPt(), new Object[][] {
				{ "노후 " + c.getOldYears() + "년+" + (b.getBldAge() != null ? " (" + b.getBldAge() + "년 경과)" : ""), b.getPtOld(), c.isOldOn(),
					"노후", b.getBldAge() != null ? b.getBldAge() + "년 경과" : "자료 없음", "준공 " + c.getOldYears() + "년 이상" },
				{ "위반건축물", b.getPtViol(), c.isViolOn(),
					"위반건축물", "1".equals(b.getViolYn()) ? "대장 등재" : "0".equals(b.getViolYn()) ? none : "대장 미연계", "위반건축물 대장 등재" } }));
		items.add(ratioGroup("flood", "침수 위험", c.getFloodPt(), new Object[][] {
				{ "침수 " + b.getFloodCnt() + "회", b.getPtFlood(), c.isFloodOn(), "침수흔적", b.getFloodCnt() + "회", "침수 흔적 " + c.getFloodCnt() + "회 이상" },
				{ "저지대 해발 " + b.getElevM() + "m", b.getPtLow(), c.isLowOn(), "저지대", String.format("%.1fm", b.getElevM()), "해발 " + fmt(c.getLowElev()) + "m 이하" } }));
		items.add(anyGroup("econ", "경제 여건", c.getEconPt(), new Object[][] {
				{ "저가 주택" + (b.getPricePct() != null ? " (백분위 " + b.getPricePct() + "%)" : ""), b.getPtCheap(), c.isCheapOn(),
					"저가 주택", b.getPricePct() != null ? "백분위 " + fmt(b.getPricePct()) + "%" : "자료 없음", "공시가 백분위 " + fmt(c.getCheapPct()) + "% 이하" } }));
		return items;
	}

	/** members → 펼침 표의 요인 줄 */
	private static List<ScoreFactorTO> factorRows(Object[][] members) {
		List<ScoreFactorTO> rows = new ArrayList<>();
		for (Object[] m : members) {
			boolean on = (Boolean) m[2];
			rows.add(new ScoreFactorTO((String) m[3], (String) m[4], (String) m[5], on, on && (Integer) m[1] > 0));
		}
		return rows;
	}

	/** 하나라도 맞으면 묶음 점수 전부 (weight = 합 100 으로 환산한 묶음 점수). 요약 = 맞은 요인 이름 */
	private static ScoreItemTO anyGroup(String key, String label, double weight, Object[][] members) {
		List<String> hits = new ArrayList<>(), names = new ArrayList<>();
		boolean anyOn = false;
		for (Object[] m : members) {
			anyOn |= (Boolean) m[2];
			if ((Boolean) m[2] && (Integer) m[1] > 0) { hits.add((String) m[0]); names.add((String) m[3]); }
		}
		int max = (int) Math.round(weight);
		int points = hits.isEmpty() ? 0 : max;
		String desc = !anyOn ? "분석 조건에서 제외" : hits.isEmpty() ? "해당 없음" : String.join(" · ", hits);
		String summary = !anyOn ? "분석 조건에서 제외" : names.isEmpty() ? "해당 없음" : String.join(" · ", names);
		return new ScoreItemTO(key, label, points, anyOn ? max : 0, points > 0, desc, summary, factorRows(members));
	}

	/** 묶음 가중치 × (맞은 요인 수 ÷ 켜진 요인 수). desc "노후 · 2개 중 1개", 요약 "2개 중 1개" */
	private static ScoreItemTO ratioGroup(String key, String label, double weight, Object[][] members) {
		List<String> hits = new ArrayList<>();
		int on = 0;
		for (Object[] m : members) {
			if (!(Boolean) m[2]) continue;
			on++;
			if ((Integer) m[1] > 0) hits.add((String) m[0]);
		}
		int points = on == 0 ? 0 : (int) Math.round(weight * (double) hits.size() / on);
		String desc = on == 0 ? "분석 조건에서 제외"
				: (hits.isEmpty() ? "해당 없음" : String.join(" · ", hits)) + " · " + on + "개 중 " + hits.size() + "개";
		String summary = on == 0 ? "분석 조건에서 제외" : hits.isEmpty() ? "해당 없음" : on + "개 중 " + hits.size() + "개";
		return new ScoreItemTO(key, label, points, on == 0 ? 0 : (int) Math.round(weight), points > 0, desc, summary, factorRows(members));
	}

	private static String fmt(double v) {
		return v == Math.floor(v) ? String.valueOf((int) v) : String.valueOf(v);
	}

	// ---------- 구 경계 (볼록 껍질, 한 번만) ----------
	private synchronized Map<String, List<double[]>> rings() {
		if (ringCache != null) return ringCache;
		Map<String, List<double[]>> pts = new HashMap<>();
		for (DongTO p : dao.getCoordList()) {
			pts.computeIfAbsent(p.getSggCd(), k -> new ArrayList<>()).add(new double[] { p.getLng(), p.getLat() });
		}
		Map<String, List<double[]>> out = new HashMap<>();
		pts.forEach((k, v) -> out.put(k, convexHull(v)));
		ringCache = out;
		return out;
	}

	/** Andrew monotone chain. 입력 [lng, lat], 출력은 닫힌 고리 (첫 점 = 끝 점) */
	static List<double[]> convexHull(List<double[]> in) {
		List<double[]> p = new ArrayList<>(in);
		p.sort(Comparator.<double[]>comparingDouble(a -> a[0]).thenComparingDouble(a -> a[1]));
		if (p.size() < 3) return p;
		List<double[]> lower = new ArrayList<>(), upper = new ArrayList<>();
		for (double[] q : p) {
			while (lower.size() >= 2 && cross(lower.get(lower.size() - 2), lower.get(lower.size() - 1), q) <= 0) lower.remove(lower.size() - 1);
			lower.add(q);
		}
		for (int i = p.size() - 1; i >= 0; i--) {
			double[] q = p.get(i);
			while (upper.size() >= 2 && cross(upper.get(upper.size() - 2), upper.get(upper.size() - 1), q) <= 0) upper.remove(upper.size() - 1);
			upper.add(q);
		}
		List<double[]> hull = new ArrayList<>(lower.subList(0, lower.size() - 1));
		hull.addAll(upper.subList(0, upper.size() - 1));
		hull.add(hull.get(0));
		return hull;
	}

	private static double cross(double[] o, double[] a, double[] b) {
		return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	}
}
