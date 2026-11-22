package itgeo.controller;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import itgeo.service.ArchiveService;
import itgeo.service.FieldService;
import itgeo.service.MemberService;
import itgeo.service.MobileService;
import itgeo.service.ScheduleService;
import itgeo.to.ArchiveDetailTO;
import itgeo.to.ArchiveRowTO;
import itgeo.to.FieldItemTO;
import itgeo.to.FieldListTO;
import itgeo.to.MemberTO;
import itgeo.to.ScheduleItemTO;

/**
 * 모바일 앱(mobile/) 전용 JSON API. 화면용 컨트롤러와 같은 서비스를 쓰고 JSON 만 돌려준다.
 * 로그인은 웹과 같은 세션(loginMember). api/mobile/login.do 만 LoginInterceptor 에서 뺀다 (servlet-context.xml).
 *
 *  POST api/mobile/login.do        loginId, pw            → 사용자 (실패 401)
 *  POST api/mobile/logout.do
 *  GET  api/mobile/me.do                                  → 사용자 (세션 없으면 401, LoginInterceptor)
 *  GET  api/mobile/groups.do                              → 현장확인 리스트(진행 중 → 완료 순) + 건물 (방문 순서)
 *  POST api/mobile/group/order.do  surveyId, factorIds[]  → 방문 순서 저장
 *  POST api/mobile/group/remove.do surveyId, factorId     → 리스트에서 건물 빼기 (보관함에는 남음)
 *  POST api/mobile/group/replace.do surveyId, oldFactorId, newFactorId → 건물 바꾸기 (같은 자리)
 *  POST api/mobile/group/add.do    surveyId, factorId     → 리스트 끝에 건물 넣기 (보관함에서)
 *  GET  api/mobile/archive.do                             → 내 보관함 (어느 리스트에 담겼는지 포함)
 *  GET  api/mobile/building.do     bldId                  → 건물 + 사전 탐지 요인 + 확인 기록 (05 와 같은 데이터)
 *  POST api/mobile/record.do       bldId, result, chk_<요인키>=Y|N|?, score_<항목키>=1~5, resident, supports[], content → recordId
 *  POST api/mobile/photo/upload.do JSON {recordId, label, data(base64 data URL)} → photoId
 *  GET  api/mobile/photo.do        photoId                → 사진 파일 (웹 05 타임라인도 이 주소로 보여 줌)
 *  GET  api/mobile/schedule.do    start, end (yyyy-MM-dd, end 미포함) → 달력에 넣은 리스트를 건물까지 펼친 줄 (확인 탭 월간 달력)
 *  GET  api/mobile/schedule/day.do date (yyyy-MM-dd)   → 하루 일정 + 건물 취약점 · 가구 취약점 (홈 주간 일정)
 *  GET  api/mobile/config.do                              → 네이버 지도 키 · 점수 항목 · 지원 목록 · 요인 라벨
 *
 * 로그인 안 된 api/ 요청은 LoginInterceptor 가 redirect 대신 401 JSON 을 돌려준다.
 */
@RestController
public class MobileRESTController {

	private static final String JSON = "application/json;charset=UTF-8";

	@Autowired
	MemberService memberService;

	@Autowired
	FieldService fieldService;

	@Autowired
	ArchiveService archiveService;

	@Autowired
	MobileService mobileService;

	@Autowired
	ScheduleService scheduleService;

	@Value("${app.naver.client-id}")
	String naverClientId;

	// ---------- 로그인 ----------

	@PostMapping(value = "api/mobile/login.do", produces = JSON)
	public ResponseEntity<Map<String, Object>> login(@RequestParam("loginId") String loginId, @RequestParam("pw") String pw,
			HttpServletRequest req) {
		MemberTO member = memberService.login(loginId, pw);
		if (member == null) {
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(msg(false, "아이디 또는 비밀번호가 올바르지 않습니다."));
		}
		req.getSession().setAttribute("loginMember", member);
		Map<String, Object> out = msg(true, null);
		out.put("member", member);
		return ResponseEntity.ok(out);
	}

	@PostMapping(value = "api/mobile/logout.do", produces = JSON)
	public Map<String, Object> logout(HttpServletRequest req) {
		HttpSession session = req.getSession(false);
		if (session != null) session.invalidate();
		return msg(true, null);
	}

	@GetMapping(value = "api/mobile/me.do", produces = JSON)
	public MemberTO me(HttpSession session) {
		return member(session);
	}

	// ---------- 방문 그룹 (= 현장확인 리스트) ----------

	@GetMapping(value = "api/mobile/groups.do", produces = JSON)
	public List<FieldListTO> groups(HttpSession session) {
		MemberTO m = member(session);
		List<FieldListTO> out = new ArrayList<>(fieldService.getFieldList(m.getUserId(), gu(m), "doing", null, true));
		out.addAll(fieldService.getFieldList(m.getUserId(), gu(m), "done", null, true));   // 다 확인한 리스트도 (뒤에)
		return out;
	}

