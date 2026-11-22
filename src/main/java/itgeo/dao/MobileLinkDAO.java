package itgeo.dao;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import itgeo.to.MobileLinkPhotoTO;
import itgeo.to.MobileLinkTO;

// MobileLinkService · AiReportService 에서만 부른다. 메서드명 = mapper-mobilelink.xml 의 id (mobile_link_record · mobile_link_photo · ai_report)
@Component
public class MobileLinkDAO {

	@Autowired
	SqlSession session;

	public MobileLinkTO getLinkByClient(String clientUuid) {
		return session.selectOne("mapper-mobilelink.getLinkByClient", clientUuid);
	}

	public int addLink(MobileLinkTO to) {
		return session.insert("mapper-mobilelink.addLink", to);
	}

	public int getPendingCount(String bldId) {
		Integer n = session.selectOne("mapper-mobilelink.getPendingCount", bldId);
		return n == null ? 0 : n;
	}

	/** {d_from, d_to} (확인 전 기록이 없으면 null 또는 값이 null) */
	public Map<String, Object> getPendingRange(String bldId) {
		return session.selectOne("mapper-mobilelink.getPendingRange", bldId);
	}

	public List<MobileLinkTO> getPendingList(String bldId) {
		return session.selectList("mapper-mobilelink.getPendingList", bldId);
	}

	public MobileLinkTO getLink(long linkId) {
		return session.selectOne("mapper-mobilelink.getLink", linkId);
	}

	public List<MobileLinkTO> getLinksByRecords(List<Long> recordIds) {
		return session.selectList("mapper-mobilelink.getLinksByRecords", recordIds);
	}

	public int updateLink(MobileLinkTO to) {
		return session.update("mapper-mobilelink.updateLink", to);
	}

	public int deleteTranscript(long linkId) {
		return session.update("mapper-mobilelink.deleteTranscript", linkId);
	}

	public int confirmLink(MobileLinkTO to) {
		return session.update("mapper-mobilelink.confirmLink", to);
	}

	public Long getPlanForBld(String bldId, long userId, Long senderUserId) {
		Map<String, Object> p = new HashMap<>();
		p.put("bldId", bldId);
		p.put("userId", userId);
		p.put("senderUserId", senderUserId);
		return session.selectOne("mapper-mobilelink.getPlanForBld", p);
	}

	// ---------- 사진 ----------
	public int addPhoto(MobileLinkPhotoTO to) {
		return session.insert("mapper-mobilelink.addPhoto", to);
	}

	public List<MobileLinkPhotoTO> getPhotosByLinks(List<Long> linkIds) {
		return session.selectList("mapper-mobilelink.getPhotosByLinks", linkIds);
	}

	public List<MobileLinkPhotoTO> getPhotosByRecords(List<Long> recordIds) {
		return session.selectList("mapper-mobilelink.getPhotosByRecords", recordIds);
	}

	public MobileLinkPhotoTO getPhoto(long photoId) {
		return session.selectOne("mapper-mobilelink.getPhoto", photoId);
	}

	public int getPhotoCount(long linkId) {
		Integer n = session.selectOne("mapper-mobilelink.getPhotoCount", linkId);
		return n == null ? 0 : n;
	}

	public int deletePhoto(long photoId) {
		return session.delete("mapper-mobilelink.deletePhoto", photoId);
	}

	// ---------- AI 현장 확인보고서 ----------
	/** p : bldId, userId, title, format, periodFrom, periodTo, recordCnt, fileName, content → p.reportId 채워짐 */
	public int addReport(Map<String, Object> p) {
		return session.insert("mapper-mobilelink.addReport", p);
	}

	/** 키 = 열 이름 (report_id, bld_id, user_id, title, format, file_name) */
	public Map<String, Object> getReport(long reportId) {
		return session.selectOne("mapper-mobilelink.getReport", reportId);
	}
}
