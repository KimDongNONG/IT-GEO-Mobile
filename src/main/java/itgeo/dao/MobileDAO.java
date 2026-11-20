package itgeo.dao;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import itgeo.to.PhotoTO;
import itgeo.to.RecordDetailTO;

// 저장은 MobileService, 05 타임라인 읽기는 ArchiveService (fillAppDetail) 에서 부른다. 메서드명 = mapper-mobile.xml 의 id (survey_record_detail · survey_photo)
@Component
public class MobileDAO {

	@Autowired
	SqlSession session;

	public int addRecordDetail(RecordDetailTO to) {
		return session.insert("mapper-mobile.addRecordDetail", to);
	}

	public List<RecordDetailTO> getRecordDetails(List<Long> recordIds) {
		return session.selectList("mapper-mobile.getRecordDetails", recordIds);
	}

	public int addPhoto(PhotoTO to) {
		return session.insert("mapper-mobile.addPhoto", to);
	}

	public List<PhotoTO> getPhotos(List<Long> recordIds) {
		return session.selectList("mapper-mobile.getPhotos", recordIds);
	}

	public PhotoTO getPhoto(long photoId) {
		return session.selectOne("mapper-mobile.getPhoto", photoId);
	}

	public String getMyRecordBld(long userId, long recordId) {
		Map<String, Object> p = new HashMap<>();
		p.put("userId", userId);
		p.put("recordId", recordId);
		return session.selectOne("mapper-mobile.getMyRecordBld", p);
	}
}
