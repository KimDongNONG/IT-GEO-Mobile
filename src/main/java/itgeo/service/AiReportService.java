package itgeo.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import itgeo.dao.AiReportDAO;
import itgeo.report.HwpxReportWriter;
import itgeo.report.PdfReportWriter;
import itgeo.to.AiReportTO;
import itgeo.to.ArchiveDetailTO;
import itgeo.to.BuildingTO;
import itgeo.to.MemberTO;
import itgeo.to.MemoTO;
import itgeo.to.RecordTO;
import itgeo.to.TransferTO;

/**
 * AI 현장 확인보고서 (05 건물 확인 이력 → [AI 현장 확인보고서 생성]).
 *  1) generate : 그 시설의 현장조사이력 전부(+ 모바일 앱 기록의 항목 점수 · 거주자 상태 · 필요한 지원 · 녹취록, 이관 · 인수인계)를 LLM 에 주고 본문을 받아 초안을 만든다
 *  2) save     : 초안을 고른 포맷(PDF · HWPX)으로 그려 app.report.dir/<건물ID>/ 에 저장하고 ai_report 에 남긴다
 * 보고서명 = 사용한 현장조사이력의 가장 오래된 날짜 ~ 가장 최근 날짜 + " AI 보고서" (예: 2025.10.14~2026.11.22 AI 보고서)
 */
@Service
public class AiReportService {

	public static final List<String> FORMATS = List.of("PDF", "HWPX");

	/** LLM 이 채울 본문 칸 (JSON 키 → 제목) */
	static final String[][] SECTIONS = {
			{ "overview", "1. 조사 개요" },
			{ "progress", "2. 현장조사 경과" },
			{ "factors", "3. 취약 요인 확인 결과" },
			{ "living", "4. 거주 환경 및 지원 필요 사항" },
			{ "opinion", "5. 종합 의견 및 후속 조치" },
	};

	private static final ObjectMapper JSON = new ObjectMapper();
	private static final DateTimeFormatter DOT = DateTimeFormatter.ofPattern("yyyy.MM.dd");

	@Autowired
	ArchiveService archiveService;

	@Autowired
	LlmService llmService;

	@Autowired
	AiReportDAO dao;

	@Autowired
	PdfReportWriter pdfWriter;

	@Autowired
	HwpxReportWriter hwpxWriter;

	@Value("${app.report.dir:}")
	String reportDir;

