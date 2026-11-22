/*
 * 분석 지도 시작점 (살피구로 main.js 의 modeOf · loadPoints · scheduleLoad · onLevelChanged 담당)
 *  - 줌 3단계 : gu(≤14) 구 경계·라벨만 / cluster(15~17) 격자 도넛 / building(≥18) 건물 핀
 *  - zoom_changed → 모드·범례 갱신, idle → 200ms 디바운스 후 loadPoints()
 *  - 요청 bbox = 화면 범위 + 여유, 요청 순번(pointSeq)으로 늦게 온 옛 응답은 버린다
 *  - 분석 전 : 현장 확인됨 핀 + 구 경계(기본 기준). "분석 실행" 후 : 기준값으로 다시 조회 + 결과 리스트
 *  - 동 선택 2단계(법정동 → 행정동 여러 개, api/map/dongs.do) · 결과 리스트 범위(구 전체 / 동 / "지도 화면 안") · [이 지역에서 재검색] (5-1)
 *  - 구청 계정 (11단계) : 소속 구 밖은 어두운 가림막(구멍 뚫린 다각형) + 경계선, 관할 밖으로 나가면 안내 띠, 이동 범위 = 구 bbox + 2km, 최소 줌 12
 */
$(function () {
  var C = window.MAP_CONFIG;
  var $map = $('#map');

  /* 지도 SDK 가 없거나 인증에 실패해도(키 · Web 서비스 URL 미등록) 결과 리스트 · 상세 패널은 동작하게 한다 */
  var hasMap = !!(window.naver && naver.maps && naver.maps.Map);
  if (!hasMap) {
    $map.html('<div class="map-error"><b>네이버 지도를 불러오지 못했습니다</b>'
      + '<p>네이버 클라우드 콘솔 &gt; Maps &gt; Application 에서 <b>Dynamic Map</b> 이 켜져 있고, Web 서비스 URL 에 <code>' + Common.esc(location.origin) + '</code> 이 등록돼 있는지, '
      + 'app.properties 의 app.naver.client-id 가 맞는지 확인하세요.<br>지도 없이도 "분석 실행" 으로 결과 리스트와 건물 상세는 볼 수 있습니다.</p></div>');
  }

  var state = {
    analyzed: false,     // "분석 실행" 을 눌렀는지
    criteria: null,      // 확정된 조건 = 마지막으로 [분석 실행]한 값 (시작 때 패널 기본값을 한 번 찍어 둔다). 슬라이더만 움직인 값은 쓰지 않는다
    gu: window.LOCK_GU || '', dong: '', adms: [], q: '',  // 구청 계정이면 소속 구로 고정 (selGu 는 disabled). dong = 법정동 하나 전체, adms = 고른 행정동들 "법정동|행정동" (복수 선택)
    bbox: null,              // [이 지역에서 재검색] 뒤의 리스트 범위 ("지도 화면 안"). 동을 다시 고르면 null
    quietUntil: 0,           // 프로그램이 지도를 옮기는 동안(flyTo · fitTo)은 [재검색] 버튼을 띄우지 않는다
    selectedId: null,
    riskOnly: C.RISK_ONLY,   // 기준점 이상 건물이 있는 묶음 · 기준점 이상 핀만 (지도 위 칩으로 끄고 켬)
    checkedMonths: C.CHECKED_MONTHS, // 현장 확인됨 기간 : 3 | 12 | 0 전체 | -1 끄기 (범례에서 고름)
    lastRaw: null,           // 마지막 응답 { mode, list } : 칩을 눌렀을 때 다시 요청하지 않고 다시 그린다
    pointSeq: 0,
    cellByLevel: {}      // zoom → 묶음 칸 크기 (같은 zoom 에서는 같은 값 → 지도를 옮겨도 묶음이 흔들리지 않음)
  };

  /* ---------- 지도 ---------- */
  /* 첫 화면 : 서울시청 = 3개 구 가운데(zoom 13), 구청 계정 = 소속 구 중심(zoom 14) */
  var lockGu = C.GU.filter(function (x) { return x.code === state.gu; })[0];
  var map = hasMap ? new naver.maps.Map('map', {
    center: new naver.maps.LatLng(lockGu ? lockGu.lat : C.CENTER.lat, lockGu ? lockGu.lng : C.CENTER.lng),
    zoom: lockGu ? C.ZOOM.GU : C.ZOOM.INIT, minZoom: lockGu ? C.ZOOM.LOCK_MIN : C.ZOOM.MIN, maxZoom: C.ZOOM.MAX,
    zoomControl: false, mapDataControl: false, scaleControl: false,
    logoControlOptions: { position: naver.maps.Position.BOTTOM_RIGHT }
  }) : null;
  /* 인증 실패는 SDK 로드 뒤에 비동기로 오고 그때 naver.maps 가 null 이 된다 → 쓸 때마다 확인 */
  var live = function () { return !!(map && window.naver && naver.maps); };
  var prevFail = window.navermap_authFailure;
  window.navermap_authFailure = function () { map = null; if (prevFail) prevFail(); };
  var LL = function (lat, lng) { return new naver.maps.LatLng(lat, lng); };
  var zoomNow = function () { return live() ? map.getZoom() : C.ZOOM.INIT; };
  /* 현재 zoom 의 표시 방식 (네이버는 숫자가 클수록 확대) */
  var modeOf = function (z) { return z >= C.ZOOM.BUILDING_MIN ? 'building' : z >= C.ZOOM.CLUSTER_MIN ? 'cluster' : 'gu'; };
  var flyTo = function (lat, lng, zoom) {
    if (!live()) return;
    state.quietUntil = Date.now() + 2500;
    if (zoom == null || zoom === map.getZoom()) map.panTo(LL(lat, lng));
    else map.morph(LL(lat, lng), zoom);
  };
  /* 동을 고르면 그 동 건물들의 범위로 (bbox = [minLng, minLat, maxLng, maxLat]) */
  var fitTo = function (box) {
    if (!live() || !box) return;
    state.quietUntil = Date.now() + 2500;
    map.fitBounds(new naver.maps.LatLngBounds(LL(box[1], box[0]), LL(box[3], box[2])), { top: 90, right: 60, bottom: 70, left: 60 });
  };
  var guOf = function (code) { return C.GU.filter(function (x) { return x.code === code; })[0]; };
  /* 분석 실행 전에 저장해도 지금 고른 시나리오를 같이 남긴다 (보관함 구분 칸). 실행 뒤에는 runAnalysis 가 넣은 값 그대로 */
  var criteria = function () {
    if (!state.criteria) { state.criteria = MapLayer.getCriteria(); state.criteria.scenario = scen; state.criteria.modified = scenMod; }
    return state.criteria;
  };
  /* 지도 조회 파라미터 = 확정 조건 + 현장 확인됨 기간 */
  var viewParams = function () { return $.extend({}, criteria(), { checkedMonths: state.checkedMonths }); };

  /* 지금 지도 화면 범위 "minLng,minLat,maxLng,maxLat" ([분석 실행] 과 [이 지역에서 재검색] 이 같이 쓴다). 지도가 없으면 null */
  function currentBbox() {
    if (!live()) return null;
    var b = map.getBounds(), sw = b.getSW(), ne = b.getNE();
    return [sw.lng(), sw.lat(), ne.lng(), ne.lat()].map(function (v) { return v.toFixed(5); }).join(',');
  }
  /* 리스트 범위가 화면(bbox)인지. 주소 · 건물명 검색 중에는 화면 밖 건물도 찾아야 하므로 bbox 를 쓰지 않고 구 · 동 범위로 찾는다 */
  var byScreen = function () { return !!state.bbox && !state.q; };
  /* 결과 리스트 파라미터. 범위 = bbox("현재 화면") 또는 구·법정동·행정동 */
  function listParams() {
    var p = $.extend({}, criteria(), { q: state.q });
    if (byScreen()) p.bbox = state.bbox;
    else { p.gu = state.gu; p.dong = state.dong; p.adms = state.adms; }
    return p;
  }
  /* 리스트 머리 : "범위 현재 화면 · 지도를 옮기면 '이 지역에서 재검색'" / "구로구 · 구로동 · 구로2동" */
  function renderScope() {
    var g = guOf(state.gu);
    var area = [g ? g.name : '전체 3개 구', state.dong].concat(state.adms.map(admOfKey)).filter(Boolean).join(' · ');
    /* 앞머리 = 분석할 때의 기준 (2차 G) : "기준 폭우 · 범위 현재 화면" */
    var basis = state.scenRun ? '<span>기준</span> ' + Common.esc(scenName(state.scenRun) + (state.modRun ? '(수정됨)' : '')) + ' <span>·</span> ' : '';
    if (byScreen()) $('#resultScope').html(basis + '<span>범위</span> 현재 화면 <span>· 지도를 옮기면 \'이 지역에서 재검색\'</span>');
    else $('#resultScope').html(basis + '<span>범위</span> ' + Common.esc(area) + (state.q ? ' <span>· 검색은 화면 밖 건물도 찾습니다</span>' : ''));
    /* 법정동·행정동을 고르면 그 경계에 테두리 (행정동 여러 개면 전부). 구만 골랐거나 전체 구면 그리지 않는다 */
    if (!live()) return;                              // 지도가 없으면(인증 실패 등) 경계 · 색칠은 건너뛴다. 여기서 오류가 나면 뒤의 결과 리스트 조회까지 막힌다
    if (window.DongBoundary && (state.dong || state.adms.length)) DongBoundary.show(map, state.gu, state.dong, state.adms.map(admOfKey));
    else if (window.DongBoundary) DongBoundary.show(null);
    if (MapMarker.filterGu) MapMarker.filterGu(state.gu, !!(state.dong || state.adms.length));       // 동을 고르면 구 색칠은 숨김
  }
  /* 지도를 옮겨도 리스트는 그대로 (5-1). 분석 뒤 사용자가 옮겼을 때만 [이 지역에서 재검색] 을 띄운다 */
  function onMoved() {
    var out = checkOutside();
    if (out || !state.analyzed || Date.now() < state.quietUntil) return;
    placeRefetch();
    $('#btnRefetch').addClass('show');
  }
  /* [이 지역에서 재검색] : 화면 정중앙 하단 (CSS fixed). 범례(왼쪽 아래, 줄 수에 따라 높이가 바뀜) 위로 30px 띄워 겹치지 않게 */
  function placeRefetch() {
    var $lg = $('#legend'), h = $lg.is(':visible') ? $lg.outerHeight() : 0;
    $('#btnRefetch').css('bottom', (h ? 12 + h + 30 : 40) + 'px');
  }
  /* 오른쪽 패널을 열고 검색 결과 화면으로 (2차 N). [분석 실행] 과 [이 지역에서 재검색] 이 같이 쓴다.
     건물 상세를 보던 중이면 상세(와 3D)는 닫는다. 패널을 열면 여닫기 버튼 방향 · 검색 줄 · 지도 유형 위치는 CSS 와 패널 class 감시(MutationObserver)가 같이 맞춘다 */
  function showResultPanel() {
    if (window.Bld3D) Bld3D.hide();
    $('#detailView').hide(); $('#resultView').removeClass('empty').show();
    $('#panelRight').addClass('open');
  }
  /* [이 지역에서 재검색] : 패널이 닫혀 있든 건물 상세를 보고 있든 항상 검색 결과 리스트를 보여준다. 지도는 움직이지 않는다.
     직전에 고른 건물이 새 리스트에 있으면 그 행만 강조된다 (MapResult 가 기억) */
  $('#btnRefetch').on('click', function () {
    if (!live()) return;
    showResultPanel();
    state.bbox = currentBbox();
    $(this).removeClass('show');
    renderScope();
    MapResult.load(true);
  });

  /* ---------- 서버 조회 (살피구로 loadPoints) ---------- */
  function loadPoints() {
    if (!live()) return;
    var z = zoomNow(), mode = modeOf(z);
    var seq = ++state.pointSeq;
    if (mode === 'gu') { state.lastRaw = null; MapMarker.clear(); return; }     // 구 단위에서는 건물·묶음 없음
    var b = map.getBounds(), sw = b.getSW(), ne = b.getNE();
    var pad = mode === 'cluster' ? 0.002 : 0.0005;        // 화면 바깥 조금 (건물 단위는 약 50m)
    var q = viewParams();
    if (state.adms.length) { q.gu = state.gu; q.adms = state.adms; }   // 행정동을 고르면 그 행정동 건물만 (묶음 · 핀)
    else if (state.dong) { q.gu = state.gu; q.dong = state.dong; }     // 법정동을 고르면 그 법정동 건물만
    q.bbox = [sw.lng() - pad, sw.lat() - pad, ne.lng() + pad, ne.lat() + pad].map(function (v) { return v.toFixed(5); }).join(',');
    var req;
    if (mode === 'cluster') {
      /* 칸 크기(경도, 도) = 화면 CLUSTER_PX 픽셀 */
      if (!state.cellByLevel[z]) state.cellByLevel[z] = C.CLUSTER_PX * (ne.lng() - sw.lng()) / $map.width();
      q.cell = state.cellByLevel[z].toFixed(8);
      req = MapApi.clusters(q);
    } else {
      q.limit = C.BUILDING_LIMIT;
      req = MapApi.buildings(q);
    }
    req.done(function (list) {
      if (seq !== state.pointSeq) return;                 // 늦게 온 옛 응답
      state.lastRaw = { mode: mode, list: list };
      renderMarks();
    });
  }
  /* 마지막 응답(lastRaw)을 지도에. riskOnly 면 기준점 이상 건물이 있는 묶음(빨간 숫자)과 기준점 이상 핀만. 선택한 건물은 항상 */
  var passRisk = function (b) { return !state.riskOnly || b.score >= C.SCORE_MIN || b.bldId === state.selectedId; };
  function renderMarks() {
    if (!state.lastRaw) { MapMarker.clear(); return; }
    var r = state.lastRaw, list;
    if (r.mode === 'cluster') list = r.list.filter(function (c) { return c.point ? passRisk(c.point) : !state.riskOnly || c.riskCount > 0; });   // 켜져 있으면 기준점 이상이 0인 칸은 안 그린다
    else list = r.list.filter(passRisk);
    MapMarker.render(r.mode, list, state.riskOnly);
    if (state.selectedId) MapMarker.select(state.selectedId);
  }
  /* 지도 위 칩 : 기준점 이상만 보기 켜고 끄기 */
  function applyRiskOnly() {
    $('#riskOnly').toggleClass('on', state.riskOnly).attr('aria-pressed', String(state.riskOnly))
      .attr('title', state.riskOnly ? '누르면 모든 건물을 표시합니다' : '누르면 ' + C.SCORE_MIN + '점 이상인 건물만 표시합니다');
  }
  $('#riskOnly').on('click', function () {
    state.riskOnly = !state.riskOnly;
    applyRiskOnly();
    renderMarks();
    legendKey = null; renderLegend(modeOf(zoomNow()));
  });
  applyRiskOnly();
  var moveTimer = null;
  function scheduleLoad() { clearTimeout(moveTimer); moveTimer = setTimeout(loadPoints, 200); }

  /* 구 경계 = 실제 행정경계 (resources/geo/seoul_3gu_gu.geojson, 통계청 행정동 경계 2026-07 기준).
     서버 ring 대신 이 고리를 쓴다. 파일을 못 읽으면 서버 ring 그대로 */
  var realRings = null;
  function loadRealRings() {
    if (realRings) return realRings;
    realRings = $.Deferred();
    $.getJSON('resources/geo/seoul_3gu_gu.geojson').done(function (fc) {
      var m = {};
      (fc.features || []).forEach(function (f) {
        var g = f.geometry, c = g.type === 'MultiPolygon' ? g.coordinates[0] : g.coordinates;
        m[f.properties.gu_code] = c[0];                          // [[lng, lat], ...] 바깥 고리
      });
      realRings.resolve(m);
    }).fail(function () { realRings.resolve({}); });
    return realRings;
  }
  var guSeq = 0;
  function loadGus() {
    var params = viewParams(), my = ++guSeq;
    loadRealRings().done(function (rings) {
      MapApi.gus(params).done(function (list) {
        if (my !== guSeq) return;                                 // 늦게 온 옛 응답 (시나리오를 빠르게 바꿨을 때)
        (list || []).forEach(function (g) { if (rings[g.sggCd]) g.ring = rings[g.sggCd]; });
        MapMarker.renderGu(list); setupLock(list);
      });
    });
    loadAreaLabels();
  }

  /* 동 집계 원 : 법정동 · 행정동을 고르면 구 원 대신 "구로동 위험 N곳" / "구로1동 위험 N곳" (구 단위 줌에서만, 확대하면 도넛).
     숫자는 gus.do 를 그 지역 조건(gu + dong 또는 gu + adms)으로 불러 받는다 = 구 원과 같은 기준 */
  var areaSeq = 0;
  function loadAreaLabels() {
    var seq = ++areaSeq;
    var targets = [];
    if (state.adms.length) state.adms.forEach(function (k) { targets.push({ name: admOfKey(k), dong: '', adm: admOfKey(k), q: { gu: state.gu, adms: [k] } }); });
    else if (state.dong) targets.push({ name: state.dong, dong: state.dong, adm: '', q: { gu: state.gu, dong: state.dong } });
    if (!targets.length || !window.DongBoundary || !DongBoundary.center) { MapMarker.renderArea([]); return; }
    var out = [], left = targets.length;
    targets.forEach(function (t) {
      var c = DongBoundary.center(state.gu, t.dong, t.adm ? [t.adm] : []);
      MapApi.gus($.extend(viewParams(), t.q)).always(function (list) {
        if (seq !== areaSeq) return;                                // 그새 다른 지역을 골랐으면 버림
        var g = $.isArray(list) && list[0];
        if (c) out.push({ name: t.name, lat: c[1], lng: c[0], riskCount: g ? g.riskCount : 0, checkedCnt: g ? g.checkedCnt : 0 });
        if (--left === 0) MapMarker.renderArea(out);
      });
    });
  }

  /* ---------- 구청 계정 : 관할 밖 가림막 · 경계선 · 이동 범위 (11단계). 첫 gus 응답의 소속 구 ring 으로 한 번만 ---------- */
  var lock = { ring: null, bbox: null, mask: null, line: null };
  function setupLock(list) {
    if (!lockGu || lock.ring || !live()) return;
    var g = (list || []).filter(function (x) { return x.sggCd === state.gu; })[0];
    if (!g || !g.ring || g.ring.length < 3) return;
    lock.ring = g.ring;                                           // [[lng, lat], ...] 닫힌 고리
    var minLng = 999, minLat = 999, maxLng = -999, maxLat = -999;
    g.ring.forEach(function (p) { minLng = Math.min(minLng, p[0]); maxLng = Math.max(maxLng, p[0]); minLat = Math.min(minLat, p[1]); maxLat = Math.max(maxLat, p[1]); });
    lock.bbox = [minLng, minLat, maxLng, maxLat];
    var hole = g.ring.map(function (p) { return LL(p[1], p[0]); });
    /* 바깥 사각형(서울 서남부를 넉넉히) + 소속 구 ring 을 구멍으로. 지도 타일에 다크 필터(invert + hue-rotate)가 걸려 있어
       오버레이도 같이 뒤집히므로, 화면에 #0b0d12 로 보이게 하려면 그 반전색(#f4f2ed)을 넣는다 */
    var outer = [LL(37.2, 126.5), LL(37.2, 127.3), LL(37.8, 127.3), LL(37.8, 126.5), LL(37.2, 126.5)];
    lock.mask = new naver.maps.Polygon({ map: map, paths: [outer, hole], fillColor: maskColor(), fillOpacity: 0.6, strokeWeight: 0, strokeOpacity: 0, clickable: false, zIndex: 2 });
    lock.line = new naver.maps.Polyline({ map: map, path: hole, strokeColor: '#4a8fe0', strokeWeight: 2, strokeOpacity: 1, clickable: false, zIndex: 3 });
    /* 이동 범위 = 구 bbox + 사방 2km (위도 0.018°, 경도 0.0227°), 최소 줌 12 */
    var dLat = 0.018, dLng = 0.0227;
    map.setOptions({ maxBounds: new naver.maps.LatLngBounds(LL(minLat - dLat, minLng - dLng), LL(maxLat + dLat, maxLng + dLng)), minZoom: C.ZOOM.LOCK_MIN });
    $('#outGu').text(lockGu.name);
    checkOutside();
  }
  /* 점이 고리 안인지 (ray casting) */
  function inRing(lng, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  /* 지도 중심이 소속 구 밖이면 안내 띠 (이때 [재검색] 은 숨김) */
  function checkOutside() {
    if (!lock.ring || !live()) return false;
    var c = map.getCenter(), out = !inRing(c.lng(), c.lat(), lock.ring);
    $('#outBar').toggleClass('show', out);
    if (out) $('#btnRefetch').removeClass('show');
    return out;
  }
  $('#btnBackGu').on('click', function () { if (lock.bbox) fitTo(lock.bbox); });
  /* 현장 확인된 건물 목록. 핀 모드에서 핀이 없는 건물만 파란 체크 점으로 그려진다 (MapMarker 가 판단) */
  function loadChecked() {
    MapApi.checked({ gu: state.gu, dong: state.dong, adms: state.adms, checkedMonths: state.checkedMonths }).done(function (list) { MapMarker.renderChecked(list); });
  }
  /* 범례 "현장 확인됨" 기간 바꾸기 → 구 요약 · 묶음/핀 · 체크 점 다시 */
  var CHECK_LABEL = { 3: '최근 3개월', 12: '최근 1년', 0: '전체', '-1': '끄기' };
  $('#legend').on('click', '#lgCheck', function (e) { e.stopPropagation(); $('#chkMenu').toggleClass('open'); });
  $('#legend').on('click', '#chkMenu button', function (e) {
    e.stopPropagation();
    state.checkedMonths = Number($(this).data('m'));
    $('#chkMenu').removeClass('open');
    legendKey = null; renderLegend(modeOf(zoomNow()));
    loadGus(); loadPoints(); loadChecked();
  });
  $(document).on('click', function () { $('#chkMenu').removeClass('open'); });

  /* 줌이 바뀌면 표시 방식 · 범례 (살피구로 onLevelChanged) */
  var legendKey = null;
  function onLevelChanged() {
    var z = zoomNow(), mode = modeOf(z);
    $map.closest('.map-wrap').toggleClass('show-labels', z >= C.ZOOM.MAX);
    if (mode === 'gu') { state.pointSeq++; state.lastRaw = null; MapMarker.clear(); }
    MapMarker.showGu(mode === 'gu');
    if (MapMarker.showArea) MapMarker.showArea(mode === 'gu');
    renderLegend(mode);
  }
  function renderLegend(mode) {
    var key = mode + '|' + state.analyzed + '|' + state.riskOnly + '|' + state.checkedMonths;
    var only = state.riskOnly ? C.SCORE_MIN + '점 이상만 표시 중 · ' : '';
    if (key === legendKey) return;
    legendKey = key;
    var key2 = key + '|' + state.checkedMonths;
    var lv = C.LEVELS.map(function (l) { return '<span class="lg"><i class="sw" style="background:' + C.COLORS[l.key] + '"></i>' + l.label + '</span>'; }).join('');
    /* "현장 확인됨" 은 누르면 기간을 고른다 (최근 3개월 / 1년 / 전체 / 끄기) */
    var html = '<b>범례</b><span class="lg lg-chk" id="lgCheck" title="현장 확인 표시 기간"><i class="lg-check">✓</i> 현장 확인됨 <small>· ' + CHECK_LABEL[state.checkedMonths] + ' ▾</small>'
      + '<span class="lg-menu" id="chkMenu">' + [3, 12, 0, -1].map(function (m) { return '<button type="button" data-m="' + m + '" class="' + (m === state.checkedMonths ? 'on' : '') + '">' + CHECK_LABEL[m] + '</button>'; }).join('') + '</span></span>';
    if (mode === 'gu') {
      html += '<span class="lg"><i class="sw" style="background:' + C.COLORS.red + '"></i><i class="sw" style="background:' + C.COLORS.orange + '"></i><i class="sw" style="background:' + C.COLORS.yellow + '"></i> 구 색 = 위험 건수 (많을수록 빨강)</span>'
        + '<span class="lg lg-mode">구 단위 · 구 라벨 = ' + C.SCORE_MIN + '점 이상 · 현장 확인 건수 · 확대하면 묶음</span>';
    } else if (mode === 'cluster') {
      var sample = MapMarker.svgUri(MapMarker.clusterSvg({ size: 10, hist: [2, 3, 2, 3] }));
      html += lv + '<span class="lg"><img src="' + sample + '" width="22" height="22" alt=""> 숫자 = 건물 수 · 테두리 = 점수 구간 비율</span>'
        + '<span class="lg"><span class="lg-badge">N</span>' + C.SCORE_MIN + '점 이상</span>'
        + '<span class="lg"><span class="lg-badge blue">✓N</span>현장 확인</span>'
        + '<span class="lg lg-mode">' + only + '묶음을 누르면 확대</span>';
    } else {
      html += lv + '<span class="lg"><i class="lg-dot"></i> 점 = 핀 ' + C.PIN_ICON_MAX + '개 밖의 건물</span>'
        + '<span class="lg"><span class="lg-badge blue">✓</span>핀의 체크 = 현장 확인됨</span>'
        + '<span class="lg lg-mode">' + only + '건물 단위 · 점수 높은 순 핀 ' + C.PIN_ICON_MAX + '개</span>';
    }
    $('#legend').html(html);
    placeRefetch();                                   // 범례 높이가 바뀌면 재검색 버튼도 따라 올라간다
  }

  if (live()) {
    naver.maps.Event.addListener(map, 'zoom_changed', onLevelChanged);
    naver.maps.Event.addListener(map, 'bounds_changed', function () { if (window.Bld3D) Bld3D.moving(); });   // 지도가 움직이는 동안 3D 작업 미룸 (map-3d.js)
    naver.maps.Event.addListener(map, 'idle', function () { scheduleLoad(); onMoved(); if (window.Bld3D) { Bld3D.idle(); Bld3D.warmup(modeOf(zoomNow()) === 'building'); } });   // 건물 핀 단계에서 1초 멈추면 3D 엔진만 미리 켬
  }

  /* "분석 실행" : 이때 조건을 확정 → 구 요약 · 도넛/핀 · 결과 리스트를 한 번에 다시. 이후 지도 이동 · 재검색 · 보관함 저장은 모두 이 조건 */
  function runAnalysis(c) {
    state.analyzed = true;
    c.scenario = scen;                                 // 어떤 기준으로 분석했는지도 조건에 남긴다 (보관함 저장 criteria JSON 에 그대로. 서버는 모르면 무시)
    c.modified = scenMod;                              // 프리셋에서 값을 직접 고쳤는지
    state.scenRun = scen; state.modRun = scenMod;
    state.criteria = c;
    state.cellByLevel = {};
    /* 리스트 범위 (2026-11-19 리뷰 8)
         ① 구 · 동을 고르지 않았을 때      = 지금 지도 화면(bbox) 안의 건물
         ② 상단에서 구 · 동을 고정했을 때  = 고정한 구 · 동 전체 (화면 범위 무시 → 화면에 걸친 이웃 구 건물이 섞이지 않는다)
         ③ [이 지역에서 재검색]            = 구 · 동 고정과 상관없이 언제나 지도 화면(bbox) — 위 #btnRefetch */
    state.bbox = (state.gu || state.dong || state.adms.length) ? null : currentBbox();
    showResultPanel();
    $('#btnRefetch').removeClass('show');
    loadGus();
    loadPoints();
    legendKey = null; renderLegend(modeOf(zoomNow()));
    renderScope();
    MapResult.load(true);
  }

  /* ---------- 선택 ---------- */
  function selectBuilding(b, fly) {
    state.selectedId = b.bldId;
    MapMarker.select(b.bldId);
    MapResult.highlight(b.bldId);
    MapPanel.show(b.bldId);
    if (fly) flyTo(b.lat, b.lng, zoomNow() < C.ZOOM.BUILDING ? C.ZOOM.BUILDING : null);
  }

  /* ---------- 모듈 연결 ---------- */
  MapMarker.init(map, {
    mode: function () { return modeOf(zoomNow()); },
    onMarkClick: function (m) {
      if (m.kind === 'cluster') flyTo(m.data.lat, m.data.lng, Math.max(C.ZOOM.BUILDING, zoomNow() + 1));   // 묶음 → 확대
      else {
        selectBuilding(m.data, false);
        if (street.on) { street.markAt = Date.now(); openPano(LL(m.data.lat, m.data.lng), m.data); }   // 로드뷰 모드 : 그 건물 앞 로드뷰를 열고 사진 속에 건물 핀 1개 (2차 O)
      }
    },
    onGuClick: function (g) { flyTo(g.lat, g.lng, C.ZOOM.CLUSTER_MIN); },
    onAreaClick: function (a) { flyTo(a.lat, a.lng, C.ZOOM.CLUSTER_MIN); }   // 동 집계 원을 누르면 확대 → 도넛
  });
  MapLayer.init({ onRun: runAnalysis, onToggle: resize, onChange: function () { setMod(true); } });   // 패널에서 직접 바꾸면 선택 칩에 "· 수정됨"
  MapResult.init({ getParams: listParams, onSelect: function (b) { selectBuilding(b, true); },
    /* 0건 안내 문구용 : 지금 리스트 범위가 화면인지, 아니면 어느 구 · 동인지 */
    getScope: function () {
      var g = guOf(state.gu);
      return { screen: byScreen(), area: [g ? g.name : '전체 3개 구', state.dong].concat(state.adms.map(admOfKey)).filter(Boolean).join(' ') };
    } });
  /* 분석 중 알약 (2차 R) : 결과를 새로 받는 동안 분석 기준 줄 아래에. MapResult 가 300ms 지연 뒤 'wf:busy' 로 알린다 */
  $(document).on('wf:busy', function (e, on) { $('#anPill').toggleClass('show', !!on); });
  MapPanel.init({ getCriteria: criteria, onArchived: setChips, onClose: resize });

  function resize() { if (live()) naver.maps.Event.trigger(map, 'resize'); }

  /* 오른쪽 패널 여닫기 버튼 (2차 11-17). 패널은 .right-panel.open 으로 여닫고, × 로 닫은 뒤에도 이 버튼으로 다시 연다.
     뷰(결과 목록 / 건물 상세)는 닫을 때 건드리지 않으므로 다시 열면 마지막에 보던 그대로. 분석 전이면 #resultView.empty 의 안내 문구만 보인다.
     × · 분석 실행 · 건물 선택으로도 여닫히므로 aria-expanded 는 클래스가 바뀔 때마다 맞춘다 */
  var panelRight = document.getElementById('panelRight');
  $('#toggleRight').on('click', function () { $(panelRight).toggleClass('open'); });
  var rightWasOpen = false;
  new MutationObserver(function () {
    var open = $(panelRight).hasClass('open');
    $('#toggleRight').attr('aria-expanded', String(open));
    if (open !== rightWasOpen) {                     // 패널이 닫히면 3D 도 닫고, 건물 상세를 보던 채로 다시 열면 3D 를 다시 준비
      rightWasOpen = open;
      if (window.Bld3D) { if (open) MapPanel.refresh3d(); else Bld3D.hide(); }
    }
    fitTop();                                        // 위쪽 두 줄(분석 기준 · 검색)이 겹치지 않게
    fitPano();                                       // 로드뷰가 열려 있으면 패널을 뺀 영역에 다시 맞춘다
  }).observe(panelRight, { attributes: true, attributeFilter: ['class'] });

  /* ---------- 분석 기준 줄 (2차 11-17 G) : [기본] [폭우] [폭염] [한파] ┃ [가중치 보기] | [접기] ----------
     시나리오 버튼 = MAP_CONFIG.SCENARIOS 순서대로. 처음에는 '기본' 이 선택돼 있다 (분석은 아직 안 돌림)
       시나리오를 누르면 : 왼쪽 패널의 체크 · 가중치를 프리셋대로 바꾸고(MapLayer.applyPreset) 바로 현재 화면으로 분석. 왼쪽 패널은 열지 않는다
       [가중치 보기] : 시나리오가 아니라 왼쪽 패널을 여닫는 버튼 (여닫기 탭 #toggleLeft 와 같은 동작). 선택 · 값은 그대로, 분석도 돌리지 않는다.
                      눌림 표시는 .map-layout 의 left-closed 유무로 CSS 가 그리므로 여닫기 탭으로 여닫아도 같이 바뀐다
       왼쪽 패널에서 체크 · 기준값 · 가중치를 직접 바꾸면 : 선택은 그대로 두고 칩 글자가 "폭우 · 수정됨" (MapLayer.init 의 onChange).
                      같은 · 다른 시나리오를 다시 누르면 프리셋 값으로 돌아가고 "수정됨" 이 사라진다. 고친 값으로 분석하려면 패널의 [분석 실행]
     접힘(itgeo.scenFold) : 선택한 시나리오 하나 ┃ 가중치 보기 | 펼치기. 시나리오를 골라도 자동으로 접지 않는다 */
  var scen = 'base', scenMod = false;
  var SCEN = C.SCENARIOS || [];
  function scenName(k) {
    var x = SCEN.filter(function (v) { return v.key === k; })[0];
    return x ? x.name : '';
  }
  function setMod(m) {
    scenMod = !!m;
    $('#scenList .scen-btn').removeClass('mod').removeAttr('title').filter('.on').toggleClass('mod', scenMod).attr('title', scenMod ? '수정됨' : null);
    fitTop();
  }
  function setScen(k) {
    scen = k;
    $('#scenList .scen-btn').each(function () { $(this).toggleClass('on', $(this).attr('data-scen') === k); });
    setMod(false);
  }
  function setFold(f) {
    $('#scenBar').toggleClass('folded', f);
    $('#scenFold').attr('aria-expanded', String(!f));
    try { localStorage.setItem('itgeo.scenFold', f ? '1' : '0'); } catch (e) {}
    fitTop();
  }
  $('#scenList').html(SCEN.map(function (v) {
    return '<button type="button" class="scen-btn" data-scen="' + Common.esc(v.key) + '">'
      + (v.icon ? '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + Common.esc(v.icon) + '"/></svg>' : '') + Common.esc(v.name) + '<span class="scen-mod"> · 수정됨</span></button>';
  }).join('') + '<i class="scen-sep"></i><button type="button" class="scen-view" id="scenView">가중치 보기</button>');
  $('#scenView').on('click', function () { $('#toggleLeft').trigger('click'); });   // 왼쪽 패널 여닫기 (탭과 같은 함수 → aria · 위쪽 줄 맞춤까지 같이)
  $('#scenFold').attr('aria-expanded', String(!$('#scenBar').hasClass('folded')));
  $('#scenFold').on('click', function () { setFold(!$('#scenBar').hasClass('folded')); });
  $('#scenList').on('click', '.scen-btn', function () {
    if ($('#scenBar').hasClass('folded')) { setFold(false); return; }     // 접힌 상태에서 남은 버튼 = 펼치기
    var k = $(this).attr('data-scen');
    MapLayer.applyPreset(SCEN.filter(function (v) { return v.key === k; })[0]);
    setScen(k);
    runAnalysis(MapLayer.getCriteria());
  });

  /* 위쪽 두 줄이 만날 만큼 좁으면 차례로 줄인다 (2차 H) : top-n1 구 · 동 칸 92px → top-n2 검색창을 돋보기 버튼으로 → top-n3 분석 기준 줄을 접힌 모양으로 (저장된 접힘 상태는 그대로).
     패널이 움직이는 중에도 맞게 나오도록 화면 위치가 아니라 폭(패널 폭 변수 · 열림 상태)으로 계산한다 */
  function fitTop() {
    var $l = $('.map-layout'), bar = document.getElementById('scenBar'), top = document.querySelector('.map-top');
    if (!bar || !top) return;
    $l.removeClass('top-n1 top-n2 top-n3');
    var cs = getComputedStyle(document.documentElement);
    var lpW = parseFloat(cs.getPropertyValue('--lp-w')) || 300, rpW = parseFloat(cs.getPropertyValue('--rp-w')) || 400;
    var left = $l.hasClass('left-closed') ? 44 : 24 + lpW;                 // .scen-bar 의 left (열림 = --lp-right)
    var right = $(panelRight).hasClass('open') ? rpW + 12 : 44;            // .map-top 의 right
    var avail = $l.width() - left - right - 12;
    var need = function () { return bar.offsetWidth + top.offsetWidth; };
    if (need() > avail) { $l.addClass('top-n1');
      if (need() > avail) { $l.addClass('top-n2');
        if (need() > avail) $l.addClass('top-n3'); } }
    if (!$l.hasClass('top-n2')) $('.map-top .search').removeClass('open');
  }
  $(window).on('resize', fitTop);
  $('#toggleLeft').on('click', fitTop);                                    // MapLayer 의 여닫기 처리 뒤에 불린다
  $(document).on('mousemove', function () { if (document.body.classList.contains('dragging')) fitTop(); })   // 패널 폭을 끄는 동안
    .on('mouseup', function () { setTimeout(fitTop, 0); });
  $('.pn-grip').on('dblclick', function () { setTimeout(fitTop, 0); });
  setScen('base');

  /* ---------- 상단 : 구 · 동(법정동 → 행정동 2단계) · 검색 · 칩 ---------- */
  var esc = Common.esc;
  var DONGS = [];   // api/map/dongs.do : [{sggCd, emdNm, cnt, bbox, adms:[{admNm, cnt, bbox}]}]
  /* reopenEmd : 구가 바뀌어 목록을 다시 받은 뒤에도 그 법정동의 행정동 열을 열어 둔다 (복수 선택 중) */
  function loadDongs(reopenEmd) {
    MapApi.dongs({ gu: state.gu }).done(function (list) {
      DONGS = list; renderDongMenu();
      if (reopenEmd) { var $r = $('#dmEmd .dm-row').filter(function () { return $(this).attr('data-emd') === reopenEmd; }); if ($r.length) showAdm($r); }
    });
  }
  function dongOf(sggCd, emdNm) { return DONGS.filter(function (x) { return x.emdNm === emdNm && x.sggCd === sggCd; })[0]; }
  /* 행정동 키 = "법정동|행정동" (같은 이름의 행정동이 다른 법정동에 걸쳐도 구분) */
  function admKey(emd, adm) { return emd + '|' + adm; }
  function admOfKey(k) { return k.split('|')[1]; }
  function emdOfKey(k) { return k.split('|')[0]; }
  /* 버튼 글자 : 전체 동 / 구로동 / 구로동 · 구로2동 / 구로2동 외 2 */
  function dongLabel() {
    var n = state.adms.length;
    if (n === 1) return emdOfKey(state.adms[0]) + ' · ' + admOfKey(state.adms[0]);
    if (n > 1) return admOfKey(state.adms[0]) + ' 외 ' + (n - 1);
    return state.dong || '전체 동';
  }
  function emdHasSel(d) {
    if (d.sggCd !== state.gu) return false;
    if (d.emdNm === state.dong) return true;
    return state.adms.some(function (k) { return emdOfKey(k) === d.emdNm; });
  }
  function renderDongMenu() {
    var $e = $('#dmEmd').empty();
    $e.append('<div class="dm-row dm-all' + (!state.dong && !state.adms.length ? ' sel' : '') + '" data-sgg="" data-emd="">전체 동</div>');
    DONGS.forEach(function (d) {
      var g = guOf(d.sggCd);
      $e.append('<div class="dm-row' + (emdHasSel(d) ? ' sel' : '') + '" data-sgg="' + d.sggCd + '" data-emd="' + esc(d.emdNm) + '">'
        + '<span>' + esc(d.emdNm) + (!state.gu && g ? ' <small>' + esc(g.name) + '</small>' : '') + '</span>' + (d.adms.length ? '<i>›</i>' : '') + '</div>');
    });
    $('#dmAdm').hide();
    $('#dongBtn span').text(dongLabel());
  }
  /* 법정동 줄에 올리면 오른쪽에 그 행정동 목록 (여러 개 고를 수 있음). data-sgg 는 .data() 가 숫자로 바꾸므로 attr 로 읽는다 */
  function showAdm($row) {
    var d = dongOf($row.attr('data-sgg'), $row.attr('data-emd')), $a = $('#dmAdm').empty();
    $('#dmEmd .dm-row').removeClass('hover'); $row.addClass('hover');
    if (!d || !d.adms.length) { $a.hide(); return; }
    var sameGu = d.sggCd === state.gu;   // 법정동 하나 전체는 왼쪽 법정동 줄을 누르면 된다 ("○○동 전체" 줄은 없앰)
    d.adms.forEach(function (a) {
      var on = sameGu && state.adms.indexOf(admKey(d.emdNm, a.admNm)) >= 0;
      $a.append('<div class="dm-row dm-multi' + (on ? ' sel' : '') + '" data-sgg="' + d.sggCd + '" data-emd="' + esc(d.emdNm) + '" data-adm="' + esc(a.admNm) + '">'
        + esc(a.admNm) + '</div>');
    });
    $a.css('top', Math.max(0, $row.position().top)).show();
  }
  /* 고른 범위로 지도 이동 : 행정동 여러 개면 bbox 를 합친다 */
  function areaBox() {
    if (state.adms.length) {
      var box = null;
      state.adms.forEach(function (k) {
        var d = dongOf(state.gu, emdOfKey(k)), a = d && d.adms.filter(function (x) { return x.admNm === admOfKey(k); })[0];
        var b = a ? a.bbox : null;
        if (!b) return;
        box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b.slice();
      });
      return box;
    }
    var d = dongOf(state.gu, state.dong);
    return d ? d.bbox : null;
  }
  /* 범위가 바뀐 뒤 공통 : 지도 이동 · 메뉴 · 리스트 머리 · 현장 확인 · 결과 */
  function applyArea(guChanged, reopenEmd) {
    state.bbox = null;                                             // 동을 다시 고르면 재검색 범위는 풀린다
    $('#btnRefetch').removeClass('show');
    var box = areaBox();
    var nAdm = state.adms.length;
    /* 실제 경계 범위로 화면 맞춤 : 하나면 가운데로 정해진 줌 (map-config SEL_*), 행정동 여러 개면 전부 들어오게 */
    var pbox = window.DongBoundary && DongBoundary.bbox ? DongBoundary.bbox(state.gu, state.dong, state.adms.map(admOfKey)) : null;
    if (pbox && nAdm > 1) fitTo(pbox);
    else if (pbox) flyTo((pbox[1] + pbox[3]) / 2, (pbox[0] + pbox[2]) / 2, nAdm ? C.ZOOM.SEL_ADM : state.dong ? C.ZOOM.SEL_BJD : C.ZOOM.SEL_GU);
    else if (box) fitTo(box);
    else { var g = guOf(state.gu); flyTo(g ? g.lat : C.CENTER.lat, g ? g.lng : C.CENTER.lng, g ? C.ZOOM.GU : C.ZOOM.INIT); }
    if (guChanged) loadDongs(reopenEmd); else $('#dongBtn span').text(dongLabel());
    renderScope();
    loadAreaLabels();                                              // 동 집계 원 (구로동 위험 N곳)
    onLevelChanged();                                              // 표시 방식 · 범례 다시
    scheduleLoad();                                                // 행정동 조건이 바뀌었으니 묶음 · 핀 다시
    loadChecked();
    if (state.analyzed) MapResult.load(true);
  }
  function setGu(sggCd) {
    var changed = sggCd && sggCd !== state.gu;
    if (changed) { state.gu = sggCd; $('#selGu').val(sggCd); state.adms = []; }   // "전체 구" 에서 동을 고르면 그 구로
    return changed;
  }
  /* 법정동 하나 전체 (또는 전체 동) : 메뉴를 닫는다 */
  function selectDong(sggCd, emdNm) {
    var guChanged = setGu(sggCd);
    state.dong = emdNm || ''; state.adms = [];
    $('#dongDd').removeClass('open');
    if (!guChanged) renderDongMenu();
    applyArea(guChanged);
  }
  /* 행정동 하나 켜고 끄기 : 메뉴는 열어 둔 채로 여러 개 고른다 */
  function toggleAdm($row) {
    var guChanged = setGu($row.attr('data-sgg'));
    var k = admKey($row.attr('data-emd'), $row.attr('data-adm')), i = state.adms.indexOf(k);
    if (i >= 0) state.adms.splice(i, 1); else state.adms.push(k);
    state.dong = '';
    if (guChanged) { applyArea(true, $row.attr('data-emd')); return; }
    $row.toggleClass('sel', i < 0);
    $('#dmEmd .dm-row').each(function () {
      var $r = $(this), d = dongOf($r.attr('data-sgg'), $r.attr('data-emd'));
      $r.toggleClass('sel', d ? emdHasSel(d) : !state.adms.length);
    });
    applyArea(false);
  }
  $('#dongBtn').on('click', function (e) { e.stopPropagation(); $('#dongDd').toggleClass('open'); if ($('#dongDd').hasClass('open')) $('#dmAdm').hide(); });
  $('#dmEmd').on('mouseenter', '.dm-row', function () { showAdm($(this)); });
  $('#dmEmd').on('click', '.dm-row', function () { var $r = $(this); selectDong($r.attr('data-sgg'), $r.attr('data-emd')); });
  $('#dmAdm').on('click', '.dm-row', function (e) {
    e.stopPropagation();
    var $r = $(this);
    if ($r.attr('data-adm')) toggleAdm($r); else selectDong($r.attr('data-sgg'), $r.attr('data-emd'));
  });
  $(document).on('click', function (e) { if (!$(e.target).closest('#dongDd').length) $('#dongDd').removeClass('open'); });

  $('#selGu').on('change', function () {
    state.gu = this.value; state.dong = ''; state.adms = []; state.bbox = null;
    $('#btnRefetch').removeClass('show');
    loadDongs();
    var g = guOf(state.gu);
    var pbox = window.DongBoundary && DongBoundary.bbox ? DongBoundary.bbox(state.gu, '', '') : null;   // 구 경계 범위로 화면 맞춤
    if (pbox) flyTo((pbox[1] + pbox[3]) / 2, (pbox[0] + pbox[2]) / 2, C.ZOOM.SEL_GU);
    else flyTo(g ? g.lat : C.CENTER.lat, g ? g.lng : C.CENTER.lng, g ? C.ZOOM.GU : C.ZOOM.INIT);
    renderScope();
    loadAreaLabels();
    onLevelChanged();
    scheduleLoad();
    loadChecked();
    if (state.analyzed) MapResult.load(true);
  });
  function search() {
    state.q = $.trim($('#searchQ').val());
    if (!state.analyzed) { runAnalysis(MapLayer.getCriteria()); return; }
    renderScope();                                    // 검색 중에는 범위가 화면 → 구 · 동 으로 바뀐다
    MapResult.load(true);
  }
  $('#btnSearch').on('click', function () {
    var $s = $('.map-top .search');
    if ($('.map-layout').hasClass('top-n2') && !$s.hasClass('open')) { $s.addClass('open'); $('#searchQ').trigger('focus'); return; }   // 돋보기로 접혀 있으면 먼저 펼친다 (2차 H)
    search();
  });
  $('#searchQ').on('blur', function () {              // 비운 채로 벗어나면 다시 돋보기로
    var el = this;
    setTimeout(function () { if (!el.value && document.activeElement !== el) $('.map-top .search').removeClass('open'); }, 200);
  });
  $('#searchQ').on('keydown', function (e) { if (e.key === 'Enter') search(); });
  /* 검색창 [×] : 지우고, 검색한 상태였으면 검색어 없이 다시 */
  $('#searchQ').on('input', function () { $('#searchClear').prop('hidden', this.value === ''); });
  $('#searchClear').on('click', function () {
    $('#searchQ').val('').trigger('focus');
    $(this).prop('hidden', true);
    if (state.q) { state.q = ''; renderScope(); if (state.analyzed) MapResult.load(true); }
  });

  function setChips() { /* 상단 칩은 없앴다 (대시보드로) */ }

  /* ---------- 줌 단계 : + / 세로 눈금 슬라이더 / − (2026-11-17) ----------
     눈금 = 줌 한 단계 (MIN~MAX, 구청 계정은 LOCK_MIN 부터). 아래부터 현재 단계까지 채우고, 손잡이 옆에 숫자 */
  var Z_MIN = lockGu ? C.ZOOM.LOCK_MIN : C.ZOOM.MIN, Z_MAX = C.ZOOM.MAX, Z_PAD = 10;
  var $zs = $('#zoomSlider');
  var zsY = function (z) { return Z_PAD + (z - Z_MIN) / (Z_MAX - Z_MIN) * ($zs.height() - Z_PAD * 2); };   // 아래에서부터 px
  for (var zt = Z_MIN; zt <= Z_MAX; zt++) $zs.append($('<i class="zs-tick"></i>').css('bottom', zsY(zt) + 'px'));
  $zs.append($('#zsThumb, #zsNum'));                    // 눈금보다 위에 그려지게 맨 뒤로
  function renderZoom() {
    var z = Math.max(Z_MIN, Math.min(Z_MAX, Math.round(zoomNow()))), y = zsY(z);
    $('#zsFill').css('height', (y - Z_PAD) + 'px');
    $('#zsThumb, #zsNum').css('bottom', y + 'px');
    $('#zsNum').text(z);
  }
  function setZoomTo(z) {
    z = Math.max(Z_MIN, Math.min(Z_MAX, z));
    if (live() && z !== map.getZoom()) map.setZoom(z, true);
  }
  /* 트랙을 누르거나 손잡이를 끌면 그 높이의 단계로 */
  function zoomAtY(clientY) {
    var r = $zs[0].getBoundingClientRect(), h = r.height - Z_PAD * 2;
    var t = Math.max(0, Math.min(1, (r.bottom - Z_PAD - clientY) / h));
    setZoomTo(Math.round(Z_MIN + t * (Z_MAX - Z_MIN)));
  }
  $zs.on('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    zoomAtY(e.clientY);
    $(document).on('mousemove.zs', function (ev) { zoomAtY(ev.clientY); })
      .on('mouseup.zs', function () { $(document).off('.zs'); });
  });
  $('#zoomIn').on('click', function () { if (live()) setZoomTo(map.getZoom() + 1); });
  $('#zoomOut').on('click', function () { if (live()) setZoomTo(map.getZoom() - 1); });
  if (live()) naver.maps.Event.addListener(map, 'zoom_changed', renderZoom);   // 휠 · 더블클릭 · 프로그램 이동 모두 반영
  renderZoom();

  /* ---------- 지도 유형 : 일반 / 위성(HYBRID = 항공사진 + 도로명 · 지명), 로드뷰는 따로 켜고 끄는 토글 (2026-11-17) ---------- */
  var mapType = 'normal';
  /* 구청 계정 가림막 색 : 타일이 반전되는 경우(다크 테마 + 일반 지도)에만 반전색을 넣어야 화면에 어둡게 보인다. 라이트 테마나 위성은 반전이 없으니 그대로 어두운 색 */
  function maskColor() { return (mapType !== 'sat' && Common.theme() !== 'light') ? '#f4f2ed' : '#0b0d12'; }
  /* 테마가 바뀌면 (헤더 버튼 → common.js 'wf:theme') : JS 로 색을 넣은 것만 다시. 지도 유형은 그대로 둔다 (테마와 지도 유형은 서로 건드리지 않는다) */
  $(document).on('wf:theme', function () {
    if (lock.mask) lock.mask.setOptions({ fillColor: maskColor() });
    loadGus();                                        // 구 색칠 (라이트는 한 단계 진하게)
  });
  try { if (localStorage.getItem('itgeo.mapType') === 'sat') mapType = 'sat'; } catch (e) {}
  function applyMapType() {
    var sat = mapType === 'sat';
    if (live()) map.setMapTypeId(sat ? naver.maps.MapTypeId.HYBRID : naver.maps.MapTypeId.NORMAL);
    /* 타일 다크 필터(반전)는 일반 지도에만. 위성은 원래 색 (map.css .map-sat).
       이 두 클래스는 지도 타일 · 마커의 색 반전에만 쓴다. 화면 테마(라이트/다크)는 지도 유형과 무관 : 위성으로 바꿔도, 일반으로 돌아와도
       data-theme · 테마 저장값 · 패널/헤더 색은 건드리지 않는다 (2차 L. 테마는 헤더 버튼으로만 바뀌게 될 예정) */
    $('.map-layout').toggleClass('map-sat', sat).toggleClass('map-normal', !sat);
    $('#mapType button[data-type="normal"]').toggleClass('on', !sat);
    $('#mapType button[data-type="sat"]').toggleClass('on', sat);
    /* 구청 계정 가림막 : 일반은 반전돼 보이므로 반전색, 위성은 그대로 어두운 색 */
    if (lock.mask) lock.mask.setOptions({ fillColor: maskColor() });
  }
  $('#mapType').on('click', 'button[data-type="normal"], button[data-type="sat"]', function () {
    mapType = $(this).attr('data-type');
    try { localStorage.setItem('itgeo.mapType', mapType); } catch (e) {}
    applyMapType();
  });
  applyMapType();

  /* 로드뷰 : 켜면 파란 도로선(StreetLayer), 지도를 누르면 그 위치의 파노라마를 지도 영역 위에. 네이버 스크립트의 submodules=panorama 필요 */
  /* markAt = 건물 마커를 누른 시각, sameT = 같은 촬영 지점일 때 핀 · 시선을 바로 맞추는 예약 (리뷰 6) */
  /* me = 지도 위 "지금 보는 곳" 표시 (위치 · 방향) */
  var street = { on: false, layer: null, pano: null, click: null, mark: null, target: null, aim: false, markAt: 0, sameT: null, me: null };
  var hasPano = function () { return live() && !!naver.maps.StreetLayer && !!naver.maps.Panorama; };
  function closePano() {
    $('#panoWrap').removeClass('open'); $('.map-layout').removeClass('pano-split'); clearPanoMark();
    resize();                                         // 지도를 다시 전체 폭으로
    if (street.me) street.me.setMap(null);
  }

  /* ---- 비율 보기 (왼쪽 로드뷰 + 오른쪽 지도) ----
     로드뷰 + 지도 폭(오른쪽 패널을 뺀 폭)을 100 으로 보고 로드뷰 비율 panoPct(20~80)를 손잡이로 정한다. 저장 itgeo.panoPct, 크게 보기 상태는 itgeo.panoFull.
     지도(#map)도 남은 폭으로 실제로 줄어든다 (CSS .pano-split #map) → 바뀔 때마다 네이버 지도에 resize 를 알린다 */
  var PANO_PCT_MIN = 20, PANO_PCT_MAX = 80, PANO_PCT_DEF = 50;
  /* 자석 : 경계선이 3:7 · 5:5 · 7:3 자리 ±PANO_SNAP_PX 안에 들어오면 그 비율에 딱 붙고, 붙은 뒤에는 ±PANO_RELEASE_PX 밖으로 끌어야 떨어진다 (붙는 거리 < 떨어지는 거리 = 걸리는 느낌) */
  var PANO_SNAPS = [30, 50, 70], PANO_SNAP_PX = 24, PANO_RELEASE_PX = 48;
  var panoFull = false, panoPct = PANO_PCT_DEF;
  try {
    panoFull = localStorage.getItem('itgeo.panoFull') === '1';
    panoPct = Number(localStorage.getItem('itgeo.panoPct')) || PANO_PCT_DEF;
  } catch (e) {}
  var rpWidth = function () { return $(panelRight).hasClass('open') ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rp-w')) || 400) : 0; };
  var panoRoom = function () { return $map.closest('.map-wrap').width() - rpWidth(); };   // 로드뷰 + 지도 = 100
  /* 비율 → 로드뷰 폭(px). 지도 크기가 바뀌므로 네이버 지도에도 알린다 */
  function setPanoPct(pct) {
    panoPct = Math.max(PANO_PCT_MIN, Math.min(PANO_PCT_MAX, Math.round(pct)));
    document.documentElement.style.setProperty('--pano-w', Math.round(panoRoom() * panoPct / 100) + 'px');
    $('#panoRatio').text('로드뷰 ' + panoPct + ' : ' + (100 - panoPct) + ' 지도');
    state.quietUntil = Date.now() + 2500;             // 폭만 바뀐 것이라 [이 지역에서 재검색] 은 띄우지 않는다
    resize();
    return panoPct;
  }
  function applyPanoW() { setPanoPct(panoPct); }   // 창 · 오른쪽 패널 크기가 바뀌면 같은 비율로 다시
  function setPanoFull(full) {
    panoFull = full;
    try { localStorage.setItem('itgeo.panoFull', full ? '1' : '0'); } catch (e) {}
    $('#panoWrap').toggleClass('split', !full);
    $('.map-layout').toggleClass('pano-split', !full && $('#panoWrap').hasClass('open'));
    $('#panoSize').text(full ? '지도와 같이 보기' : '크게 보기');
    if (!full) applyPanoW(); else resize();
    fitPano();
    if (!full && street.pano) panIntoView(street.pano.getPosition());
  }
  /* 로드뷰 위치가 지도에서 안 보이면(가장자리 · 오른쪽 패널 뒤) 지도를 옮겨 보이는 칸 가운데로. 지도 중심 기준 픽셀 차이로 계산해 새 중심으로 panTo */
  function panIntoView(coord) {
    if (!live() || panoFull || !coord || !$('#panoWrap').hasClass('open')) return;
    var proj = map.getProjection(), a = proj.fromCoordToOffset(coord), c = proj.fromCoordToOffset(map.getCenter());
    var w = $map.width(), h = $map.height(), x = w / 2 + (a.x - c.x), y = h / 2 + (a.y - c.y);
    var l = 12, r = w - rpWidth() - 12, t = 60, b = h - 12;    // #map 안에서 보이는 칸 (오른쪽 패널 · 분석 기준 줄 제외)
    if (x > l + 40 && x < r - 40 && y > t + 30 && y < b - 30) return;
    var dx = x - (l + r) / 2, dy = (y > t + 30 && y < b - 30) ? 0 : y - (t + b) / 2;
    state.quietUntil = Date.now() + 2500;
    map.panTo(proj.fromOffsetToCoord(new naver.maps.Point(c.x + dx, c.y + dy)));
  }
  /* 지도 위 "지금 보는 곳" : 위치는 촬영 지점이 바뀔 때, 방향은 시선(pan)이 바뀔 때 따라간다 */
  function updateMe() {
    if (!live() || !street.pano) return;
    var pos = street.pano.getPosition();
    if (!pos) return;
    if (!street.me) {
      street.me = new naver.maps.Marker({ position: pos, zIndex: 1000, clickable: false,
        icon: { content: '<div class="pano-me mk-inv"><svg id="panoMeDir" viewBox="0 0 60 60" width="60" height="60" aria-hidden="true"><path d="M30 30 18 4a28 28 0 0 1 24 0z"/></svg><b></b></div>', anchor: new naver.maps.Point(30, 30) } });
    }
    street.me.setPosition(pos);
    if (!street.me.getMap()) street.me.setMap(map);
    var dir = document.getElementById('panoMeDir'), pov = street.pano.getPov();
    if (dir && pov) dir.style.transform = 'rotate(' + pov.pan + 'deg)';
  }
  $('#panoSize').on('click', function () { setPanoFull(!panoFull); });
  /* 손잡이 끌기 : 마우스 위치 = 경계선. 로드뷰가 커지면 지도가 그만큼 줄어든다 (같이 조정). 다 끌면 비율 저장, 두 번 누르면 50:50
     자유 드래그 + 자석 : 3:7 · 5:5 · 7:3 근처(±PANO_SNAP_PX)에서는 그 비율에 붙고(.snap = 점선 + 비율 표시 강조), 더 끌면 다시 마우스를 따라간다 */
  $('#panoGrip').on('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    var left = $map.closest('.map-wrap').offset().left, room = panoRoom(), $g = $(this).addClass('drag'), cur = null;
    $('body').addClass('resizing dragging');
    /* 끄는 동안만 3:7 · 5:5 · 7:3 자리에 흐린 안내선 */
    var $guides = $('#panoGuides').empty().addClass('show');
    PANO_SNAPS.forEach(function (p) { $guides.append($('<i>').attr('data-p', p).css('left', Math.round(room * p / 100) + 'px')); });
    $(document).on('mousemove.pano', function (ev) {
      var px = ev.clientX - left, snap = null;
      if (cur != null && Math.abs(px - room * cur / 100) <= PANO_RELEASE_PX) snap = cur;    // 붙어 있으면 더 멀리 끌어야 떨어진다
      else PANO_SNAPS.forEach(function (p) { if (snap == null && Math.abs(px - room * p / 100) <= PANO_SNAP_PX) snap = p; });
      if (snap !== cur && snap != null) {                // 새로 붙은 순간 : 손잡이가 톡 튀고 안내선이 진해진다
        $g.removeClass('pop'); void $g[0].offsetWidth; $g.addClass('pop');
      }
      cur = snap;
      $g.toggleClass('snap', snap != null);
      $guides.children().each(function () { $(this).toggleClass('on', Number($(this).attr('data-p')) === snap); });
      setPanoPct(snap != null ? snap : px / room * 100);
      fitPano();
    })
      .on('mouseup.pano', function () {
        $(document).off('.pano');
        $g.removeClass('drag snap pop');
        $guides.removeClass('show').empty();
        $('body').removeClass('resizing dragging');
        try { localStorage.setItem('itgeo.panoPct', String(panoPct)); } catch (err) {}
        fitPano();
        if (street.pano) panIntoView(street.pano.getPosition());
      });
  }).on('dblclick', function () {
    try { localStorage.removeItem('itgeo.panoPct'); } catch (err) {}
    setPanoPct(PANO_PCT_DEF); fitPano();
  });

  /* 건물 마커로 로드뷰에 들어왔을 때만 : 사진 속 그 건물 위치에 핀 1개 + 이름 (2차 O). 도로를 눌러 들어오면 핀 없음, 주변 다른 건물도 안 띄운다.
     네이버 공식 예제 "Panorama image marker" 방식 그대로 : 이미지 아이콘 Marker 를 setMap(pano), 시선은 pano.getProjection().fromCoordToPov(좌표).
     핀 모양 = 메인 컬러 물방울 + 아래 흰 이름표 (예제가 이미지 아이콘만 쓰므로 SVG 를 이미지 주소로 만들어 넣는다). 높이 옵션은 문서에 없어 기본값 */
  function panoIcon(name) {
    var t = String(name || '').replace(/[<>&"']/g, ' ');
    var pc = $.trim(getComputedStyle(document.documentElement).getPropertyValue('--primary')) || '#448ede';   // 지금 테마의 메인 컬러
    var w = Math.max(64, Math.min(260, 20 + t.length * 12)), cx = w / 2;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="68" viewBox="0 0 ' + w + ' 68">'
      + '<path d="M' + cx + ' 40c-7-9-12-14-12-21a12 12 0 0 1 24 0c0 7-5 12-12 21z" fill="' + pc + '" stroke="#fff" stroke-width="2"/>'
      + '<circle cx="' + cx + '" cy="19" r="4.5" fill="#fff"/>'
      + '<rect x="1" y="44" width="' + (w - 2) + '" height="22" rx="2" fill="#fff" stroke="' + pc + '"/>'
      + '<text x="' + cx + '" y="59.5" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#1b1b1e">' + t + '</text></svg>';
    return { url: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), size: new naver.maps.Size(w, 68), anchor: new naver.maps.Point(cx, 40) };
  }
  function clearPanoMark() {
    if (street.mark) { street.mark.setMap(null); street.mark = null; }
    clearTimeout(street.sameT);
    street.target = null; street.aim = false;
    $('#panoTarget').removeClass('show');
  }
  /* 파노라마가 촬영 지점에 붙은 뒤 : 건물 핀을 올리고 시선을 그 건물 쪽으로 (좌우만. 상하 각도는 PANO_TILT 유지). 화살표로 걸어서 옮길 때는 다시 돌리지 않는다 */
  function placePanoMark() {
    var t = street.target;
    if (!t || !street.pano) return;
    var pos = LL(t.lat, t.lng), name = t.bldNm ? Common.shortAddr(t.addr) + ' ' + t.bldNm : Common.shortAddr(t.addr) + (t.useNm ? ' ' + t.useNm : '');
    if (!street.mark) {
      street.mark = new naver.maps.Marker({ position: pos, icon: panoIcon(name) });
      naver.maps.Event.addListener(street.mark, 'click', function () { if (street.target) selectBuilding(street.target, false); });   // 핀을 누르면 그 건물 상세
    }
    street.mark.setMap(street.pano);
    $('#panoTarget').text(name).addClass('show');
    if (street.aim) {
      street.aim = false;
      var proj = street.pano.getProjection(), look = proj && proj.fromCoordToPov(pos);
      if (look) street.pano.setPov({ pan: look.pan, tilt: PANO_TILT, fov: street.pano.getPov().fov });
    }
  }
  /* 이동 화살표는 네이버가 바닥(도로) 위에 그려서 CSS 로는 못 옮긴다 (2차 지시문 F) →
     ① 파노라마를 실제로 보이는 영역(오른쪽 패널을 뺀 곳)에 정확히 맞추고  ② 시선을 조금 아래로 둬서 화살표가 화면 가운데 쪽으로 올라오게 한다.
     옵션 · 메서드는 네이버 지도 v3 Panorama 문서에 있는 것만 : pov { pan, tilt(-90 아래 ~ 90 위), fov(20~100) } · setPov · getPov · setSize · setPosition */
  var PANO_TILT = -18;
  /* 파노라마 크기 = #pano 의 지금 크기. 문서에 자동 리사이즈가 없어서 영역이 바뀔 때마다(창 크기 · 오른쪽 패널 여닫기 · 폭 조절) 직접 맞춘다 */
  function fitPano() {
    if (!$('#panoWrap').hasClass('open')) return;
    if (!panoFull && !$('body').hasClass('dragging')) applyPanoW();   // 창 · 패널 크기가 바뀌었으면 같은 비율로 다시 맞춘다
    if (!street.pano) return;
    var el = document.getElementById('panoWrap');       // #pano 는 네이버가 처음 크기를 박아 넣으므로 창(#panoWrap) 크기로 잰다
    if (el.clientWidth && el.clientHeight) street.pano.setSize(new naver.maps.Size(el.clientWidth, el.clientHeight));
  }
  /* target = 건물 마커로 들어온 경우의 그 건물 (bldId · lat · lng · addr …). 도로를 눌렀으면 없음 → 있던 핀은 지운다 */
  function openPano(coord, target) {
    if (!panoFull) applyPanoW();
    $('#panoWrap').addClass('open').toggleClass('split', !panoFull);   // 먼저 보이게 해야 크기가 잡힌다
    $('.map-layout').toggleClass('pano-split', !panoFull);
    $('#panoSize').text(panoFull ? '지도와 같이 보기' : '크게 보기');
    clearPanoMark();
    if (target) { street.target = target; street.aim = true; }
    if (!street.pano) {
      street.pano = new naver.maps.Panorama('pano', { position: coord, pov: { pan: 0, tilt: PANO_TILT, fov: 100 } });
      naver.maps.Event.addListener(street.pano, 'init', placePanoMark);            // 처음 만들 때 (공식 예제와 같은 시점)
      naver.maps.Event.addListener(street.pano, 'pano_changed', function () { clearTimeout(street.sameT); placePanoMark(); updateMe(); panIntoView(street.pano.getPosition()); });    // 위치를 옮긴 뒤 (지도 표시도 따라간다)
      naver.maps.Event.addListener(street.pano, 'pov_changed', updateMe);          // 둘러보면 지도의 방향 부채꼴도 돈다
      naver.maps.Event.addListener(street.pano, 'init', updateMe);
      naver.maps.Event.addListener(street.pano, 'pano_status', function (status) {
        if (status === 'ERROR') { closePano(); Common.toast('이 위치에는 로드뷰가 없습니다. 파란 도로선 위를 눌러 주세요.'); }
      });
    } else {
      fitPano();
      street.pano.setPosition(coord);
      var pov = street.pano.getPov();                   // 보던 방향은 그대로, 상하 각도만 다시 아래로
      street.pano.setPov({ pan: pov.pan, tilt: PANO_TILT, fov: pov.fov });
      /* 옆 건물이 지금 보는 촬영 지점을 그대로 쓰면 pano_changed 가 오지 않을 수 있다 (리뷰 6) → 0.5초 안에 안 오면 여기서 바로 핀 · 시선을 맞춘다.
         street.aim 이 아직 켜져 있다 = 이 건물로 placePanoMark 가 아직 안 돌았다. 맞춘 뒤에는 aim 이 꺼지므로 다음 화살표 이동 때 시야가 튀지 않는다 */
      if (target) street.sameT = setTimeout(function () { if (street.target === target && street.aim) placePanoMark(); }, 500);
    }
    panIntoView(coord);                                 // 누른 곳이 로드뷰 창 뒤로 숨지 않게
    updateMe();                                         // 닫았다 다시 열 때 지도 표시를 다시 올린다 (위치는 pano_changed 때 맞춰짐)
  }
  $(window).on('resize', fitPano);
  /* 오른쪽 패널 폭을 끄는 동안 · 여닫는 애니메이션(.26s)이 끝난 뒤에도 맞춘다 */
  $(document).on('mouseup', function () { setTimeout(fitPano, 0); });
  $('#panelRight').on('transitionend', fitPano);
  function setStreet(on) {
    if (on && !hasPano()) { Common.toast('로드뷰를 불러오지 못했습니다.'); return; }
    street.on = on;
    $('#btnStreet').toggleClass('on', on).attr('aria-pressed', String(on));
    $map.closest('.map-wrap').toggleClass('street-on', on);
    if (!live()) return;
    if (on) {
      if (!street.layer) street.layer = new naver.maps.StreetLayer();
      street.layer.setMap(map);
      /* 건물 마커를 누르면 지도 click 도 같이 온다 → 그 click 으로 다시 열면 방금 정한 건물(핀 · 이름표 · 시선)이 지워지므로 마커 직후의 click 은 넘긴다 */
      street.click = naver.maps.Event.addListener(map, 'click', function (e) { if (Date.now() - street.markAt < 400) return; openPano(e.coord); });
      Common.toast('파란 도로선 위를 누르면 로드뷰가 열립니다.');
    } else {
      if (street.layer) street.layer.setMap(null);
      if (street.click) { naver.maps.Event.removeListener(street.click); street.click = null; }
      closePano();
    }
  }
  $('#btnStreet').on('click', function () { setStreet(!street.on); });
  $('#panoClose').on('click', closePano);
  $(document).on('keydown', function (e) { if (e.key === 'Escape') closePano(); });

  /* ---------- 시작 : 동 목록 + 구 경계(기본 기준) + 현장 확인됨 핀 ---------- */
  loadDongs();
  renderScope();
  renderLegend(modeOf(zoomNow()));
  loadGus();
  loadChecked();
  /* 05 [지도에서 보기] (map.do?bldId=) : 그 건물로 가서 상세 패널을 연다. 구청 계정이 남의 구 건물을 열려 하면 서버가 bldId 를 비우고 안내만 (15단계 A-2) */
  /* 데이터 업데이트 모달이 닫힐 때 (DB 가 바뀐 경우) : 현재 조건으로 지도 · 결과를 다시. 분석 전이면 구 요약 · 현장 확인만 (dataupdate-modal.js) */
  window.WF_MAP_RELOAD = function () {
    state.cellByLevel = {};
    loadGus(); loadPoints(); loadChecked();
    if (state.analyzed) MapResult.load(true);
  };
  /* map.do?changed=up (데이터 업데이트 완료 → [새로 위험해진 N동 지도에서 보기]) : 오른쪽 결과 패널을 연다.
     그 건물들만 추리는 것은 배치 서버가 report.diff(upBldIds)를 주면 서버 쪽에 연결한다. 지금은 현재 조건의 결과 그대로 */
  if (window.OPEN_CHANGED === 'up') {
    runAnalysis(MapLayer.getCriteria());
    Common.toast('새로 위험해진 건물만 추리는 기능은 배치 서버 연동 뒤 적용됩니다. 지금은 전체 결과입니다.');
  }
  if (window.OPEN_MSG) Common.toast(window.OPEN_MSG);
  if (window.OPEN_BLD) {
    MapApi.building($.extend({}, criteria(), { bldId: window.OPEN_BLD })).done(function (d) {
      if (d && d.building) selectBuilding(d.building, true);
      else Common.toast('건물을 찾을 수 없습니다.');
    });
  }
});
