/*
 * 왼쪽 레이어 패널 → 분석 조건 (AnalysisCriteriaTO 파라미터)
 *  - 요인 체크박스 · 기준값 슬라이더 (map.jsp 의 [data-factor] 행). 요인은 켜고 끄기만
 *  - 가중치 = 위험 유형 4묶음 (주거 공간 · 건물 상태 · 침수 위험 · 경제 여건), 묶음마다 0~100 따로 (2026-11-23)
 *      점수에는 비율로 환산 : 반영 점수 = 내 값 ÷ 켜진 묶음 값의 합 × 100 (100·100·100·100 → 25씩, 100·50·100·50 → 2:1:2:1)
 *      팝업 각 줄에 "설정값 → 반영 점수". 묶음의 요인이 전부 꺼지면 "꺼짐" 으로 잠기고 비율 계산에서 빠진다 (설정값은 기억)
 *      환산은 서버(AnalysisCriteriaTO.getSpacePt …)가 같은 식으로 한 번 더 한다. 여기 표시는 미리보기
 *  - 조건이 바뀌어도 지도는 그대로. [분석 실행](dirty) 을 눌러야 onRun(getCriteria()) 로 확정된다
 *  - 슬라이더 채움(--pct) : 손잡이 왼쪽 primary, 오른쪽 어두운 회색 (map.css)
 */
