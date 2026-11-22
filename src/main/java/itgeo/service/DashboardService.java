package itgeo.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import itgeo.common.BadRequestException;
import itgeo.dao.DashboardDAO;
import itgeo.to.DashboardTO;
import itgeo.to.MemberTO;
import itgeo.to.RecentViewTO;
import itgeo.to.ReportFactsTO;
import itgeo.to.ScheduleTO;

/**
 * 대시보드 숫자 · 업무 캘린더(survey_schedule, 읽기 전용) · 이어서 보기.
 * 구청 계정은 소속 구(member.sggCd)만, 서울시청 계정(sggCd NULL)은 3개 구 전체.
 */
@Service
public class DashboardService {

	/** 월별 추이 막대 수 (최근 6개월 = 이번 달 포함) */
	public static final int MONTHS = 6;

	/** 이어서 보기 : 탭(header.jspf activeMenu) → 저장해도 되는 화면 주소 */
	private static final List<String> RECENT_MENUS = Arrays.asList("map", "field", "archive");
	private static final Pattern RECENT_URL = Pattern.compile(
			"^(map|fieldlist|fielddetail|fieldedit|archive|archivedetail)\\.do(\\?[^\\s<>\"']*)?$");

	@Autowired
	DashboardDAO dao;

	private static String gu(MemberTO m) {
		return m.isGuUser() ? m.getSggCd() : null;
	}

	public DashboardTO getDashboard(MemberTO member) {
		long userId = member.getUserId();
		String gu = gu(member);
		DashboardTO d = new DashboardTO();

		Map<String, Object> rate = dao.getHighRiskRate(userId, gu);
		if (rate != null) {
			d.setHighTotal(num(rate.get("total")));
			d.setHighChecked(num(rate.get("checked")));
		}
		d.setByDong(dao.getHighRiskByDong(userId, gu));

		// 월별 추이 : 이번 달 포함 최근 6개월, 빈 달도 0 으로 채운다
		YearMonth now = YearMonth.now();
		YearMonth from = now.minusMonths(MONTHS - 1);
		String fromDay = from.atDay(1).toString(), toDay = now.plusMonths(1).atDay(1).toString();
		List<DashboardTO.MonthStatTO> chk = dao.getMonthlyChecked(userId, gu, fromDay, toDay);
		List<DashboardTO.MonthStatTO> monthly = new ArrayList<>();
		for (int i = MONTHS - 1; i >= 0; i--) {
			String key = now.minusMonths(i).toString();
			DashboardTO.MonthStatTO m = new DashboardTO.MonthStatTO();
			m.setYm(key);
			for (DashboardTO.MonthStatTO r : chk) if (key.equals(r.getYm())) m.setChecked(r.getChecked());
			monthly.add(m);
		}
		d.setMonthly(monthly);

		d.setLastReport(dao.getLastReport(userId, gu));
		d.setRecent(dao.getRecentList(userId));
		return d;
	}

	/** 하루 일정 (date = yyyy-MM-dd, 틀리면 오늘) */
	public List<ScheduleTO> getSchedules(MemberTO member, String date) {
		return dao.getScheduleList(member.getUserId(), parseDay(date).toString());
	}

	/** 달력 점 (ym = yyyy-MM, 틀리면 이번 달) */
	public List<DashboardTO.DayMarkTO> getScheduleMarks(MemberTO member, String ym) {
		YearMonth m;
		try {
			m = ym == null || ym.isBlank() ? YearMonth.now() : YearMonth.parse(ym);
		} catch (DateTimeParseException e) {
			m = YearMonth.now();
		}
		return dao.getScheduleMarks(member.getUserId(), m.atDay(1).toString(), m.plusMonths(1).atDay(1).toString());
	}

	/** 이어서 보기 저장. 탭 · 주소가 허용 목록 밖이면 400 (다른 사이트로 보내는 주소를 저장하지 않게) */
	public void saveRecent(MemberTO member, String menu, String url, String title, String sub) {
		if (menu == null || !RECENT_MENUS.contains(menu)) throw new BadRequestException("저장할 수 없는 탭입니다.");
		if (url == null || !RECENT_URL.matcher(url).matches() || url.length() > 500) throw new BadRequestException("저장할 수 없는 주소입니다.");
		RecentViewTO to = new RecentViewTO();
		to.setUserId(member.getUserId());
		to.setMenu(menu);
		to.setUrl(url);
		to.setTitle(cut(title, 100));
		to.setSub(cut(sub, 100));
		dao.saveRecent(to);
	}

