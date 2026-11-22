package itgeo.to;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import lombok.Data;

/**
 * 모바일 앱이 JSON 으로 보낸 현장조사기록 1건 = mobile_link_record (+ 사진 mobile_link_photo).
 * 05 건물 확인 이력의 "미확인 현장조사기록" 모달 왼쪽 목록 한 줄 · 오른쪽 정리내용.
 * scores / factorCheck 는 DB 에 JSON 문자열로 두고, MobileLinkService 가 scoreItems / checkText 로 풀어 준다.
 */
@Data
public class MobileLinkTO {
	private long linkId;
	private String bldId;
	private String clientUuid;
	private Long senderUserId;
	private String authorNm;
	private String visitedAt;        // yyyy-MM-dd HH:mm
	private String result;           // MET / ABSENT / REFUSED / OTHER
	private String residentStatus;   // 양호 / 주의 / 긴급 / 부재
	private String scores;           // JSON {"around":3,…}
	private String factorCheck;      // JSON {"ugrnd":"Y",…}
	private String supports;         // 쉼표 구분
	private String memo;
	private String transcript;
	private String status;           // NEW / DONE
	private Long recordId;
	private String aiSummary;
	private Long confirmedBy;
	private String confirmedAt;
	private String receivedAt;       // yyyy-MM-dd HH:mm

	// 서비스가 채움 (화면용)
	private List<ScoreRow> scoreItems = new ArrayList<>();     // 항목별 취약점수 (라벨 순)
	private String checkText;                                  // "지하층 맞음 · 침수 판단 어려움"
	private List<String> supportList = new ArrayList<>();
	private List<MobileLinkPhotoTO> photos = new ArrayList<>();

	/** 항목 키 → 점수 (화면 · AI 정리 입력용) */
	public Map<String, Integer> scoreMap() {
		Map<String, Integer> m = new LinkedHashMap<>();
		for (ScoreRow r : scoreItems) m.put(r.getKey(), r.getScore());
		return m;
	}

	public String getResultLabel() {
		if ("MET".equals(result)) return "면담";
		if ("ABSENT".equals(result)) return "부재";
		if ("REFUSED".equals(result)) return "거부";
		if ("OTHER".equals(result)) return "기타";
		return "-";
	}

	/** 항목별 취약점수 한 줄 */
	@Data
	public static class ScoreRow {
		private String key;
		private String label;
		private int score;      // 1 양호 ~ 5 위험

		public ScoreRow() {}

		public ScoreRow(String key, String label, int score) {
			this.key = key;
			this.label = label;
			this.score = score;
		}
	}
}
