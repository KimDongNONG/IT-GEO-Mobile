package itgeo.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import itgeo.common.ForbiddenException;
import itgeo.dao.MobileLinkDAO;
import itgeo.to.FieldCheckTO;
import itgeo.to.MemberTO;
import itgeo.to.MobileLinkPhotoTO;
import itgeo.to.MobileLinkTO;
import itgeo.to.RecordTO;

/**
 * 모바일 앱 현장조사기록 연동 (reference/db/07_ai_report.sql).
 * 웹은 앱 기능을 따로 만들지 않고, 앱이 보낸 JSON(항목별 취약점수 · 메모 · 사진 · 녹취록)을 받아 두었다가
 * 05 건물 확인 이력에서 확인 · 수정한 뒤 [AI 정리]로 요약해 기존 현장 확인 기록(visit_history + survey_record)으로 기재한다.
 *
 * 받는 JSON (한 건 또는 배열, 또는 {"records":[…]}). 이름이 다른 키도 같이 받는다 (앱 FieldRecord 그대로 보내도 됨)
 *   bldId | buildingId          건물 ID (필수)
 *   clientUuid | appRecordId    앱 기록 ID (같은 값으로 다시 보내면 중복으로 보고 저장하지 않음)
 *   loginId                     보낸 사람 로그인 ID (토큰으로 보낼 때)
 *   author | authorNm           작성자 이름
 *   visitedAt | savedAt         방문 일시 "yyyy-MM-dd HH:mm" 또는 epoch 밀리초 (못 읽으면 받은 시각)
 *   result                      MET / ABSENT / REFUSED / OTHER (없으면 거주자 상태로 판단)
 *   resident | residentStatus   양호 / 주의 / 긴급 / 부재
 *   scores                      {"around":3,"flood":4,"exit":2,"clean":1,"mold":5}  1 양호 ~ 5 위험
 *   factorChecks | checks       {"지하층":true,"침수":null} 또는 {"ugrnd":"Y","flood":"?"}
 *   supports                    ["집 수리","돌봄 연계"] 또는 "집 수리,돌봄 연계"
 *   memo | content              메모
 *   transcript                  녹취록 문자열 또는 ["…","…"] 또는 [{"speaker":"담당자","text":"…"}]
 *   photos                      ["data:image/jpeg;base64,…"] 또는 [{"label":"외관","data":"data:image/jpeg;base64,…"}]
 */
@Service
public class MobileLinkService {

	private static final Logger log = LoggerFactory.getLogger(MobileLinkService.class);

	/** 앱 점수 항목 키 → 라벨 (모바일 앱 현장 기록 화면의 항목과 같은 키) */
	public static final Map<String, String> SCORE_LABELS = new LinkedHashMap<>();
	static {
		SCORE_LABELS.put("around", "건물 주변");
		SCORE_LABELS.put("flood", "침수 흔적·배수");
		SCORE_LABELS.put("exit", "비상 탈출로");
		SCORE_LABELS.put("clean", "내부 청결");
		SCORE_LABELS.put("mold", "곰팡이·습기");
	}
	public static final List<String> RESIDENT_STATUS = Arrays.asList("양호", "주의", "긴급", "부재");

	/** 점수 이 값 이상 = 주의 (점수 보정 건수 · 화면 강조). 앱의 "주의 N" 과 같은 기준 */
	public static final int WARN_SCORE = 4;
	public static final int PHOTO_MAX_BYTES = 5 * 1024 * 1024;
	public static final int PHOTO_MAX_COUNT = 10;
	public static final int MEMO_MAX = 5000;
	public static final int TRANSCRIPT_MAX = 100_000;
	public static final int BATCH_MAX = 50;

	private static final ObjectMapper JSON = new ObjectMapper();
	private static final DateTimeFormatter DB_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

	@Autowired
	MobileLinkDAO dao;

	@Autowired
	MapService mapService;

	@Autowired
	FieldService fieldService;

	@Autowired
	MemberService memberService;

	@Autowired
	LlmService llmService;

	@Value("${app.upload.dir:}")
	String uploadDir;

