package wellfair.to;

import lombok.Data;

// api/field/schedule.do 응답 한 줄 = 풀캘린더 이벤트 하나 (survey_schedule + survey_list.title)
@Data
public class ScheduleEventTO {
	private long id;          // schedule_id
	private String title;     // survey_list.title (리스트 이름)
	private String start;     // sched_date "yyyy-MM-dd" (날짜만 → 풀캘린더가 하루 종일 일정으로 그림)
	private long surveyId;    // 누르면 fielddetail.do?listId= 로 이동할 때 씀 (풀캘린더 extendedProps.surveyId)
}
 