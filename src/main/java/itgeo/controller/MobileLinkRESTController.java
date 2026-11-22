package itgeo.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import itgeo.service.ArchiveService;
import itgeo.service.MobileLinkService;
import itgeo.to.MemberTO;
import itgeo.to.MobileLinkPhotoTO;
import itgeo.to.MobileLinkTO;

/**
 * 모바일 현장조사기록 연동 JSON API (05 건물 확인 이력의 "미확인 현장조사기록").
 * 웹은 모바일 기능을 만들지 않는다 : 앱이 보낸 기록을 받아(receive) 확인 · 수정 · [AI 정리]로 이력에 기재하는 것까지만.
 *
 *  POST api/mobile-link/receive.do        JSON 한 건 / 배열 / {records:[…]}  → {ok, received, items}
 *                                         로그인 세션 또는 헤더 X-Link-Token (= app.mobile-link.token). LoginInterceptor 에서 뺀다 (servlet-context.xml)
 *  GET  api/mobile-link/list.do           bldId                  → 미확인 기록 목록 (정리내용 · 사진 포함)
 *  POST api/mobile-link/update.do         JSON {linkId, scores:{키:1~5}, memo}  → 취약점수 · 메모 수정
 *  POST api/mobile-link/photo/delete.do   photoId                → 사진 삭제 (추가 기능 없음)
 *  POST api/mobile-link/transcript/delete.do linkId              → 녹취록 삭제 (추가 · 수정 기능 없음)
 *  POST api/mobile-link/summarize.do      JSON {linkId, scores, memo} → 수정 저장 → AI 정리 → 현장조사이력 기재 → {ok, recordId, summary, pendingCount}
 *  GET  api/mobile-link/photo.do          photoId                → 사진 파일 (모달 · 타임라인)
 */
@RestController
public class MobileLinkRESTController {

	private static final String JSON = "application/json;charset=UTF-8";

	@Autowired
	MobileLinkService mobileLinkService;

	@Autowired
	ArchiveService archiveService;

	/** 앱 → 웹 기록 보내기. 세션도 없고 토큰도 틀리면 401 */
	@CrossOrigin(originPatterns = "${app.mobile-link.allowed-origins:*}", allowedHeaders = { "Content-Type", "X-Link-Token" }, methods = { RequestMethod.POST, RequestMethod.OPTIONS })
	@PostMapping(value = "api/mobile-link/receive.do", consumes = "application/json", produces = JSON)
	public ResponseEntity<Map<String, Object>> receive(@RequestBody JsonNode body,
			@RequestHeader(value = "X-Link-Token", required = false) String token, HttpServletRequest req) {
		HttpSession session = req.getSession(false);
		MemberTO member = session == null ? null : (MemberTO) session.getAttribute("loginMember");
		if (member == null && !mobileLinkService.tokenOk(token)) {
			Map<String, Object> out = new LinkedHashMap<>();
			out.put("ok", false);
			out.put("msg", "로그인하거나 연동 토큰(X-Link-Token)을 보내 주세요.");
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(out);
		}
		return ResponseEntity.ok(mobileLinkService.receive(member, body));
	}

	/** 모달 목록. 관할 밖 건물이면 403 */
	@GetMapping(value = "api/mobile-link/list.do", produces = JSON)
	public Map<String, Object> list(@RequestParam("bldId") String bldId, HttpSession session) {
		archiveService.assertMyGu(member(session), bldId);
		List<MobileLinkTO> list = mobileLinkService.getPendingList(bldId);
		Map<String, Object> out = ok();
		out.put("items", list);
		out.put("scoreLabels", MobileLinkService.SCORE_LABELS);
		out.put("warnScore", MobileLinkService.WARN_SCORE);
		return out;
	}

	/** [수정 내용 저장] */
	@PostMapping(value = "api/mobile-link/update.do", consumes = "application/json", produces = JSON)
	public Map<String, Object> update(@RequestBody JsonNode body, HttpSession session) {
		MobileLinkTO l = myLink(session, body);
		mobileLinkService.update(l.getLinkId(), scores(body), text(body, "memo"));
		Map<String, Object> out = ok();
		out.put("item", mobileLinkService.getLink(l.getLinkId()));
		return out;
	}

