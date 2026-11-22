package itgeo.to;

import java.util.ArrayList;
import java.util.List;

/**
 * 대시보드 한 화면 치 숫자 (DashboardService.getDashboard).
 * 내부 클래스가 많고 다른 TO(ReportFactsTO)가 그 목록을 필드로 쓰므로, Eclipse 의 lombok 처리에 기대지 않게 getter · setter 를 직접 둔다.
 */
public class DashboardTO {
	private int highTotal;                                    // 고위험 가구 전체 (내 현장확인 리스트 건물)
	private int highChecked;                                  // 그중 확인한 가구
	private List<DongRiskTO> byDong = new ArrayList<>();      // 동별 남은 고위험 가구 (남은 곳 많은 순)
	private List<MonthStatTO> monthly = new ArrayList<>();    // 월별 추이 = 확인 완료 건물 수 (최근 6개월, 오래된 달부터)
	private ReportRefTO lastReport;                           // 보고서 박스 "지난 보고서 보기" (없으면 null)
	private List<RecentViewTO> recent = new ArrayList<>();    // 이어서 보기 (최대 3)

	public int getHighTotal() { return highTotal; }
	public void setHighTotal(int highTotal) { this.highTotal = highTotal; }
	public int getHighChecked() { return highChecked; }
	public void setHighChecked(int highChecked) { this.highChecked = highChecked; }
	public List<DongRiskTO> getByDong() { return byDong; }
	public void setByDong(List<DongRiskTO> byDong) { this.byDong = byDong; }
	public List<MonthStatTO> getMonthly() { return monthly; }
	public void setMonthly(List<MonthStatTO> monthly) { this.monthly = monthly; }
	public ReportRefTO getLastReport() { return lastReport; }
	public void setLastReport(ReportRefTO lastReport) { this.lastReport = lastReport; }
	public List<RecentViewTO> getRecent() { return recent; }
	public void setRecent(List<RecentViewTO> recent) { this.recent = recent; }

	public int getHighRemain() { return Math.max(0, highTotal - highChecked); }
	public int getHighPct() { return pct(highChecked, highTotal); }
	public static int pct(int part, int total) { return total == 0 ? 0 : (int) Math.round(part * 100.0 / total); }

	/** 동별 고위험 가구 : 전체 · 확인 */
	public static class DongRiskTO {
		private String emdNm;
		private int total;
		private int checked;

		public String getEmdNm() { return emdNm; }
		public void setEmdNm(String emdNm) { this.emdNm = emdNm; }
		public int getTotal() { return total; }
		public void setTotal(int total) { this.total = total; }
		public int getChecked() { return checked; }
		public void setChecked(int checked) { this.checked = checked; }
		public int getRemain() { return Math.max(0, total - checked); }

		@Override public String toString() { return "DongRiskTO(" + emdNm + ", total=" + total + ", checked=" + checked + ")"; }
	}

	/** 월별 확인 완료 건물 수 (ym = yyyy-MM) */
	public static class MonthStatTO {
		private String ym;
		private int checked;

		public String getYm() { return ym; }
		public void setYm(String ym) { this.ym = ym; }
		public int getChecked() { return checked; }
		public void setChecked(int checked) { this.checked = checked; }

		@Override public String toString() { return "MonthStatTO(" + ym + ", checked=" + checked + ")"; }
	}

	/** 달력 점 : 날짜별 일정 건물 수 · 재방문 수 (day = yyyy-MM-dd) */
	public static class DayMarkTO {
		private String day;
		private int cnt;
		private int revisit;

		public String getDay() { return day; }
		public void setDay(String day) { this.day = day; }
		public int getCnt() { return cnt; }
		public void setCnt(int cnt) { this.cnt = cnt; }
		public int getRevisit() { return revisit; }
		public void setRevisit(int revisit) { this.revisit = revisit; }

		@Override public String toString() { return "DayMarkTO(" + day + ", cnt=" + cnt + ", revisit=" + revisit + ")"; }
	}

	/** 저장된 보고서 한 건의 머리 정보 (ym = yyyy-MM, createdAt = MM.dd 또는 보고서 저장소에서는 yyyy-MM-dd HH:mm) */
	public static class ReportRefTO {
		private long reportId;
		private String ym;
		private String createdAt;
		private String status;      // DRAFT 초안 / CONFIRMED 확정 (보고서 저장소)
		private String sggCd;       // 구 (NULL = 3개 구 전체)

		public String getStatus() { return status; }
		public void setStatus(String status) { this.status = status; }
		public String getSggCd() { return sggCd; }
		public void setSggCd(String sggCd) { this.sggCd = sggCd; }

		public long getReportId() { return reportId; }
		public void setReportId(long reportId) { this.reportId = reportId; }
		public String getYm() { return ym; }
		public void setYm(String ym) { this.ym = ym; }
		public String getCreatedAt() { return createdAt; }
		public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
		public int getMonth() { return ym == null || ym.length() < 7 ? 0 : Integer.parseInt(ym.substring(5, 7)); }
	}

	// ---------- 보관함 집계 (ArchiveService.getStatusByDong · getMonthlyDone 이 아직 쓴다) ----------

	public static class MonthCountTO {
		private String ym;
		private int cnt;

		public String getYm() { return ym; }
		public void setYm(String ym) { this.ym = ym; }
		public int getCnt() { return cnt; }
		public void setCnt(int cnt) { this.cnt = cnt; }
	}

	public static class DongStatusTO {
		private String emdNm;
		private int todo;
		private int doing;
		private int done;

		public String getEmdNm() { return emdNm; }
		public void setEmdNm(String emdNm) { this.emdNm = emdNm; }
		public int getTodo() { return todo; }
		public void setTodo(int todo) { this.todo = todo; }
		public int getDoing() { return doing; }
		public void setDoing(int doing) { this.doing = doing; }
		public int getDone() { return done; }
		public void setDone(int done) { this.done = done; }
		public int getTotal() { return todo + doing + done; }
	}
}
