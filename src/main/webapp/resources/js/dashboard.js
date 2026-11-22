/* 대시보드 (dashboard.jsp)
 *  ① 날씨 : api/dashboard/weather.do (10분마다 다시)
 *  ③ ④ 달력 · 하루 일정 : 처음엔 오늘 (window.DASH), 날짜를 누르면 api/dashboard/schedule.do — 보기만, 수정은 업무 캘린더(calendar.do)
 *       일정 = 업무 캘린더에 그날 넣은 현장확인 리스트의 건물 (방문 순서). 시각이 없으므로 확인 결과로 지난 일 · 다음 방문을 나눈다
 *  ⑤ 이어서 보기 시각 글자 · ⑦ 동별 정렬 · ⑥ 월별 막대 · ⑧ 보고서 만들기 (api/dashboard/report.do)
 */
$(function () {
  var D = window.DASH || {};
  var esc = Common.esc;

  /* JSON 조회는 $.ajax 로 (항상 promise 를 돌려줌). 실패해도 화면의 다른 부분은 계속 그려지게 safe() 로 감싼다 */
  function getJson(path, data) {
    return $.ajax({ url: Common.url(path), method: 'GET', data: data || {}, dataType: 'json', cache: false });
  }
  function safe(name, fn) {
    try { fn(); } catch (e) { if (window.console) console.error('[대시보드] ' + name + ' 표시 실패 :', e); }
  }
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayStr() { return ymd(new Date()); }

  /* ================= ① 날씨 ================= */
  function loadWeather() {
    getJson('api/dashboard/weather.do').done(function (w) {
      if (w && w.ok) {
        $('#wxTemp').text(Math.round(w.temp) + '°');
        $('#wxWarns').html((w.warnings || []).map(function (x) { return '<span class="wx-warn">' + esc(x) + '</span>'; }).join(''));
        $('#wxTime').text('기상청 ' + w.baseTime).attr('title', '1시간마다 갱신되는 관측 기준 시각');
      } else {
        $('#wxTemp').text('--°');
        $('#wxWarns').empty();
        $('#wxTime').text((w && w.msg) || '날씨 정보를 불러오지 못했습니다.');
      }
    }).fail(function () { $('#wxTime').text('날씨 정보를 불러오지 못했습니다.'); });
  }
  safe('날씨', loadWeather);
  setInterval(loadWeather, 10 * 60 * 1000);

  /* ================= ③ 월간 캘린더 ================= */
  var calYm = D.today ? D.today.slice(0, 7) : todayStr().slice(0, 7);   // 보고 있는 달 yyyy-MM
  var selDay = D.today || todayStr();                                     // 고른 날
  var marks = {};                                                         // day → {cnt, revisit}
  (D.marks || []).forEach(function (m) { marks[m.day] = m; });

  function drawCal() {
    var y = +calYm.slice(0, 4), m = +calYm.slice(5, 7);
    $('#calTitle').text((y === new Date().getFullYear() ? '' : y + '년 ') + m + '월');
    var first = new Date(y, m - 1, 1), last = new Date(y, m, 0).getDate();
    var lead = (first.getDay() + 6) % 7;            // 월요일 시작
    var t = todayStr(), html = '';
    for (var i = 0; i < lead; i++) html += '<span class="cd empty"></span>';
    for (var d = 1; d <= last; d++) {
      var key = calYm + '-' + pad(d), mk = marks[key], dots = '';
      if (mk) for (var k = 0; k < Math.min(mk.cnt, 3); k++) dots += '<i></i>';
      html += '<button type="button" class="cd' + (key === t ? ' today' : '') + (key === selDay ? ' sel' : '') + '" data-day="' + key + '"'
        + ' aria-label="' + m + '월 ' + d + '일' + (mk ? ' 일정 ' + mk.cnt + '건' : '') + '">'
        + '<span>' + d + '</span><em>' + dots + '</em></button>';
    }
    $('#calDays').html(html);
  }

  function loadMarks() {
    getJson('api/dashboard/schedule-marks.do', { ym: calYm }).done(function (r) {
      marks = {};
      (r.list || []).forEach(function (m) { marks[m.day] = m; });
      drawCal();
    });
  }

  function moveMonth(diff) {
    var dt = new Date(+calYm.slice(0, 4), +calYm.slice(5, 7) - 1 + diff, 1);
    calYm = dt.getFullYear() + '-' + pad(dt.getMonth() + 1);
    drawCal();
    loadMarks();
  }
  $('#calPrev').on('click', function () { moveMonth(-1); });
  $('#calNext').on('click', function () { moveMonth(1); });
  $('#calDays').on('click', '.cd[data-day]', function () { selectDay($(this).data('day')); });
  $('#backToday').on('click', function () {
    var t = todayStr();
    if (calYm !== t.slice(0, 7)) { calYm = t.slice(0, 7); loadMarks(); }
    selectDay(t);
  });

  /* ================= ③ ④ 하루 일정 ================= */
  var dayList = D.schedules || [];

  var RESULT = { MET: ['확인 완료', 'done'], OTHER: ['확인 완료', 'done'], ABSENT: ['부재', 'absent'], REFUSED: ['거부', 'absent'] };
  var ICO_VISIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  var ICO_RE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function selectDay(day) {
    selDay = day;
    drawCal();
    if (day === todayStr() && D.schedules && D.today === day) { dayList = D.schedules; renderDay(); return; }
    getJson('api/dashboard/schedule.do', { date: day }).done(function (r) {
      dayList = r.list || [];
      if (day === todayStr()) { D.schedules = dayList; D.today = day; }
      renderDay();
    });
  }

  /* 업무 캘린더 일정에는 시각이 없다 : 확인 결과가 있으면 지난 일, 오늘은 결과 없는 첫 건물이 "다음", 지난 날의 결과 없는 건물은 "미확인" */
  function renderDay() {
    var t = todayStr(), isToday = selDay === t, isPast = selDay < t;
    var dt = parseYmd(selDay), label = (dt.getMonth() + 1) + '.' + pad(dt.getDate()) + ' ' + DOW[dt.getDay()];
    var nextDone = false, cntDone = 0, cntAbsent = 0, remain = 0, html = '', group = null;

    dayList.forEach(function (s) {
      var res = s.checkResult && RESULT[s.checkResult];
      var badge, cls, past = !!res || isPast;
      if (res) { badge = res[0]; cls = res[1]; if (cls === 'done') cntDone++; else cntAbsent++; }
      else if (isToday && !nextDone) { badge = '다음'; cls = 'next'; nextDone = true; }
      else if (isPast) { badge = '미확인'; cls = 'unchecked'; }
      else if (s.schedType === 'REVISIT') { badge = '재방문'; cls = 'revisit'; }
      else { badge = '예정'; cls = 'plan'; }
      if (!res && !isPast) remain++;
      if (s.memo !== group) { group = s.memo; html += '<div class="sch-group">' + esc(group || '현장확인 리스트') + '</div>'; }
      html += '<div class="sch-item ' + cls + (past ? ' past' : ' upcoming') + (s.schedType === 'REVISIT' ? ' re' : '') + '">'
        + '<div class="sch-time">' + (s.schedType === 'REVISIT' ? ICO_RE : ICO_VISIT) + '<b>' + (s.visitOrder != null ? s.visitOrder + '번' : '-') + '</b></div>'
        + '<div class="sch-title">' + esc(s.title) + '</div>'
        + '<span class="sch-badge">' + badge + '</span></div>';
    });
    if (!dayList.length) html = '<div class="empty">' + (isToday ? '오늘' : '이날') + ' 일정이 없습니다.</div>';

    $('#dayTitle').text(isToday ? '오늘 일정' : '일정');
    $('#daySub').text(label + (isToday ? ' · ' + remain + '곳 남음' : ' · ' + dayList.length + '곳'));
    var cnt = [];
    if (cntDone) cnt.push('확인 완료 ' + cntDone);
    if (cntAbsent) cnt.push('부재 ' + cntAbsent);
    $('#dayCount').text(cnt.join(' · '));
    $('#backToday').prop('hidden', isToday);

    var $list = $('#schList').html(html), $next = $list.find('.sch-item.next');
    /* 다음 방문이 보이게 : 그 위로 지난 일정 2개까지만 남기고 스크롤 */
    var top = 0;
    if ($next.length) {
      var $prev = $next.prevAll('.sch-item');
      top = $prev.length > 2 ? $prev.eq(1)[0].offsetTop : 0;
    }
    $list.scrollTop(top);
  }

  safe('달력', drawCal);
  safe('오늘 일정', renderDay);

  /* ================= ⑤ 이어서 보기 : "오늘 09:10" / "어제 18:20" / "11.15 18:20" ================= */
  $('.cont-item time').each(function () {
    var at = String($(this).data('at') || '');
    if (!at) return;
    var day = at.slice(0, 10), tm = at.slice(11, 16), t = new Date();
    var y = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1);
    var txt = day === ymd(t) ? '오늘 ' + tm : day === ymd(y) ? '어제 ' + tm : (+day.slice(5, 7)) + '.' + day.slice(8, 10) + ' ' + tm;
    $(this).text(txt).attr('datetime', at.replace(' ', 'T'));
  });

  /* ================= ⑦ 동별 남은 고위험 가구 ================= */
  function drawDong() {
    var rows = (D.byDong || []).slice(), by = $('#dongSort').val();
    rows.sort(by === 'name'
      ? function (a, b) { return a.emdNm.localeCompare(b.emdNm, 'ko'); }
      : function (a, b) { return (b.remain - a.remain) || a.emdNm.localeCompare(b.emdNm, 'ko'); });
    var max = rows.reduce(function (mx, r) { return Math.max(mx, r.total); }, 0) || 1;
    var html = rows.map(function (r) {
      return '<div class="dong2-row"><span class="nm">' + esc(r.emdNm) + '</span>'
        + '<div class="bar2" title="남은 ' + r.remain + ' · 확인 ' + r.checked + '">'
        + '<b class="remain" style="width:' + (r.remain * 100 / max) + '%"></b>'
        + '<b class="check" style="width:' + (r.checked * 100 / max) + '%"></b></div>'
        + '<span class="cnt"><b>' + r.remain + '</b><small>/ ' + r.total + '</small></span></div>';
    }).join('');
    $('#dongList').html(html || '<div class="empty">현장 확인 리스트에 고위험 가구가 있는 건물이 없습니다.</div>');
  }
  $('#dongSort').on('change', drawDong);
  safe('동별 남은 고위험 가구', drawDong);

  /* ================= ⑥ 월별 추이 (확인 완료 건물 수, 이번 달 막대만 진하게) ================= */
  var chart = null;
  var valueLabels = {           // 막대 위 숫자
    id: 'valueLabels',
    afterDatasetsDraw: function (c) {
      var ctx = c.ctx, ds = c.data.datasets[0];
      ctx.save();
      ctx.font = '700 13px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = ds.labelColor;
      c.getDatasetMeta(0).data.forEach(function (bar, j) { ctx.fillText(ds.data[j], bar.x, bar.y - 4); });
      ctx.restore();
    }
  };
  function drawTrend() {
    if (!window.Chart || !document.getElementById('trendChart')) return;
    if (chart) chart.destroy();
    var css = getComputedStyle(document.documentElement);
    var col = function (v) { return css.getPropertyValue(v).trim(); };
    var M = D.monthly || [], last = M.length - 1;
    Chart.defaults.color = col('--text-2');
    chart = new Chart(document.getElementById('trendChart'), {
      type: 'bar',
      data: {
        labels: M.map(function (m) { return Number(m.ym.slice(5)) + '월'; }),
        datasets: [{
          label: '확인 완료', data: M.map(function (m) { return m.checked; }),
          /* 지난 달은 연하게, 이번 달은 진하게 → "이번 달이 지난달보다 늘었나"가 한눈에 */
          backgroundColor: M.map(function (m, i) { return i === last ? col('--dash-check') : col('--dash-trend-past'); }),
          labelColor: col('--dash-check'), maxBarThickness: 46, borderRadius: 2
        }]
      },
      options: {
        maintainAspectRatio: false,
        layout: { padding: { top: 22 } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return '확인 완료 ' + c.parsed.y + '곳'; } } } },
        scales: {
          x: { grid: { display: false }, border: { color: col('--line') } },
          y: { display: false, beginAtZero: true, grace: '8%' }
        }
      },
      plugins: [valueLabels]
    });
  }
  safe('월별 추이', drawTrend);
  $(document).on('wf:theme', drawTrend);   /* 헤더 테마 버튼 (common.js) */

  /* ================= ⑧ 이번 달 현황 보고서 =================
   *  [보고서 만들기] → 파일 형식 고르기 (지금은 PDF 만, xlsx · hwpx · docx 는 준비 중)
   *  → "11월 보고서를 작성 중입니다" 알림 → 서버 (api/dashboard/report.do)
   *     · 1~4번 숫자(facts) = 서버가 대시보드와 같은 기준으로 채움
   *     · 5번 종합 의견(opinion) = LLM 이 그 숫자를 읽고 3~4줄 (설정이 없거나 실패하면 빈 칸 + 안내)
   *  → 통계 현황 보고서 양식(.rep-doc)에 채움 → html2canvas 로 그림 → jsPDF 로 A4 PDF
   *  → 파일로 내려받지 않고 화면 안 PDF 보기 창으로 띄움 (인쇄 · 저장은 사용자가 보기 창에서 직접)
   *  [지난 보고서 보기] → api/dashboard/report-view.do 로 저장된 숫자 · 의견을 받아 같은 양식으로 다시 그림
   */
  var FORMATS = [
    { v: 'pdf',  label: 'PDF',  sub: '보고서를 바로 열어 봅니다', on: true },
    { v: 'xlsx', label: 'Excel (xlsx)', sub: '준비 중', on: false },
    { v: 'hwpx', label: '한글 (hwpx)', sub: '준비 중', on: false },
    { v: 'docx', label: 'Word (docx)', sub: '준비 중', on: false }
  ];
  var noticeTimer = null;
  function notice(text, busy) {
    clearTimeout(noticeTimer);
    $('#repNoticeTxt').text(text);
    $('#repNotice').toggleClass('busy', !!busy).prop('hidden', false);
    if (!busy) noticeTimer = setTimeout(function () { $('#repNotice').prop('hidden', true); }, 4000);
  }

  $('#btnReport').on('click', function () {
    var $b = $(this), month = $b.data('month');
    pickedFmt = 'pdf';
    var html = '<div class="fmt-list">' + FORMATS.map(function (f, i) {
      return '<label class="fmt-opt' + (f.on ? '' : ' off') + '"><input type="radio" name="repFmt" value="' + f.v + '"' + (i === 0 ? ' checked' : '') + (f.on ? '' : ' disabled') + '>'
        + '<b>' + f.label + '</b><small>' + f.sub + '</small></label>';
    }).join('') + '</div>';
    Common.dialog({ title: month + '월 현황 보고서 만들기', html: html, okText: '보고서 만들기' }).done(function (ok) {
      if (!ok) return;
      makeReport($b, month, pickedFmt);
    });
  });
  /* dialog 가 닫히기 전에 고른 값을 읽어 두기 위해 (닫힐 때 DOM 이 지워짐) */
  var pickedFmt = 'pdf';
  $(document).on('change', 'input[name="repFmt"]', function () { pickedFmt = this.value; });

  function makeReport($b, month, fmt) {
    if (fmt !== 'pdf') { Common.toast('지금은 PDF 만 만들 수 있어요.'); return; }
    if (!window.html2canvas || !window.jspdf) { Common.toast('PDF 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); return; }
    $b.prop('disabled', true);
    notice(month + '월 보고서를 작성 중입니다', true);
    $.ajax({ url: Common.url('api/dashboard/report.do'), method: 'POST', dataType: 'json' })
      .done(function (r) {
        if (!r || !r.ok || !r.facts) { failReport((r && r.msg) || '보고서를 만들지 못했습니다.'); $b.prop('disabled', false); return; }
        setLastReport(r);
        openReport(r, month + '월 보고서를 만들었어요').then(function () { $b.prop('disabled', false); });
      })
      .fail(function (x) { failReport((x.responseJSON && x.responseJSON.msg) || '보고서를 만들지 못했습니다.'); $b.prop('disabled', false); });
  }

  $('#lastReport').on('click', function () {
    var $l = $(this), id = $l.data('id');
    if (!id || $l.prop('disabled')) return;
    if (!window.html2canvas || !window.jspdf) { Common.toast('PDF 도구를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); return; }
    $l.prop('disabled', true);
    getJson('api/dashboard/report-view.do', { id: id })
      .done(function (r) {
        if (!r || !r.ok) { Common.toast((r && r.msg) || '보고서를 찾을 수 없습니다.'); $l.prop('disabled', false); return; }
        openReport(r, null).then(function () { $l.prop('disabled', false); });
      })
      .fail(function () { Common.toast('보고서를 불러오지 못했습니다.'); $l.prop('disabled', false); });
  });

  /* 방금 만든 보고서를 "지난 보고서 보기" 링크로 */
  function setLastReport(r) {
    $('#noReport').remove();
    $('#btnReportBox').prop('hidden', false);   /* 보고서가 생겼으니 저장소 폴더 아이콘을 보인다 */
    $('#lastReport').data('id', r.reportId).prop('hidden', false)
      .text('지난 보고서 · ' + r.month + '월 보고서 (' + (r.createdAt || '오늘') + ') 보기 ›');
  }

  function failReport(msg) {
    $('#repNotice').prop('hidden', true);
    Common.toast(msg);
  }

  /* 보고서 JSON → 양식 → PDF 보기 창. done = 다 만든 뒤 알림 문구 (지난 보고서 열기는 null) */
  function openReport(r, done) {
    var $doc = buildDoc(r);
    return toPdf($doc[0]).then(function (blob) {
      $doc.remove();
      if (done) notice(done, false);
      if (r.aiOk === false && r.msg) Common.toast(r.msg);
      showPdf(blob, r.facts ? r.facts.month : '');
    }).catch(function () {
      $doc.remove();
      failReport('PDF 를 만들지 못했습니다.');
    });
  }

  /* 통계 현황 보고서 양식 (A4 폭 794px, 화면 밖에 그렸다가 PDF 로 만든 뒤 지운다)
   *  1. 고위험 가구 확인 현황 (누적)  ← 좌측 상단 도넛
   *  2. 동별 남은 고위험 가구 상위 3  ← 동별 그래프
   *  3. 월별 현장 확인 완료           ← 월별 추이
   *  4. 이번 달 방문 일정             ← 달력 · 오늘 일정
   *  5. 종합 의견 (AI 정리)           ← 1~4 숫자를 읽고 LLM 이 작성
   */
  function buildDoc(r) {
    var f = r.facts, op = r.opinion || [];
    if (!f) {   /* 예전 형식 보고서 (글자만 저장) */
      return $('<div class="rep-doc"><h1>월간 현황 보고</h1><h2>보고 내용</h2><div class="rd-text">' + esc(op.join('\n')) + '</div></div>').appendTo('body');
    }
    function dot(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[0] + '.' + (+p[1]) + '.' + (+p[2]) : esc(s); }
    function delta(d, unit) { return d === 0 ? '변동 없음' : (d > 0 ? '▲ ' : '▼ ') + Math.abs(d) + unit; }
    var M = f.monthly || [], cur = M[M.length - 1] || { checked: 0 }, prev = M[M.length - 2] || { checked: 0 };
    var dp = f.highPct - f.prevPct;

    var html = '<div class="rep-doc">'
      + '<h1>' + f.year + '년 ' + f.month + '월 고위험 가구 현장 확인 현황 보고</h1>'
      + '<div class="rd-meta"><span>' + esc(f.area) + ' · ' + esc(f.writer || '-') + '</span>'
      + '<span>기간 ' + dot(f.periodFrom) + ' ~ ' + dot(f.periodTo).replace(/^\d+\./, '') + ' · 작성일 ' + dot(f.writtenAt) + '</span></div>'

      + '<h2>1. 고위험 가구 확인 현황 (누적)</h2><div class="rd-kpi">'
      + '<div><small>전체</small><b>' + f.highTotal + '가구</b><span>현장 확인 리스트 기준</span></div>'
      + '<div><small>확인</small><b class="c">' + f.highChecked + '가구</b><span>확인율 ' + f.highPct + '%</span></div>'
      + '<div><small>남은 곳</small><b>' + f.highRemain + '가구</b><span' + (dp > 0 ? ' class="up"' : '') + '>확인율 전월 대비 ' + delta(dp, '%p') + '</span></div>'
      + '</div>'

      + '<h2>2. 동별 남은 고위험 가구 (상위 ' + (f.topDong || []).length + '개 동)</h2>'
      + ((f.topDong || []).length
          ? '<table class="rd-tbl"><thead><tr><th>순위</th><th>동</th><th>남은 곳</th><th>확인 / 전체</th></tr></thead><tbody>'
            + f.topDong.map(function (d, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(d.emdNm) + '</td><td><b>' + d.remain + '</b></td><td>' + d.checked + ' / ' + d.total + '</td></tr>'; }).join('')
            + '</tbody></table>'
          : '<p class="rd-empty">현장 확인 리스트에 고위험 가구가 있는 건물이 없습니다.</p>')

      + '<h2>3. 월별 현장 확인 완료 (건물 수)</h2><table class="rd-tbl"><thead><tr>'
      + M.map(function (m) { return '<th>' + Number(m.ym.slice(5)) + '월</th>'; }).join('') + '</tr></thead><tbody><tr>'
      + M.map(function (m, i) {
          return i === M.length - 1
            ? '<td><b class="c">' + m.checked + '</b> <span class="' + (cur.checked > prev.checked ? 'up' : '') + '">(' + delta(cur.checked - prev.checked, '') + ')</span></td>'
            : '<td>' + m.checked + '</td>';
        }).join('') + '</tr></tbody></table>'

      + '<h2>4. 이번 달 방문 일정</h2><table class="rd-tbl"><thead><tr><th>전체 일정</th><th>진행</th><th>남은 일정</th><th>진행률</th></tr></thead><tbody>'
      + '<tr><td>' + f.schedTotal + '건</td><td>' + f.schedDone + '건</td><td>' + f.schedRemain + '건</td><td>' + f.schedPct + '%</td></tr></tbody></table>'

      + '<h2>5. 종합 의견</h2><div class="rd-ai"><span class="rd-tag">AI 정리 초안 · 담당자 검토 필요</span>'
      + (op.length ? '<ul>' + op.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
                   : '<p class="rd-empty">종합 의견 자동 작성 실패' + (r.msg ? ' (' + esc(r.msg) + ')' : '') + ', 담당자 직접 작성 필요</p>')
      + '</div>'
      + '<div class="rd-foot">※ 1~4번은 ITGEO 대시보드 집계값을 그대로 기재함. 5번 종합 의견은 위 수치를 바탕으로 AI 가 정리한 초안이며, 담당자 검토 후 사용함</div>'
      + '</div>';
    return $(html).appendTo('body');
  }

  /* 양식 → A4 PDF. 여러 장이 되면 제목 · 표 줄 경계에서만 자른다 (줄이 반으로 잘리지 않게) */
  function toPdf(el) {
    var SCALE = 2, base = el.getBoundingClientRect().top;
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return fonts.then(function () {
      return html2canvas(el, { scale: SCALE, backgroundColor: '#ffffff', logging: false });
    }).then(function (cv) {
      var cuts = [].map.call(el.querySelectorAll('h2, tbody tr:not(:first-child), .rd-ai li, .rd-foot'), function (n) {
        return Math.round((n.getBoundingClientRect().top - base) * SCALE);
      }).sort(function (a, b) { return a - b; });
      var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      var pw = 210, ph = 297, mmPerPx = pw / cv.width, topPad = 14, y = 0, page = 0;
      while (y < cv.height - 2) {
        var pad = page ? topPad : 0;                                    /* 2쪽부터 위 여백 */
        var room = Math.floor((ph - pad - (page ? 10 : 0)) / mmPerPx);  /* 이 쪽에 들어가는 높이(px) */
        var end = Math.min(cv.height, y + room);
        if (end < cv.height) {
          var ok = cuts.filter(function (c) { return c > y + room * 0.3 && c <= end; });
          if (ok.length) end = ok[ok.length - 1];
        }
        var h = end - y, part = document.createElement('canvas');
        part.width = cv.width; part.height = h;
        var c = part.getContext('2d');
        c.fillStyle = '#fff'; c.fillRect(0, 0, part.width, h);
        c.drawImage(cv, 0, y, cv.width, h, 0, 0, cv.width, h);
        if (page++) pdf.addPage();
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pad, pw, h * mmPerPx);
        y = end;
      }
      return pdf.output('blob');
    });
  }

  /* PDF 보기 창 (내려받기 버튼은 두지 않음 = 로컬 저장 없음). 결재용 출력을 위해 [인쇄] 버튼만 둔다 */
  function showPdf(blob, month) {
    var url = URL.createObjectURL(blob);
    var $v = $('<div class="pdf-view" role="dialog" aria-modal="true" aria-label="' + month + '월 보고서">'
      + '<div class="pv-box"><div class="pv-head"><b>' + month + '월 고위험 가구 현장 확인 현황 보고 (PDF)</b>'
      + '<span class="pv-act"><button type="button" class="pv-print">인쇄</button>'
      + '<button type="button" class="pv-x" aria-label="닫기">×</button></span></div>'
      + '<iframe title="보고서 PDF" src="' + url + '"></iframe></div></div>').appendTo('body');
    function close() { $(document).off('keydown.pv'); $v.remove(); URL.revokeObjectURL(url); }
    $v.on('click', function (e) { if (e.target === this) close(); });
    $v.find('.pv-x').on('click', close);
    $v.find('.pv-print').on('click', function () {
      /* 보기 창 안 PDF 뷰어의 인쇄를 연다. 브라우저가 막으면(일부 Safari · Firefox) 새 탭으로 열어 거기서 인쇄 */
      try {
        var w = $v.find('iframe')[0].contentWindow;
        w.focus();
        w.print();
      } catch (e) {
        window.open(url, '_blank', 'noopener');
      }
    });
    $(document).on('keydown.pv', function (e) { if (e.key === 'Escape') close(); });
  }


  /* ================= ⑧-2 보고서 저장소 (폴더 아이콘) =================
   *  목록 api/dashboard/reports.do → 항목을 누르면 api/dashboard/report-view.do 로 내용 →
   *  종합 의견(한 줄 = 한 항목) · 상태(초안/확정)를 고쳐 api/dashboard/report-save.do 로 저장. 1 ~ 4번 숫자는 집계값이라 보기만
   *  [PDF 로 보기] = 고친 내용 그대로 위 보고서 양식(buildDoc)으로 PDF 보기 창
   */
  var $rb = $('#rbModal'), rbList = [], rbCur = null, rbDirty = false, rbBusy = false;
  var GU = { '11530': '구로구', '11470': '양천구', '11560': '영등포구' };
  var STATUS = { DRAFT: '초안', CONFIRMED: '확정' };

  function rbOpen() {
    $rb.prop('hidden', false);
    setTimeout(function () { $rb.addClass('open'); }, 0);
    $('body').addClass('ml-lock');
    rbCur = null; rbDirty = false;
    $('#rbDetail').html('<p class="muted ml-empty">보고서를 불러오는 중…</p>');
    rbLoad();
  }
  function rbClose() {
    $rb.removeClass('open');
    setTimeout(function () { $rb.prop('hidden', true); }, 150);
    $('body').removeClass('ml-lock');
  }
  function rbTryClose() {
    if (rbBusy) return;
    if (!rbDirty) { rbClose(); return; }
    Common.dialog({ title: '저장하지 않은 수정 내용', text: '저장하지 않은 수정 내용이 있습니다. 닫으면 고친 내용이 사라집니다.', okText: '닫기', cancelText: '계속 수정' })
      .done(function (ok) { if (ok) { rbDirty = false; rbClose(); } });
  }
  $('#btnReportBox').on('click', rbOpen);
  $rb.on('click', '[data-rb-close]', rbTryClose);
  $rb.on('mousedown', function (e) { if (e.target === this) rbTryClose(); });
  $(document).on('keydown.rb', function (e) {
    if (e.key === 'Escape' && !$rb.prop('hidden') && !$('.dlg-bg').length && !$('.pdf-view').length) rbTryClose();
  });

  function rbName(r) { var ym = String(r.ym || ''); return ym.slice(0, 4) + '년 ' + Number(ym.slice(5, 7)) + '월 현황 보고서'; }

  function rbLoad(selectId) {
    getJson('api/dashboard/reports.do').done(function (r) {
      rbList = (r && r.list) || [];
      $('#rbCnt').text(rbList.length);
      rbRenderList();
      if (!rbList.length) { $('#rbDetail').html('<p class="muted ml-empty">아직 만든 보고서가 없습니다.</p>'); rbButtons(); return; }
      rbSelect(selectId || (rbCur && rbCur.reportId) || rbList[0].reportId, true);
    }).fail(function () { $('#rbDetail').html('<p class="muted ml-empty">보고서 목록을 불러오지 못했습니다.</p>'); });
  }

  function rbRenderList() {
    var $l = $('#rbList').empty();
    if (!rbList.length) { $l.append('<li class="ml-none">만든 보고서가 없습니다.</li>'); return; }
    rbList.forEach(function (it) {
      var on = rbCur && rbCur.reportId === it.reportId;
      $('<li role="option" tabindex="0"></li>')
        .attr({ 'data-id': it.reportId, 'aria-selected': on ? 'true' : 'false' }).toggleClass('on', !!on)
        .html('<b>' + esc(rbName(it)) + (on && rbDirty ? ' <i class="ml-edited">수정 중</i>' : '') + '</b>'
          + '<span>' + esc(it.sggCd ? (GU[it.sggCd] || it.sggCd) : '3개 구 전체') + ' · 만든 시각 ' + esc(it.createdAt || '') + '</span>'
          + '<small class="rb-st ' + (it.status === 'CONFIRMED' ? 'ok' : '') + '">' + (STATUS[it.status] || '초안') + '</small>')
        .appendTo($l);
    });
  }
  $('#rbList').on('click keydown', 'li[data-id]', function (e) {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    var id = Number($(this).attr('data-id'));
    if (rbCur && rbCur.reportId === id) return;
    if (!rbDirty) { rbSelect(id); return; }
    Common.dialog({ title: '저장하지 않은 수정 내용', text: '고친 내용을 저장하지 않고 다른 보고서로 옮길까요?', okText: '옮기기', cancelText: '계속 수정' })
      .done(function (ok) { if (ok) { rbDirty = false; rbSelect(id); } });
  });

  function rbSelect(id, quiet) {
    getJson('api/dashboard/report-view.do', { id: id }).done(function (r) {
      if (!r || !r.ok) { Common.toast((r && r.msg) || '보고서를 찾을 수 없습니다.'); return; }
      rbCur = r; rbDirty = false;
      rbRenderList();
      rbRenderDetail();
    }).fail(function () { if (!quiet) Common.toast('보고서를 불러오지 못했습니다.'); });
  }

  function rbSec(n, title, body) {
    return '<section class="ml-sec"><h4><span class="ml-num">' + n + '</span>' + title + '</h4>' + body + '</section>';
  }

  function rbRenderDetail() {
    var r = rbCur, f = r.facts, op = r.opinion || [];
    var st = r.status || 'DRAFT';
    var h = '<div class="ml-meta"><b>' + esc(rbName(r)) + '</b><span>' + (f ? esc(f.area || '') + ' · 작성 ' + esc(f.writer || '-') + ' · ' : '') + '만든 시각 ' + esc(r.createdAt || '') + '</span></div>'
      + '<div class="rb-status" role="radiogroup" aria-label="보고서 상태"><span>상태</span>'
      + ['DRAFT', 'CONFIRMED'].map(function (v) {
          return '<label class="' + (st === v ? 'on' : '') + '"><input type="radio" name="rbStatus" value="' + v + '"' + (st === v ? ' checked' : '') + '>' + STATUS[v] + '</label>';
        }).join('') + '</div>';
    if (f) {
      var dp = f.highPct - f.prevPct;
      h += rbSec(1, '고위험 가구 확인 현황 (누적)', '<table class="rb-tbl"><tr><th>전체</th><th>확인</th><th>남은 곳</th><th>확인율</th></tr><tr><td>' + f.highTotal + '가구</td><td>' + f.highChecked + '가구</td><td>' + f.highRemain + '가구</td><td>' + f.highPct + '% <small>(전월 대비 ' + (dp >= 0 ? '+' : '') + dp + '%p)</small></td></tr></table>');
      h += rbSec(2, '동별 남은 고위험 가구', (f.topDong || []).length
        ? '<table class="rb-tbl"><tr><th>동</th><th>남은 곳</th><th>확인 / 전체</th></tr>' + f.topDong.map(function (d) { return '<tr><td>' + esc(d.emdNm) + '</td><td>' + d.remain + '</td><td>' + d.checked + ' / ' + d.total + '</td></tr>'; }).join('') + '</table>'
        : '<p class="muted ml-none-txt">고위험 가구가 있는 건물이 없습니다.</p>');
      h += rbSec(3, '월별 현장 확인 완료 (건물 수)', '<table class="rb-tbl"><tr>' + (f.monthly || []).map(function (m) { return '<th>' + Number(String(m.ym).slice(5)) + '월</th>'; }).join('') + '</tr><tr>' + (f.monthly || []).map(function (m) { return '<td>' + m.checked + '</td>'; }).join('') + '</tr></table>');
      h += rbSec(4, '이번 달 방문 일정', '<table class="rb-tbl"><tr><th>전체</th><th>진행</th><th>남은 일정</th><th>진행률</th></tr><tr><td>' + f.schedTotal + '곳</td><td>' + f.schedDone + '곳</td><td>' + (f.schedRemain != null ? f.schedRemain : Math.max(0, f.schedTotal - f.schedDone)) + '곳</td><td>' + (f.schedPct != null ? f.schedPct : 0) + '%</td></tr></table>');
    }
    h += rbSec(f ? 5 : 1, '종합 의견 <small>한 줄에 한 항목 · 10줄까지 · 고칠 수 있어요</small>',
      '<textarea class="field ml-memo" id="rbOpinion" rows="7" placeholder="종합 의견이 비어 있습니다. 직접 써 주세요.">' + esc(op.join('\n')) + '</textarea>');
    $('#rbDetail').html(h).scrollTop(0);
    rbButtons();
  }

  function rbButtons() {
    $('#rbSave').prop('disabled', !rbCur || rbBusy || !rbDirty);
    $('#rbPdf').prop('disabled', !rbCur || rbBusy || !(window.html2canvas && window.jspdf));
    $('#rbDirty').text(rbDirty ? '저장하지 않은 수정 내용이 있습니다.' : '');
  }
  function rbMarkDirty() { rbDirty = true; rbRenderList(); rbButtons(); }
  $('#rbDetail').on('input', '#rbOpinion', rbMarkDirty);
  $('#rbDetail').on('change', 'input[name="rbStatus"]', function () {
    $('.rb-status label').removeClass('on');
    $(this).closest('label').addClass('on');
    rbMarkDirty();
  });
  function rbLines() {
    return String($('#rbOpinion').val() || '').split(/\r?\n/).map(function (t) { return $.trim(t); }).filter(function (t) { return t; });
  }

  $('#rbSave').on('click', function () {
    if (!rbCur || rbBusy || !rbDirty) return;
    var lines = rbLines();
    if (lines.length > 10) { Common.toast('종합 의견은 10줄까지 쓸 수 있습니다.'); return; }
    rbBusy = true; rbButtons();
    Common.apiJson('api/dashboard/report-save.do', { id: rbCur.reportId, opinion: lines, status: $('input[name="rbStatus"]:checked').val() })
      .done(function (r) {
        rbCur = r; rbDirty = false;
        rbList.forEach(function (it) { if (it.reportId === r.reportId) it.status = r.status; });
        rbRenderList(); rbRenderDetail();
        Common.toast('보고서를 저장했습니다.');
      })
      .always(function () { rbBusy = false; rbButtons(); });
  });

  /* 고친 내용 그대로 PDF 보기 (저장 전이어도 지금 화면 내용으로) */
  $('#rbPdf').on('click', function () {
    if (!rbCur) return;
    var $b = $(this).prop('disabled', true);
    openReport({ facts: rbCur.facts, opinion: rbLines() }, null).then(function () { $b.prop('disabled', false); });
  });

});
