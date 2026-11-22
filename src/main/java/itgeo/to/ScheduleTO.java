package itgeo.to;

/**
 * 대시보드 하루 일정 1줄 = 업무 캘린더(survey_schedule)에 그날 넣은 현장확인 리스트의 건물 1곳 (방문 순서대로).
 * 대시보드는 읽기만, 추가 · 이동 · 빼기는 업무 캘린더(calendar.do). getter · setter 는 직접 둔다 (lombok 없이)
 */
public class ScheduleTO {
	private long scheduleId;
	private Long planId;          // 현장확인 리스트 항목
	private String bldId;
	private String schedDate;     // yyyy-MM-dd
	private Integer visitOrder;   // 리스트 안 방문 순서 (없으면 null)
	private String title;         // 가리봉동 12-34 행복빌라
	private String schedType;     // VISIT | REVISIT (그날 전에 확인 기록이 있던 건물)
	private String memo;          // 리스트 이름
	private String checkResult;   // 일정 날짜 이후 남긴 가장 최근 확인 결과 MET | ABSENT | REFUSED | OTHER (없으면 null)

	public long getScheduleId() { return scheduleId; }
	public void setScheduleId(long scheduleId) { this.scheduleId = scheduleId; }
	public Long getPlanId() { return planId; }
	public void setPlanId(Long planId) { this.planId = planId; }
	public String getBldId() { return bldId; }
	public void setBldId(String bldId) { this.bldId = bldId; }
	public String getSchedDate() { return schedDate; }
	public void setSchedDate(String schedDate) { this.schedDate = schedDate; }
	public Integer getVisitOrder() { return visitOrder; }
	public void setVisitOrder(Integer visitOrder) { this.visitOrder = visitOrder; }
	public String getTitle() { return title; }
	public void setTitle(String title) { this.title = title; }
	public String getSchedType() { return schedType; }
	public void setSchedType(String schedType) { this.schedType = schedType; }
	public String getMemo() { return memo; }
	public void setMemo(String memo) { this.memo = memo; }
	public String getCheckResult() { return checkResult; }
	public void setCheckResult(String checkResult) { this.checkResult = checkResult; }
}
