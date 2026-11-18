package wellfair.controller;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import jakarta.servlet.http.HttpSession;
import wellfair.service.ArchiveService;
import wellfair.service.FieldService;
import wellfair.to.DashboardTO;
import wellfair.to.FieldListTO;
import wellfair.to.MemberTO;
import wellfair.to.StatusCountTO;

// 대시보드(분석 리포트, Figma 06). 숫자는 ArchiveService(상태) + FieldService(리스트) 에서
@Controller
public class DashboardController {

	@Autowired
	ArchiveService archiveService;

	@Autowired
	FieldService fieldService;

	// GET dashboard.do?gu&ym(yyyy-MM 기준 월)&month(1|3|6 기간)&status
	@GetMapping("dashboard.do")
	public String dashboard(@RequestParam(value = "gu", required = false) String gu,
			@RequestParam(value = "ym", required = false) String ym,
			@RequestParam(value = "month", defaultValue = "1") int month,
			@RequestParam(value = "status", required = false) String status,
			HttpSession session, Model model) {
		MemberTO member = (MemberTO) session.getAttribute("loginMember");
		long userId = member.getUserId();
		if (member.isGuUser()) gu = member.getSggCd();          // 구청 계정 : 소속 구만 (화면의 gu 는 무시)
		if (gu != null && gu.isBlank()) gu = null;
		int months = month == 3 ? 3 : month == 6 ? 6 : 1;

		DashboardTO d = new DashboardTO();
		StatusCountTO sc = archiveService.getStatusCount(userId, gu);
		d.setStatus(sc);
		d.setTotal(sc.getTodo() + sc.getDoing() + sc.getDone());

		List<FieldListTO> doing = fieldService.getFieldList(userId, gu, "doing", null, false);
		d.setDoingLists(doing.size() > 3 ? doing.subList(0, 3) : doing);
		d.setListRemain(doing.size());
		int remain = 0, totalBld = 0;
		for (FieldListTO f : doing) { remain += f.getItemCnt() - f.getDoneCnt(); totalBld += f.getItemCnt(); }
		d.setListRemainBld(remain);
		d.setListTotalBld(totalBld);

		// 기준 월 (?ym=yyyy-MM) : 최근 12개월 안에서만. 없거나 형식이 다르거나 범위 밖이면 이번 달
		YearMonth now = YearMonth.now();
		YearMonth base = now;
		try {
			if (ym != null && !ym.isBlank()) base = YearMonth.parse(ym);
		} catch (DateTimeParseException e) {
			base = now;
		}
		if (base.isAfter(now) || base.isBefore(now.minusMonths(11))) base = now;

		// 월별 완료 : 기준 월까지 빈 달도 채워서. 막대 = 최근 5개월 (6개월을 고르면 6개월),
		// 기간 비교 = 최근 N개월 합 vs 그 앞 N개월 합 → 둘 다 들어가게 max(막대 수, 2N)개월을 한 번에 받는다
		int bars = months == 6 ? 6 : 5;
		int span = Math.max(bars, months * 2);
		YearMonth from = base.minusMonths(span - 1);
		List<DashboardTO.MonthCountTO> raw = archiveService.getMonthlyDone(userId, from.atDay(1).toString(), base.plusMonths(1).atDay(1).toString(), gu);
		List<DashboardTO.MonthCountTO> all = new ArrayList<>();        // from ~ base, 오래된 달부터
		for (int i = span - 1; i >= 0; i--) {
			String key = base.minusMonths(i).toString();
			DashboardTO.MonthCountTO m = new DashboardTO.MonthCountTO();
			m.setYm(key);
			for (DashboardTO.MonthCountTO r : raw) if (key.equals(r.getYm())) m.setCnt(r.getCnt());
			all.add(m);
		}
		d.setMonthly(new ArrayList<>(all.subList(span - bars, span)));
		d.setMonthDone(all.get(span - 1).getCnt());
		d.setPrevMonthDone(all.get(span - 2).getCnt());
		int period = 0, prevPeriod = 0;
		for (int i = 0; i < months; i++) {
			period += all.get(span - 1 - i).getCnt();
			prevPeriod += all.get(span - 1 - months - i).getCnt();
		}
		d.setPeriodDone(period);
		d.setPrevPeriodDone(prevPeriod);
		d.setCumDone(sc.getDone());

		// 기준 월 선택칸 : 이번 달부터 11개월 전까지 (value yyyy-MM, 화면 글자 yyyy.MM)
		List<String> ymOpts = new ArrayList<>();
		for (int i = 0; i < 12; i++) ymOpts.add(now.minusMonths(i).toString());

		d.setByDong(archiveService.getStatusByDong(userId, gu));

		model.addAttribute("d", d);
		model.addAttribute("gu", gu == null ? "" : gu);
		model.addAttribute("months", months);
		model.addAttribute("status", status == null ? "" : status);
		model.addAttribute("nowYm", now.toString());
		model.addAttribute("baseYm", base.toString());
		model.addAttribute("baseMonth", base.getMonthValue());
		model.addAttribute("isNowMonth", base.equals(now));
		model.addAttribute("ymOpts", ymOpts);
		model.addAttribute("bars", bars);
		return "dashboard";
	}
}
