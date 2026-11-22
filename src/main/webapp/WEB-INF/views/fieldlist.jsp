<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions" %>
<c:set var="pageTitle" value="현장 확인 리스트"/>
<c:set var="pageCss" value="pages"/>
<c:set var="activeMenu" value="field"/>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<%@ include file="/WEB-INF/views/include/header.jspf" %>
<%-- 이 화면 전용 스타일. ?v= 는 브라우저에 남은 옛 파일을 쓰지 않게 하려는 것 (파일을 고치면 값도 바꾼다) --%>
<link rel="stylesheet" href="${ctx}/resources/css/fieldlist.css?v=20261120b">

<%--
  현장 확인 리스트 + 현장 확인 상세(예전 fielddetail.jsp)를 한 화면에.
  왼쪽 = 리스트 카드 (||| · 상태 점 · 이름 · 건물 수 · 상태 · ⌄). ⌄ 를 누르면 그 리스트의 건물이 펼쳐지고 오른쪽 지도에 동선이 그려진다.
  오른쪽 = 큰 지도 + 경로 · 소요시간 카드 (이동수단을 바꾸면 api/field/mode.do 로 저장, TMAP 경로는 api/field/walk.do).
--%>
<div class="page">
  <div class="page-head"><h1>현장 확인 리스트</h1></div>
  <c:if test="${not empty msg}"><div class="flash"><c:out value="${msg}"/></div></c:if>

  <div class="page-head fl-search-row" style="margin-bottom:0">
    <div class="tabs" style="margin-bottom:0;border:0">
      <a href="${ctx}/fieldlist.do?tab=doing" class="${tab == 'doing' ? 'active' : ''}">진행중 <b>${doingCnt}</b></a>
      <a href="${ctx}/fieldlist.do?tab=done" class="${tab == 'done' ? 'active' : ''}">완료됨 <b>${doneCnt}</b></a>
    </div>
    <div class="right">
      <form method="get" action="${ctx}/fieldlist.do" class="search-wrap">
        <input type="hidden" name="tab" value="${tab}">
        <input class="field" name="q" value="<c:out value='${q}'/>" placeholder="리스트 이름 검색">
        <button type="submit" title="검색">⌕</button>
      </form>
      <a class="btn btn-primary" href="${ctx}/fieldedit.do?listId=0">+ 새 현장확인 리스트</a>
    </div>
  </div>
  <div class="fl-divider" style="border-bottom:1px solid var(--line);margin:0 0 16px"></div>

  <div class="fx-split">
    <%-- ===== 왼쪽 : 리스트 카드 ===== --%>
    <div class="fx-side">
      <div class="fx-box">
        <div class="fx-box-head">
          <h3>내 현장 확인 리스트 <b class="fx-cnt">${fn:length(list)}</b></h3>
          <small>리스트를 펼치면 오른쪽 지도에 동선과 소요시간이 나옵니다.</small>
        </div>


        <c:forEach var="f" items="${list}">
          <c:set var="st" value="${f.doneCnt == 0 ? 'todo' : (f.doneCnt >= f.itemCnt ? 'done' : 'doing')}"/>
          <div class="fx-card" data-id="${f.surveyId}" data-sgg="${empty f.items ? f.sggCd : f.items[0].sggCd}"
               data-mode="${empty f.moveMode ? 'walk' : fn:toLowerCase(f.moveMode)}" data-title="<c:out value='${f.title}'/>">
            <div class="fx-row">
              
              <i class="fx-dot st-${st}"></i>
              <div class="tx">
                <b><c:out value="${f.title}"/></b>
                <small>${f.itemCnt}개 건물 · ${f.doneCnt}개 완료<c:if test="${not empty f.emdNm}"> · <c:out value="${f.guName}"/> <c:out value="${f.emdNm}"/></c:if></small>
              </div>
              <span class="fx-badge st-${st}">${st == 'todo' ? '조사 전' : (st == 'done' ? '확인 완료' : '조사 중')}</span>
              <button type="button" class="fx-caret" title="건물 펼치기" aria-label="건물 펼치기"></button>
            </div>

            <div class="fx-body">
              <div class="fx-cap"><c:out value="${f.title}"/> · 건물 ${f.itemCnt}곳 · 방문 순서</div>
              <c:forEach var="it" items="${f.items}" varStatus="s">
                <div class="fx-item" data-lat="${it.lat}" data-lng="${it.lng}" data-km="${it.legKm}"
                     data-order="${it.visitOrder == null ? s.index + 1 : it.visitOrder}" data-checked="${it.checked}" data-title="<c:out value='${it.title}'/>">
                  <span class="num ${it.checked ? 'done' : ''}">${it.checked ? '✓' : (it.visitOrder == null ? s.index + 1 : it.visitOrder)}</span>
                  <div class="ti">
                    <a href="${ctx}/archivedetail.do?bldId=${it.bldId}" title="건물 확인 이력"><c:out value="${it.title}"/></a>
                    <span class="addr"><c:out value="${it.addr}"/></span>
                    <span class="leg"><span class="leg-from">${s.first ? '출발지에서 ' : '이전 지점에서 '}</span><span class="leg-min">${it.legMin}</span>분 <span class="leg-km">(${it.legKm}km)</span></span>
                  </div>
                  <div class="sc"><b>${it.score}</b><small>취약도</small></div>
                  <div class="ck">
                    <c:choose>
                      <c:when test="${it.checked}"><span class="badge done">확인 완료</span></c:when>
                      <c:otherwise>
                        <form method="post" action="${ctx}/fieldcheck.do">
                          <input type="hidden" name="planId" value="${it.planId}"><input type="hidden" name="listId" value="${f.surveyId}">
                          <button type="submit" class="btn btn-line btn-sm">확인 완료</button>
                        </form>
                      </c:otherwise>
                    </c:choose>
                  </div>
                </div>
              </c:forEach>
              <c:if test="${empty f.items}"><div class="fx-empty">담긴 건물이 없습니다. "편집"에서 보관함 건물을 담으세요.</div></c:if>
              <div class="fx-foot">
                <a class="btn btn-line btn-sm" href="${ctx}/fieldedit.do?listId=${f.surveyId}">편집</a>
                <c:choose>
                  <c:when test="${f.doneCnt > 0}"><button type="button" class="btn btn-line btn-sm fx-del" disabled title="현장 확인 기록이 있는 리스트는 건물 확인 이력을 지키기 위해 삭제할 수 없습니다">리스트 삭제</button></c:when>
                  <c:otherwise><button type="button" class="btn btn-line btn-sm fx-del" data-id="${f.surveyId}" data-title="<c:out value='${f.title}'/>">리스트 삭제</button></c:otherwise>
                </c:choose>
              </div>
            </div>

          </div>
        </c:forEach>

        <c:if test="${empty list}"><div class="fx-empty">${tab == 'done' ? '완료된 리스트가 없습니다.' : '진행 중인 리스트가 없습니다.'}</div></c:if>
      </div>

      <%-- 새 리스트 만들기 --%>
      <a class="fx-add" href="${ctx}/fieldedit.do?listId=0" title="새 현장확인 리스트"><span>+</span></a>
    </div>

    <%-- ===== 오른쪽 : 큰 지도 + 경로 · 소요시간 카드 (펼친 리스트 기준) ===== --%>
    <div class="fd-map fx-map" id="fxMap">
      <div class="nmap" id="map"></div>
      <div class="map-ctrl"><button type="button" id="zoomIn" title="확대">+</button><button type="button" id="zoomOut" title="축소">−</button></div>
      <div class="card route-card" id="routeCard">
        <div class="card-head"><h3>경로 · 소요시간</h3><small id="rtCap">리스트를 펼쳐 주세요</small></div>
        <%@ include file="/WEB-INF/views/include/mode-icons.jspf" %>
        <div class="route-modes" id="routeModes">
          <div data-mode="walk" title="도보 4km/h">${icoWalk}도보<b><span>-</span><small>분</small></b></div>
          <div data-mode="transit" title="대중교통 15km/h">${icoTransit}대중교통<b><span>-</span><small>분</small></b></div>
          <div data-mode="car" title="자동차 20km/h">${icoCar}자동차<b><span>-</span><small>분</small></b></div>
        </div>
        <div class="route-stats">
          <div>이동 거리<b id="rtKm">-</b></div>
          <div>현장 확인 예상<b id="rtCheck">-</b></div>
          <div>총 소요<b id="rtTotal">-</b></div>
          <div>출발 → 예상 종료<b id="rtEnd">-</b></div>

        </div>
      </div>
      <div class="fx-map-empty" id="fxMapEmpty" style="display:none"></div>
    </div>
  </div>
