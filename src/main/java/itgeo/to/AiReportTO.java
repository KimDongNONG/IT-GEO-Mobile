package itgeo.to;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import lombok.Data;

/**
 * AI 현장 확인보고서 한 건 (미리보기 · PDF · HWPX 가 모두 이 내용을 그린다).
 * 생성 직후에는 세션에 초안(draftId)으로 두었다가, [다운로드] 때 파일로 만들어 서버에 저장하고 ai_report 에 남긴다.
 */
@Data
public class AiReportTO implements Serializable {
	private static final long serialVersionUID = 1L;

	private String draftId;
	private String bldId;
	private String format;           // PDF / HWPX
	private String title;            // 2025.10.14~2026.11.22 AI 보고서
	private String periodFrom;       // yyyy-MM-dd
	private String periodTo;
	private int recordCnt;
	private String createdAt;        // yyyy-MM-dd HH:mm
	private String writer;           // 만든 사람 (이름 직급 · 부서)

	private List<String[]> facts = new ArrayList<>();        // 대상 시설 표 [항목, 내용]
	private List<Section> sections = new ArrayList<>();      // AI 가 쓴 본문
	private List<String[]> history = new ArrayList<>();      // 사용한 현장조사이력 표 [방문 일시, 담당자, 방문 결과, 현장 체크, 관찰 메모]

	@Data
	public static class Section implements Serializable {
		private static final long serialVersionUID = 1L;
		private String heading;
		private String body;

		public Section() {}

		public Section(String heading, String body) {
			this.heading = heading;
			this.body = body;
		}
	}
}
