package itgeo.to;

import lombok.Data;
import java.util.List;

/**
 * api/mobile/schedule.do 응답 한 줄 = 달력 날짜에 넣은 리스트(survey_schedule) 안의 건물 하나.
 * 상태(완료 · 예정 · 부재 · 종료 · 재방문 · 자원 연결 · 다음)는 "오늘"을 기준으로 앱이 계산한다 (mobile/src/lib/schedule.ts).
 * 서버는 그 계산에 필요한 사실만 준다 : 그날의 확인 기록(시각 · 결과 · 지원), 그날 이전 마지막 방문 결과.
 */
@Data
public class ScheduleItemTO {
	private long scheduleId;      // survey_schedule.schedule_id
	private String schedDate;     // "yyyy-MM-dd"
	private long surveyId;        // 리스트 ID (앱의 방문그룹 id)
	private String title;         // 리스트 이름
	private long planId;
	private long factorId;
	private String bldId;
	private Integer visitOrder;   // 방문 순서 (null = 순서 없음)
	private String addr;
	private String bldNm;
	private String useNm;
	private String sggCd;
	private int score;            // 취약도
	private Long recordId;        // 그날 남긴 확인 기록 (없으면 null)
	private String visitTime;     // 그날 기록의 방문 시각 "HH:mm"
	private String result;        // 그날 기록의 결과 MET / ABSENT / REFUSED / OTHER
	private String supports;      // 그날 기록의 필요한 지원 (쉼표 구분, 앱 기록만)
	private String prevResult;    // 그날 이전 이 건물의 마지막 방문 결과 (재방문 판단)
	
	// 하루 조회(api/mobile/schedule/day.do)에서만 채운다
	private List<String> bldFactors;   // 건물 취약점
	private List<String> hhVulns;      // 가구 취약점
}