	/** 보고서 초안 만들기 (LLM 호출). 건물이 없으면 IllegalArgumentException, 현장조사이력이 없으면 IllegalStateException */
	public AiReportTO generate(MemberTO member, String bldId, String format) {
		String fmt = format == null ? "" : format.trim().toUpperCase();
		if (!FORMATS.contains(fmt)) throw new IllegalArgumentException("보고서 포맷을 골라 주세요. (PDF · 한글)");
		ArchiveDetailTO d = archiveService.getArchiveDetail(bldId, member.getUserId(), member.isGuUser() ? member.getSggCd() : null);
		if (d == null) throw new IllegalArgumentException("건물을 찾을 수 없습니다.");
		if (d.getRecords().isEmpty()) throw new IllegalStateException("현장조사이력이 없어 보고서를 만들 수 없습니다.");

		// 오래된 기록부터 (경과 순서). 화면 타임라인은 최근이 위
		List<RecordTO> recs = new ArrayList<>(d.getRecords());
		recs.sort(Comparator.comparing(RecordTO::getVisitedAt, Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(RecordTO::getRecordId));
		int appCnt = 0;      // 모바일 앱에서 저장한 기록 수 (survey_record_detail 이 있는 기록)
		for (RecordTO r : recs) if (r.isFromApp()) appCnt++;

		// 보고서 기간 = 사용한 현장조사이력 중 가장 오래된 날 ~ 가장 최근 날
		LocalDate from = LocalDate.parse(recs.get(0).getVisitedAt().substring(0, 10));
		LocalDate to = LocalDate.parse(recs.get(recs.size() - 1).getVisitedAt().substring(0, 10));

		AiReportTO rp = new AiReportTO();
		rp.setDraftId(UUID.randomUUID().toString());
		rp.setBldId(bldId);
		rp.setFormat(fmt);
		rp.setTitle(title(from, to));
		rp.setPeriodFrom(from.toString());
		rp.setPeriodTo(to.toString());
		rp.setRecordCnt(recs.size());
		rp.setCreatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
		rp.setWriter(join(" ", member.getUserNm(), member.getRankNm()) + (blank(member.getDeptNm()) ? "" : " · " + member.getDeptNm()));

		BuildingTO b = d.getBuilding();
		String place = placeName(b);
		rp.getFacts().add(new String[] { "대상 시설", place });
		rp.getFacts().add(new String[] { "주소", nvl(b.getAddr()) });
		rp.getFacts().add(new String[] { "용도 · 규모", nvl(b.getUseNm(), "용도 미상") + floors(b) });
		rp.getFacts().add(new String[] { "취약도", d.getSavedScore() + "점 → 현장 확인 보정 " + d.getAdjustedScore() + "점 (" + d.getAdjText() + ")" });
		rp.getFacts().add(new String[] { "사전 탐지 요인", blank(d.getDetectedText()) ? "없음" : d.getDetectedText() });
		rp.getFacts().add(new String[] { "조사 기간", from.format(DOT) + " ~ " + to.format(DOT) + " (현장조사이력 " + recs.size() + "건)" });
		rp.getFacts().add(new String[] { "모바일 앱 연동", appCnt == 0 ? "앱에서 저장한 기록 없음" : "현장조사이력 중 모바일 앱 기록 " + appCnt + "건" });
		rp.getFacts().add(new String[] { "부서 이관", blank(d.getTransferDept()) ? "없음" : d.getTransferDept() });

		// 붙임 표 : 현장조사이력 날짜순. 앱 기록은 방문 결과 뒤에 (앱), 메모 뒤에 항목 점수 · 사진 · 녹취록 유무
		for (RecordTO r : recs) {
			StringBuilder memo = new StringBuilder(nvl(r.getContent()));
			if (r.isFromApp()) {
				if (!r.getScores().isEmpty()) memo.append(memo.length() > 0 ? " / " : "").append("항목 점수 ").append(r.getScoreText());
				if (!r.getPhotos().isEmpty()) memo.append(memo.length() > 0 ? " / " : "").append("사진 ").append(r.getPhotos().size()).append("장");
			}
			if (!blank(r.getTranscript())) memo.append(memo.length() > 0 ? " / " : "").append("녹취록 있음");
			rp.getHistory().add(new String[] {
					r.getVisitedAt(),
					join(" ", r.getUserNm(), r.getRankNm()),
					r.getResultLabel() + (r.isFromApp() ? " (앱)" : ""),
					blank(r.getCheckText()) ? "-" : r.getCheckText(),
					memo.length() == 0 ? "-" : memo.toString() });
		}

		String answer = llmService.chat(systemPrompt(), userPrompt(d, place, recs));
		rp.setSections(sections(answer));
		return rp;
	}

	/** 초안 → 파일 저장 + ai_report 기록. {reportId, fileName, title, format} */
	/** 초안 → 고른 포맷의 파일 내용 (PDF · HWPX). 생성 때 한 번 만들어 미리보기와 저장이 같은 파일을 쓴다 */
	public byte[] render(AiReportTO rp) {
		return "PDF".equals(rp.getFormat()) ? pdfWriter.write(rp) : hwpxWriter.write(rp);
	}

	public Map<String, Object> save(MemberTO member, AiReportTO rp) {
		return save(member, rp, null);
	}

	/** bytes = 생성 때 만든 파일 (없으면 지금 만든다) */
	public Map<String, Object> save(MemberTO member, AiReportTO rp, byte[] bytes) {
		if (rp == null) throw new IllegalStateException("보고서를 먼저 생성해 주세요.");
		archiveService.assertMyGu(member, rp.getBldId());
		if (bytes == null) bytes = render(rp);
		String ext = "PDF".equals(rp.getFormat()) ? ".pdf" : ".hwpx";

		Path dir = root().resolve(safe(rp.getBldId()));
		Path file;
		try {
			Files.createDirectories(dir);
			file = write(dir, safe(rp.getTitle()), ext, bytes);
		} catch (InvalidPathException e) {
			// 서버 OS 가 한글 파일 이름을 못 쓰는 경우 (리눅스 기본 로케일 등) : 같은 날짜의 영문 이름으로. 내려받을 때 이름은 여전히 보고서명
			try {
				file = write(dir, "AI_report_" + rp.getPeriodFrom().replace('-', '.') + "~" + rp.getPeriodTo().replace('-', '.'), ext, bytes);
			} catch (IOException | InvalidPathException e2) {
				throw new IllegalStateException("보고서 파일을 서버에 저장하지 못했습니다.");
			}
		} catch (IOException e) {
			throw new IllegalStateException("보고서 파일을 서버에 저장하지 못했습니다.");
		}

		Map<String, Object> p = new HashMap<>();
		p.put("bldId", rp.getBldId());
		p.put("userId", member.getUserId());
		p.put("title", rp.getTitle());
		p.put("format", rp.getFormat());
		p.put("periodFrom", rp.getPeriodFrom());
		p.put("periodTo", rp.getPeriodTo());
		p.put("recordCnt", rp.getRecordCnt());
		p.put("fileName", root().relativize(file).toString().replace('\\', '/'));
		try {
			p.put("content", JSON.writeValueAsString(rp));
		} catch (Exception e) {
			p.put("content", null);
		}
		dao.addReport(p);

		Map<String, Object> out = new HashMap<>();
		out.put("reportId", ((Number) p.get("reportId")).longValue());   // 생성 키가 BIGINT UNSIGNED 라 BigInteger 로 올 수 있다
		out.put("fileName", rp.getTitle() + ext);                        // 화면 안내 · 내려받는 이름 = 보고서명
		out.put("serverFile", root().relativize(file).toString().replace('\\', '/'));
		out.put("title", rp.getTitle());
		out.put("format", rp.getFormat());
		return out;
	}

	/** 저장된 보고서 파일 (관할 밖 건물이면 ForbiddenException, 없으면 null). [0] = 경로, [1] = 내려받을 파일 이름 (= 보고서명 + 확장자) */
	public Object[] getReportFile(MemberTO member, long reportId) {
		Map<String, Object> r = dao.getReport(reportId);
		if (r == null) return null;
		archiveService.assertMyGu(member, String.valueOf(r.get("bld_id")));
		Path f;
		try {
			f = root().resolve(String.valueOf(r.get("file_name"))).normalize();
		} catch (InvalidPathException e) {
			return null;
		}
		if (!f.startsWith(root()) || !Files.isRegularFile(f)) return null;
		String ext = "PDF".equals(String.valueOf(r.get("format"))) ? ".pdf" : ".hwpx";
		return new Object[] { f, safe(String.valueOf(r.get("title"))) + ext };
	}

	/** dir/이름.ext 로 쓰기. 같은 이름이 있으면 " (2)", " (3)" … 를 붙인다 */
	private static Path write(Path dir, String name, String ext, byte[] bytes) throws IOException {
		Path file = dir.resolve(name + ext);
		for (int i = 2; Files.exists(file); i++) file = dir.resolve(name + " (" + i + ")" + ext);
		Files.write(file, bytes);
		return file;
	}

	/** 2025.10.14~2026.11.22 AI 보고서 */
	static String title(LocalDate from, LocalDate to) {
		return from.format(DOT) + "~" + to.format(DOT) + " AI 보고서";
	}

	// ---------- LLM ----------

	static String systemPrompt() {
		StringBuilder keys = new StringBuilder();
		for (String[] s : SECTIONS) keys.append("  \"").append(s[0]).append("\": \"").append(s[1].substring(3)).append("\",\n");
		return String.join("\n",
				"너는 서울시 구청의 취약 주거 '현장 확인보고서'를 쓰는 행정 보조 도구다.",
				"한 시설에 대해 쌓인 현장조사이력(방문 일시, 담당자, 방문 결과, 사전 탐지 요인 확인, 관찰 메모, 모바일 앱의 항목별 취약점수 · 녹취록)과",
				"부서 이관 · 인수인계 내용을 읽고 보고서 본문을 쓴다.",
				"규칙:",
				"- 한국어 공문서 문체 ('~함', '~임', '~필요함'). 항목은 줄바꿈과 '- ' 로 나눠도 된다.",
				"- 입력에 없는 사실을 지어내지 않는다. 기록끼리 다르면 날짜를 밝혀 변화로 적는다. 추정은 '~로 보임'으로 구분한다.",
				"- 사람 이름, 연락처, 주민등록번호 등 개인을 특정할 수 있는 정보는 쓰지 않는다. 담당자는 '담당자', 거주자는 '거주자'로 적는다.",
				"- 항목별 취약점수는 1(양호) ~ 5(위험)이며 4점 이상은 주의 항목이다.",
				"- 아래 키를 가진 JSON 객체 하나만 출력한다. 값은 모두 문자열이다. 설명 문장이나 코드 블록 표시는 넣지 않는다.",
				"{",
				keys.toString().replaceAll(",\n$", ""),
				"}");
	}

	static String userPrompt(ArchiveDetailTO d, String place, List<RecordTO> recs) {
		BuildingTO b = d.getBuilding();
		StringBuilder u = new StringBuilder();
		u.append("[대상 시설] ").append(place).append(" / ").append(nvl(b.getAddr())).append('\n');
		u.append("[용도 · 규모] ").append(nvl(b.getUseNm(), "용도 미상")).append(floors(b))
				.append(blank(b.getUseaprDay()) || b.getUseaprDay().length() < 4 ? "" : " / 사용승인 " + b.getUseaprDay().substring(0, 4) + "년").append('\n');
		u.append("[취약도] 저장 ").append(d.getSavedScore()).append("점, 현장 확인 보정 후 ").append(d.getAdjustedScore()).append("점\n");
		u.append("[사전 탐지 요인] ").append(blank(d.getDetectedText()) ? "없음" : d.getDetectedText()).append('\n');
		u.append("\n[현장조사이력] 오래된 순, 총 ").append(recs.size()).append("건\n");
		int budget = 40_000;      // 프롬프트가 너무 길어지지 않게 (녹취록부터 줄인다)
		int i = 1;
		for (RecordTO r : recs) {
			u.append("\n(").append(i++).append(") ").append(r.getVisitedAt()).append(" · 방문 결과 ").append(r.getResultLabel()).append('\n');
			if (!blank(r.getCheckText())) u.append("  현장 체크: ").append(r.getCheckText()).append('\n');
			u.append("  관찰 메모: ").append(nvl(r.getContent())).append('\n');
			if (r.getScoreAdj() != null) u.append("  점수 보정: ").append(r.getScoreAdj() > 0 ? "+" : "").append(r.getScoreAdj()).append('\n');
			if (!blank(r.getTransferDept())) u.append("  이관: ").append(r.getTransferDept()).append(' ').append(nvl(r.getTransferReq())).append('\n');
			if (r.isFromApp()) {
				u.append("  [모바일 앱 기록]");
				if (r.getResidentStatus() != null) u.append(" 거주자 상태 ").append(r.getResidentStatus()).append(';');
				if (!r.getSupports().isEmpty()) u.append(" 필요한 지원 ").append(String.join(", ", r.getSupports())).append(';');
				if (!r.getPhotos().isEmpty()) u.append(" 사진 ").append(r.getPhotos().size()).append("장;");
				u.append('\n');
				for (Map.Entry<String, Integer> s : r.getScores().entrySet())
					u.append("   - ").append(MobileService.SCORE_LABELS.getOrDefault(s.getKey(), s.getKey())).append(' ').append(s.getValue()).append("점\n");
			}
			if (!blank(r.getTranscript()) && budget > 0) {
				String t = r.getTranscript();
				int max = Math.min(budget, 4000);
				u.append("  녹취록: ").append(t.length() > max ? t.substring(0, max) + " …(이하 생략)" : t).append('\n');
				budget -= Math.min(t.length(), max);
			}
		}
		if (!d.getTransfers().isEmpty()) {
			u.append("\n[부서 이관]\n");
			for (TransferTO t : d.getTransfers())
				u.append("- ").append(t.getCreatedAt()).append(' ').append(t.getDeptNm()).append(' ').append(t.getReqType())
						.append(" (").append("REPLIED".equals(t.getStatus()) ? "회신 완료" : "회신 대기").append(")\n");
		}
		if (!d.getMemos().isEmpty()) {
			u.append("\n[인수인계 메모]\n");
			for (MemoTO m : d.getMemos()) u.append("- ").append(m.getCreatedAt()).append(' ').append(m.getMemo()).append('\n');
		}
		return u.toString();
	}

	/** LLM 응답(JSON) → 본문 칸. JSON 이 아니면 전체를 "종합 의견" 한 칸으로 */
	static List<AiReportTO.Section> sections(String answer) {
		List<AiReportTO.Section> out = new ArrayList<>();
		JsonNode n = LlmService.extractJson(answer);
		if (n != null && n.isObject()) {
			for (String[] s : SECTIONS) {
				JsonNode v = n.get(s[0]);
				String body = v == null || v.isNull() ? "" : v.isArray() ? joinArray(v) : v.asText();
				out.add(new AiReportTO.Section(s[1], blank(body) ? "해당 내용 없음." : body.trim()));
			}
			return out;
		}
		out.add(new AiReportTO.Section("종합 의견", answer == null ? "" : answer.trim()));
		return out;
	}

	private static String joinArray(JsonNode v) {
		StringBuilder sb = new StringBuilder();
		for (JsonNode x : v) { if (sb.length() > 0) sb.append('\n'); sb.append("- ").append(x.asText()); }
		return sb.toString();
	}

	// ---------- 공통 ----------

	/** 05 화면 제목과 같은 시설 이름 ("가리봉동 12-34 ○○빌라") */
	static String placeName(BuildingTO b) {
		String addr = nvl(b.getAddr()).replace("서울특별시 ", "");
		int gu = addr.indexOf("구 ");
		String shortAddr = gu >= 0 ? addr.substring(gu + 2) : addr;
		return (shortAddr + " " + nvl(blank(b.getBldNm()) ? b.getUseNm() : b.getBldNm())).trim();
	}

	private static String floors(BuildingTO b) {
		String s = "";
		if (b.getGrndFlr() != null) s += " · 지상 " + b.getGrndFlr() + "층";
		if (b.getUgrndFlr() != null && b.getUgrndFlr() > 0) s += " / 지하 " + b.getUgrndFlr() + "층";
		return s;
	}

	/** 보고서 폴더 = app.report.dir (비어 있으면 [사용자 홈]/itgeo-report) */
	Path root() {
		String d = blank(reportDir) ? Paths.get(System.getProperty("user.home"), "itgeo-report").toString() : reportDir.trim();
		return Paths.get(d).toAbsolutePath().normalize();
	}

	/** 파일 · 폴더 이름에 못 쓰는 글자 빼기 (~ 와 . 와 공백은 그대로) */
	static String safe(String s) {
		String t = nvl(s).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
		return t.isEmpty() || t.matches("\\.+") ? "report" : t;
	}

	private static String join(String sep, String... parts) {
		StringBuilder sb = new StringBuilder();
		for (String p : parts) if (!blank(p)) { if (sb.length() > 0) sb.append(sep); sb.append(p.trim()); }
		return sb.toString();
	}

	private static boolean blank(String s) {
		return s == null || s.isBlank();
	}

	private static String nvl(String s) {
		return s == null ? "" : s;
	}

	private static String nvl(String s, String def) {
		return blank(s) ? def : s;
	}
}
