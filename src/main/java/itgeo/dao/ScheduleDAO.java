package itgeo.dao;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import itgeo.to.ScheduleEventTO;
import itgeo.to.ScheduleItemTO;

// 달력 (survey_schedule). SQL 은 mapper-schedule.xml (namespace = mapper-schedule)
@Repository
public class ScheduleDAO {

	@Autowired
	private SqlSession sqlSession;

	// 내 달력 : userId 의 일정 중 start <= sched_date < end
	public List<ScheduleEventTO> selectMyEvents(long userId, String start, String end) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("start", start);
		p.put("end", end);
		return sqlSession.selectList("mapper-schedule.selectMyEvents", p);
	}

	// 모바일 달력 : 내 일정(start <= sched_date < end)을 리스트 안 건물까지 펼친 줄들
	public List<ScheduleItemTO> selectMyItems(long userId, String start, String end) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("start", start);
		p.put("end", end);
		return sqlSession.selectList("mapper-schedule.selectMyItems", p);
	}

	// 날짜에 리스트 넣기 : 내가 볼 수 있는 리스트일 때만 들어감. 들어간 줄 수 (0 = 못 넣음)
	public int insertSchedule(long userId, String guSgg, long surveyId, String date) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("guSgg", guSgg);
		p.put("surveyId", surveyId);
		p.put("date", date);
		return sqlSession.insert("mapper-schedule.insertSchedule", p);
	}

	// 내 일정 날짜 바꾸기 : 내 것만. 바뀐 줄 수
	public int updateDate(long userId, long scheduleId, String date) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("scheduleId", scheduleId);
		p.put("date", date);
		return sqlSession.update("mapper-schedule.updateDate", p);
	}

	// 내 일정 빼기 : 내 것만. 지운 줄 수
	public int deleteSchedule(long userId, long scheduleId) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("scheduleId", scheduleId);
		return sqlSession.delete("mapper-schedule.deleteSchedule", p);
	}
}
 