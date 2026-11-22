package itgeo.to;

import java.util.ArrayList;
import java.util.List;

// 기상청 현재 기온 + 기상특보 (WeatherService). getter · setter 는 직접 둔다 (lombok 없이)
public class WeatherTO {
	private boolean ok;
	private Double temp;                                  // 기온 ℃ (초단기실황 T1H)
	private List<String> warnings = new ArrayList<>();    // 서울에 발효 중인 특보 (한파주의보 …)
	private String baseTime;                              // 관측 기준 시각 HH:00 (1시간 단위)
	private String msg;

	public boolean isOk() { return ok; }
	public void setOk(boolean ok) { this.ok = ok; }
	public Double getTemp() { return temp; }
	public void setTemp(Double temp) { this.temp = temp; }
	public List<String> getWarnings() { return warnings; }
	public void setWarnings(List<String> warnings) { this.warnings = warnings; }
	public String getBaseTime() { return baseTime; }
	public void setBaseTime(String baseTime) { this.baseTime = baseTime; }
	public String getMsg() { return msg; }
	public void setMsg(String msg) { this.msg = msg; }
}