	@Value("${app.mobile-link.token:}")
	String linkToken;

	// ================= 받기 =================

	/** 앱이 보낸 연동 토큰이 맞는지 (설정이 비어 있으면 토큰 방식은 꺼짐 = 로그인 세션으로만 받음) */
	public boolean tokenOk(String token) {
		if (linkToken == null || linkToken.isBlank() || token == null) return false;
		return MessageDigest.isEqual(linkToken.trim().getBytes(StandardCharsets.UTF_8), token.trim().getBytes(StandardCharsets.UTF_8));
	}

	/**
	 * JSON 받기 → {ok, received, items:[{linkId, bldId, code: ADDED | DUP | FAIL, msg}]}.
	 * sessionMember 가 있으면 그 사람이 보낸 것, 없으면(토큰) 각 기록의 loginId 로 찾는다.
	 * 구청 계정이 다른 구 건물을 보내면 그 건만 FAIL (나머지는 저장)
	 */
	public Map<String, Object> receive(MemberTO sessionMember, JsonNode body) {
		List<JsonNode> list = new ArrayList<>();
		if (body == null || body.isNull()) throw new IllegalArgumentException("받은 내용이 없습니다.");
		JsonNode arr = body.isArray() ? body : body.has("records") ? body.get("records") : null;
		if (arr != null && arr.isArray()) arr.forEach(list::add); else list.add(body);
		if (list.isEmpty()) throw new IllegalArgumentException("받은 현장조사기록이 없습니다.");
		if (list.size() > BATCH_MAX) throw new IllegalArgumentException("한 번에 " + BATCH_MAX + "건까지 보낼 수 있습니다.");

		List<Map<String, Object>> items = new ArrayList<>();
		int added = 0;
		for (JsonNode n : list) {
			Map<String, Object> it = new LinkedHashMap<>();
			it.put("bldId", text(n, "bldId", "buildingId"));
			try {
				MobileLinkTO l = receiveOne(sessionMember, n);
				boolean isNew = l.getStatus() == null;
				it.put("linkId", l.getLinkId());
				it.put("code", isNew ? "ADDED" : "DUP");
				if (isNew) added++;
			} catch (IllegalArgumentException | IllegalStateException | ForbiddenException e) {
				it.put("code", "FAIL");
				it.put("msg", e.getMessage());
			}
			items.add(it);
		}
		Map<String, Object> out = new LinkedHashMap<>();
		out.put("ok", added > 0 || items.stream().anyMatch(m -> "DUP".equals(m.get("code"))));
		out.put("received", added);
		out.put("items", items);
		return out;
	}

