package itgeo.to;

import java.util.ArrayList;
import java.util.List;

import lombok.Data;

/**
 * 05 건물 확인 이력 (archivedetail.do) 한 화면 분량.
 * 상단 = 건물 + 내 보관함 저장분(factor) + 요약 숫자, 가운데 = 확인 기록 타임라인, 오른쪽 = 이관 · 분석 반영 · 인수인계
 */
@Data
public class ArchiveDetailTO {
	private BuildingTO building;                 // 건물 + 현재 기준 점수 (mapper-building.getBuilding)
	private List<ScoreItemTO> scoreItems;        // 사전 탐지 요인 (hit = 해당)
	private ResidentCountTO residents;
	private ArchiveTO factor;                    // 내 보관함의 이 건물 (저장 점수). 없으면 null
	private Long planId;                         // 내 현장확인 리스트에 담긴 plan (없으면 현장 체크 입력 불가)

	private List<RecordTO> records = new ArrayList<>();     // 최신순
	private List<TransferTO> transfers = new ArrayList<>();
	private List<MemoTO> memos = new ArrayList<>();

	// 요약
	private int checkCnt;            // 확인 횟수
	private String lastCheckedAt;    // 최근 확인일
	private String lastUserNm;       // 담당자 (최근 방문자)
	private String lastRankNm;
	private int scoreAdj;            // 점수 보정 합
	private String transferDept;     // "주택과 점검 요청" (최근)
	private int pendingAppCnt;       // 모바일 앱에서 받았지만 아직 확인 안 한 현장조사기록 수 (타임라인 위 안내)
	private String pendingAppFrom;   // 그 기록들의 가장 오래된 · 가장 최근 방문 날짜 (yyyy-MM-dd, 없으면 null)
	private String pendingAppTo;

	/** AI 보고서 기간 (웹 이력 + 앱 확인 전 기록) : 가장 오래된 날 yyyy-MM-dd, 기록이 없으면 "" */
	public String getReportFrom() {
		String a = records == null || records.isEmpty() ? null : records.get(records.size() - 1).getVisitedAt().substring(0, 10);
		return minMax(a, pendingAppFrom, true);
	}
	/** AI 보고서 기간 : 가장 최근 날 */
	public String getReportTo() {
		String a = records == null || records.isEmpty() ? null : records.get(0).getVisitedAt().substring(0, 10);
		return minMax(a, pendingAppTo, false);
	}
	private static String minMax(String a, String b, boolean min) {
		if (a == null) return b == null ? "" : b;
		if (b == null) return a;
		return (a.compareTo(b) <= 0) == min ? a : b;
	}

	/** 저장 점수 (보관함에 없으면 현재 점수) */
	public int getSavedScore() {
		return factor != null && factor.getVulnerabilityScore() != null ? factor.getVulnerabilityScore() : building.getScore();
	}
	public int getAdjustedScore() { return getSavedScore() + scoreAdj; }
	public String getAdjText() { return (scoreAdj >= 0 ? "+" : "") + scoreAdj; }

	/** 사전 탐지 요인 라벨 ("지하층 · 침수 · 노후") */
	public String getDetectedText() {
		StringBuilder sb = new StringBuilder();
		if (scoreItems != null) for (ScoreItemTO it : scoreItems) if (it.isHit()) { if (sb.length() > 0) sb.append(" · "); sb.append(it.getLabel()); }
		return sb.toString();
	}
}