</div>

<form id="flDeleteForm" method="post" action="${ctx}/fielddelete.do" style="display:none"><input type="hidden" name="listId" id="flDeleteId"><input type="hidden" name="tab" value="${tab}"></form>

<script>
  window.navermap_authFailure = function () { document.getElementById('map').innerHTML = '<div class="map-error"><b>네이버 지도 인증 실패</b></div>'; };
  window.FX_OPEN = '<c:out value="${openId}"/>';   /* fieldlist.do?open=리스트ID : 처음 펼칠 리스트 */
</script>
<script src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<c:out value='${naverClientId}'/>"></script>
<script src="${ctx}/resources/js/common.js"></script>
<script src="${ctx}/resources/js/field-map.js"></script>
<script>
  $(function () {
    var FM = window.FieldMap, MODE_NM = { walk: '도보', transit: '대중교통', car: '자동차' };
    var CHECK_MIN = 20, START_MIN = 9 * 60 + 30;    /* 건물당 현장 확인 20분 · 09:30 출발 (예전 상세와 같은 값) */
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tt(min) { return min >= 60 ? Math.floor(min / 60) + '시간 ' + (min % 60) + '분' : min + '분'; }
    function endText(total) { var e = START_MIN + total; return '09:30 → ' + pad(Math.floor(e / 60) % 24) + ':' + pad(e % 60); }
    function startOf(sgg) { return FM.GU_OFFICE[sgg] || FM.GU_OFFICE['11530']; }

    /* 첫 건물 줄의 "출발지에서" → "구로구청에서" */
    $('.fx-card').each(function () { $(this).find('.fx-item').first().find('.leg-from').text(startOf(String($(this).data('sgg'))).name + '에서 '); });

    /* ---------- 지도 ---------- */
    var map = null;
    if (window.naver && naver.maps && naver.maps.Map) {
      map = new naver.maps.Map('map', { center: new naver.maps.LatLng(37.4954, 126.8874), zoom: 14, zoomControl: false, mapDataControl: false, scaleControl: false });
      $('#zoomIn').on('click', function () { if (map) map.setZoom(map.getZoom() + 1, true); });
      $('#zoomOut').on('click', function () { if (map) map.setZoom(map.getZoom() - 1, true); });
      var prevFail = window.navermap_authFailure;
      window.navermap_authFailure = function () { map = null; if (prevFail) prevFail(); };
    }
    var $info = $('<div class="map-float tc walk-info"></div>').appendTo('#fxMap').hide();
    var drawn = [], dash = null, routeLine = null, seq = 0, cur = null;

    function clearMap() {
      drawn.forEach(function (m) { m.setMap(null); }); drawn = [];
      if (dash) { dash.setMap(null); dash = null; }
      if (routeLine) { routeLine.setMap(null); routeLine = null; }
      $info.hide();
    }

    /* 카드 하나 → { id, $card, start, items[], km, checkMin, mode } */
    function readCard($c) {
      var items = $c.find('.fx-item').map(function () {
        var $i = $(this);
        return { lat: Number($i.data('lat')), lng: Number($i.data('lng')), km: Number($i.data('km')) || 0, order: $i.data('order'),
                 checked: String($i.data('checked')) === 'true', title: String($i.data('title')) };
      }).get().filter(function (p) { return !isNaN(p.lat) && !isNaN(p.lng); });
      var km = Math.round(items.reduce(function (s, p) { return s + p.km; }, 0) * 10) / 10;
      return { id: String($c.data('id')), $card: $c, title: String($c.data('title')), start: startOf(String($c.data('sgg'))),
               items: items, km: km, checkMin: items.length * CHECK_MIN, mode: String($c.data('mode') || 'walk') };
    }

    /* 직선거리 추정으로 카드 숫자 채우기 (TMAP 이 오기 전 · 못 받았을 때) */
    function applyStraight() {
      if (!cur) return;
      $('#routeModes > div').removeClass('on').each(function () {
        var m = $(this).data('mode');
        $(this).toggleClass('on', m === cur.mode).find('b > span').text(FM.minutes(cur.km, m));
      });
      var total = FM.minutes(cur.km, cur.mode) + cur.checkMin;
      $('#rtCap').text(cur.start.name + ' 출발 · ' + cur.items.length + '곳 · 직선거리 추정');
      $('#rtKm').text(cur.km + 'km');
      $('#rtCheck').html(cur.checkMin + '분 <small>(' + cur.items.length + '동 × ' + CHECK_MIN + '분)</small>');
      $('#rtTotal').text(tt(total));
      $('#rtEnd').text(endText(total));
      cur.$card.find('.leg-min').each(function () { var k = Number($(this).closest('.fx-item').data('km')) || 0; $(this).text(k > 0 ? Math.max(1, FM.minutes(k, cur.mode)) : 0); });   /* 가까워도 0분 대신 1분 */
      cur.$card.find('.leg-km').each(function () { $(this).text('(' + $(this).closest('.fx-item').data('km') + 'km)'); });
    }

    /* TMAP 응답으로 카드 숫자 교체. legs[i] = 출발→1, 1→2 … = i 번째 건물 줄 */
    function applyRoute(r) {
      var move = Math.max(1, Math.round(r.totalTime / 60)), total = move + cur.checkMin;
      $('#rtKm').text((r.totalDistance / 1000).toFixed(1) + 'km');
      $('#rtTotal').text(tt(total));
      $('#rtEnd').text(endText(total));
      $('#routeModes > div.on b > span').text(move);
      cur.$card.find('.fx-item').each(function (i) {
        var leg = (r.legs || [])[i]; if (!leg) return;
        $(this).find('.leg-min').text(Math.max(1, Math.round(leg.time / 60)));
        $(this).find('.leg-km').text('(' + (leg.distance / 1000).toFixed(1) + 'km' + (leg.straight ? ' · 직선' : '') + ')');
      });
      $('#rtCap').text(cur.start.name + ' 출발 · ' + cur.items.length + '곳 · TMAP ' + (MODE_NM[r.mode] || '도보') + ' 경로');
    }

    function loadRoute() {
      if (!map || !cur || !cur.items.length) return;
      var my = ++seq, c = cur;
      var pts = [c.start].concat(c.items).map(function (p) { return { lat: p.lat, lng: p.lng }; });
      $info.text('경로 찾는 중…').show();
      FM.walkPath(pts, c.mode).done(function (r) {
        if (my !== seq || !map) return;
        if (dash) dash.setMap(null);
        if (routeLine) routeLine.setMap(null);
        routeLine = FM.drawWalk(map, r, 5);
        $info.html(FM.walkText(r));
        applyRoute(r);
      }).fail(function (msg) {
        if (my !== seq) return;
        if (routeLine) { routeLine.setMap(null); routeLine = null; }
        if (dash) dash.setMap(map);
        applyStraight();
        if (msg) $info.text(msg + ' (직선으로 표시)'); else $info.hide();
      });
    }

    /* 리스트 하나를 오른쪽 지도 · 경로 카드에 보여 주기 */
    function show($c) {
      cur = readCard($c);
      $('#routeCard').show();
      if (!cur.items.length) {
        $('#fxMapEmpty').text('"' + cur.title + '" 에 담긴 건물이 없습니다.').show();
      } else $('#fxMapEmpty').hide();
      applyStraight();
      if (!map) return;
      seq++;                                   /* 앞 리스트의 늦은 TMAP 응답은 버린다 */
      clearMap();
      if (!cur.items.length) { map.setCenter(new naver.maps.LatLng(cur.start.lat, cur.start.lng)); return; }
      var path = [new naver.maps.LatLng(cur.start.lat, cur.start.lng)];
      drawn.push(new naver.maps.Marker({ position: path[0], map: map, zIndex: 90, title: '출발 · ' + cur.start.name,
        icon: { content: '<div class="mk-inv start-pin">출발</div>', anchor: new naver.maps.Point(16, 16) } }));
      cur.items.forEach(function (it, i) {
        var ll = new naver.maps.LatLng(it.lat, it.lng);
        drawn.push(new naver.maps.Marker({ position: ll, map: map, zIndex: 100 + i, title: it.title,
          icon: { content: '<div class="mk-inv num-pin' + (it.checked ? ' done' : '') + '">' + (it.checked ? '✓' : it.order) + '</div>', anchor: new naver.maps.Point(14, 14) } }));
        path.push(ll);
      });
      dash = new naver.maps.Polyline({ map: map, path: path, strokeColor: '#4a8fe0', strokeWeight: 4, strokeStyle: 'shortdash', strokeOpacity: 0.95, zIndex: 50 });
      var b = new naver.maps.LatLngBounds(path[0], path[0]);
      path.forEach(function (p) { b.extend(p); });
      map.fitBounds(b, { top: 60, right: 400, bottom: 40, left: 40 });   /* 오른쪽은 경로 카드 자리 */
      loadRoute();
    }

    /* 이동수단 바꾸기 : 펼친 리스트에 저장 + 다시 계산 */
    $('#routeModes').on('click', '> div', function () {
      var mode = $(this).data('mode');
      if (!cur || mode === cur.mode) return;
      var c = cur;
      Common.api('POST', 'api/field/mode.do', { listId: c.id, moveMode: mode }).done(function (res) {
        if (!res || !res.ok) { Common.toast('이동수단을 저장하지 못했습니다.'); return; }
        c.mode = mode; c.$card.attr('data-mode', mode).data('mode', mode);
        if (c !== cur) return;
        applyStraight();
        loadRoute();
        Common.toast(MODE_NM[mode] + ' 기준으로 저장했습니다.');
      });
    });

    /* 카드 머리를 누르면 펼침 (하나만). 펼친 리스트가 지도에 나온다. 링크 · 버튼은 제외, ⌄ 는 포함 */
    $('.fx-row').on('click', function (e) {
      if ($(e.target).closest('a, button:not(.fx-caret)').length) return;
      var $c = $(this).closest('.fx-card'), open = !$c.hasClass('open');
      $('.fx-card').not($c).removeClass('open');
      $c.toggleClass('open', open);
      if (open) show($c);
    });

    /* [약도 4] 펼친 카드의 약도 : 번호 핀 + 방문 순서대로 점선. 카드마다 처음 펼칠 때 한 번만 만든다
       (접혀 있는 동안은 크기가 0 이라 그때 만들면 지도가 깨진다) */
    function drawMiniMap($card) {
      if (!(window.naver && naver.maps && naver.maps.Map)) return;
      var $box = $card.find('.fl-map');
      if (!$box.length) return;
      if ($box.data('map')) { naver.maps.Event.trigger($box.data('map'), 'resize'); return; }
      var pts = [];
      $card.find('.fl-item').each(function () {
        var lat = parseFloat($(this).data('lat')), lng = parseFloat($(this).data('lng'));
        if (!isNaN(lat) && !isNaN(lng)) pts.push({ lat: lat, lng: lng, order: $(this).data('order'), checked: String($(this).data('checked')) === 'true', title: $(this).data('title') });
      });
      if (!pts.length) { $box.hide(); return; }
      var map = new naver.maps.Map($box.find('.nmap')[0], {
        center: new naver.maps.LatLng(pts[0].lat, pts[0].lng), zoom: 16,
        zoomControl: false, mapDataControl: false, scaleControl: false, logoControlOptions: { position: naver.maps.Position.BOTTOM_LEFT }
      });
      $box.data('map', map);
      var path = pts.map(function (p, i) {
        var ll = new naver.maps.LatLng(p.lat, p.lng);
        new naver.maps.Marker({ position: ll, map: map, zIndex: 100 + i, title: p.title,
          icon: { content: '<div class="mk-inv num-pin' + (p.checked ? ' done' : '') + '">' + (p.checked ? '✓' : p.order) + '</div>', anchor: new naver.maps.Point(14, 14) } });
        return ll;
      });
      if (path.length > 1) {
        new naver.maps.Polyline({ map: map, path: path, strokeColor: '#4a8fe0', strokeWeight: 3, strokeStyle: 'shortdash', strokeOpacity: 0.95, zIndex: 50 });
        var b = new naver.maps.LatLngBounds(path[0], path[0]);
        path.forEach(function (p) { b.extend(p); });
        map.fitBounds(b, { top: 30, right: 30, bottom: 30, left: 30 });
      }
      $box.find('.zin').on('click', function (e) { e.stopPropagation(); map.setZoom(map.getZoom() + 1, true); });
      $box.find('.zout').on('click', function (e) { e.stopPropagation(); map.setZoom(map.getZoom() - 1, true); });
    }
    drawMiniMap($('.fl-card.open').first());
    $('.fl-row').on('click', function () {
      var $card = $(this).closest('.fl-card');
      setTimeout(function () { if ($card.hasClass('open')) drawMiniMap($card); }, 0);
    });
    /* [추가 3] 이번 주 달력
       - 보이는 주의 일정 : GET  api/field/schedule.do?start&end  → [{id, title, start, surveyId}]
       - 리스트를 끌어다 놓기 : POST api/field/schedule/add.do    (surveyId, date)
       - 일정 끌어서 옮기기   : POST api/field/schedule/move.do   (scheduleId, date)
       - × 로 빼기           : POST api/field/schedule/delete.do (scheduleId) */
    var calEl = document.getElementById('flCalendar');
    if (calEl && window.FullCalendar) {
      function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }   /* 2026-11-17 */
      function failMsg(xhr, def) { return (xhr && xhr.responseJSON && xhr.responseJSON.msg) || def; }

      var calendar = new FullCalendar.Calendar(calEl, {
        initialView: 'dayGridWeek',
        locale: 'ko',
        height: 'auto',
        headerToolbar: { left: 'title', center: '', right: 'today prev,next' },
        dayMaxEvents: 3,                       /* 하루에 3개 넘으면 "+n" 으로 접기 */
        droppable: true,                       /* 밖(리스트)에서 끌어온 것을 받는다 */
        editable: true,                        /* 일정을 끌어서 다른 날로 */
        eventDurationEditable: false,          /* 여러 날로 늘리기는 안 함 */
        events: {
          url: '${ctx}/api/field/schedule.do',
          method: 'GET',
          failure: function () { Common.toast('달력 일정을 불러오지 못했습니다.'); }
        },

        /* 일정 막대 오른쪽에 × (빼기) */
        eventDidMount: function (info) {
          var x = document.createElement('span');
          x.className = 'fc-x'; x.title = '이 날짜에서 빼기'; x.textContent = '×';
          info.el.appendChild(x);
        },

        /* × 를 누르면 빼기, 나머지를 누르면 그 리스트 상세보기로 */
        eventClick: function (info) {
          info.jsEvent.preventDefault();
          if ($(info.jsEvent.target).hasClass('fc-x')) {
            if (!confirm('"' + info.event.title + '" 을(를) ' + ymd(info.event.start) + ' 에서 뺄까요?')) return;
            Common.api('POST', 'api/field/schedule/delete.do', { scheduleId: info.event.id }).done(function (res) {
              if (res && res.ok) info.event.remove(); else Common.toast((res && res.msg) || '일정을 빼지 못했습니다.');
            }).fail(function (xhr) { Common.toast(failMsg(xhr, '일정을 빼지 못했습니다.')); });
            return;
          }
          var sid = info.event.extendedProps.surveyId;
          if (sid) location.href = '${ctx}/fielddetail.do?listId=' + sid;
        },

        /* 리스트를 끌어다 놓음 → 저장. 저장되면 서버 기준으로 다시 그림 (id 를 받으려고) */
        eventReceive: function (info) {
          var ev = info.event;
          Common.api('POST', 'api/field/schedule/add.do', { surveyId: ev.extendedProps.surveyId, date: ymd(ev.start) }).done(function (res) {
            ev.remove();
            if (res && res.ok) { calendar.refetchEvents(); Common.toast('"' + ev.title + '" 을(를) ' + ymd(ev.start) + ' 에 넣었습니다.'); }
            else Common.toast((res && res.msg) || '일정을 넣지 못했습니다.');
          }).fail(function (xhr) { ev.remove(); Common.toast(failMsg(xhr, '일정을 넣지 못했습니다.')); });
        },

        /* 일정을 다른 날로 옮김 → 저장. 실패하면 제자리로 */
        eventDrop: function (info) {
          Common.api('POST', 'api/field/schedule/move.do', { scheduleId: info.event.id, date: ymd(info.event.start) }).done(function (res) {
            if (!res || !res.ok) { info.revert(); Common.toast((res && res.msg) || '일정을 옮기지 못했습니다.'); }
          }).fail(function (xhr) { info.revert(); Common.toast(failMsg(xhr, '일정을 옮기지 못했습니다.')); });
        }
      });
      calendar.render();

      /* 리스트 카드의 제목 줄(.fl-row)을 달력으로 끌 수 있게. 살짝 움직여야 끌기로 보므로 클릭(펼치기)은 그대로 */
      new FullCalendar.Draggable(document.querySelector('.page'), {
        itemSelector: '.fl-card .fl-row',
        minDistance: 8,
        eventData: function (el) {
          var $card = $(el).closest('.fl-card');
          return {
            title: $.trim($card.find('.t').first().text()),
            extendedProps: { surveyId: $card.data('id') },
            create: true
          };
        }
      });
    }

    /* 리스트 삭제 */
    $('.fx-del[data-id]').on('click', function () {
      if (!confirm('"' + $(this).data('title') + '" 리스트를 삭제할까요?\n담긴 건물은 보관함에 그대로 남습니다.')) return;
      $('#flDeleteId').val($(this).data('id'));
      $('#flDeleteForm').trigger('submit');
    });

    /* 처음 : ?open= 의 리스트, 없으면 첫 리스트를 펼친다 */
    var $first = window.FX_OPEN ? $('.fx-card[data-id="' + window.FX_OPEN + '"]') : $();
    if (!$first.length) $first = $('.fx-card').first();
    if ($first.length) { $first.addClass('open'); show($first); if (window.FX_OPEN) $first[0].scrollIntoView({ block: 'nearest' }); }
    else { $('#routeCard').hide(); $('#fxMapEmpty').text('현장 확인 리스트가 없습니다. [+ 새 현장확인 리스트] 로 만들어 보세요.').show(); }
  });
</script>
</body>
</html>
 