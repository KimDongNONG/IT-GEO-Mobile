package itgeo.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import itgeo.to.WeatherTO;

/**
 * 기상청 (공공데이터포털 data.go.kr) : 현재 기온 + 기상특보. 대시보드 상단 한 줄.
 *  - 기온 : 단기예보 조회서비스 · 초단기실황 getUltraSrtNcst 의 T1H. 매시 정각 관측, 매시 40분쯤 올라옴 → 1시간 단위
 *  - 특보 : 기상특보 조회서비스 · 특보현황 getPwnStatus 의 발효 현황(t6) 중 "서울" 이 들어간 특보만
 * 키는 app.properties 의 app.kma.service-key (두 서비스 모두 활용 신청 필요). 비어 있으면 화면은 "날씨 연동 전" 으로 보인다.
 * 같은 구는 10분 동안 다시 부르지 않는다 (메모리 캐시).
 */
@Service
public class WeatherService {

	private static final Logger log = LoggerFactory.getLogger(WeatherService.class);
	private static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private static final long TTL_MS = 10 * 60 * 1000L;
	private static final String NCST_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
	private static final String WARN_URL = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";
	/** "o 한파주의보 : 서울, 인천, 경기도(…)" 한 줄 */
	private static final Pattern WARN_LINE = Pattern.compile("o\\s*([^\\s:]+(?:주의보|경보))\\s*:\\s*([^\\r\\n]*)");

	/** 구 코드 → 기상청 격자 (nx, ny). 없으면(서울시청 계정) 서울 중구 */
	private static final Map<String, int[]> GRID = Map.of(
			"11530", new int[] { 58, 125 },   // 구로구
			"11470", new int[] { 58, 126 },   // 양천구
			"11560", new int[] { 58, 126 });  // 영등포구
	private static final int[] SEOUL = { 60, 127 };

	@Value("${app.kma.service-key:}")
	String serviceKey;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
	private final ObjectMapper json = new ObjectMapper();
	private final Map<String, Object[]> cache = new ConcurrentHashMap<>();   // key → { 저장 시각(Long), 값 }

	public WeatherTO getWeather(String sggCd) {
		WeatherTO w = new WeatherTO();
		if (serviceKey == null || serviceKey.isBlank()) {
			w.setMsg("기상청 API 키(app.kma.service-key)가 설정되지 않았습니다.");
			return w;
		}
		int[] g = sggCd == null ? SEOUL : GRID.getOrDefault(sggCd, SEOUL);

		// 관측 기준 시각 : 40분 전 기준 정시 (예: 12:10 → 11:00, 12:45 → 12:00)
		LocalDateTime base = LocalDateTime.now(KST).minusMinutes(40).withMinute(0).withSecond(0).withNano(0);
		String key = g[0] + "," + g[1] + "@" + base;
		try {
			Double temp = cached("t:" + key, () -> fetchTemp(g, base));
			List<String> warns = cached("w:" + base.toLocalDate() + base.getHour(), this::fetchWarnings);
			w.setTemp(temp);
			if (warns != null) w.setWarnings(warns);
			w.setBaseTime(base.format(DateTimeFormatter.ofPattern("HH:00")));
			w.setOk(temp != null);
			if (temp == null) w.setMsg("기온 정보를 받지 못했습니다.");
		} catch (Exception e) {
			log.warn("기상청 호출 실패 : {}", e.toString());
			w.setMsg("기상청 연결에 실패했습니다.");
		}
		return w;
	}

	/** 초단기실황 T1H (기온 ℃) */
	private Double fetchTemp(int[] g, LocalDateTime base) throws Exception {
		String url = NCST_URL + "?serviceKey=" + key() + "&pageNo=1&numOfRows=20&dataType=JSON"
				+ "&base_date=" + base.format(DateTimeFormatter.BASIC_ISO_DATE)
				+ "&base_time=" + base.format(DateTimeFormatter.ofPattern("HH00"))
				+ "&nx=" + g[0] + "&ny=" + g[1];
		JsonNode items = get(url).path("response").path("body").path("items").path("item");
		for (JsonNode it : items) {
			if ("T1H".equals(it.path("category").asText())) return it.path("obsrValue").asDouble();
		}
		return null;
	}

	/** 특보현황 : 발효 중인 특보 중 서울이 들어간 것 (없으면 빈 목록) */
	private List<String> fetchWarnings() throws Exception {
		String url = WARN_URL + "?serviceKey=" + key() + "&pageNo=1&numOfRows=10&dataType=JSON";
		JsonNode root = get(url);
		String code = root.path("response").path("header").path("resultCode").asText();
		Set<String> out = new LinkedHashSet<>();
		if ("03".equals(code)) return new ArrayList<>();      // NO_DATA = 발효 중인 특보 없음
		for (JsonNode it : root.path("response").path("body").path("items").path("item")) {
			Matcher m = WARN_LINE.matcher(it.path("t6").asText(""));
			while (m.find()) {
				if (m.group(2).contains("서울")) out.add(m.group(1));
			}
		}
		return new ArrayList<>(out);
	}

	private JsonNode get(String url) throws Exception {
		HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(8)).GET().build();
		HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
		if (res.statusCode() != 200) throw new IllegalStateException("HTTP " + res.statusCode());
		String body = res.body();
		if (body == null || !body.trim().startsWith("{")) throw new IllegalStateException("JSON 아님 (키 · 활용 신청 확인) : " + (body == null ? "" : body.substring(0, Math.min(120, body.length()))));
		return json.readTree(body);
	}

	/** 포털의 일반 인증키(Decoding)를 넣었으면 인코딩, 이미 인코딩된 키(%포함)면 그대로 */
	private String key() {
		String k = serviceKey.trim();
		return k.contains("%") ? k : URLEncoder.encode(k, StandardCharsets.UTF_8);
	}

	interface Loader<T> { T load() throws Exception; }

	@SuppressWarnings("unchecked")
	private <T> T cached(String key, Loader<T> loader) throws Exception {
		Object[] hit = cache.get(key);
		if (hit != null && System.currentTimeMillis() - (Long) hit[0] < TTL_MS) return (T) hit[1];
		T v = loader.load();
		if (cache.size() > 200) cache.clear();
		cache.put(key, new Object[] { System.currentTimeMillis(), v });
		return v;
	}
}
