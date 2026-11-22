/*
 * 05 건물 확인 이력 (archivedetail.jsp)
 *  - 타임라인 [전체][요인 맞음][요인 아님] 필터 (data-yes / data-no)
 *  - [현장 확인 결과 입력] 폼 펼치기 · 새로 발견 요인 줄 추가 · 점수 보정 슬라이더
 *  - [부서로 넘기기] 폼 (상단 버튼 · 기록 카드 버튼 → 그 기록에 연결) · 인수인계 메모 폼
 *  - [재확인 요청 ▾] = 현장확인 리스트에 담기 (fieldadditems.do)
 *  - 타임라인은 이 칸만 스크롤 (#tlScroll 높이를 화면 아래 끝에 맞춤). 기록이 쌓여도 페이지는 길어지지 않는다
 */
$(function () {
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 타임라인 필터 */
  $('#tlFilter button').on('click', function () {
    $('#tlFilter button').removeClass('on'); $(this).addClass('on');
    var f = $(this).data('f'), shown = 0;
    $('#timeline .tl-item').each(function () {
      var ok = f === 'all' || (f === 'yes' && $(this).data('yes') === true) || (f === 'no' && $(this).data('no') === true);
      $(this).toggle(ok); if (ok) shown++;
    });
    $('#tlNone').toggle(shown === 0 && $('#timeline .tl-item').length > 0);
  });

  /* 폼 열고 닫기 */
  /* 본문은 #adPage 안에서만 스크롤한다 (pages.css .page-scroll : 헤더 고정) → 창이 아니라 #adPage 를 움직인다 */
  var $scroller = $('#adPage');
  function open(sel) {
    $(sel).slideDown(150);
    $scroller.animate({ scrollTop: $scroller.scrollTop() + $(sel).offset().top - $scroller.offset().top - 16 }, 200);
  }
  $(document).on('click', '[data-close]', function () { $($(this).data('close')).slideUp(120); });

  /* 방문 일시는 지금까지만 고를 수 있다 (15단계 D-12. 미래 시각 · 이상한 형식은 서버도 막는다) */
  (function () {
    var d = new Date();
    $('#visitedAt').attr('max', d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()));
  })();

  /* 현장 확인 결과 입력 */
  $('#btnCheckForm').on('click', function () {
    var $f = $('#checkForm');
    if ($f.is(':visible')) { $f.slideUp(120); return; }
    if (!$('#visitedAt').val()) {
      var d = new Date();
      $('#visitedAt').val(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()));
    }
    open('#checkForm');
  });
  $('#btnAddMore').on('click', function () {
    $('<div class="added-row"><input class="field" name="added" placeholder="새로 발견한 요인" autocomplete="off"><button type="button" class="btn btn-line btn-sm rm-added">－</button></div>')
      .appendTo('#addedWrap').find('input').trigger('focus');
  });
  $(document).on('click', '.rm-added', function () { $(this).closest('.added-row').remove(); });
  var base = Number($('#adjTo').text()) || 0;
  $('#scoreAdj').on('input change', function () {
    var v = Number(this.value);
    $('#adjVal').text((v > 0 ? '+' : '') + v);
    $('#adjTo').text(base + v);
  });

  /* 부서로 넘기기 */
  $('#btnTransfer').on('click', function () { $('#transferRecord').val(''); open('#transferForm'); });
  $(document).on('click', '.to-transfer', function () { $('#transferRecord').val(String($(this).data('record'))); open('#transferForm'); });

  /* 인수인계 메모 : +추가 = 공용 메모, 담당자 변경 = 받는 담당자 고르기 */
  $('#btnMemo').on('click', function () { open('#memoForm'); $('#memoText').trigger('focus'); });
  $('#btnHandover').on('click', function () { open('#memoForm'); $('#memoTo').trigger('focus'); if (!$('#memoText').val()) $('#memoText').val('담당자 변경(인수인계). '); });
  $('#memoForm').on('submit', function () {
    var v = $.trim($('#memoText').val());
    if (!v) { Common.toast('메모 내용을 입력하세요.'); return false; }
    if (v.length > 500) { Common.toast('메모는 500자까지 입력할 수 있습니다.'); return false; }   // handover_memo.memo VARCHAR(500)
  });

  /* 재확인 요청 드롭다운 (보관함과 같은 방식) */
  $(document).on('click', '.dd-toggle', function (e) {
    e.stopPropagation();
    if (this.disabled) return;
    var $dd = $(this).closest('.dd');
    $('.dd').not($dd).removeClass('open');
    $dd.toggleClass('open');
    if ($dd.hasClass('open')) {
      var r = this.getBoundingClientRect(), $m = $dd.find('.dd-menu'), w = $m.outerWidth() || 280;
      $m.css({ position: 'fixed', top: r.bottom + 4, left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), right: 'auto' });
    }
  });
  $(document).on('click', function () { $('.dd').removeClass('open'); });
  $(window).on('scroll resize', function () { $('.dd').removeClass('open'); });
  $scroller.on('scroll', function () { $('.dd').removeClass('open'); });          // 메뉴는 position: fixed → 본문이 움직이면 닫는다
  $(document).on('click', '.dd-menu', function (e) { e.stopPropagation(); });
  $(document).on('click', '.to-survey', function () {
    if (!$('#addItemsForm input[name=factorIds]').val()) { Common.toast('보관함에 없는 건물입니다.'); return; }
    $('#addListId').val($(this).data('id'));
    $('#addItemsForm').trigger('submit');
  });

  $('.pdf-btn').on('click', function () { Common.toast('확인서 PDF 는 연동 예정입니다.'); });

  /* 타임라인 높이 : 본문(#adPage) 맨 아래까지 남은 높이 (최소 320px). 폼을 열고 닫거나 창 크기가 바뀌면 다시 맞춘다 */
  function fitTimeline() {
    var el = document.getElementById('tlScroll'), sc = $scroller[0];
    if (!el || !sc) return;
    var top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;   // 본문 기준 위치 (스크롤과 상관없이)
    el.style.maxHeight = Math.max(320, sc.clientHeight - top - 16) + 'px';
    /* 타임라인 아래 여백(페이지 padding 등) 때문에 아직 넘치면 그만큼 더 줄인다. 오른쪽 칸이 더 길어 넘치는 것은 타임라인과 상관없으니 그대로 */
    var sec = el.closest('section'), aside = sec && sec.nextElementSibling;
    for (var i = 0; i < 3; i++) {
      var over = sc.scrollHeight - sc.clientHeight;
      if (over <= 0 || (aside && sec.getBoundingClientRect().bottom < aside.getBoundingClientRect().bottom)) break;
      var cur = parseFloat(el.style.maxHeight);
      if (cur <= 320) break;
      el.style.maxHeight = Math.max(320, cur - over) + 'px';
    }
  }
  fitTimeline();
  $(window).on('resize load', fitTimeline);                                         // 글꼴 · 사진을 다 읽으면 위쪽 높이가 바뀔 수 있다
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTimeline);
  $(document).on('click', '#btnCheckForm, #btnTransfer, .to-transfer, [data-close]', function () { setTimeout(fitTimeline, 260); });
});