	/** 한 건 저장. 같은 clientUuid 가 이미 있으면 그 기록을 status 그대로 돌려준다 (중복). 새로 넣은 기록은 status == null */
	MobileLinkTO receiveOne(MemberTO sessionMember, JsonNode n) {
		if (n == null || !n.isObject()) throw new IllegalArgumentException("현장조사기록 형식이 아닙니다.");
		String bldId = text(n, "bldId", "buildingId");
		if (bldId == null) throw new IllegalArgumentException("건물 ID(bldId)가 없습니다.");
		String sgg = mapService.getBuildingSgg(bldId);
		if (sgg == null) throw new IllegalArgumentException("없는 건물입니다. (" + bldId + ")");

		MemberTO sender = sessionMember != null ? sessionMember : memberService.findByLoginId(text(n, "loginId"));
		if (sender != null && sender.isGuUser() && !sender.getSggCd().equals(sgg))
			throw new ForbiddenException("관할 구역의 건물 기록만 보낼 수 있습니다. (" + bldId + ")");

		String uuid = text(n, "clientUuid", "appRecordId");
		if (uuid == null && n.hasNonNull("recordId")) uuid = "app-" + n.get("recordId").asText();
		if (uuid != null && uuid.length() > 64) uuid = uuid.substring(0, 64);
		if (uuid != null) {
			MobileLinkTO dup = dao.getLinkByClient(uuid);
			if (dup != null) return dup;
		}

		MobileLinkTO l = new MobileLinkTO();
		l.setBldId(bldId);
		l.setClientUuid(uuid);
		l.setSenderUserId(sender == null ? null : sender.getUserId());
		String author = text(n, "author", "authorNm");
		if (author == null && sender != null) author = sender.getUserNm();
		l.setAuthorNm(cut(author, 50));
		l.setVisitedAt(visitedAt(n.get("visitedAt") != null ? n.get("visitedAt") : n.get("savedAt")));

		String resident = text(n, "resident", "residentStatus");
		l.setResidentStatus(resident != null && RESIDENT_STATUS.contains(resident) ? resident : null);
		String result = text(n, "result");
		if (result == null || !ArchiveService.VISIT_RESULTS.contains(result)) result = "부재".equals(l.getResidentStatus()) ? "ABSENT" : "MET";
		l.setResult(result);

		l.setScores(toJson(parseScores(n.get("scores"))));
		l.setFactorCheck(toJson(parseChecks(n.has("factorChecks") ? n.get("factorChecks") : n.get("checks"))));
		l.setSupports(cut(String.join(",", parseSupports(n.get("supports"))), 300));
		String memo = text(n, "memo", "content");
		l.setMemo(memo == null ? null : cut(memo, MEMO_MAX));
		String tr = parseTranscript(n.get("transcript"));
		l.setTranscript(tr == null ? null : cut(tr, TRANSCRIPT_MAX));
		dao.addLink(l);

		JsonNode photos = n.get("photos");
		if (photos != null && photos.isArray()) {
			int i = 0;
			for (JsonNode p : photos) {
				if (i >= PHOTO_MAX_COUNT) break;
				String data = p.isTextual() ? p.asText() : text(p, "data", "dataUrl");
				String label = p.isObject() ? text(p, "label") : null;
				try {
					savePhoto(l.getLinkId(), label == null ? "현장 사진 " + (i + 1) : label, data);
					i++;
				} catch (IllegalArgumentException | IllegalStateException e) {
					log.warn("mobile link photo skipped (link {}) : {}", l.getLinkId(), e.getMessage());   // 사진 한 장이 깨져도 기록은 받는다
				}
			}
		}
		l.setStatus(null);       // 새로 넣었다는 표시 (receive 가 ADDED 로 센다)
		return l;
	}

	// ================= 05 화면 =================

	/** 05 타임라인 위 "N개의 미확인 현장조사기록" */
	public int getPendingCount(String bldId) {
		return dao.getPendingCount(bldId);
	}

	/** 확인 전 기록의 방문 날짜 범위 [가장 오래된 날, 가장 최근 날] (yyyy-MM-dd). 없으면 null */
	public String[] getPendingRange(String bldId) {
		Map<String, Object> m = dao.getPendingRange(bldId);
		if (m == null || m.get("d_from") == null) return null;
		return new String[] { String.valueOf(m.get("d_from")), String.valueOf(m.get("d_to")) };
	}

	/** 모달 목록 : 미확인 기록 + 정리내용(항목별 취약점수 · 현장 체크 · 사진) */
	public List<MobileLinkTO> getPendingList(String bldId) {
		List<MobileLinkTO> list = dao.getPendingList(bldId);
		fill(list);
		return list;
	}

	/** 기록 1건 (정리내용 채움). 없으면 IllegalArgumentException */
	public MobileLinkTO getLink(long linkId) {
		MobileLinkTO l = dao.getLink(linkId);
		if (l == null) throw new IllegalArgumentException("현장조사기록을 찾을 수 없습니다.");
		fill(List.of(l));
		return l;
	}

