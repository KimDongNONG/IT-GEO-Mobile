package itgeo.to;

import lombok.Data;

/** 현장 사진 1장 (survey_photo). 파일은 app.upload.dir 아래, 화면에서는 api/mobile/photo.do?photoId= 로 본다 */
@Data
public class PhotoTO {
	private long photoId;
	private long recordId;
	private String fileName;
	private String label;
	private String bldId;       // 권한 확인용 (getPhoto 에서만 채움)
	private String createdAt;
}
