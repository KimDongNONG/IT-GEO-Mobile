package itgeo.controller;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpSession;
import itgeo.service.DashboardService;
import itgeo.to.DashboardTO;
import itgeo.to.MemberTO;

// 대시보드 (dashboard.do). 숫자는 DashboardService, 날씨 · 일정 클릭 · 보고서는 DashboardRESTController (JSON)
@Controller
public class DashboardController {

	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	DashboardService dashboardService;

	@GetMapping("dashboard.do")
	public String dashboard(HttpSession session, Model model) throws JsonProcessingException {
		MemberTO member = (MemberTO) session.getAttribute("loginMember");
		DashboardTO d = dashboardService.getDashboard(member);
		LocalDate today = LocalDate.now();

		// 화면 스크립트(dashboard.js)가 쓰는 값 : 동별 정렬 · 월별 막대 · 오늘 일정 · 이번 달 달력 점
		Map<String, Object> js = new HashMap<>();
		js.put("today", today.toString());
		js.put("byDong", d.getByDong());
		js.put("monthly", d.getMonthly());
		js.put("schedules", dashboardService.getSchedules(member, today.toString()));
		js.put("marks", dashboardService.getScheduleMarks(member, YearMonth.now().toString()));

		model.addAttribute("d", d);
		model.addAttribute("today", today);
		model.addAttribute("nowMonth", today.getMonthValue());
		// </script> 로 끊기지 않게 "</" 를 "<\/" 로
		model.addAttribute("dashJson", JSON.writeValueAsString(js).replace("</", "<\\/"));
		return "dashboard";
	}
}