	/**
	 * 보고서 1~4번 숫자. 대시보드 화면과 같은 기준이라 화면 숫자와 보고서 숫자가 어긋나지 않는다.
	 * (d = 방금 만든 getDashboard 결과를 넘기면 다시 조회하지 않는다)
	 */
	public ReportFactsTO getReportFacts(MemberTO member, DashboardTO d) {
		long userId = member.getUserId();
		String gu = gu(member);
		if (d == null) d = getDashboard(member);
		LocalDateTime now = LocalDateTime.now();
		YearMonth ym = YearMonth.from(now);

		ReportFactsTO f = new ReportFactsTO();
		f.setYm(ym.toString());
		f.setYear(ym.getYear());
		f.setMonth(ym.getMonthValue());
		f.setPeriodFrom(ym.atDay(1).toString());
		f.setPeriodTo(now.toLocalDate().toString());
		f.setWrittenAt(now.toLocalDate().toString());
		f.setArea(gu == null ? "서울시 3개 구 (구로 · 양천 · 영등포)" : ArchiveService.guName(gu));
		f.setWriter(String.join(" ", nz(member.getDeptNm()), nz(member.getUserNm()), nz(member.getRankNm())).trim());

		f.setHighTotal(d.getHighTotal());
		f.setHighChecked(d.getHighChecked());
		f.setHighRemain(d.getHighRemain());
		f.setHighPct(d.getHighPct());
		Map<String, Object> prev = dao.getHighRiskRate(userId, gu, ym.atDay(1).toString());
		f.setPrevPct(prev == null ? 0 : DashboardTO.pct(num(prev.get("checked")), num(prev.get("total"))));

		List<DashboardTO.DongRiskTO> dong = new ArrayList<>(d.getByDong());
		dong.sort((a, b) -> b.getRemain() != a.getRemain() ? b.getRemain() - a.getRemain() : String.valueOf(a.getEmdNm()).compareTo(String.valueOf(b.getEmdNm())));
		f.setTopDong(dong.subList(0, Math.min(3, dong.size())));
		f.setMonthly(d.getMonthly());

		Map<String, Object> sc = dao.getScheduleCount(userId, ym.atDay(1).toString(), ym.plusMonths(1).atDay(1).toString(),
				now.toLocalDate().toString());
		if (sc != null) {
			f.setSchedTotal(num(sc.get("total")));
			f.setSchedDone(num(sc.get("done")));
		}
		return f;
	}

	public long addReport(MemberTO member, String ym, String content) {
		return dao.addReport(member.getUserId(), gu(member), ym, content);
	}

	public DashboardTO.ReportRefTO getLastReport(MemberTO member) {
		return dao.getLastReport(member.getUserId(), gu(member));
	}

	/** 보고서 저장소 : 내가 만든 보고서 목록 (최근이 위) */
	public List<DashboardTO.ReportRefTO> getReportList(MemberTO member) {
		return dao.getReportList(member.getUserId());
	}

	/** 보고서 한 건 머리 정보 (내 것이 아니거나 없으면 null) */
	public DashboardTO.ReportRefTO getReportMeta(MemberTO member, long reportId) {
		return dao.getReportMeta(member.getUserId(), reportId);
	}

	/** 보고서 수정 저장 (내 것만). 바뀐 줄 수 */
	public int updateReport(MemberTO member, long reportId, String content, String status) {
		return dao.updateReport(member.getUserId(), reportId, content, status);
	}

	/** 저장한 보고서 JSON (내 것이 아니거나 없으면 null) */
	public String getReportContent(MemberTO member, long reportId) {
		return dao.getReportContent(member.getUserId(), reportId);
	}

	private static String nz(String s) { return s == null ? "" : s; }

	private static LocalDate parseDay(String s) {
		try {
			return s == null || s.isBlank() ? LocalDate.now() : LocalDate.parse(s);
		} catch (DateTimeParseException e) {
			return LocalDate.now();
		}
	}

	private static int num(Object o) {
		return o instanceof Number ? ((Number) o).intValue() : 0;
	}

	private static String cut(String s, int max) {
		if (s == null) return null;
		s = s.trim();
		return s.length() > max ? s.substring(0, max) : s;
	}
}