window.MapLayer = (function () {
  var C = window.MAP_CONFIG;
  var STEP = C.WEIGHT_STEP || 5;
  var weights = {};      // 묶음 key → 설정값 0~100 (합은 상관없음)
  var onRun = null, onToggle = null, onChange = null;

  function factorOf(key) {
    for (var i = 0; i < C.FACTORS.length; i++) if (C.FACTORS[i].key === key) return C.FACTORS[i];
    return null;
  }
  function groupOf(factorKey) {
    for (var i = 0; i < C.WEIGHT_GROUPS.length; i++) {
      if (C.WEIGHT_GROUPS[i].factors.indexOf(factorKey) >= 0) return C.WEIGHT_GROUPS[i];
    }
    return null;
  }
  function isOn(factorKey) { return $('[data-factor="' + factorKey + '"] .f-chk').is(':checked'); }
  /* 묶음 안 요인이 전부 꺼졌으면 잠김 (가중치 0) */
  function locked(g) { return !g.factors.some(isOn); }
  function r5(v) { return Math.round(v / STEP) * STEP; }

  /* 슬라이더 채움 비율 → CSS 변수 */
  function fill($r) {
    var min = Number($r.attr('min')) || 0, max = Number($r.attr('max')) || 100, v = Number($r.val()) || 0;
    $r.css('--pct', (max > min ? (v - min) / (max - min) * 100 : 0) + '%');
  }

  /* 슬라이더 값 라벨 갱신 */
  function refreshRow($row) {
    var f = factorOf($row.data('factor'));
    if (!f) return;
    var on = $row.find('.f-chk').is(':checked');
    $row.toggleClass('off', !on);
    var $rng = $row.find('.f-rng');
    if ($rng.length) { if (f.fmt) $row.find('.f-val').text(f.fmt($rng.val())); fill($rng); }
  }

  /* 켜진 묶음 설정값의 합 */
  function weightSum() {
    return C.WEIGHT_GROUPS.reduce(function (s, g) { return s + (locked(g) ? 0 : (weights[g.key] || 0)); }, 0);
  }
  /* 반영 점수 (합 100 으로 환산). 소수는 한 자리 */
  function pointOf(g) {
    var sum = weightSum();
    return locked(g) || sum <= 0 ? 0 : (weights[g.key] || 0) * 100 / sum;
  }
  function fmtPt(v) { var r = Math.round(v * 10) / 10; return (r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)); }

  function refreshWeights() {
    var sum = weightSum();
    C.WEIGHT_GROUPS.forEach(function (g) {
      var w = weights[g.key] || 0, lk = locked(g);
      var $r = $('#w-' + g.key).val(w).prop('disabled', lk);
      fill($r);
      $('#wv-' + g.key).html(lk ? '꺼짐' : w + ' <i>→ ' + fmtPt(pointOf(g)) + '점</i>');
      $('.wp-row[data-gw="' + g.key + '"]').toggleClass('locked', lk);
      /* 레이어 패널에는 점수를 보이지 않는다 (피그마 02). 묶음 점수는 이 팝업에서만 */
    });
    $('#wpSum').toggleClass('warn', sum <= 0)
      .text(sum <= 0 ? '켜진 묶음의 가중치를 하나 이상 0보다 크게 해 주세요' : '반영 점수 = 설정값 ÷ 합계 ' + sum + ' × 100 (만점 100)');
    $('#btnRun').prop('disabled', sum <= 0);
  }

  /* 묶음 하나의 설정값만 바꾼다 (0~100, STEP 단위). 다른 묶음은 그대로 */
  function setWeight(key, v) {
    weights[key] = Math.max(0, Math.min(100, r5(Number(v) || 0)));
    refreshWeights();
  }

  function resetWeights() {
    C.WEIGHT_GROUPS.forEach(function (g) { weights[g.key] = g.def; });
    refreshWeights();
  }

  /* 현재 패널 상태 → 서버 파라미터 (요인 on/off · 기준값 · 묶음 가중치 설정값 4개, 꺼진 묶음은 0 으로 보냄) */
  function getCriteria() {
    var p = { scoreMin: C.SCORE_MIN };
    C.FACTORS.forEach(function (f) {
      var $row = $('[data-factor="' + f.key + '"]');
      p[f.key + 'On'] = $row.find('.f-chk').is(':checked');
      if (f.param) p[f.param] = $row.find('.f-rng').val();
    });
    C.WEIGHT_GROUPS.forEach(function (g) { p[g.key + 'W'] = locked(g) ? 0 : (weights[g.key] || 0); });
    return p;
  }

  /* 사용자가 패널에서 체크 · 기준값 · 가중치를 직접 바꿨다 → [분석 실행] 에 "변경됨" 표시 + 분석 기준 줄의 선택 칩에 "· 수정됨" (onChange = map-main.js) */
  function dirty() { $('#btnRun').addClass('dirty'); if (onChange) onChange(); }

  /* 바뀐 행을 0.6초 강조 (map.css .flash) */
  function flash($el) {
    $el.removeClass('flash');
    void $el[0].offsetWidth;                       // 애니메이션을 처음부터 다시
    $el.addClass('flash');
    setTimeout(function () { $el.removeClass('flash'); }, 650);
  }

  /**
   * 시나리오 프리셋 적용 (2026-11-17 G, MAP_CONFIG.SCENARIOS 의 한 줄). 왼쪽 패널의 실제 화면 요소를 바로 바꾼다 :
   *   요인 체크박스(.f-chk · 행의 .off), 가중치 팝업 슬라이더 · 값 라벨 · 채움 · 잠김. 패널이 닫혀 있어도 같은 DOM 을 바꿔 두므로 나중에 열면 그 값이 보인다.
   *   factors · weights 가 없는 프리셋(기본)은 처음 체크 상태(FACTORS[].on) · 기본 가중치(WEIGHT_GROUPS[].def).
   *   기준값 슬라이더(노후 연수 등)는 기본값으로 둔다. 프리셋 가중치는 설정값 그대로 넣는다 (반영 점수는 비율로 환산).
   *   이벤트를 내지 않으므로 "수정됨" 이 붙지 않는다
   */
  function applyPreset(p) {
    p = p || {};
    var want = p.factors || C.FACTORS.filter(function (f) { return f.on; }).map(function (f) { return f.key; });
    C.FACTORS.forEach(function (f) {
      var $row = $('[data-factor="' + f.key + '"]'), $chk = $row.find('.f-chk');
      var on = want.indexOf(f.key) >= 0, changed = $chk.is(':checked') !== on;
      $chk.prop('checked', on);
      /* 기준값 슬라이더(노후 연수 등)는 프리셋마다 다르지 않고 늘 기본값. 사용자가 고쳐 둔 값("수정됨")이 있으면 기본값으로 되돌린다 */
      var $rng = $row.find('.f-rng');
      if ($rng.length && f.def != null && Number($rng.val()) !== f.def) { $rng.val(f.def); changed = true; }
      if (!changed) return;
      refreshRow($row);
      flash($row);
    });
    var before = $.extend({}, weights);
    C.WEIGHT_GROUPS.forEach(function (g) {
      var w = p.weights && p.weights[g.key] != null ? Number(p.weights[g.key]) : g.def;
      weights[g.key] = Math.max(0, Math.min(100, w));
    });
    refreshWeights();
    C.WEIGHT_GROUPS.forEach(function (g) { if (before[g.key] !== weights[g.key]) flash($('.wp-row[data-gw="' + g.key + '"]')); });
    $('#btnRun').removeClass('dirty');
  }



  function init(opts) {
    onRun = opts.onRun;
    onToggle = opts.onToggle;
    onChange = opts.onChange;

    /* 요인 행 */
    $('[data-factor]').each(function () {
      var $row = $(this), f = factorOf($row.data('factor'));
      if (!f) return;
      $row.find('.f-chk').prop('checked', f.on);
      var $rng = $row.find('.f-rng');
      if ($rng.length) $rng.attr({ min: f.min, max: f.max, step: f.step }).val(f.def);
      refreshRow($row);
    });
    resetWeights();

    $('.layer-panel').on('change input', '.f-rng', function () { refreshRow($(this).closest('[data-factor]')); dirty(); });
    $('.layer-panel').on('change', '.f-chk', function () {
      var $row = $(this).closest('[data-factor]');
      refreshRow($row);
      refreshWeights();                                                // 묶음이 전부 꺼지면 "꺼짐" (설정값은 기억해 두었다가 다시 켜면 그대로)
      dirty();
    });

    /* 섹션 접기 */
    $('.layer-panel').on('click', '.sec-head', function (e) {
      $(this).closest('.sec').toggleClass('collapsed');
    });

    /* 가중치 팝업 */
    $('#btnWeights').on('click', function () { $('#weightPop').toggleClass('open'); });
    $('#weightClose').on('click', function () { $('#weightPop').removeClass('open'); });
    $('#weightReset').on('click', function () { resetWeights(); dirty(); });
    C.WEIGHT_GROUPS.forEach(function (g) {
      $('#w-' + g.key).attr({ min: 0, max: 100, step: STEP }).on('input change', function () {
        setWeight(g.key, this.value);
        dirty();
      });
    });

    /* 분석 실행 : 이때만 조건이 확정된다 */
    $('#btnRun').on('click', function () {
      $(this).removeClass('dirty');
      $('#weightPop').removeClass('open');
      if (onRun) onRun(getCriteria());
    });

    /* 패널 폭 : 오른쪽 끝 손잡이를 끌면 260~480px (기본 300), itgeo.lpW 에 기억. --lp-w 를 바꾸면 --lp-right · 접기 버튼 · 가중치 팝업 · 지도 위 요소가 같이 움직인다 */
    Common.resizer({ handle: '#lpGrip', cssVar: '--lp-w', key: 'itgeo.lpW', min: 260, max: 480, def: 300, sign: 1 });

    /* 패널 여닫기 (처음에는 닫힘 : map.jsp 가 left-closed 를 붙여 렌더링) */
    $('#toggleLeft').on('click', function () {
      var closed = $('.map-layout').toggleClass('left-closed').hasClass('left-closed');
      $(this).attr('aria-expanded', String(!closed));
      /* 레이어 패널은 지도 위에 떠 있어서 지도 크기가 그대로 → resize 를 부르지 않는다 (부르면 지도가 움찔) */
    });
  }

  return { init: init, getCriteria: getCriteria, applyPreset: applyPreset };
})();
