package itgeo.report;

import itgeo.to.AiReportTO;

/**
 * AI 현장 확인보고서 → HTML. 화면 미리보기(fragment)와 PDF(document, XHTML)가 같은 내용 · 같은 순서로 그린다.
 * 모든 글자는 esc() 로 이스케이프한다 (LLM 응답 · 기록 내용에 태그가 들어 있어도 글자로 보인다).
 */
public final class ReportHtml {

	private ReportHtml() {}

	/** 미리보기 모달 안에 넣는 조각 (스타일은 pages.css 의 .rp-doc) */
	public static String fragment(AiReportTO rp) {
		StringBuilder h = new StringBuilder();
		h.append("<div class=\"rp-doc\">");
		body(h, rp);
		h.append("</div>");
		return h.toString();
	}

	/** PDF 용 XHTML 문서 (글꼴 이름 fontFamily 는 PdfReportWriter 가 등록한 이름) */
	public static String document(AiReportTO rp, String fontFamily) {
		StringBuilder h = new StringBuilder();
		h.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
				.append("<html xmlns=\"http://www.w3.org/1999/xhtml\" lang=\"ko\"><head><meta charset=\"UTF-8\"/>")
				.append("<title>").append(esc(rp.getTitle())).append("</title><style>")
				.append("@page { size: A4; margin: 18mm 16mm 18mm 16mm; @bottom-center { content: counter(page) ' / ' counter(pages); font-family: '").append(fontFamily).append("'; font-size: 8pt; color: #888; } }")
				.append("body { font-family: '").append(fontFamily).append("'; font-size: 10pt; line-height: 1.6; color: #111; }")
				.append(".rp-title { text-align: center; font-size: 18pt; font-weight: bold; margin: 0 0 4pt; }")
				.append(".rp-sub { text-align: center; font-size: 9pt; color: #555; margin: 0 0 14pt; }")
				.append("table { width: 100%; border-collapse: collapse; margin: 0 0 12pt; }")
				.append("th, td { border: 0.6pt solid #999; padding: 4pt 6pt; vertical-align: top; text-align: left; font-size: 9pt; }")
				.append("th { background: #eef1f5; font-weight: bold; }")
				.append(".rp-facts th { width: 24%; }")
				.append("h2 { font-size: 12pt; margin: 14pt 0 6pt; padding-bottom: 3pt; border-bottom: 1pt solid #333; }")
				.append("p { margin: 0 0 4pt; }")
				.append(".rp-hist th:nth-child(1) { width: 20%; } .rp-hist th:nth-child(2) { width: 15%; } .rp-hist th:nth-child(3) { width: 11%; } .rp-hist th:nth-child(4) { width: 18%; }")
				.append(".rp-hist td:nth-child(1) { white-space: nowrap; }")
				.append(".rp-foot { margin-top: 16pt; font-size: 8.5pt; color: #666; }")
				.append("</style></head><body>");
		body(h, rp);
		h.append("</body></html>");
		return h.toString();
	}

	private static void body(StringBuilder h, AiReportTO rp) {
		h.append("<h1 class=\"rp-title\">현장 확인보고서</h1>");
		h.append("<p class=\"rp-sub\">").append(esc(rp.getTitle())).append(" · 작성 ").append(esc(rp.getCreatedAt()))
				.append(rp.getWriter() == null || rp.getWriter().isBlank() ? "" : " · " + esc(rp.getWriter())).append("</p>");

		h.append("<table class=\"rp-facts\"><tbody>");
		for (String[] f : rp.getFacts()) h.append("<tr><th>").append(esc(f[0])).append("</th><td>").append(esc(f[1])).append("</td></tr>");
		h.append("</tbody></table>");

		for (AiReportTO.Section s : rp.getSections()) {
			h.append("<h2>").append(esc(s.getHeading())).append("</h2>");
			for (String line : (s.getBody() == null ? "" : s.getBody()).split("\\r?\\n")) {
				if (line.isBlank()) continue;
				h.append("<p>").append(esc(line.trim())).append("</p>");
			}
		}

		h.append("<h2>붙임. 사용한 현장조사이력 (").append(rp.getRecordCnt()).append("건)</h2>");
		h.append("<table class=\"rp-hist\"><thead><tr><th>방문 일시</th><th>담당자</th><th>방문 결과</th><th>현장 체크</th><th>관찰 메모</th></tr></thead><tbody>");
		for (String[] r : rp.getHistory()) {
			h.append("<tr>");
			for (String c : r) h.append("<td>").append(esc(c)).append("</td>");
			h.append("</tr>");
		}
		h.append("</tbody></table>");
		h.append("<p class=\"rp-foot\">이 보고서의 본문(1 ~ 5)은 현장조사이력을 바탕으로 AI 가 정리한 초안입니다. 담당자가 사실관계를 확인한 뒤 사용해 주세요.</p>");
	}

	/** HTML · XML 이스케이프 (XHTML 에 못 쓰는 제어문자도 뺀다) */
	public static String esc(String s) {
		if (s == null) return "";
		StringBuilder sb = new StringBuilder(s.length() + 16);
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			switch (c) {
				case '&': sb.append("&amp;"); break;
				case '<': sb.append("&lt;"); break;
				case '>': sb.append("&gt;"); break;
				case '"': sb.append("&quot;"); break;
				case '\'': sb.append("&#39;"); break;
				default:
					if (c < 0x20 && c != '\n' && c != '\t' && c != '\r') break;   // XML 1.0 에서 못 쓰는 글자
					sb.append(c);
			}
		}
		return sb.toString();
	}
}