	@PostMapping(value = "api/mobile/group/order.do", produces = JSON)
	public Map<String, Object> order(@RequestParam("surveyId") long surveyId, @RequestParam("factorIds") List<Long> factorIds,
			HttpSession session) {
		MemberTO m = member(session);
		long id = fieldService.saveField(m.getUserId(), gu(m), surveyId, null, null, factorIds);
		return msg(id > 0, id > 0 ? null : "리스트를 찾을 수 없습니다.");
	}

	@PostMapping(value = "api/mobile/group/remove.do", produces = JSON)
	public Map<String, Object> remove(@RequestParam("surveyId") long surveyId, @RequestParam("factorId") long factorId,
			HttpSession session) {
		MemberTO m = member(session);
		List<Long> ids = itemIds(m, surveyId);
		ids.remove(Long.valueOf(factorId));
		long id = fieldService.saveField(m.getUserId(), gu(m), surveyId, null, null, ids);
		return msg(id > 0, id > 0 ? null : "리스트를 찾을 수 없습니다.");
	}

	@PostMapping(value = "api/mobile/group/replace.do", produces = JSON)
	public Map<String, Object> replace(@RequestParam("surveyId") long surveyId, @RequestParam("oldFactorId") long oldFactorId,
			@RequestParam("newFactorId") long newFactorId, HttpSession session) {
		MemberTO m = member(session);
		List<Long> ids = itemIds(m, surveyId);
		int at = ids.indexOf(oldFactorId);
		if (at < 0) return msg(false, "바꿀 건물이 리스트에 없습니다.");
		if (ids.contains(newFactorId)) return msg(false, "이미 리스트에 있는 건물입니다.");
		ids.set(at, newFactorId);
		long id = fieldService.saveField(m.getUserId(), gu(m), surveyId, null, null, ids);   // 남의 건물 · 다른 구면 IllegalArgumentException → 400
		return msg(id > 0, id > 0 ? null : "리스트를 찾을 수 없습니다.");
	}

	@PostMapping(value = "api/mobile/group/add.do", produces = JSON)
	public Map<String, Object> groupAdd(@RequestParam("surveyId") long surveyId, @RequestParam("factorId") long factorId,
			HttpSession session) {
		MemberTO m = member(session);
		List<Long> ids = itemIds(m, surveyId);
		if (ids.contains(factorId)) throw new IllegalArgumentException("이미 이 리스트에 있는 건물입니다.");
		ids.add(factorId);
		long id = fieldService.saveField(m.getUserId(), gu(m), surveyId, null, null, ids);   // 남의 건물 · 다른 구면 IllegalArgumentException → 400
		return msg(id > 0, id > 0 ? null : "리스트를 저장하지 못했습니다.");
	}

	// ---------- 보관함 · 건물 ----------

	@GetMapping(value = "api/mobile/archive.do", produces = JSON)
	public List<ArchiveRowTO> archive(HttpSession session) {
		MemberTO m = member(session);
		return fieldService.getPickList(m.getUserId(), gu(m));
	}

	@GetMapping(value = "api/mobile/building.do", produces = JSON)
	public ResponseEntity<ArchiveDetailTO> building(@RequestParam("bldId") String bldId, HttpSession session) {
		MemberTO m = member(session);
		archiveService.assertMyGu(m, bldId);
		ArchiveDetailTO d = archiveService.getArchiveDetail(bldId, m.getUserId(), gu(m));
		return d == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(d);
	}

	// ---------- 현장 확인 결과 ----------

	/**
	 * 웹 archivecheck.do 와 같은 저장 (visit_history + survey_record) + 앱 상세 (survey_record_detail) → recordId.
	 * 사전 탐지 요인은 chk_<요인키>=Y|N|?, 항목 점수는 score_<항목키>=1~5, 거주자 상태 resident, 필요한 지원 supports[], 녹취록 transcript(선택).
	 * 사진은 저장 뒤 받은 recordId 로 photo/upload.do 에 한 장씩 보낸다.
	 */
	@PostMapping(value = "api/mobile/record.do", produces = JSON)
	public Map<String, Object> record(@RequestParam("bldId") String bldId,
			@RequestParam(value = "result", defaultValue = "MET") String result,
			@RequestParam(value = "content", required = false) String content,
			@RequestParam(value = "scoreAdj", defaultValue = "0") int scoreAdj,
			@RequestParam(value = "added", required = false) List<String> added,
			@RequestParam(value = "resident", required = false) String resident,
			@RequestParam(value = "supports", required = false) List<String> supports,
			@RequestParam(value = "transcript", required = false) String transcript,
			@RequestParam Map<String, String> all, HttpSession session) {
		MemberTO m = member(session);
		archiveService.assertMyGu(m, bldId);
		Map<String, String> checks = new HashMap<>();
		Map<String, Integer> scores = new LinkedHashMap<>();
		for (Map.Entry<String, String> e : all.entrySet()) {
			if (e.getKey().startsWith("chk_")) checks.put(e.getKey().substring(4), e.getValue());
			else if (e.getKey().startsWith("score_")) {
				try { scores.put(e.getKey().substring(6), Integer.parseInt(e.getValue())); } catch (NumberFormatException ignore) { /* 건너뜀 */ }
			}
		}
		long recordId = mobileService.saveRecord(m.getUserId(), bldId, result, checks, added, content, scoreAdj, resident, scores, supports, transcript);   // 리스트에 없음 · 값 이상 → 400
		Map<String, Object> out = msg(true, "현장 확인 결과를 저장했습니다.");
		out.put("recordId", recordId);
		return out;
	}

