package itgeo.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;

import itgeo.common.BadRequestException;
import itgeo.common.ForbiddenException;
import itgeo.dao.MobileDAO;
import itgeo.to.AnalysisCriteriaTO;
import itgeo.to.BuildingDetailTO;
import itgeo.to.BuildingTO;
import itgeo.to.MemberTO;
import itgeo.to.PhotoTO;
import itgeo.to.RecordDetailTO;
import itgeo.to.ScheduleItemTO;

/**
 * 모바일 앱 현장 기록 저장 (reference/db/06_app_tables.sql).
 * 기록 본문은 웹과 같은 ArchiveService.addCheck (visit_history + survey_record), 앱에만 있는 값은 survey_record_detail,
 * 사진은 app.upload.dir 폴더 + survey_photo. 웹 05 타임라인은 ArchiveService.getArchiveDetail 이 같이 읽어 보여 준다.
 */
@Service
public class MobileService {

	/** 앱 점수 항목 키 → 라벨 (mobile/src/screens/Record.tsx SECTIONS 와 같은 키) */
	public static final Map<String, String> SCORE_LABELS = new LinkedHashMap<>();
	static {
		SCORE_LABELS.put("around", "건물 주변");
		SCORE_LABELS.put("flood", "침수 흔적·배수");
		SCORE_LABELS.put("exit", "비상 탈출로");
		SCORE_LABELS.put("clean", "내부 청결");
		SCORE_LABELS.put("mold", "곰팡이·습기");
	}
	public static final List<String> RESIDENT_STATUS = Arrays.asList("양호", "주의", "긴급", "부재");
	public static final List<String> SUPPORTS = Arrays.asList("집 수리", "주거 이전", "긴급복지", "돌봄 연계", "의료", "안부 확인");

	/** 사진 1장 최대 크기 (디코딩 후). 앱은 1280px · JPEG 70% 로 줄여 보낸다 */
	public static final int PHOTO_MAX_BYTES = 5 * 1024 * 1024;
	/** 한 기록에 붙일 수 있는 사진 수 */
	public static final int PHOTO_MAX_COUNT = 10;
	/** 녹취록 최대 글자 수 */
	public static final int TRANSCRIPT_MAX = 100_000;

	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	MobileDAO dao;

	@Autowired
	ArchiveService archiveService;

	@Autowired
	ScheduleService scheduleService;

	@Autowired
	MapService mapService;

	@Value("${app.upload.dir:}")
	String uploadDir;

	/** 앱 현장 기록 저장 → recordId. 본문(웹과 같은 저장) + 상세 한 트랜잭션 */
	@Transactional
	public long saveRecord(long userId, String bldId, String result, Map<String, String> checks, List<String> added,
			String content, int scoreAdj, String residentStatus, Map<String, Integer> scores, List<String> supports, String transcript) {
		if (residentStatus != null && residentStatus.isBlank()) residentStatus = null;
		if (residentStatus != null && !RESIDENT_STATUS.contains(residentStatus)) throw new IllegalArgumentException("거주자 상태를 확인해 주세요.");
		if ("부재".equals(residentStatus) && (result == null || "MET".equals(result))) result = "ABSENT";

		long recordId = archiveService.addCheck(userId, bldId, null, result, checks, added, content, scoreAdj);

		Map<String, Integer> sc = new LinkedHashMap<>();
		if (scores != null) for (Map.Entry<String, Integer> e : scores.entrySet()) {
			Integer v = e.getValue();
			if (SCORE_LABELS.containsKey(e.getKey()) && v != null && v >= 1 && v <= 5) sc.put(e.getKey(), v);
		}
		StringBuilder sp = new StringBuilder();
		if (supports != null) for (String s : supports) if (SUPPORTS.contains(s)) { if (sp.length() > 0) sp.append(','); sp.append(s); }

		RecordDetailTO d = new RecordDetailTO();
		d.setRecordId(recordId);
		d.setResidentStatus(residentStatus);
		try { d.setScores(sc.isEmpty() ? null : JSON.writeValueAsString(sc)); } catch (Exception e) { d.setScores(null); }
		d.setSupports(sp.length() == 0 ? null : sp.toString());
		if (transcript != null && transcript.length() > TRANSCRIPT_MAX) throw new IllegalArgumentException("녹취록이 너무 깁니다. (최대 " + TRANSCRIPT_MAX + "자)");
		d.setTranscript(transcript == null || transcript.isBlank() ? null : transcript.trim());
		dao.addRecordDetail(d);
		return recordId;
	}

