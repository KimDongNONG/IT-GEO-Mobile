/*
 * 오른쪽 "건물 상세 정보" 패널 (include/building-panel.jspf, Figma 02-2)
 *  - 점수 구성 · 건축물대장 · 시설까지의 거리(가까운 시설) · 거주 취약 가구(집계) · 메모 · 보관함 저장
 *  - [개인 정보 보기] → 취약 가구 정보 모달 (Figma 02-2-1) : 순위·가점(툴팁 = 내역) · 성만 보이는 세대주 · 층수 · 연령대 · 가구 구성 · 취약 유형 · 복지 연계
 *      순서는 서버(mapper-resident getResidentList)가 정한 "가장 취약한 순" 그대로. 여기서 다시 정렬하지 않는다 (12단계)
 *  - [보관함에 저장] (13단계) : 안 담김 "보관함에 저장" / 담겼고 조사 전 "보관함에 저장됨"(누르면 안내 + 보관함에서 보기) / 조사 이력 있음 "다시 저장 (점수 갱신)"
 */
window.MapPanel = (function () {
  var esc = Common.esc;
  var getCriteria = null, onArchived = null;
  var current = null;        // BuildingDetailTO

  /* 묶음 한 줄 (피그마 02-2) : "주거 공간 (반지하 · 옥탑)" · 막대 · "+45". 막대 = 받은 점수 ÷ 가장 큰 묶음 가중치 */
  /* 2차(11-17 K) 펼침형 : [꺾쇠] 묶음 이름 · 요약 · 막대 · +점수. 묶음 줄을 누르면 아래에 요인별 표 (요인 | 이 건물 | 기준 | 충족).
     서버가 factors 를 주지 않으면(옛 응답 등) 예전처럼 desc 를 괄호로 붙인 한 줄로 그린다 */
  var CHEV = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function scoreRow(it, maxW, open) {
    var w = maxW ? Math.round(Math.min(it.points, maxW) / maxW * 100) : 0;
    if (it.factors && it.factors.length) {
      var rows = it.factors.map(function (f) {
        var cls = !f.on ? 'off' : f.hit ? '' : 'miss';
        return '<tr class="' + cls + '"><td>' + esc(f.name) + '</td><td>' + esc(f.value) + '</td><td>' + esc(f.criterion) + '</td>'
          + '<td class="c">' + (!f.on ? '제외' : f.hit ? CHECK : '–') + '</td></tr>';
      }).join('');
      return '<div class="sc-item' + (open ? ' open' : '') + (it.hit ? '' : ' miss') + '">'
        + '<button type="button" class="sc-head" aria-expanded="' + !!open + '" title="가중치 ' + it.weight + '">' + CHEV
        + '<span class="sc-label">' + esc(it.label) + '</span><span class="sc-sum">' + esc(it.summary || '') + '</span>'
        + '<span class="sc-bar"><i style="width:' + w + '%"></i></span>'
        + '<b class="sc-pt">' + (it.hit ? '+' + it.points : (it.weight ? '0' : '-')) + '</b></button>'
        + '<table class="sc-detail"><thead><tr><th>요인</th><th>이 건물</th><th>기준</th><th class="c">충족</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    return '<div class="sc-row' + (it.hit ? '' : ' miss') + '" title="가중치 ' + it.weight + ' · ' + esc(it.desc) + '">'
      + '<span class="sc-label">' + esc(it.label) + ' <small>(' + esc(it.desc) + ')</small></span>'
      + '<span class="sc-bar"><i style="width:' + w + '%"></i></span>'
      + '<b class="sc-pt">' + (it.hit ? '+' + it.points : (it.weight ? '0' : '-')) + '</b></div>';
  }

  function infoRow(k, v) { return '<tr><th>' + esc(k) + '</th><td>' + esc(v == null || v === '' ? '-' : v) + '</td></tr>'; }

  function distText(m) { return m == null ? '-' : m >= 1000 ? (m / 1000).toFixed(1) + 'km' : Math.round(m) + 'm'; }
  function welfRow(k, nm, dist) {
    return '<div class="welf-row"><span class="welf-k">' + esc(k) + '</span><span class="welf-nm">' + esc(nm || '-') + '</span><b class="welf-d">' + distText(dist) + '</b></div>';
  }

  function titleOf(b) {
    return b.bldNm ? Common.shortAddr(b.addr) + ' ' + b.bldNm : Common.shortAddr(b.addr) + (b.useNm ? ' ' + b.useNm : '');
  }

  /* 아래 [조사 이력 보기] : 현장 방문 기록이 있으면 05 건물 확인 이력으로 가는 링크, 없으면 막아 둔다 */
  function setHistory(href) {
    var $h = $('#dHistory').toggleClass('disabled', !href).attr('aria-disabled', String(!href)).attr('title', href ? '' : '아직 현장 조사 기록이 없습니다');
    if (href) $h.attr('href', href); else $h.removeAttr('href');
  }

  function renderInfo(d) {
    var b = d.building;
    $('#dTitle').text(titleOf(b));
    $('#dAddr').text(b.addr);
    $('#dScore').text(b.score + '점');
    $('#dChecked').toggle(!!b.checkedAt).text('현장 확인됨 ' + (b.checkedAt || '').slice(5));
    /* 조사 이력 보기 : 현장 방문 기록이 있을 때만 */
    setHistory(b.visitCnt > 0 ? Common.url('archivedetail.do?bldId=' + encodeURIComponent(String(b.bldId))) : null);
    var maxW = d.scoreItems.reduce(function (m, it) { return Math.max(m, it.weight || 0); }, 0);
    /* 처음에는 모두 접어 둔다. 묶음 줄을 눌러야 요인별 표가 펼쳐진다 */
    $('#dScoreItems').html(d.scoreItems.map(function (it) { return scoreRow(it, maxW, false); }).join(''));
    $('#dScoreTotal').html('합계 <b>' + b.score + '</b>점');

    var floors = (b.grndFlr != null ? '지상 ' + b.grndFlr + '층' : '') + (b.ugrndFlr ? ' / 지하 ' + b.ugrndFlr + '층' : '');
    if (b.ugrndUnits > 0) floors += (floors ? ' · ' : '') + '지하 전유 ' + b.ugrndUnits + '호';   // 공동주택 전유부 기준 (점수와 무관)
    var use = (b.useNm || '미상') + (b.strctNm ? ' (' + b.strctNm + ')' : '');                      // 구조는 용도 뒤 괄호로
    var apr = b.useaprDay && b.useaprDay.length === 8 ? b.useaprDay.slice(0, 4) + '.' + b.useaprDay.slice(4, 6) + '.' + b.useaprDay.slice(6) + (b.bldAge != null ? ' (' + b.bldAge + '년)' : '') : '자료 없음';
    /* 건축물대장에 있는 값만 */
    $('#dInfo').html(
      infoRow('주용도', use) + infoRow('층수', floors || '-') + infoRow('사용승인', apr)
      + infoRow('위반건축물', b.violYn === '1' ? '해당' : b.violYn === '0' ? '없음' : '대장 미연계')
      + infoRow('세대수', b.units != null ? b.units + '세대' : '-')
    );
    /* 시설까지의 거리 : 가장 가까운 시설까지 거리 */
    $('#dWelf').html(welfRow('복지시설', b.welfNm, b.welfDist) + welfRow('병원', b.hospNm, b.hospDist) + welfRow('정류장', b.busNm, b.busDist));

    /* 거주 취약 가구 (02-2) : 세대 수 + 많은 유형 3개 */
    var rc = d.residents || {};
    /* 한 줄 (2026-11-17) : "취약 가구 3세대 · 75세 이상 2 · 심한 장애 1 · …" 넘치면 … 로 줄고, 전체 문장은 title 로 */
    var types = rc.vulnLine || rc.vulnTypes || (rc.hhCnt ? '취약 유형 없음' : '거주 가구 자료 없음');
    $('#dVulnCnt').text('취약 가구 ' + (rc.vulnHh || 0) + '세대');
    $('#dVulnTypes').text(' · ' + types);
    $('#dVulnLine').attr('title', '취약 가구 ' + (rc.vulnHh || 0) + '세대 · ' + types + (rc.hhCnt ? ' (전체 ' + rc.hhCnt + '가구 ' + rc.mbrCnt + '명)' : ''));
    $('#btnResidents').prop('disabled', !rc.hhCnt);
    $('#dMemo').val('');
    $('#btnArchive').prop('disabled', false).text(archiveLabel(b));
  }
  /* 저장 버튼 문구 (13단계) : building.do 의 archiveCnt(내 보관함) · visitCnt(방문 기록) 로 */
  function archiveLabel(b) {
    if (!(b.archiveCnt > 0)) return '보관함에 저장';
    return b.visitCnt > 0 ? '다시 저장 (점수 갱신)' : '보관함에 저장됨';
  }

  /* ---------- 취약 가구 정보 모달 (02-2-1) ---------- */
  function ageBand(age) { return age == null ? '-' : age < 10 ? '10세 미만' : (Math.floor(age / 10) * 10) + '대'; }
  function household(r) {
    var t = r.hhType || '';
    if (t === '1인') return '1인 가구';
    return t + (r.hhMbrCnt ? ' · ' + r.hhMbrCnt + '인' : '');
  }
  /* 복지 연계 = 원본 값 그대로 (5-1). 임의 규칙("상담 필요" 등) 없음
   *  - 가구원 중 지원연계(support_type: 공적급여 / 민간자원 / 기타서비스)가 있으면 "{값} 연계"
   *  - 없고 처리결과(detect_result: 조치완료 / 단순상담 / 미처리 / 요청접수 / 미지원 …)가 있으면 그 값
   *  - 둘 다 없으면 "이력 없음" */
  function welfare(r) {
    if (r.supportType) return { c: 'ok', t: r.supportType + ' 연계' };
    if (r.detectResult) return { c: 'blue', t: r.detectResult };
    return { c: 'none', t: '이력 없음' };
  }
  /* 한 줄 = 한 가구. 맨 앞 = 순위(서버 순서의 몇 번째) + 가점, 가점에 올리면 내역 툴팁 ("고위험고립 30 · 지하층 10 · 기초연금 3", ResidentService) */
  function rmRow(r, i) {
    var w = welfare(r);
    var tags = (r.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('')
      + (r.benefits || []).map(function (t) { return '<span class="tag benefit" title="수급 확인용 (이미 복지 체계 안)">' + esc(t) + '</span>'; }).join('');
    return '<tr><td class="rm-rank"><b>' + (i + 1) + '</b><small title="' + esc(r.priorityText || '') + '">' + r.priority + '점</small></td>'
      + '<td class="rm-flr" title="' + esc(r.resFlr || '') + '">' + esc(r.resFlr || '-') + '</td><td>' + esc(r.headNm) + '</td><td>' + ageBand(r.maxAge) + '</td>'
      /* 가구 구성 · 복지 연계는 넘치면 … 로 끝나므로 전체 값을 title 로. 취약 유형 칸만 칩 단위로 줄바꿈 (2차 M) */
      + '<td title="' + esc(household(r)) + '">' + esc(household(r)) + '</td>'
      + '<td class="rm-tagcell">' + (tags ? '<div class="rm-tags">' + tags + '</div>' : '<span class="muted">-</span>') + '</td>'
      + '<td title="' + esc(w.t) + '"><i class="rm-dot ' + w.c + '"></i>' + esc(w.t) + '</td></tr>';
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function openResidents() {
    if (!current) return;
    var b = current.building, now = new Date();
    $('#rmSub').text(titleOf(b) + ' · ' + b.addr);
    $('#rmViewer').text(($('#resModal').data('viewer') || '').trim() + ' · ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()));
    $('#rmRows').html('<tr><td colspan="7" class="rs-empty">불러오는 중…</td></tr>');
    $('#resModal').addClass('open');
    MapApi.residents(b.bldId).done(function (list) {
      var vuln = list.filter(function (r) { return r.priority >= 10; });   // 취약 가구 = 가구 가점 10 이상 (5-1). 순서는 서버 그대로
      $('#rmRows').html(vuln.length ? vuln.map(function (r, i) { return rmRow(r, i); }).join('') : '<tr><td colspan="7" class="rs-empty">취약 유형에 해당하는 가구가 없습니다. (전체 ' + list.length + '가구)</td></tr>');
    }).fail(function () {
      $('#rmRows').html('<tr><td colspan="7" class="rs-empty">가구 정보를 볼 수 없습니다.</td></tr>');
    });
  }
  function closeResidents() { $('#resModal').removeClass('open'); }

  function show(bldId) {
    current = null;
    $('#panelRight').addClass('open');
    $('#resultView').hide(); $('#detailView').show();
    $('#dTitle').text('불러오는 중…'); $('#dAddr').text(''); setHistory(null); $('#dScoreItems, #dInfo, #dWelf').empty();
    MapApi.building($.extend({}, getCriteria(), { bldId: bldId })).done(function (d) {
      if (!d || !d.building) { Common.toast('건물 정보를 찾을 수 없습니다.'); return; }
      current = d;
      renderInfo(d);
      if (window.Bld3D) Bld3D.show(d);                   // 상세 패널 왼쪽 건물 3D 입체보기 : 안 보이는 채로 미리 그린다 (map-3d.js)
    }).fail(function () {                               // 403(관할 밖) 등 : 안내는 Common.api 가 띄운다
      $('#dTitle').text('건물 정보를 볼 수 없습니다');
      $('#btnArchive, #btnResidents').prop('disabled', true);
    });
  }

  function init(opts) {
    getCriteria = opts.getCriteria;
    onArchived = opts.onArchived;

    /* 취약 가구 모달을 오른쪽 패널 밖(body 맨 끝)으로 옮긴다 (2차 Q). 패널이 transform · z-index 로 자기만의 겹침 영역을 만들어서,
       패널 안에 두면 패널 밖의 여닫기 버튼이 모달 위로 올라온다. 이벤트는 id 로 걸려 있어 그대로 동작한다 */
    $('#resModal').appendTo('body');

    /* 점수 구성 : 묶음 줄을 누르면 요인별 표를 펼치고 접는다 (여러 개를 같이 펼칠 수 있다) */
    $('#dScoreItems').on('click', '.sc-head', function () {
      var open = $(this).closest('.sc-item').toggleClass('open').hasClass('open');
      $(this).attr('aria-expanded', String(open));
    });

    $('#btnResidents').on('click', openResidents);
    $('#rmClose, #rmClose2').on('click', closeResidents);
    $('#resModal').on('click', function (e) { if (e.target === this) closeResidents(); });
    $(document).on('keydown', function (e) { if (e.key === 'Escape') closeResidents(); });

    /* 보관함 저장 (13단계). 판정은 서버(ArchiveService.addArchive) :
     *   DUP     = 이미 저장돼 있고 조사 전 → 저장 안 함. 안내 모달(Common.dialog) [보관함에서 보기] = 보관함 목록 새 탭 / [닫기]
     *   UPDATED = 조사 이력 있음 → 새 점수로 다시 저장 (묻지 않음)
     *   ADDED   = 처음 저장 */
    $('#btnArchive').on('click', function () {
      if (!current) return;
      var $b = $(this).prop('disabled', true), bld = current.building, bldId = bld.bldId;
      MapApi.archiveAdd(bldId, current.building.sggCd, current.building.score, getCriteria()).done(function (res) {
        if (res && res.ok === false) {
          if (res.code === 'DUP') {
            var info = res.savedAt ? esc(res.savedAt) + ' 저장 · ' + esc(res.savedScore) + '점' : esc(res.msg || '');
            Common.dialog({
              title: '이미 저장된 건물입니다',
              html: '<div class="dlg-info"><span class="t">' + esc(titleOf(bld)) + '</span><span class="s">' + info + '</span></div>'
                + '아직 현장 조사 기록이 없어 다시 저장하지 않았어요.<br>보관함에서 볼까요?',
              okText: '보관함에서 보기', cancelText: '닫기'
            }).done(function (go) {
              /* 확인 클릭 직후라 팝업 차단에 걸리지 않는다 (사용자 동작 안에서 open) */
              if (go) window.open(Common.url('archive.do'), '_blank');   // 보관함 목록 (2026-11-22, 건물 확인 이력 대신)
            });
            return;
          }
          Common.toast(res.msg || '저장할 수 없습니다.');
          return;
        }
        current.building.archiveCnt = 1;
        $b.text(archiveLabel(current.building));
        if (onArchived) onArchived(res.statusCount);
        savedDialog(bld, res);
      }).always(function () { $b.prop('disabled', false); });
    });

    /* 오른쪽 패널 폭 : 왼쪽 끝 손잡이를 끌면 360~640px (기본 400), itgeo.rpW 에 기억 */
    Common.resizer({ handle: '#rpGrip', cssVar: '--rp-w', key: 'itgeo.rpW', min: 360, max: 640, def: 400, sign: -1 });

    /* 3D 보기 (#btn3d) : 클릭 · 로딩 표시는 map-3d.js (Bld3D) 가 맡는다. 목록으로 돌아가거나 패널을 닫으면 3D 도 닫는다 */
    $('#dHistory').on('click', function (e) { if ($(this).hasClass('disabled')) e.preventDefault(); });
    $('#detailBack').on('click', function () { $('#detailView').hide(); $('#resultView').show(); if (window.Bld3D) Bld3D.hide(); });
    $('#detailClose, #resultClose').on('click', function () { $('#panelRight').removeClass('open'); if (window.Bld3D) Bld3D.hide(); });   /* 오른쪽 패널도 지도 위에 덮으므로 resize 없음 */
  }

  /* 저장 완료 안내 (2026-11-22) : 오른쪽 아래 버튼 글자만 바뀌어 잘 안 보이므로 모달로 알린다.
       건물 · 저장일 · 점수 · 어떤 가중치(기본/폭우/폭염/한파/사용자 설정)로 저장했는지 + [보관함에서 보기]
       [다시 보지 않기] 를 체크하고 닫으면 itgeo.archiveDlgOff = 1 → 다음부터는 예전처럼 아래 알림(toast)만 */
  var DLG_OFF_KEY = 'itgeo.archiveDlgOff';
  function scenLabel(c) {
    if (c && c.modified) return '사용자 설정';
    var key = (c && c.scenario) || 'base';
    var hit = (window.MAP_CONFIG && MAP_CONFIG.SCENARIOS || []).filter(function (x) { return x.key === key; })[0];
    return hit ? hit.name : '기본';
  }
  function savedDialog(bld, res) {
    var off = false;
    try { off = localStorage.getItem(DLG_OFF_KEY) === '1'; } catch (e) {}
    var msg = res.msg || '보관함에 저장했습니다.';
    if (off) { Common.toast(msg); return; }
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var bldId = bld.bldId;
    Common.dialog({
      title: res.code === 'UPDATED' ? '점수를 갱신해 다시 저장했습니다' : '보관함에 저장했습니다',
      html: '<div class="dlg-info"><span class="t">' + esc(titleOf(bld)) + '</span>'
        + '<span class="s">' + day + ' 저장 · ' + esc(bld.score) + '점 · ' + esc(scenLabel(getCriteria ? getCriteria() : null)) + '</span></div>'
        + '<label class="dlg-off"><input type="checkbox" class="dlg-off-chk"> 다시 보지 않기</label>',
      okText: '보관함에서 보기', cancelText: '닫기'
    }).done(function (go) {
      if (go) window.open(Common.url('archive.do'), '_blank');   // 보관함 목록 (2026-11-22, 건물 확인 이력 대신)
    });
    /* 체크하는 순간 기억 (닫기 · 보관함에서 보기 · Esc 어느 쪽으로 닫아도 적용) */
    $('.dlg-bg').last().on('change', '.dlg-off-chk', function () {
      try { if (this.checked) localStorage.setItem(DLG_OFF_KEY, '1'); else localStorage.removeItem(DLG_OFF_KEY); } catch (e) {}
    });
  }

  /* 여닫기 버튼으로 패널을 다시 열었을 때 : 보던 건물 상세가 있으면 3D 를 다시 준비한다 (닫을 때 Bld3D.hide 로 정리했으므로) */
  function refresh3d() {
    if (current && window.Bld3D && $('#detailView').is(':visible')) Bld3D.show(current);
  }

  return { init: init, show: show, refresh3d: refresh3d };
})();
