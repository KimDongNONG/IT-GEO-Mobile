package itgeo.to;

import lombok.Data;

// 보관함 한 행 = vulnerability_factor 1건 (+ 리스트 · 건물 · 상태)
@Data
public class ArchiveRowTO {
	private long factorId;
	private long vulnerabilityId;
	private String title;           // 분석 리스트 이름
	private String bldId;
	private String sggCd;
	private String emdNm;
	private String addr;
	private String bldNm;
	private String useNm;
	private double lat;
	private double lng;
	private int score;              // 저장 당시 점수 (vulnerability_score)
	private int vulnHhCnt;          // 취약 가구 수 (bld_resident_stat)
	private int prioritySum;        // 가구 가점 합
	private String factorText;      // 현재 기본 기준으로 계산한 요인 ("지하층 · 노후")
	private int priorityRank;       // 내 보관함 안 점수 순위 (우선순위 추정)
	private String status;          // TODO | DOING | DONE (statusExpr)
	private String savedAt;         // evaluated_at (yyyy-MM-dd)
	private String scenKey;         // 저장할 때 쓴 가중치 시나리오 : base | rain | heat | cold | custom (mapper-archive.scenExpr)
	private String scenBase;        // custom 일 때 어느 프리셋에서 고쳤는지 (criteria.scenario)
	private Long surveyId;          // 담긴 현장확인 리스트 (있으면)
	private String surveyTitle;
	private String checkedAt;       // 확인 완료일 (DONE 일 때)

	/** 구분 칸 글자 (지도 왼쪽 위 시나리오 버튼 이름과 같게 : map-config.js SCENARIOS) */
	public String getScenLabel() {
		return scenName(scenKey);
	}

	/** 구분 칸 마우스 올림 설명. 사용자 설정이면 어느 프리셋에서 고쳤는지 */
	public String getScenTitle() {
		if ("custom".equals(scenKey)) return scenName(scenBase) + " 가중치에서 직접 고쳐서 저장";
		return scenName(scenKey) + " 가중치로 분석해서 저장";
	}

	public static String scenName(String key) {
		if (key == null) return "기본";
		switch (key) {
		case "rain": return "폭우";
		case "heat": return "폭염";
		case "cold": return "한파";
		case "custom": return "사용자 설정";
		default: return "기본";
		}
	}

	public String getStatusLabel() {
		try { return itgeo.common.WorkStatus.valueOf(status).getLabel(); } catch (Exception e) { return status; }
	}
}
