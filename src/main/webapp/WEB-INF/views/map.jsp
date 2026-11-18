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

<div class="map-layout">

  <%-- ================= 왼쪽 : 레이어 패널 (Figma 02) ================= --%>
  <aside class="layer-panel" id="panelLeft">
    <%-- 상황 버튼 (피그마 02) : 기본값 / 폭우 / 폭염 / 한파. 누르면 그 상황의 기본 조건으로 되돌리고 아래 요인 목록을 잠근다 ([직접 조정 >] 으로 풀기).
         재해 시나리오 = 해당 요인 점수 × 1.5, 100점에서 자름 (AnalysisCriteriaTO.scenario). [분석 실행] 을 눌러야 지도에 반영 --%>
    <div class="scn-tabs" id="scnTabs" role="tablist" aria-label="재해 시나리오">
      <button type="button" class="scn-tab on" data-scn="" role="tab" aria-selected="true"><i class="ico ico-sc-default" aria-hidden="true"></i>기본값</button>
      <button type="button" class="scn-tab" data-scn="RAIN" role="tab" aria-selected="false" title="지하층 · 침수흔적 · 저지대 점수 1.5배"><i class="ico ico-sc-rain" aria-hidden="true"></i>폭우</button>
      <button type="button" class="scn-tab" data-scn="HEAT" role="tab" aria-selected="false" title="옥탑 · 고시원 · 노후 점수 1.5배"><i class="ico ico-sc-heat" aria-hidden="true"></i>폭염</button>
      <button type="button" class="scn-tab" data-scn="COLD" role="tab" aria-selected="false" title="노후 · 저가 주택 · 고시원 점수 1.5배"><i class="ico ico-sc-cold" aria-hidden="true"></i>한파</button>
    </div>

    <div class="layer-body">
    <%-- 잠금 필터 (피그마 02 "잠금 필터") : 상황 버튼의 기본 조건일 때 요인 목록을 어둡게 덮는다. [직접 조정 >] 을 누르면 걷힌다 --%>
    <div class="layer-lock" id="layerLock">
      <button type="button" class="lock-unlock" id="btnUnlock">직접 조정 &gt;</button>
    </div>
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
          <div class="f-row off ref">
            <label class="chk"><input type="checkbox" disabled> 하천범람 · 참고</label><span class="f-val">연동 예정</span>
          </div>
          <div class="f-row off ref">
            <label class="chk"><input type="checkbox" disabled> 재해위험지구 · 참고</label><span class="f-val">연동 예정</span>
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
    </div>

    <div class="layer-foot">
      <button type="button" class="btn btn-line" id="btnWeights">가중치 조정</button>
      <button type="button" class="btn btn-primary" id="btnRun">▶ 분석 실행</button>
    </div>

    <%-- 가중치 조정 팝업 (피그마 02 가중치 조정 열림) : 위험 유형 4묶음, 합계 항상 100 (map-layer.js 가 비율대로 맞춘다) --%>
    <div class="weight-pop" id="weightPop">
      <div class="wp-head"><b>가중치 조정</b><button type="button" class="link-muted" id="weightReset">초기화</button><button type="button" class="wp-close" id="weightClose" title="닫기">×</button></div>
      <div class="wp-row" data-gw="space"><div class="wp-name">주거 공간 <small>지하층 · 옥탑 · 고시원</small></div><b id="wv-space"></b><input type="range" id="w-space"></div>
      <div class="wp-row" data-gw="bld"><div class="wp-name">건물 상태 <small>노후 · 위반건축물</small></div><b id="wv-bld"></b><input type="range" id="w-bld"></div>
      <div class="wp-row" data-gw="flood"><div class="wp-name">침수 위험 <small>침수 이력 · 저지대</small></div><b id="wv-flood"></b><input type="range" id="w-flood"></div>
      <div class="wp-row" data-gw="econ"><div class="wp-name">경제 여건 <small>저가 주택</small></div><b id="wv-econ"></b><input type="range" id="w-econ"></div>
      <%-- 점수 규칙 안내 (10단계 규칙, 15단계 B-7 문구) --%>
      <p class="wp-note">주거 공간은 지하·고시원·옥탑 중 하나라도 맞으면 가중치 전부, 건물 상태·침수 위험은 켠 요인 중 맞은 비율만큼, 경제 여건은 맞으면 가중치 전부. 합계 100점 만점.</p>
    </div>
  </aside>

  <button type="button" class="side-toggle" id="toggleLeft" aria-expanded="true" title="왼쪽 패널 접기">‹</button>

  <%-- ================= 가운데 : 지도 ================= --%>
  <main class="map-wrap">
    <div id="map"></div>

    <%-- 구 선택 : 구청 계정(loginMember.sggCd 있음)은 소속 구로 잠금, 서울시청은 자유 (CLAUDE.md 5-1 계정 2종류) --%>
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

      <%-- 살피구로 #risk-only : 켜져 있으면 기준점 이상 건물이 있는 묶음(빨간 숫자)과 그런 건물 핀만 지도에 표시 --%>
      <button type="button" class="chip chip-toggle on" id="riskOnly" aria-pressed="true" title="누르면 모든 건물을 표시합니다">
        <span class="ck">✓</span><span><b>${criteria.scoreMin}</b>점 이상만 보기</span>
      </button>

      <div class="search">
        <input class="field" id="searchQ" placeholder="건물명 · 주소로 검색" autocomplete="off">
        <button type="button" class="search-clear" id="searchClear" title="검색어 지우기" aria-label="검색어 지우기" hidden>×</button>
        <button type="button" class="search-btn" id="btnSearch" title="검색">⌕</button>
      </div>
    </div>

    <%-- 재해 시나리오 적용 중 띠 (피그마 02-3) : [분석 실행]으로 확정된 시나리오가 있을 때만. 글자는 map-main.js --%>
    <div class="scn-banner" id="scnBanner" role="status"></div>

    <%-- 지도 모드 (피그마 02 "일반 · 위성 · 로드뷰") : map-main.js
         위성 = 네이버 HYBRID(항공사진 + 지명 · 도로명), 로드뷰 = 거리뷰 되는 길을 파란 선으로 표시하고 지도를 클릭하면 그 자리 거리뷰 (#panoWrap) --%>
    <div class="map-type" role="group" aria-label="지도 모드">
      <button type="button" class="mt-btn on" data-mt="normal" aria-pressed="true"><i class="ico ico-mt-normal" aria-hidden="true"></i><span>일반</span></button>
      <button type="button" class="mt-btn" data-mt="satellite" aria-pressed="false"><i class="ico ico-mt-satellite" aria-hidden="true"></i><span>위성</span></button>
      <button type="button" class="mt-btn" data-mt="street" aria-pressed="false"><i class="ico ico-mt-street" aria-hidden="true"></i><span>로드뷰</span></button>
    </div>

    <%-- 로드뷰 창 : 지도 위에 띄운다 (지도 다크 필터를 받지 않게 #map 밖). 네이버 파노라마 = maps.js submodules=panorama --%>
    <div class="pano-wrap" id="panoWrap" hidden>
      <div class="pano-head"><b>로드뷰</b><span id="panoInfo"></span><button type="button" class="pano-x" id="panoClose" title="로드뷰 닫기" aria-label="로드뷰 닫기">×</button></div>
      <div class="pano" id="pano"></div>
    </div>

    <%-- 상단 현황 패널 (피그마 02 "양쪽 패널 접힘 + 상단 현황 패널") : 왼쪽 레이어 패널 · 오른쪽 패널이 모두 닫혀 있을 때만 보인다 (map.css).
         숫자 = api/map/todo.do (조사 대기 = 보관함 신규 · 기한 임박 = 조사 예정일 3일 안 미확인 · 결과 확인 필요 = 이관 회신 대기). 아래 손잡이로 접고 편다 --%>
    <div class="todo-wrap" id="todoWrap">
      <div class="todo-panel" id="todoPanel">
        <b class="todo-title">지금 처리할 일</b>
        <div class="todo-nums">
          <div class="todo-item"><b id="tdTodo">-</b><span><img src="${pageContext.request.contextPath}/resources/img/icons/st-dot-green.svg" width="6" height="6" alt="">조사 대기</span></div>
          <div class="todo-item"><b id="tdDue">-</b><span><img src="${pageContext.request.contextPath}/resources/img/icons/st-dot-orange.svg" width="6" height="6" alt="">기한 임박</span></div>
          <div class="todo-item"><b id="tdReply">-</b><span><img src="${pageContext.request.contextPath}/resources/img/icons/st-dot-blue.svg" width="6" height="6" alt="">결과 확인 필요</span></div>
        </div>
      </div>
      <button type="button" class="todo-fold" id="todoFold" aria-expanded="true" title="현황 패널 접기"><img src="${pageContext.request.contextPath}/resources/img/icons/chevron-up.svg" width="10" height="6" alt=""></button>
    </div>

    <%-- 지도를 옮겨도 리스트는 그대로. 분석 뒤 옮기면 이 버튼이 뜨고, 누르면 그때만 화면 bbox 로 다시 받는다 (5-1) --%>
    <button type="button" class="btn-refetch" id="btnRefetch">⟳ 이 지역에서 재검색</button>
    <%-- 구청 계정이 관할 밖으로 나갔을 때 (11단계). 가림막 · 범위 제한은 map-main.js --%>
    <div class="out-bar" id="outBar"><span>관할 구역(<b id="outGu"></b>) 밖입니다</span><button type="button" class="btn btn-primary btn-sm" id="btnBackGu">돌아가기</button></div>

    <%-- 범례 : 모드(구/묶음/건물)에 따라 map-main.js 가 채운다 --%>
    <div class="map-legend" id="legend"></div>

    <div class="map-ctrl">
      <button type="button" id="zoomIn" title="확대">+</button>
      <button type="button" id="zoomOut" title="축소">−</button>
    </div>
  </main>

  <%-- ================= 오른쪽 : 결과 리스트 / 건물 상세 ================= --%>
  <aside class="right-panel" id="panelRight">

    <div class="rp-view" id="resultView">
      <div class="rp-head"><h2>검색 결과</h2><button type="button" class="rp-close" id="resultClose">×</button></div>
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

    <%-- 기준 가이드 (피그마 02-3) : 건물 상세 [이 기준은 왜?] 로 연다. 화면만 — 답변은 연동 예정 (map-panel.js) --%>
    <div class="rp-view" id="guideView" style="display:none">
      <div class="rp-head"><h2>기준 가이드</h2><button type="button" class="rp-close" id="guideClose" title="닫기">×</button></div>
      <div class="gd-body" id="gdBody">
        <p class="gd-note">미리 정리한 근거 문서(법령·연구·인터뷰) 안에서만 답해요. 데이터 검색이나 분석 실행은 하지 않아요.</p>
        <div class="gd-msgs" id="gdMsgs"></div>
      </div>
      <div class="gd-faq">
        <span>자주 묻는 기준</span>
        <div class="gd-chips">
          <button type="button" class="gd-chip">고시원 가산 근거</button>
          <button type="button" class="gd-chip">에너지 급감 기준</button>
          <button type="button" class="gd-chip">최저주거기준</button>
        </div>
      </div>
      <form class="gd-input" id="gdForm" autocomplete="off">
        <input class="field" id="gdQ" maxlength="200" placeholder="기준에 대해 물어보세요">
        <button type="submit" class="btn btn-primary">보내기</button>
      </form>
    </div>

  </aside>
</div>

<%-- 네이버 지도 JS API v3 (Client ID : app.properties app.naver.client-id) --%>
<script>
  window.navermap_authFailure = function () {
    document.getElementById('map').innerHTML = '<div class="map-error"><b>네이버 지도 인증 실패</b><p>Client ID 또는 Web 서비스 URL 등록을 확인하세요.</p></div>';
  };
  window.APP_SCORE_MIN = ${criteria.scoreMin};   // 기준점 (app.properties app.analysis.score-min) → map-config SCORE_MIN
  window.LOCK_GU = '<c:out value="${lockGu}"/>';   // 구청 계정이면 소속 구 코드, 서울시청이면 
  window.OPEN_BLD = '<c:out value="${openBldId}"/>';   // map.do?bldId= (05 지도에서 보기)
  window.OPEN_MSG = '<c:out value="${openMsg}"/>';     // 남의 구 건물 · 없는 건물이면 상세 대신 이 안내만 (15단계 A-2)
</script>
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<c:out value='${naverClientId}'/>&submodules=panorama"></script>
<script src="${pageContext.request.contextPath}/resources/js/common.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-config.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/gu-boundary.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/dong-boundary.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-api.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-layer.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-marker.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-result.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-panel.js"></script>
<script src="${pageContext.request.contextPath}/resources/js/map/map-main.js"></script>
</body>
</html>
