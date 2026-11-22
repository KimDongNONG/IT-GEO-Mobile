package itgeo.to;

import java.util.ArrayList;
import java.util.List;

/**
 * 월간 현황 보고서의 "숫자" 부분 (보고서 1~4번). 시스템이 대시보드와 같은 기준으로 채우고, LLM 은 이 값을 읽고 5번 종합 의견만 쓴다.
 * monthly_report.content 에 {"facts": 이것, "opinion": [..]} JSON 으로 저장해서 "지난 보고서 보기" 때 그대로 다시 그린다.
 * getter · setter 는 직접 둔다 (Eclipse 의 lombok 처리에 기대지 않게)
 */
public class ReportFactsTO {
	private String ym;              // 2026-11
	private int year;
	private int month;
	private String periodFrom;      // 2026-11-01
	private String periodTo;        // 작성일
	private String writtenAt;       // 2026-11-20
	private String area;            // 구로구 / 서울시 3개 구
	private String writer;          // 구로구청 복지정책과 김구로 주무관

	// 1. 고위험 가구 확인 현황 (누적)
	private int highTotal;
	private int highChecked;
	private int highRemain;
	private int highPct;
	private int prevPct;            // 이번 달 1일 0시 기준 확인율 (전월 말)

	// 2. 동별 남은 고위험 가구 상위 3개 동
	private List<DashboardTO.DongRiskTO> topDong = new ArrayList<>();

	// 3. 월별 현장 확인 완료 (건물 수, 최근 6개월)
	private List<DashboardTO.MonthStatTO> monthly = new ArrayList<>();

	// 4. 이번 달 방문 일정 (업무 캘린더 survey_schedule 의 건물 수)
	private int schedTotal;
	private int schedDone;          // 오늘까지 날짜가 지난(오늘 포함) 일정

	// 참고 (종합 의견에만 쓰고 표에는 안 넣음)
	private List<String> warnings = new ArrayList<>();   // 지금 발효 중인 기상 특보

	public int getSchedRemain() { return Math.max(0, schedTotal - schedDone); }
	public int getSchedPct() { return DashboardTO.pct(schedDone, schedTotal); }

	public String getYm() { return ym; }
	public void setYm(String ym) { this.ym = ym; }
	public int getYear() { return year; }
	public void setYear(int year) { this.year = year; }
	public int getMonth() { return month; }
	public void setMonth(int month) { this.month = month; }
	public String getPeriodFrom() { return periodFrom; }
	public void setPeriodFrom(String periodFrom) { this.periodFrom = periodFrom; }
	public String getPeriodTo() { return periodTo; }
	public void setPeriodTo(String periodTo) { this.periodTo = periodTo; }
	public String getWrittenAt() { return writtenAt; }
	public void setWrittenAt(String writtenAt) { this.writtenAt = writtenAt; }
	public String getArea() { return area; }
	public void setArea(String area) { this.area = area; }
	public String getWriter() { return writer; }
	public void setWriter(String writer) { this.writer = writer; }
	public int getHighTotal() { return highTotal; }
	public void setHighTotal(int highTotal) { this.highTotal = highTotal; }
	public int getHighChecked() { return highChecked; }
	public void setHighChecked(int highChecked) { this.highChecked = highChecked; }
	public int getHighRemain() { return highRemain; }
	public void setHighRemain(int highRemain) { this.highRemain = highRemain; }
	public int getHighPct() { return highPct; }
	public void setHighPct(int highPct) { this.highPct = highPct; }
	public int getPrevPct() { return prevPct; }
	public void setPrevPct(int prevPct) { this.prevPct = prevPct; }
	public List<DashboardTO.DongRiskTO> getTopDong() { return topDong; }
	public void setTopDong(List<DashboardTO.DongRiskTO> topDong) { this.topDong = topDong; }
	public List<DashboardTO.MonthStatTO> getMonthly() { return monthly; }
	public void setMonthly(List<DashboardTO.MonthStatTO> monthly) { this.monthly = monthly; }
	public int getSchedTotal() { return schedTotal; }
	public void setSchedTotal(int schedTotal) { this.schedTotal = schedTotal; }
	public int getSchedDone() { return schedDone; }
	public void setSchedDone(int schedDone) { this.schedDone = schedDone; }
	public List<String> getWarnings() { return warnings; }
	public void setWarnings(List<String> warnings) { this.warnings = warnings; }
}
