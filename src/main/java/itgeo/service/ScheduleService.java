package itgeo.service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import itgeo.common.BadRequestException;
import itgeo.dao.ScheduleDAO;
import itgeo.to.ScheduleEventTO;
import itgeo.to.ScheduleItemTO;

/**
 * 달력 (풀캘린더). 날짜에 현장확인 리스트를 묶음째 넣은 것 = survey_schedule. 내 일정만 보인다.
 *  풀캘린더는 start · end 를 "2026-11-15T00:00:00+09:00" 같은 모양으로 보낸다 → 앞 10글자(날짜)만 쓴다.
 *  같은 리스트를 같은 날짜에 두 번 넣을 수 없다 (UNIQUE survey_id, sched_date)
 */
@Service
public class ScheduleService {

	static final int MAX_DAYS = 62;   // 한 번에 두 달까지만 (주 보기는 7일)

	@Autowired
	ScheduleDAO scheduleDAO;

	public List<ScheduleEventTO> myEvents(long userId, String start, String end) {
		LocalDate s = toDate(start), e = toDate(end);
		if (!s.isBefore(e) || s.plusDays(MAX_DAYS).isBefore(e)) throw new BadRequestException("달력 날짜 범위가 올바르지 않습니다.");
		return scheduleDAO.selectMyEvents(userId, s.toString(), e.toString());
	}

	/** 모바일 달력 (월간) : 날짜 범위 확인은 웹 달력과 같은 규칙 (두 달까지) */
	public List<ScheduleItemTO> myItems(long userId, String start, String end) {
		LocalDate s = toDate(start), e = toDate(end);
		if (!s.isBefore(e) || s.plusDays(MAX_DAYS).isBefore(e)) throw new BadRequestException("달력 날짜 범위가 올바르지 않습니다.");
		return scheduleDAO.selectMyItems(userId, s.toString(), e.toString());
	}

	/** 날짜에 리스트 넣기. 실패하면 이유를 담은 BadRequestException */
	public void add(long userId, String guSgg, long surveyId, String date) {
		String d = toDate(date).toString();
		try {
			if (scheduleDAO.insertSchedule(userId, guSgg, surveyId, d) == 0) throw new BadRequestException("이 리스트를 달력에 넣을 수 없습니다.");
		} catch (DuplicateKeyException ex) {
			throw new BadRequestException("이 리스트는 그 날짜에 이미 들어 있습니다.");
		}
	}

	/** 내 일정 다른 날로 옮기기 */
	public void move(long userId, long scheduleId, String date) {
		String d = toDate(date).toString();
		try {
			if (scheduleDAO.updateDate(userId, scheduleId, d) == 0) throw new BadRequestException("옮길 일정을 찾지 못했습니다.");
		} catch (DuplicateKeyException ex) {
			throw new BadRequestException("이 리스트는 그 날짜에 이미 들어 있습니다.");
		}
	}

	/** 내 일정 빼기 */
	public void delete(long userId, long scheduleId) {
		if (scheduleDAO.deleteSchedule(userId, scheduleId) == 0) throw new BadRequestException("뺄 일정을 찾지 못했습니다.");
	}

	private static LocalDate toDate(String v) {
		try {
			return LocalDate.parse(v.length() > 10 ? v.substring(0, 10) : v);
		} catch (DateTimeParseException | NullPointerException ex) {
			throw new BadRequestException("날짜 형식이 올바르지 않습니다.");
		}
	}
}