	/** [수정 내용 저장] : 항목별 취약점수 · 메모만 고친다. 확인이 끝난 기록이면 IllegalStateException */
	public void update(long linkId, Map<String, Integer> scores, String memo) {
		MobileLinkTO cur = getLink(linkId);
		if (!"NEW".equals(cur.getStatus())) throw new IllegalStateException("이미 확인을 마친 기록은 고칠 수 없습니다.");
		Map<String, Integer> sc = new LinkedHashMap<>(cur.scoreMap());
		if (scores != null) for (Map.Entry<String, Integer> e : scores.entrySet()) {
			if (!sc.containsKey(e.getKey()) && !SCORE_LABELS.containsKey(e.getKey())) continue;   // 모르는 항목은 무시
			Integer v = e.getValue();
			if (v == null) sc.remove(e.getKey());
			else if (v >= 1 && v <= 5) sc.put(e.getKey(), v);
			else throw new IllegalArgumentException("취약점수는 1 ~ 5 사이로 골라 주세요.");
		}
		MobileLinkTO to = new MobileLinkTO();
		to.setLinkId(linkId);
		to.setScores(toJson(sc));
		to.setMemo(memo == null || memo.isBlank() ? null : cut(memo.trim(), MEMO_MAX));
		if (dao.updateLink(to) == 0) throw new IllegalStateException("이미 확인을 마친 기록은 고칠 수 없습니다.");
	}

	/** 사진 삭제 (파일 + 행). 확인 전 기록의 사진만 */
	public void deletePhoto(long photoId) {
		MobileLinkPhotoTO p = dao.getPhoto(photoId);
		if (p == null) throw new IllegalArgumentException("사진을 찾을 수 없습니다.");
		if (!"NEW".equals(p.getStatus())) throw new IllegalStateException("이미 확인을 마친 기록의 사진은 지울 수 없습니다.");
		dao.deletePhoto(photoId);
		try {
			Path f = photoRoot().resolve(p.getFileName()).normalize();
			if (f.startsWith(photoRoot())) Files.deleteIfExists(f);
		} catch (IOException e) {
			log.warn("photo file delete failed : {}", p.getFileName());
		}
	}

	/** 녹취록 삭제 (추가 · 수정 기능은 없음) */
	public void deleteTranscript(long linkId) {
		if (dao.deleteTranscript(linkId) == 0) throw new IllegalStateException("이미 확인을 마친 기록은 고칠 수 없습니다.");
	}

	/** 사진 1장 (건물 · 상태 포함). 없으면 null */
	public MobileLinkPhotoTO getPhoto(long photoId) {
		return dao.getPhoto(photoId);
	}

	/** 사진 파일 경로 (폴더 밖 · 없는 파일이면 null) */
	public Path getPhotoFile(MobileLinkPhotoTO p) {
		if (p == null) return null;
		Path f = photoRoot().resolve(p.getFileName()).normalize();
		if (!f.startsWith(photoRoot()) || !Files.isRegularFile(f)) return null;
		return f;
	}

	// ================= AI 정리 → 현장조사이력 기재 =================