	/** 사진 1장 { recordId, label, data: "data:image/jpeg;base64,..." }. JSON 본문이라 Tomcat 폼 크기 제한(2MB)과 상관없다 */
	@PostMapping(value = "api/mobile/photo/upload.do", consumes = "application/json", produces = JSON)
	public Map<String, Object> photoUpload(@RequestBody Map<String, Object> body, HttpSession session) {
		MemberTO m = member(session);
		long recordId;
		try { recordId = Long.parseLong(String.valueOf(body.get("recordId"))); } catch (NumberFormatException e) { throw new IllegalArgumentException("기록을 찾을 수 없습니다."); }
		Object label = body.get("label");
		Object data = body.get("data");
		long photoId = mobileService.savePhoto(m.getUserId(), recordId, label == null ? null : String.valueOf(label), data == null ? null : String.valueOf(data));
		Map<String, Object> out = msg(true, null);
		out.put("photoId", photoId);
		return out;
	}

	/** 사진 보기 (앱 · 웹 05 타임라인 공용). 관할 밖 건물이면 403 */
	@GetMapping("api/mobile/photo.do")
	public ResponseEntity<Resource> photo(@RequestParam("photoId") long photoId, HttpSession session) throws IOException {
		Path f = mobileService.getPhotoFile(member(session), photoId);
		if (f == null) return ResponseEntity.notFound().build();
		String type = Files.probeContentType(f);
		return ResponseEntity.ok()
				.contentType(type == null ? MediaType.IMAGE_JPEG : MediaType.parseMediaType(type))
				.cacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePrivate())
				.body(new FileSystemResource(f));
	}

	/** 앱이 웹과 같은 지도 키 · 선택 값을 쓰도록 */
	@GetMapping(value = "api/mobile/config.do", produces = JSON)
	public Map<String, Object> config() {
		Map<String, Object> out = new HashMap<>();
		out.put("naverClientId", naverClientId);
		out.put("scoreItems", MobileService.SCORE_LABELS);
		out.put("residentStatus", MobileService.RESIDENT_STATUS);
		out.put("supports", MobileService.SUPPORTS);
		out.put("factorLabels", ArchiveService.FACTOR_LABELS);
		return out;
	}

	// ---------- 확인 탭 달력 · 홈 주간 일정 ----------

	// 웹 현장확인 리스트 달력(api/field/schedule.do)과 같은 survey_schedule 을 읽는다. 내 일정만, 한 번에 두 달까지
	@GetMapping(value = "api/mobile/schedule.do", produces = JSON)
	public List<ScheduleItemTO> schedule(@RequestParam("start") String start, @RequestParam("end") String end, HttpSession session) {
		MemberTO m = member(session);
		return scheduleService.myItems(m.getUserId(), start, end);
	}

	@GetMapping(value = "api/mobile/schedule/day.do", produces = JSON)
	public List<ScheduleItemTO> scheduleDay(@RequestParam("date") String date, HttpSession session) {
		return mobileService.dayItems(member(session), date);
	}

	// ---------- 공통 ----------

	private List<Long> itemIds(MemberTO m, long surveyId) {
		FieldListTO f = fieldService.getFieldDetail(surveyId, m.getUserId(), gu(m));
		if (f == null) throw new IllegalArgumentException("리스트를 찾을 수 없습니다.");
		List<Long> ids = new ArrayList<>();
		for (FieldItemTO it : f.getItems()) ids.add(it.getFactorId());
		return ids;
	}

	private static MemberTO member(HttpSession session) {
		return (MemberTO) session.getAttribute("loginMember");
	}

	/** 구청 계정이면 소속 구, 서울시청이면 null (= 전체) */
	private static String gu(MemberTO m) {
		return m.isGuUser() ? m.getSggCd() : null;
	}

	private static Map<String, Object> msg(boolean ok, String msg) {
		Map<String, Object> out = new HashMap<>();
		out.put("ok", ok);
		if (msg != null) out.put("msg", msg);
		return out;
	}
}
