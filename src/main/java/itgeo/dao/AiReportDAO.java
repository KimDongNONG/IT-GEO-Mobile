package itgeo.dao;

import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

// AiReportService 에서만 부른다. 메서드명 = mapper-aireport.xml 의 id (ai_report)
@Component
public class AiReportDAO {

	@Autowired
	SqlSession session;

	// 보고서 1건 저장 (생성 키 → p.reportId)
	public int addReport(Map<String, Object> p) {
		return session.insert("mapper-aireport.addReport", p);
	}

	// 보고서 1건 (내려받기)
	public Map<String, Object> getReport(long reportId) {
		return session.selectOne("mapper-aireport.getReport", reportId);
	}
}