	/**
	 * [AI 정리] 1단계 : 항목별 취약점수 · 메모 · 녹취록(+ 거주자 상태 · 필요한 지원 · 요인 확인)을 관찰 메모 한 단락으로 요약.
	 * LLM 호출이라 트랜잭션 밖에서 부른다
	 */
	public String aiSummary(MobileLinkTO l, String place) {
		String system = String.join("\n",
				"너는 서울시 구청의 취약 주거 현장조사 기록을 정리하는 행정 보조 도구다.",
				"현장 담당자가 모바일 앱에 남긴 항목별 취약점수, 메모, 녹취록을 읽고 현장조사이력의 '관찰 메모' 한 단락으로 정리한다.",
				"규칙:",
				"- 한국어 공문서 문체로 '~함', '~임', '~필요함'처럼 끝낸다.",
				"- 3~6문장, 600자 이내.",
				"- 점수가 " + WARN_SCORE + "점 이상(주의·위험)인 항목과 메모·녹취록에서 확인된 구체적 사실(위치, 상태, 거주자 요청)을 먼저 적는다.",
				"- 입력에 없는 사실은 지어내지 않는다. 추정은 '~로 보임'으로 구분한다.",
				"- 사람 이름, 연락처, 주민등록번호처럼 개인을 특정할 수 있는 정보는 쓰지 않는다. 거주자는 '거주자'로 적는다.",
				"- 제목, 머리말, 목록 기호 없이 본문만 출력한다.");
		StringBuilder u = new StringBuilder();
		u.append("[대상 시설] ").append(place == null ? "" : place).append('\n');
		u.append("[방문 일시] ").append(l.getVisitedAt()).append('\n');
		u.append("[방문 결과] ").append(l.getResultLabel()).append('\n');
		if (l.getResidentStatus() != null) u.append("[거주자 상태] ").append(l.getResidentStatus()).append('\n');
		u.append("[항목별 취약점수] (1 양호 ~ 5 위험)\n");
		if (l.getScoreItems().isEmpty()) u.append("- 없음\n");
		for (MobileLinkTO.ScoreRow r : l.getScoreItems()) u.append("- ").append(r.getLabel()).append(": ").append(r.getScore()).append("점\n");
		if (l.getCheckText() != null && !l.getCheckText().isBlank()) u.append("[사전 탐지 요인 확인] ").append(l.getCheckText()).append('\n');
		if (!l.getSupportList().isEmpty()) u.append("[필요한 지원] ").append(String.join(", ", l.getSupportList())).append('\n');
		u.append("[메모]\n").append(l.getMemo() == null || l.getMemo().isBlank() ? "없음" : l.getMemo()).append('\n');
		String tr = l.getTranscript();
		u.append("[녹취록]\n").append(tr == null || tr.isBlank() ? "없음" : tr.length() > 12000 ? tr.substring(0, 12000) + " …(이하 생략)" : tr).append('\n');

		String text = llmService.chat(system, u.toString());
		text = text.replaceAll("(?m)^\\s*[-*•·]\\s*", "").replaceAll("\\s*\\n\\s*", " ").trim();
		if (text.startsWith("\"") && text.endsWith("\"") && text.length() > 1) text = text.substring(1, text.length() - 1).trim();
		return cut(text, 2000);
	}

	/**
	 * [AI 정리] 2단계 : 요약을 관찰 메모로 visit_history + survey_record 1건 기재 → 수신 기록 DONE. recordId 리턴.
	 * 담당자(방문자) = 앱에서 보낸 사람, 모르면 확인하는 사람. 방문 일시 = 앱의 방문 일시.
	 * 현장 체크 = 앱의 요인 확인, 점수 보정 = 취약점수 WARN_SCORE 이상 항목 수 (앱 저장과 같은 기준, 최대 +10).
	 * 그 건물이 어떤 현장확인 리스트에도 없으면 IllegalStateException
	 */
	@Transactional
	public long confirm(MemberTO member, long linkId, String summary) {
		MobileLinkTO l = getLink(linkId);
		if (!"NEW".equals(l.getStatus())) throw new IllegalStateException("이미 확인을 마친 기록입니다.");
		Long planId = dao.getPlanForBld(l.getBldId(), member.getUserId(), l.getSenderUserId());
		if (planId == null) throw new IllegalStateException("이 건물은 현장확인 리스트에 없습니다. 위 [재확인 요청]으로 리스트에 먼저 담아 주세요.");

		int warn = 0;
		for (MobileLinkTO.ScoreRow r : l.getScoreItems()) if (r.getScore() >= WARN_SCORE) warn++;
		FieldCheckTO c = new FieldCheckTO();
		c.setPlanId(planId);
		c.setUserId(l.getSenderUserId() != null ? l.getSenderUserId() : member.getUserId());
		c.setBldId(l.getBldId());
		c.setResult(l.getResult() == null ? "MET" : l.getResult());
		c.setContent(summary == null || summary.isBlank() ? "현장 확인 (모바일 앱 기록)" : summary);
		c.setVisitedAt(l.getVisitedAt());
		c.setFactorCheck(l.getFactorCheck());
		int adj = Math.min(10, warn);
		c.setScoreAdj(adj == 0 ? null : adj);
		fieldService.addCheck(c);

		MobileLinkTO done = new MobileLinkTO();
		done.setLinkId(linkId);
		done.setRecordId(c.getRecordId());
		done.setAiSummary(summary);
		done.setConfirmedBy(member.getUserId());
		if (dao.confirmLink(done) == 0) throw new IllegalStateException("이미 확인을 마친 기록입니다.");   // 동시에 누른 경우 → 위 INSERT 도 롤백
		return c.getRecordId();
	}

