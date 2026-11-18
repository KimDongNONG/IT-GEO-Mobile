package wellfair.to;

import lombok.Data;

/** 앱 현장 기록 상세 1줄 (survey_record_detail) */
@Data
public class RecordDetailTO {
	private long recordId;
	private String residentStatus;   // 양호 / 주의 / 긴급 / 부재
	private String scores;           // JSON {"around":3,"flood":4,…}
	private String supports;         // 쉼표 구분
	private String source = "APP";
}
