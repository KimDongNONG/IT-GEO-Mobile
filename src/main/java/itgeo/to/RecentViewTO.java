package itgeo.to;

// 이어서 보기 (recent_view) : 탭마다 마지막으로 본 화면 1건. Eclipse 의 lombok 처리에 기대지 않게 getter · setter 를 직접 둔다
public class RecentViewTO {
	private long userId;
	private String menu;          // map | field | archive
	private String url;           // 컨텍스트 경로 뒤 주소 (fielddetail.do?listId=3)
	private String title;
	private String sub;
	private String viewedAt;      // yyyy-MM-dd HH:mm

	public long getUserId() { return userId; }
	public void setUserId(long userId) { this.userId = userId; }
	public String getMenu() { return menu; }
	public void setMenu(String menu) { this.menu = menu; }
	public String getUrl() { return url; }
	public void setUrl(String url) { this.url = url; }
	public String getTitle() { return title; }
	public void setTitle(String title) { this.title = title; }
	public String getSub() { return sub; }
	public void setSub(String sub) { this.sub = sub; }
	public String getViewedAt() { return viewedAt; }
	public void setViewedAt(String viewedAt) { this.viewedAt = viewedAt; }
}