	// ================= 05 타임라인 · AI 보고서 =================

	/** 타임라인 기록 중 앱에서 받아 기재한 것 : fromApp 표시 + 사진 */
	public void fillTimeline(List<RecordTO> recs) {
		if (recs == null || recs.isEmpty()) return;
		List<Long> ids = new ArrayList<>();
		for (RecordTO r : recs) ids.add(r.getRecordId());
		Map<Long, RecordTO> byId = new HashMap<>();
		for (RecordTO r : recs) byId.put(r.getRecordId(), r);
		for (MobileLinkTO l : dao.getLinksByRecords(ids)) {
			RecordTO r = byId.get(l.getRecordId());
			if (r != null) r.setFromApp(true);
		}
		for (MobileLinkPhotoTO p : dao.getPhotosByRecords(ids)) {
			RecordTO r = byId.get(p.getRecordId());
			if (r != null) r.getAppPhotos().add(p);
		}
	}

	/** 이력에 기재된 기록들의 앱 원본 (recordId → 원본). AI 보고서 재료 */
	public Map<Long, MobileLinkTO> getLinksByRecords(List<Long> recordIds) {
		Map<Long, MobileLinkTO> out = new HashMap<>();
		if (recordIds == null || recordIds.isEmpty()) return out;
		List<MobileLinkTO> list = dao.getLinksByRecords(recordIds);
		parse(list);
		for (MobileLinkTO l : list) out.put(l.getRecordId(), l);
		return out;
	}

	// ================= 내부 =================

	/** JSON 칸 풀기 + 사진 */
	private void fill(List<MobileLinkTO> list) {
		if (list.isEmpty()) return;
		parse(list);
		List<Long> ids = new ArrayList<>();
		Map<Long, MobileLinkTO> byId = new HashMap<>();
		for (MobileLinkTO l : list) { ids.add(l.getLinkId()); byId.put(l.getLinkId(), l); }
		for (MobileLinkPhotoTO p : dao.getPhotosByLinks(ids)) {
			MobileLinkTO l = byId.get(p.getLinkId());
			if (l != null) l.getPhotos().add(p);
		}
	}

	@SuppressWarnings("unchecked")
	private static void parse(List<MobileLinkTO> list) {
		for (MobileLinkTO l : list) {
			l.getScoreItems().clear();
			if (l.getScores() != null && !l.getScores().isBlank()) {
				try {
					Map<String, Object> m = JSON.readValue(l.getScores(), Map.class);
					for (String k : SCORE_LABELS.keySet()) if (m.get(k) instanceof Number) l.getScoreItems().add(new MobileLinkTO.ScoreRow(k, SCORE_LABELS.get(k), ((Number) m.get(k)).intValue()));
					for (Map.Entry<String, Object> e : m.entrySet())        // 앱에 항목이 더 생겨도 보이게 (라벨 = 키)
						if (!SCORE_LABELS.containsKey(e.getKey()) && e.getValue() instanceof Number) l.getScoreItems().add(new MobileLinkTO.ScoreRow(e.getKey(), e.getKey(), ((Number) e.getValue()).intValue()));
				} catch (Exception ignore) {
					// 깨진 JSON 은 점수 없음으로
				}
			}
			StringBuilder sb = new StringBuilder();
			if (l.getFactorCheck() != null && !l.getFactorCheck().isBlank()) {
				try {
					Map<String, Object> m = JSON.readValue(l.getFactorCheck(), Map.class);
					for (Map.Entry<String, Object> e : m.entrySet()) {
						if (sb.length() > 0) sb.append(" · ");
						String v = String.valueOf(e.getValue());
						sb.append(ArchiveService.FACTOR_LABELS.getOrDefault(e.getKey(), e.getKey())).append(' ')
								.append("Y".equals(v) ? "맞음" : "N".equals(v) ? "아님" : "판단 어려움");
					}
				} catch (Exception ignore) {
					// 깨진 JSON 은 표시 안 함
				}
			}
			l.setCheckText(sb.toString());
			l.getSupportList().clear();
			if (l.getSupports() != null) for (String s : l.getSupports().split(",")) if (!s.isBlank()) l.getSupportList().add(s.trim());
		}
	}

