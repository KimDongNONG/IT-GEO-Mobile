package itgeo.dao;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import itgeo.to.DashboardTO;
import itgeo.to.RecentViewTO;
import itgeo.to.ScheduleTO;

// DashboardService 에서만 부른다. 메서드명 = mapper-dashboard.xml 의 id
@Component
public class DashboardDAO {

	@Autowired
	SqlSession session;

	private static Map<String, Object> p(long userId, String gu) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("gu", gu);
		return p;
	}

	public Map<String, Object> getHighRiskRate(long userId, String gu) {
		return getHighRiskRate(userId, gu, null);
	}

	/** before (yyyy-MM-dd) 0시 전에 남긴 확인 기록만 센 확인율. null 이면 지금 */
	public Map<String, Object> getHighRiskRate(long userId, String gu, String before) {
		Map<String, Object> p = p(userId, gu);
		p.put("before", before);
		return session.selectOne("mapper-dashboard.getHighRiskRate", p);
	}

	public List<DashboardTO.DongRiskTO> getHighRiskByDong(long userId, String gu) {
		return session.selectList("mapper-dashboard.getHighRiskByDong", p(userId, gu));
	}

	public List<DashboardTO.MonthStatTO> getMonthlyChecked(long userId, String gu, String from, String to) {
		Map<String, Object> p = p(userId, gu);
		p.put("from", from);
		p.put("to", to);
		return session.selectList("mapper-dashboard.getMonthlyChecked", p);
	}

	/** 저장 후 p 의 reportId 에 새 번호 */
	public long addReport(long userId, String gu, String ym, String content) {
		Map<String, Object> p = p(userId, gu);
		p.put("ym", ym);
		p.put("content", content);
		session.insert("mapper-dashboard.addReport", p);
		Object id = p.get("reportId");
		return id == null ? 0 : ((Number) id).longValue();
	}

	public DashboardTO.ReportRefTO getLastReport(long userId, String gu) {
		return session.selectOne("mapper-dashboard.getLastReport", p(userId, gu));
	}

	public List<DashboardTO.ReportRefTO> getReportList(long userId) {
		return session.selectList("mapper-dashboard.getReportList", p(userId, null));
	}

	public DashboardTO.ReportRefTO getReportMeta(long userId, long reportId) {
		Map<String, Object> p = p(userId, null);
		p.put("reportId", reportId);
		return session.selectOne("mapper-dashboard.getReportMeta", p);
	}

	public int updateReport(long userId, long reportId, String content, String status) {
		Map<String, Object> p = p(userId, null);
		p.put("reportId", reportId);
		p.put("content", content);
		p.put("status", status);
		return session.update("mapper-dashboard.updateReport", p);
	}

	public String getReportContent(long userId, long reportId) {
		Map<String, Object> p = p(userId, null);
		p.put("reportId", reportId);
		return session.selectOne("mapper-dashboard.getReportContent", p);
	}

	/** {total, done} : [from, to) 일정(건물) 수와 today(yyyy-MM-dd)까지(오늘 포함) 날짜가 된 일정 수 */
	public Map<String, Object> getScheduleCount(long userId, String from, String to, String today) {
		Map<String, Object> p = p(userId, null);
		p.put("from", from);
		p.put("to", to);
		p.put("today", today);
		return session.selectOne("mapper-dashboard.getScheduleCount", p);
	}

	public List<DashboardTO.DayMarkTO> getScheduleMarks(long userId, String from, String to) {
		Map<String, Object> p = p(userId, null);
		p.put("from", from);
		p.put("to", to);
		return session.selectList("mapper-dashboard.getScheduleMarks", p);
	}

	public List<ScheduleTO> getScheduleList(long userId, String date) {
		Map<String, Object> p = p(userId, null);
		p.put("date", date);
		return session.selectList("mapper-dashboard.getScheduleList", p);
	}

	public int saveRecent(RecentViewTO to) {
		return session.insert("mapper-dashboard.saveRecent", to);
	}

	public List<RecentViewTO> getRecentList(long userId) {
		return session.selectList("mapper-dashboard.getRecentList", p(userId, null));
	}
}
