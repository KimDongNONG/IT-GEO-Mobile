<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<c:set var="pageTitle" value="취약공간 분석 지도"/>
<c:set var="pageCss" value="map"/>
<c:set var="activeMenu" value="map"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<%@ include file="/WEB-INF/views/include/header.jspf" %>

<%-- 2차(11-17) : 처음 들어오면 좌 · 우 패널 모두 닫힘. 왼쪽은 JS 로 닫으면 열렸다 닫히는 게 보여서 여기서 바로 left-closed. 열림 상태는 저장하지 않는다 (폭만 itgeo.lpW / itgeo.rpW) --%>
<div class="map-layout left-closed">

  <%-- ================= 왼쪽 : 레이어 패널 (Figma 02) ================= --%>
  <aside class="layer-panel" id="panelLeft">
    <div class="pn-grip" id="lpGrip" title="끌어서 폭 조절 (두 번 누르면 기본 폭)"></div>
    <div class="layer-scroll">
      <%-- 요인은 위험 유형 4묶음 아래로 (5-1 "가중치·분석 실행·도넛"). 켜고 끄기만, 새 요인 추가 없음. 점수(가중치)는 [가중치 조정] 팝업에서만 보인다 (피그마 02) --%>

      <section class="sec">
        <div class="sec-head"><span class="caret"></span>1. 주거 공간</div>
        <div class="sec-body">
          <div class="f-row" data-factor="ugrnd">
            <label class="chk"><input type="checkbox" class="f-chk"> 지하층(반지하)</label>
            <span class="f-val">지하 거주 등록</span>
          </div>
          <div class="f-row" data-factor="rooftop">
            <label class="chk"><input type="checkbox" class="f-chk"> 옥탑</label>
            <span class="f-val">옥탑층 거주</span>
          </div>
          <div class="f-row" data-factor="gosiwon">
            <label class="chk"><input type="checkbox" class="f-chk"> 고시원(다중생활시설)</label>
            <span class="f-val">대장 유형</span>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head"><span class="caret"></span>2. 건물 상태</div>
        <div class="sec-body">
          <div class="f-row has-rng" data-factor="old">
            <label class="chk"><input type="checkbox" class="f-chk"> 노후주택 (준공 30년+)</label>
            <input type="range" class="f-rng"><span class="f-val"></span>
          </div>
          <div class="f-row" data-factor="viol">
            <label class="chk"><input type="checkbox" class="f-chk"> 위반건축물</label>
            <span class="f-val">대장 등재</span>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head"><span class="caret"></span>3. 침수 위험</div>
        <div class="sec-body">
          <div class="f-row has-rng" data-factor="flood">
            <label class="chk"><input type="checkbox" class="f-chk"> 침수흔적</label>
            <input type="range" class="f-rng"><span class="f-val"></span>
          </div>
          <div class="f-row has-rng" data-factor="low">
            <label class="chk"><input type="checkbox" class="f-chk"> 저지대 (DEM)</label>
            <input type="range" class="f-rng"><span class="f-val"></span>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="sec-head"><span class="caret"></span>4. 경제 여건</div>
        <div class="sec-body">
          <div class="f-row has-rng ref" data-factor="cheap">
            <label class="chk"><input type="checkbox" class="f-chk"> 저가 주택 (공시가격 백분위)</label>
            <input type="range" class="f-rng"><span class="f-val"></span>
          </div>
        </div>
      </section>

      <section class="sec collapsed">
        <div class="sec-head"><span class="caret"></span>5. 인구 · 가구 <span class="badge">우선순위</span></div>
        <div class="sec-body">
          <p class="sec-note">거주자 가구 가점(고위험고립 · 75세 이상 · 심한 장애 · 사각지대 · 건보료 체납 · 독박돌봄 · 지하·옥탑)은 취약 점수와 더하지 않고 동점일 때 <b>2순위</b>(취약 가구 수 → 가점 합)로 봅니다. 건물 상세 → 개인 정보 보기에서 확인.</p>
        </div>
      </section>

      <section class="sec collapsed">
        <div class="sec-head"><span class="caret"></span>6. 자원 · 접근성 <span class="badge">참고</span></div>
        <div class="sec-body">
          <p class="sec-note">가장 가까운 병원 · 복지시설 · 버스정류장까지 거리는 건물 상세에 표시합니다. 점수에는 넣지 않습니다.</p>
        </div>
      </section>

    </div>

    <div class="layer-foot">
      <button type="button" class="btn btn-line" id="btnWeights">가중치 조정</button>
      <button type="button" class="btn btn-primary" id="btnRun">▶ 분석 실행</button>
    </div>

    <%-- 가중치 조정 팝업 (피그마 02 가중치 조정 열림) : 위험 유형 4묶음, 묶음마다 0~100. 점수에는 비율로 환산 (map-layer.js) --%>
    <div class="weight-pop" id="weightPop">
      <div class="wp-head"><b>가중치 조정</b><button type="button" class="link-muted" id="weightReset">초기화</button><button type="button" class="wp-close" id="weightClose" title="닫기">×</button></div>
      <div class="wp-row" data-gw="space"><div class="wp-name">주거 공간 <small>지하층 · 옥탑 · 고시원</small></div><b id="wv-space"></b><input type="range" id="w-space"></div>
      <div class="wp-row" data-gw="bld"><div class="wp-name">건물 상태 <small>노후 · 위반건축물</small></div><b id="wv-bld"></b><input type="range" id="w-bld"></div>
      <div class="wp-row" data-gw="flood"><div class="wp-name">침수 위험 <small>침수 이력 · 저지대</small></div><b id="wv-flood"></b><input type="range" id="w-flood"></div>
      <div class="wp-row" data-gw="econ"><div class="wp-name">경제 여건 <small>저가 주택</small></div><b id="wv-econ"></b><input type="range" id="w-econ"></div>
      <%-- 점수 규칙 안내 (10단계 규칙, 15단계 B-7 문구) --%>
      <p class="wp-sum" id="wpSum"></p>
      <p class="wp-note">묶음마다 0~100으로 정하면 비율대로 100점 만점에 나눠 반영합니다 (100·100·100·100이면 25점씩, 100·50·100·50이면 2:1:2:1). 주거 공간은 지하·고시원·옥탑 중 하나라도 맞으면 묶음 점수 전부, 건물 상태·침수 위험은 켠 요인 중 맞은 비율만큼, 경제 여건은 맞으면 전부.</p>
    </div>
  </aside>

  <%-- 여닫기 버튼 : 늘 세로 정가운데. 꺾쇠는 닫는 방향(‹)으로 그리고, 닫힘 상태에서는 CSS 가 좌우로 뒤집는다 --%>
  <button type="button" class="side-toggle" id="toggleLeft" aria-expanded="false" title="위험요인 패널 열기 · 닫기"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>

  <%-- ================= 가운데 : 지도 ================= --%>
  <main class="map-wrap">
    <div id="map"></div>

    <%-- 분석 기준 줄 (2차 11-17 G) : [기본] [폭우] [폭염] [한파] ┃ [가중치 보기] | [접기]. 버튼은 MAP_CONFIG.SCENARIOS 를 보고 map-main.js 가 그린다.
         접힘 상태는 itgeo.scenFold 에 기억. 깜빡이지 않게 처음부터 접힌 모양으로 그리도록 바로 아래 스크립트가 클래스를 붙인다 --%>
    <div class="scen-bar" id="scenBar">
      <div class="scen-list" id="scenList"></div>
      <button type="button" class="scen-fold" id="scenFold" title="분석 기준 접기 · 펼치기" aria-expanded="true"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
    </div>
    <%-- 분석 중 알약 (2차 R) : 결과를 새로 받는 동안만. 지도 조작은 막지 않는다 --%>
    <div class="an-pill" id="anPill"><i class="b3-spin"></i>분석 중…</div>
    <script>try { if (localStorage.getItem('itgeo.scenFold') === '1') document.getElementById('scenBar').classList.add('folded'); } catch (e) {}</script>

    <%-- 오른쪽 위 (2차 11-17 H) : [전체 구] [전체 동] [검색] [지도 유형]. 오른쪽 패널 왼쪽 끝에 붙어 같이 움직인다 --%>
    <%-- 구 선택 : 구청 계정(loginMember.sggCd 있음)은 소속 구로 잠금, 서울시청은 자유 (계정 2종류) --%>
    <c:set var="lockGu" value="${sessionScope.loginMember.sggCd}"/>
    <div class="map-top">
      <select class="field sel" id="selGu" ${not empty lockGu ? 'disabled title="소속 구로 고정됩니다"' : ''}>
        <c:if test="${empty lockGu}"><option value="">전체 구</option></c:if>
        <option value="11530" ${lockGu == '11530' ? 'selected' : ''}>구로구</option>
        <option value="11470" ${lockGu == '11470' ? 'selected' : ''}>양천구</option>
        <option value="11560" ${lockGu == '11560' ? 'selected' : ''}>영등포구</option>
      </select>
      <%-- 동 선택 2단계 (5-1, 피그마 02 "동 선택 열림") : 법정동 → 행정동. 목록은 api/map/dongs.do, map-main.js 가 채운다 --%>
      <div class="dong-dd" id="dongDd">
        <button type="button" class="field sel dong-btn" id="dongBtn"><span>전체 동</span><i>▾</i></button>
        <div class="dm-menu">
          <div class="dm-col" id="dmEmd"></div>
          <div class="dm-col dm-sub" id="dmAdm" style="display:none"></div>
        </div>
      </div>

      <div class="search">
        <input class="field" id="searchQ" placeholder="건물명 · 주소로 검색" autocomplete="off">
        <button type="button" class="search-clear" id="searchClear" title="검색어 지우기" aria-label="검색어 지우기" hidden>×</button>
        <button type="button" class="search-btn" id="btnSearch" title="검색">⌕</button>
      </div>

      <%-- 지도 유형 (2026-11-17) : 일반 / 위성 은 둘 중 하나, 로드뷰는 따로 켜고 끄는 토글. 3D 는 여기 넣지 않는다 (건물 상세의 "3D 보기").
           2차(H) : 검색 줄과 같은 높이에서 맨 오른쪽 칸 (검색창 바로 옆) --%>
      <div class="map-type" id="mapType">
        <button type="button" data-type="normal" class="on"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20V6.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>일반</button>
        <button type="button" data-type="sat"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 8.5 3-3 7 7-3 3z"/><path d="m5 12 3.5-3.5 3 3L8 15z"/><path d="m12.5 15.5 3 3 3.5-3.5-3-3"/><path d="M4 17a3 3 0 0 0 3 3M4 20h.1"/></svg>위성</button>
        <button type="button" data-type="street" id="btnStreet" aria-pressed="false"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M9 21l1.5-6-1.5-2V9.5h6V13l-1.5 2 1.5 6"/><path d="M9 9.5 6.5 12M15 9.5l2.5 2.5"/></svg>로드뷰</button>
      </div>
    </div>

    <%-- 지도를 옮겨도 리스트는 그대로. 분석 뒤 옮기면 이 버튼이 뜨고, 누르면 그때만 화면 bbox 로 다시 받는다 (5-1) --%>
    <button type="button" class="btn-refetch" id="btnRefetch">⟳ 이 지역에서 재검색</button>
    <%-- 구청 계정이 관할 밖으로 나갔을 때 (11단계). 가림막 · 범위 제한은 map-main.js --%>
    <div class="out-bar" id="outBar"><span>관할 구역(<b id="outGu"></b>) 밖입니다</span><button type="button" class="btn btn-primary btn-sm" id="btnBackGu">돌아가기</button></div>

    <%-- 왼쪽 아래 한 줄 : [범례] [N점 이상만 보기]. 범례는 모드(구/묶음/건물)에 따라 map-main.js 가 채운다 --%>
    <div class="map-bottom">
      <div class="map-legend" id="legend"></div>
      <%-- 살피구로 #risk-only : 켜져 있으면 기준점 이상 건물이 있는 묶음(빨간 숫자)과 그런 건물 핀만 지도에 표시. 위쪽 줄에 있던 것을 범례 옆으로 내렸다 (2차) --%>
      <button type="button" class="chip chip-toggle on" id="riskOnly" aria-pressed="true" title="누르면 모든 건물을 표시합니다">
      <span class="ck">✓</span><span><b>${criteria.scoreMin}</b>점 이상만 보기</span>
    </button>
    </div>

    <%-- 줌 단계 : + / 세로 눈금 슬라이더 / − . 눈금 · 채움 · 손잡이 · 숫자는 map-main.js 가 그린다 --%>
    <div class="map-ctrl zoom-ctrl">
      <button type="button" id="zoomIn" title="확대">+</button>
      <div class="zs" id="zoomSlider" title="끌어서 확대 단계 바꾸기">
        <div class="zs-track"><i class="zs-fill" id="zsFill"></i></div>
        <span class="zs-thumb" id="zsThumb"></span>
        <span class="zs-num" id="zsNum"></span>
      </div>
      <button type="button" id="zoomOut" title="축소">−</button>
    </div>

    <%-- 로드뷰(파노라마) : 로드뷰를 켜고 지도를 누르면 뜬다. 기본은 비율 보기(.split = 왼쪽 로드뷰 + 오른쪽 지도, 손잡이로 비율 조정), [크게 보기] 를 누르면 지도 영역 전체.
         경계선 손잡이(#panoGrip)를 끌면 로드뷰 : 지도 비율이 같이 바뀌고, 두 번 누르면 기본 폭. 지도에는 지금 보는 위치 · 방향 표시가 따라 움직인다 (map-main.js) --%>
    <div class="pano-wrap split" id="panoWrap">
      <div class="pano-bar">
        <button type="button" class="pano-close" id="panoClose">× 로드뷰 닫기</button>
        <span class="pano-target" id="panoTarget"></span>
        <button type="button" class="pano-size" id="panoSize" title="로드뷰 크게 보기 · 지도와 같이 보기">크게 보기</button>
      </div>
      <div id="pano"></div>
      <div class="pano-grip" id="panoGrip" title="끌어서 비율 조절 · 3:7 · 5:5 · 7:3 에 자석처럼 붙음 (두 번 누르면 50 : 50)"><span class="pano-ratio" id="panoRatio"></span></div>
    </div>
    <div class="pano-guides" id="panoGuides"></div><%-- 비율 손잡이를 끄는 동안 3:7 · 5:5 · 7:3 자리 안내선 (map-main.js) --%>
  </main>

  <%-- ================= 건물 3D 입체보기 : 건물 상세 패널 바로 왼쪽 (map-3d.js · 브이월드 WebGL 3D, iframe 은 처음 열 때 불러옴) ================= --%>
  <section class="bld3d" id="bld3d" hidden>
    <div class="b3-head">
      <b>건물 3D 입체보기</b><span class="b3-sub" id="b3Sub"></span>
      <button type="button" class="b3-btn on" id="b3Only" title="주변 건물 보이기"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="16"/><path d="M3 20h18"/></svg></button>
      <button type="button" class="b3-btn" id="b3Rotate" title="자동 회전"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/></svg></button>
      <button type="button" class="b3-btn" id="b3Expand" title="크게 보기 / 작게 보기"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      <button type="button" class="b3-btn" id="b3Close" title="닫기"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    <div class="b3-stage">
      <iframe id="b3Frame" title="건물 3D 입체보기"></iframe>
      <div class="b3-status" id="b3Status"></div>
      <div class="b3-hint">드래그 = 건물 둘레로 360° 회전 · 휠 = 확대/축소</div>
      <%-- 로딩 표시 (2차 지시문 I) : 다 그려질 때까지 3D 영역을 덮는다. 실패 · 15초 초과면 아래 b3Fail 로 바뀐다 --%>
      <div class="b3-loading" id="b3Loading" hidden><i class="b3-spin"></i><span>3D 건물을 불러오는 중…</span></div>
      <div class="b3-loading b3-fail" id="b3Fail" hidden><span>3D를 불러오지 못했습니다</span><button type="button" class="btn btn-line btn-sm" id="b3Retry">다시 시도</button></div>
    </div>
    <div class="b3-legend" id="b3Legend"></div>
    <div class="b3-note" id="b3Note"></div>
  </section>

  <%-- ================= 오른쪽 : 결과 리스트 / 건물 상세 ================= --%>
  <%-- 오른쪽 여닫기 버튼 : 패널 왼쪽 끝 바깥 (닫히면 화면 오른쪽 끝). 꺾쇠는 여는 방향(‹), 열림 상태에서는 CSS 가 뒤집어 › --%>
  <button type="button" class="side-toggle side-toggle-r" id="toggleRight" aria-expanded="false" title="결과 패널 열기 · 닫기"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
  <aside class="right-panel" id="panelRight">
    <div class="pn-grip" id="rpGrip" title="끌어서 폭 조절 (두 번 누르면 기본 폭)"></div>

    <%-- .empty = 아직 분석 전 (안내 문구만). [분석 실행] 때 map-main.js 가 뗀다 --%>
    <div class="rp-view empty" id="resultView">
      <div class="rp-head"><h2>검색 결과</h2><button type="button" class="rp-close" id="resultClose">×</button></div>
      <p class="rs-blank">분석 실행을 누르면 결과가 여기에 표시됩니다</p>
      <div class="rs-scope" id="resultScope"></div>
      <div class="rs-bar">
        <span class="rs-count" id="resultCount"><b>0</b> 건</span>
        <select class="field sel-sm" id="resultSort">
          <option value="score">취약 점수 높은 순</option>
          <option value="old">오래된 건물 순</option>
          <option value="addr">주소 순</option>
        </select>
      </div>
      <div class="rs-list" id="resultList"></div>
      <button type="button" class="rs-more" id="resultMore" style="display:none">목록 더 불러오기</button>
    </div>

    <div class="rp-view" id="detailView" style="display:none">
      <%@ include file="/WEB-INF/views/include/building-panel.jspf" %>
    </div>

  </aside>
</div>

<%-- 네이버 지도 JS API v3 (Client ID : app.properties app.naver.client-id) --%>
<script>
  window.navermap_authFailure = function () {
    document.getElementById('map').innerHTML = '<div class="map-error"><b>네이버 지도 인증 실패</b><p>Client ID 또는 Web 서비스 URL 등록을 확인하세요.</p></div>';
  };
  window.APP_SCORE_MIN = ${criteria.scoreMin};   // 기준점 (app.properties app.analysis.score-min) → map-config SCORE_MIN
  window.APP_VWORLD_KEY = '<c:out value="${vworldKey}"/>';   // 브이월드 인증키 (app.properties app.vworld.api-key) → resources/vworld3d/bld3d-frame.html 이 읽는다
  window.LOCK_GU = '<c:out value="${lockGu}"/>';   // 구청 계정이면 소속 구 코드, 서울시청이면 
  window.OPEN_BLD = '<c:out value="${openBldId}"/>';   // map.do?bldId= (05 지도에서 보기)
  window.OPEN_CHANGED = '<c:out value="${param.changed}"/>';   // map.do?changed=up (데이터 업데이트 완료 → 새로 위험해진 건물 보기)
  window.OPEN_MSG ='<c:out value="${openMsg}"/>';     // 남의 구 건물 · 없는 건물이면 상세 대신 이 안내만 (15단계 A-2)
</script>
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<c:out value='${naverClientId}'/>&submodules=panorama"></script><%-- panorama = 로드뷰(StreetLayer · Panorama) --%>
<script src="${pageContext.request.contextPath}/resources/js/common.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-config.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/gu-boundary.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/dong-boundary.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-api.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-layer.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-marker.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-result.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-3d.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-panel.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-main.js"></script>
</body>
</html>