	/** {"around":3,…} → 1~5 인 것만. 모르는 키도 영문 · 숫자 · _ 20자 이내면 받아 둔다 */
	static Map<String, Integer> parseScores(JsonNode n) {
		Map<String, Integer> out = new LinkedHashMap<>();
		if (n == null || !n.isObject()) return out;
		Iterator<Map.Entry<String, JsonNode>> it = n.fields();
		while (it.hasNext() && out.size() < 20) {
			Map.Entry<String, JsonNode> e = it.next();
			String k = e.getKey();
			if (!SCORE_LABELS.containsKey(k) && !k.matches("[A-Za-z0-9_]{1,20}")) continue;
			int v = e.getValue().isNumber() ? e.getValue().asInt() : e.getValue().isTextual() ? parseIntOr(e.getValue().asText(), 0) : 0;
			if (v >= 1 && v <= 5) out.put(k, v);
		}
		return out;
	}

	/** {"지하층":true,"침수":null} 또는 {"ugrnd":"Y"} → {"ugrnd":"Y","flood":"?"} (요인 키 · Y/N/? 만) */
	static Map<String, String> parseChecks(JsonNode n) {
		Map<String, String> out = new LinkedHashMap<>();
		if (n == null || !n.isObject()) return out;
		Map<String, String> keyByLabel = new HashMap<>();
		for (Map.Entry<String, String> e : ArchiveService.FACTOR_LABELS.entrySet()) keyByLabel.put(e.getValue(), e.getKey());
		Iterator<Map.Entry<String, JsonNode>> it = n.fields();
		while (it.hasNext()) {
			Map.Entry<String, JsonNode> e = it.next();
			String key = ArchiveService.FACTOR_LABELS.containsKey(e.getKey()) ? e.getKey() : keyByLabel.get(e.getKey());
			if (key == null) continue;
			JsonNode v = e.getValue();
			String s = v == null || v.isNull() ? "?" : v.isBoolean() ? (v.asBoolean() ? "Y" : "N") : v.asText();
			if (!"Y".equals(s) && !"N".equals(s)) s = "?";
			out.put(key, s);
		}
		return out;
	}

	static List<String> parseSupports(JsonNode n) {
		List<String> out = new ArrayList<>();
		if (n == null || n.isNull()) return out;
		List<String> raw = new ArrayList<>();
		if (n.isArray()) n.forEach(x -> raw.add(x.asText()));
		else raw.addAll(Arrays.asList(n.asText().split(",")));
		for (String s : raw) {
			String t = s == null ? "" : s.trim().replace(",", " ");
			if (!t.isEmpty() && t.length() <= 20 && !out.contains(t) && out.size() < 10) out.add(t);
		}
		return out;
	}

	/** 녹취록 : 문자열 그대로, 배열이면 줄마다 ("화자: 내용") */
	static String parseTranscript(JsonNode n) {
		if (n == null || n.isNull()) return null;
		if (n.isTextual()) return n.asText().isBlank() ? null : n.asText().trim();
		if (n.isArray()) {
			StringBuilder sb = new StringBuilder();
			for (JsonNode x : n) {
				String line = x.isObject() ? (x.hasNonNull("speaker") ? x.get("speaker").asText() + ": " : "") + (x.hasNonNull("text") ? x.get("text").asText() : "") : x.asText();
				if (line.isBlank()) continue;
				if (sb.length() > 0) sb.append('\n');
				sb.append(line.trim());
			}
			return sb.length() == 0 ? null : sb.toString();
		}
		return null;
	}