	@PostMapping(value = "api/mobile-link/photo/delete.do", produces = JSON)
	public Map<String, Object> deletePhoto(@RequestParam("photoId") long photoId, HttpSession session) {
		MobileLinkPhotoTO p = mobileLinkService.getPhoto(photoId);
		if (p == null) throw new IllegalArgumentException("사진을 찾을 수 없습니다.");
		archiveService.assertMyGu(member(session), p.getBldId());
		mobileLinkService.deletePhoto(photoId);
		return ok();
	}

	@PostMapping(value = "api/mobile-link/transcript/delete.do", produces = JSON)
	public Map<String, Object> deleteTranscript(@RequestParam("linkId") long linkId, HttpSession session) {
		MobileLinkTO l = mobileLinkService.getLink(linkId);
		archiveService.assertMyGu(member(session), l.getBldId());
		mobileLinkService.deleteTranscript(linkId);
		return ok();
	}

	/**
	 * [AI 정리] : 화면의 수정 내용을 먼저 저장 → LLM 요약 → 현장조사이력(visit_history + survey_record) 기재 → 확인 완료.
	 * LLM 이 실패하면 이력에 아무것도 쓰지 않는다 (수정 내용만 저장된 상태)
	 */
	@PostMapping(value = "api/mobile-link/summarize.do", consumes = "application/json", produces = JSON)
	public Map<String, Object> summarize(@RequestBody JsonNode body, HttpSession session) {
		MemberTO m = member(session);
		MobileLinkTO l = myLink(session, body);
		if (body.has("scores") || body.has("memo")) mobileLinkService.update(l.getLinkId(), scores(body), text(body, "memo"));
		MobileLinkTO cur = mobileLinkService.getLink(l.getLinkId());
		String place = text(body, "place");
		String summary = mobileLinkService.aiSummary(cur, place);
		long recordId = mobileLinkService.confirm(m, cur.getLinkId(), summary);
		Map<String, Object> out = ok();
		out.put("recordId", recordId);
		out.put("summary", summary);
		out.put("pendingCount", mobileLinkService.getPendingCount(cur.getBldId()));
		return out;
	}

	/** 사진 보기 (모달 · 타임라인 공용). 관할 밖 건물이면 403 */
	@GetMapping("api/mobile-link/photo.do")
	public ResponseEntity<Resource> photo(@RequestParam("photoId") long photoId, HttpSession session) throws IOException {
		MobileLinkPhotoTO p = mobileLinkService.getPhoto(photoId);
		if (p == null) return ResponseEntity.notFound().build();
		archiveService.assertMyGu(member(session), p.getBldId());
		Path f = mobileLinkService.getPhotoFile(p);
		if (f == null) return ResponseEntity.notFound().build();
		String type = Files.probeContentType(f);
		return ResponseEntity.ok()
				.contentType(type == null ? MediaType.IMAGE_JPEG : MediaType.parseMediaType(type))
				.cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePrivate())
				.body(new FileSystemResource(f));
	}

	// ---------- 공통 ----------

	/** body.linkId 의 기록 (관할 확인) */
	private MobileLinkTO myLink(HttpSession session, JsonNode body) {
		if (body == null || !body.hasNonNull("linkId")) throw new IllegalArgumentException("기록을 골라 주세요.");
		MobileLinkTO l = mobileLinkService.getLink(body.get("linkId").asLong());
		archiveService.assertMyGu(member(session), l.getBldId());
		return l;
	}

	/** {"around":3,"flood":null} → 키 → 점수(null = 지움). 없으면 null (= 점수는 그대로) */
	private static Map<String, Integer> scores(JsonNode body) {
		JsonNode s = body.get("scores");
		if (s == null || !s.isObject()) return null;
		Map<String, Integer> out = new LinkedHashMap<>();
		s.fields().forEachRemaining(e -> out.put(e.getKey(), e.getValue().isNull() ? null : e.getValue().asInt()));
		return out;
	}

	private static String text(JsonNode body, String key) {
		JsonNode v = body.get(key);
		return v == null || v.isNull() ? null : v.asText();
	}

	private static MemberTO member(HttpSession session) {
		return (MemberTO) session.getAttribute("loginMember");
	}

	private static Map<String, Object> ok() {
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("ok", true);
		return out;
	}
}
