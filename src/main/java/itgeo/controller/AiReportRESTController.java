package itgeo.controller;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpSession;
import itgeo.report.ReportHtml;
import itgeo.service.AiReportService;
import itgeo.to.AiReportTO;
import itgeo.to.MemberTO;

/**
 * AI 현장 확인보고서 (05 건물 확인 이력 → 인수인계 아래 [AI 현장 확인보고서 생성]). 화면 흐름은 대시보드 보고서와 같다
 *  POST api/report/generate.do  bldId, format(PDF | HWPX) → 본문 생성(LLM) + 파일 만들기 → {ok, draftId, title, format, html, previewUrl?}
 *                               초안과 파일은 세션에 (미리보기와 저장이 같은 파일)
 *  GET  api/report/preview.do   draftId                   → PDF 미리보기 (내려받지 않고 화면 안 보기 창에서 연다)
 *  POST api/report/save.do      draftId                   → 고른 포맷 파일로 서버에 저장 (app.report.dir) → {ok, reportId, fileName, downloadUrl}
 *  GET  api/report/file.do      reportId                  → 저장된 파일 내려받기
 */
@RestController
public class AiReportRESTController {

	private static final String JSON = "application/json;charset=UTF-8";
	private static final String DRAFT = "aiReportDraft";            // 세션 키 (가장 최근 초안 1개)
	private static final String DRAFT_FILE = "aiReportDraftFile";   // 그 초안으로 만든 파일

	@Autowired
	AiReportService aiReportService;

	@PostMapping(value = "api/report/generate.do", produces = JSON)
	public Map<String, Object> generate(@RequestParam("bldId") String bldId, @RequestParam("format") String format, HttpSession session) {
		MemberTO m = member(session);
		AiReportTO rp = aiReportService.generate(m, bldId, format);
		byte[] file = aiReportService.render(rp);          // PDF 글꼴이 없으면 여기서 안내 문구와 함께 400
		session.setAttribute(DRAFT, rp);
		session.setAttribute(DRAFT_FILE, file);
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("ok", true);
		out.put("draftId", rp.getDraftId());
		out.put("title", rp.getTitle());
		out.put("format", rp.getFormat());
		out.put("recordCnt", rp.getRecordCnt());
		out.put("html", ReportHtml.fragment(rp));
		if ("PDF".equals(rp.getFormat())) out.put("previewUrl", "api/report/preview.do?draftId=" + rp.getDraftId());
		return out;
	}

	/** PDF 미리보기 : 생성 때 만든 파일을 그대로 (inline). 초안이 바뀌었거나 HWPX 면 404 */
	@GetMapping("api/report/preview.do")
	public ResponseEntity<byte[]> preview(@RequestParam("draftId") String draftId, HttpSession session) {
		AiReportTO rp = draft(session, draftId);
		Object f = session.getAttribute(DRAFT_FILE);
		if (rp == null || !"PDF".equals(rp.getFormat()) || !(f instanceof byte[])) return ResponseEntity.notFound().build();
		return ResponseEntity.ok()
				.contentType(MediaType.APPLICATION_PDF)
				.cacheControl(CacheControl.noStore())
				.header(HttpHeaders.CONTENT_DISPOSITION, disposition("inline", rp.getTitle() + ".pdf"))
				.body((byte[]) f);
	}

	/** [다운로드] 아이콘 : 세션의 초안 파일을 서버에 저장. 같은 초안을 두 번 누르면 "(2)" 가 붙은 파일로 한 번 더 저장된다 */
	@PostMapping(value = "api/report/save.do", produces = JSON)
	public Map<String, Object> save(@RequestParam("draftId") String draftId, HttpSession session) {
		AiReportTO rp = draft(session, draftId);
		if (rp == null) throw new IllegalStateException("보고서 미리보기가 만료됐습니다. 다시 생성해 주세요.");
		Object f = session.getAttribute(DRAFT_FILE);
		Map<String, Object> r = aiReportService.save(member(session), rp, f instanceof byte[] ? (byte[]) f : null);
		Map<String, Object> out = new LinkedHashMap<>(r);
		out.put("ok", true);
		out.put("downloadUrl", "api/report/file.do?reportId=" + r.get("reportId"));
		return out;
	}

	@GetMapping("api/report/file.do")
	public ResponseEntity<Resource> file(@RequestParam("reportId") long reportId, HttpSession session) {
		Object[] f = aiReportService.getReportFile(member(session), reportId);
		if (f == null) return ResponseEntity.notFound().build();
		Path p = (Path) f[0];
		String name = (String) f[1];
		MediaType type = name.toLowerCase().endsWith(".pdf") ? MediaType.APPLICATION_PDF : MediaType.parseMediaType("application/hwp+zip");
		return ResponseEntity.ok()
				.contentType(type)
				.header(HttpHeaders.CONTENT_DISPOSITION, disposition("attachment", name))
				.body(new FileSystemResource(p));
	}

	/** 파일 이름 헤더 : 한글 이름은 filename* (RFC 5987), 옛 브라우저용 filename 에는 영문 · 숫자만 */
	static String disposition(String type, String name) {
		String ascii = name.replaceAll("[^A-Za-z0-9._~()\\- ]", "_");
		String enc = java.net.URLEncoder.encode(name, StandardCharsets.UTF_8).replace("+", "%20");
		return type + "; filename=\"" + ascii + "\"; filename*=UTF-8''" + enc;
	}

	/** 세션의 초안 (draftId 가 다르면 null) */
	private static AiReportTO draft(HttpSession session, String draftId) {
		Object o = session.getAttribute(DRAFT);
		return o instanceof AiReportTO && draftId != null && draftId.equals(((AiReportTO) o).getDraftId()) ? (AiReportTO) o : null;
	}

	private static MemberTO member(HttpSession session) {
		return (MemberTO) session.getAttribute("loginMember");
	}
}