	/** 방문 일시 : "yyyy-MM-dd HH:mm[:ss]" · "yyyy-MM-ddTHH:mm" · epoch 밀리초. 못 읽거나 미래면 지금 */
	static String visitedAt(JsonNode n) {
		LocalDateTime now = LocalDateTime.now();
		if (n != null && n.isNumber()) {
			LocalDateTime t = LocalDateTime.ofInstant(Instant.ofEpochMilli(n.asLong()), ZoneId.of("Asia/Seoul"));
			return (t.isAfter(now.plusMinutes(5)) ? now : t).format(DB_TIME);
		}
		if (n != null && n.isTextual()) {
			String s = n.asText().trim();
			if (s.length() >= 16) s = s.substring(0, s.length() >= 19 && s.charAt(16) == ':' ? 19 : 16);
			try {
				String v = ArchiveService.parseVisitedAt(s);
				if (v != null) return v;
			} catch (IllegalArgumentException ignore) {
				// 형식이 다르면 받은 시각으로
			}
		}
		return now.format(DB_TIME);
	}

	/** data URL 사진 1장 저장 */
	private void savePhoto(long linkId, String label, String dataUrl) {
		if (dataUrl == null) throw new IllegalArgumentException("사진이 없습니다.");
		int comma = dataUrl.indexOf(',');
		String head = comma > 0 ? dataUrl.substring(0, comma) : "";
		String ext = head.startsWith("data:image/jpeg") || head.startsWith("data:image/jpg") ? "jpg"
				: head.startsWith("data:image/png") ? "png" : head.startsWith("data:image/webp") ? "webp" : null;
		if (ext == null || !head.endsWith(";base64")) throw new IllegalArgumentException("JPEG · PNG · WEBP 사진만 받을 수 있습니다.");
		byte[] bytes;
		try {
			bytes = Base64.getMimeDecoder().decode(dataUrl.substring(comma + 1).trim());
		} catch (IllegalArgumentException e) {
			throw new IllegalArgumentException("사진 데이터를 읽을 수 없습니다.");
		}
		if (bytes.length == 0 || bytes.length > PHOTO_MAX_BYTES) throw new IllegalArgumentException("사진은 5MB 까지 받을 수 있습니다.");
		if (dao.getPhotoCount(linkId) >= PHOTO_MAX_COUNT) throw new IllegalArgumentException("사진은 기록 하나에 " + PHOTO_MAX_COUNT + "장까지입니다.");
		String name = "link" + linkId + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "." + ext;
		try {
			Path dir = photoRoot();
			Files.createDirectories(dir);
			Files.write(dir.resolve(name), bytes);
		} catch (IOException e) {
			throw new IllegalStateException("사진을 저장하지 못했습니다.");
		}
		MobileLinkPhotoTO p = new MobileLinkPhotoTO();
		p.setLinkId(linkId);
		p.setFileName(name);
		p.setLabel(cut(label == null ? null : label.trim(), 30));
		dao.addPhoto(p);
	}

	/** 사진 폴더 = app.upload.dir/mobile-link (비어 있으면 [사용자 홈]/itgeo-upload/mobile-link) */
	Path photoRoot() {
		String d = uploadDir == null || uploadDir.isBlank() ? Paths.get(System.getProperty("user.home"), "itgeo-upload").toString() : uploadDir.trim();
		return Paths.get(d, "mobile-link").toAbsolutePath().normalize();
	}

	private static String text(JsonNode n, String... keys) {
		if (n == null) return null;
		for (String k : keys) {
			JsonNode v = n.get(k);
			if (v != null && !v.isNull() && !v.isContainerNode()) {
				String s = v.asText().trim();
				if (!s.isEmpty()) return s;
			}
		}
		return null;
	}

	private static String toJson(Map<String, ?> m) {
		if (m == null || m.isEmpty()) return null;
		try {
			return JSON.writeValueAsString(m);
		} catch (Exception e) {
			return null;
		}
	}

	private static String cut(String s, int max) {
		if (s == null || s.isEmpty()) return null;
		return s.length() > max ? s.substring(0, max) : s;
	}

	private static int parseIntOr(String s, int def) {
		try {
			return Integer.parseInt(s.trim());
		} catch (Exception e) {
			return def;
		}
	}
}