	/** 사진 1장 저장 (data:image/jpeg;base64,... ). 내가 쓴 기록에만 붙일 수 있다 → photoId */
	public long savePhoto(long userId, long recordId, String label, String dataUrl) {
		if (dao.getMyRecordBld(userId, recordId) == null) throw new ForbiddenException("내가 저장한 기록에만 사진을 붙일 수 있습니다.");
		if (dataUrl == null) throw new IllegalArgumentException("사진이 없습니다.");
		int comma = dataUrl.indexOf(',');
		String head = comma > 0 ? dataUrl.substring(0, comma) : "";
		String ext = head.startsWith("data:image/jpeg") ? "jpg" : head.startsWith("data:image/png") ? "png" : head.startsWith("data:image/webp") ? "webp" : null;
		if (ext == null || !head.endsWith(";base64")) throw new IllegalArgumentException("JPEG · PNG · WEBP 사진만 올릴 수 있습니다.");
		byte[] bytes;
		try {
			bytes = Base64.getDecoder().decode(dataUrl.substring(comma + 1).trim());
		} catch (IllegalArgumentException e) {
			throw new IllegalArgumentException("사진 데이터를 읽을 수 없습니다.");
		}
		if (bytes.length == 0 || bytes.length > PHOTO_MAX_BYTES) throw new IllegalArgumentException("사진은 5MB 까지 올릴 수 있습니다.");
		if (dao.getPhotos(List.of(recordId)).size() >= PHOTO_MAX_COUNT) throw new IllegalArgumentException("사진은 기록 하나에 " + PHOTO_MAX_COUNT + "장까지입니다.");

		String name = recordId + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12) + "." + ext;
		try {
			Path dir = uploadRoot();
			Files.createDirectories(dir);
			Files.write(dir.resolve(name), bytes);
		} catch (IOException e) {
			throw new IllegalStateException("사진을 저장하지 못했습니다.");
		}
		PhotoTO p = new PhotoTO();
		p.setRecordId(recordId);
		p.setFileName(name);
		p.setLabel(label == null || label.isBlank() ? null : label.trim().length() > 30 ? label.trim().substring(0, 30) : label.trim());
		dao.addPhoto(p);
		return p.getPhotoId();
	}

	/** 사진 보기 : 파일 경로. 관할 밖 건물이면 ForbiddenException, 없으면 null */
	public Path getPhotoFile(MemberTO member, long photoId) {
		PhotoTO p = dao.getPhoto(photoId);
		if (p == null) return null;
		archiveService.assertMyGu(member, p.getBldId());
		Path f = uploadRoot().resolve(p.getFileName()).normalize();
		if (!f.startsWith(uploadRoot()) || !Files.isRegularFile(f)) return null;
		return f;
	}

	/** 모바일 홈 : 하루 일정 + 건물 취약점 · 가구 취약점 (05 건물 상세와 같은 데이터, 같은 건물은 한 번만 읽음) */
	public List<ScheduleItemTO> dayItems(MemberTO m, String date) {
		LocalDate d;
		try {
			d = LocalDate.parse(date);
		} catch (DateTimeParseException | NullPointerException e) {
			throw new BadRequestException("날짜 형식이 올바르지 않습니다.");
		}
		List<ScheduleItemTO> items = scheduleService.myItems(m.getUserId(), d.toString(), d.plusDays(1).toString());
		String gu = m.isGuUser() ? m.getSggCd() : null;
		Map<String, BuildingDetailTO> cache = new HashMap<>();
		for (ScheduleItemTO it : items) {
			if (gu != null && !gu.equals(it.getSggCd())) { it.setBldFactors(List.of()); it.setHhVulns(List.of()); continue; }
			BuildingDetailTO bd = cache.computeIfAbsent(it.getBldId(), id -> {
				AnalysisCriteriaTO c = new AnalysisCriteriaTO();
				c.setBldId(id);
				c.setUserId(m.getUserId());
				if (gu != null) c.setGu(gu);
				return mapService.getBuildingDetail(c);
			});
			it.setBldFactors(bd == null ? List.of() : factorsOf(bd.getBuilding()));
			it.setHhVulns(bd == null || bd.getResidents() == null ? List.of() : bd.getResidents().getVulnList());
		}
		return items;
	}

	/** 요인 점수가 0보다 큰 것 = 건물 취약점 */
	static List<String> factorsOf(BuildingTO b) {
		List<String> out = new ArrayList<>();
		if (b == null) return out;
		int[] pts = { b.getPtUgrnd(), b.getPtGosiwon(), b.getPtRooftop(), b.getPtViol(), b.getPtOld(), b.getPtFlood(), b.getPtLow(), b.getPtCheap() };
		String[] keys = { "ugrnd", "gosiwon", "rooftop", "viol", "old", "flood", "low", "cheap" };
		for (int i = 0; i < keys.length; i++) if (pts[i] > 0) out.add(ArchiveService.FACTOR_LABELS.get(keys[i]));
		return out;
	}

	/** app.upload.dir 이 비어 있으면 [사용자 홈]/itgeo-upload (예전 이름 itgeo-upload 폴더만 있으면 그 폴더를 계속 씀) */
	Path uploadRoot() {
		if (uploadDir != null && !uploadDir.isBlank()) return Paths.get(uploadDir.trim()).toAbsolutePath().normalize();
		Path home = Paths.get(System.getProperty("user.home"));
		Path dir = home.resolve("itgeo-upload");
		Path old = home.resolve("itgeo-upload");
		return (!Files.exists(dir) && Files.isDirectory(old) ? old : dir).toAbsolutePath().normalize();
	}
}
