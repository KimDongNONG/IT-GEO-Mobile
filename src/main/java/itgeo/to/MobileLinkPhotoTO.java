package itgeo.to;

import lombok.Data;

/** 모바일 현장조사기록 사진 1장 (mobile_link_photo). 화면에서는 api/mobile-link/photo.do?photoId= 로 본다 */
@Data
public class MobileLinkPhotoTO {
	private long photoId;
	private long linkId;
	private String fileName;
	private String label;
	private String bldId;       // 권한 확인용 (getPhoto 에서만 채움)
	private Long recordId;      // 이력에 기재된 기록 (타임라인 사진용, getPhotosByRecords 에서만 채움)
	private String status;      // 수신 기록 상태 NEW / DONE (getPhoto 에서만 채움)
	private String createdAt;
}
