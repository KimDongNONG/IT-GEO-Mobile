/*
 * 공통 : 컨텍스트 경로, HTML 이스케이프, 서버 호출(jQuery), 토스트
 * ctx 는 head.jspf 의 <meta name="ctx"> 에서 읽는다.
 */
window.Common = (function () {
  var CTX = ($('meta[name="ctx"]').attr('content') || '/').replace(/\/$/, '');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function url(path) {
    return CTX + '/' + String(path).replace(/^\//, '');
  }

  /* GET/POST JSON. 세션이 끊겨 로그인 화면(HTML)이 오면 로그인으로 보낸다 */
  function api(method, path, data) {
    return $.ajax({
      url: url(path),
      method: method,
      data: data || {},
      dataType: 'json',
      traditional: true
    }).fail(function (xhr) {
      if (xhr.status === 200 || xhr.status === 302 || xhr.status === 401) {
        location.href = url('loginform.do');
        return;
      }
      /* 403(관할 밖) · 400(가중치 등) · 500 은 GlobalExceptionHandler 가 {ok:false, msg} 로 준다 → 그 문구 그대로 */
      var m = xhr.responseJSON && xhr.responseJSON.msg;
      toast(m || '서버 요청에 실패했습니다. (' + xhr.status + ')');
    });
  }

  /* POST JSON 본문 (모바일 현장조사기록 수정 · AI 정리처럼 중첩 값이 있는 요청). 실패 처리는 api 와 같다 */
  function apiJson(path, body) {
    return $.ajax({
      url: url(path),
      method: 'POST',
      data: JSON.stringify(body || {}),
      contentType: 'application/json; charset=UTF-8',
      dataType: 'json'
    }).fail(function (xhr) {
      if (xhr.status === 200 || xhr.status === 302 || xhr.status === 401) {
        location.href = url('loginform.do');
        return;
      }
      var m = xhr.responseJSON && xhr.responseJSON.msg;
      toast(m || '서버 요청에 실패했습니다. (' + xhr.status + ')');
    });
  }

  var toastTimer = null;
  function toast(msg) {
    var $el = $('#app-toast');
    if (!$el.length) $el = $('<div id="app-toast" class="toast" role="status"></div>').appendTo('body');
    $el.text(msg).addClass('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $el.removeClass('show'); }, 2600);
  }

  /**
   * 안내 · 확인 모달 (브라우저 기본 alert / confirm 대신. 모양 = common.css .dlg-*, 건물 상세의 모달과 같은 톤)
   *   Common.dialog({ title, html | text, okText, cancelText }) → jQuery promise. [확인] = resolve(true), 닫기 · 취소 · Esc · 바깥 클릭 = resolve(false)
   *   cancelText 를 null 로 주면 버튼 하나(확인)만
   */
  function dialog(opt) {
    opt = opt || {};
    var dfd = $.Deferred();
    var cancelText = opt.cancelText === undefined ? '취소' : opt.cancelText;
    var $bg = $('<div class="dlg-bg" role="dialog" aria-modal="true"></div>');
    var $box = $('<div class="dlg"></div>').appendTo($bg);
    $('<div class="dlg-head"></div>')
      .append($('<h3></h3>').text(opt.title || '안내'))
      .append('<button type="button" class="dlg-x" aria-label="닫기">×</button>').appendTo($box);
    var $body = $('<div class="dlg-body"></div>').appendTo($box);
    if (opt.html != null) $body.html(opt.html); else $body.text(opt.text || '');
    var $foot = $('<div class="dlg-foot"></div>').appendTo($box);
    if (cancelText) $('<button type="button" class="btn btn-line btn-sm dlg-cancel"></button>').text(cancelText).appendTo($foot);
    var $ok = $('<button type="button" class="btn btn-primary btn-sm dlg-ok"></button>').text(opt.okText || '확인').appendTo($foot);

    var prevFocus = document.activeElement;
    function close(v) {
      $(document).off('keydown.dlg');
      $bg.removeClass('open');
      setTimeout(function () { $bg.remove(); }, 160);
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) {}
      dfd.resolve(v);
    }
    $ok.on('click', function () { close(true); });
    $box.find('.dlg-x, .dlg-cancel').on('click', function () { close(false); });
    $bg.on('mousedown', function (e) { if (e.target === this) close(false); });
    $(document).off('keydown.dlg').on('keydown.dlg', function (e) {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); close(false); }
      else if (e.key === 'Enter' && document.activeElement === $ok[0]) { e.preventDefault(); close(true); }
    });
    $bg.appendTo('body');
    setTimeout(function () { $bg.addClass('open'); $ok.trigger('focus'); }, 0);
    return dfd.promise();
  }

  /* "서울특별시 구로구 가리봉동 12-34" → "가리봉동 12-34" */
  function shortAddr(addr) {
    return String(addr || '').replace(/^서울특별시\s+/, '').replace(/^\S+구\s+/, '');
  }

  function num(n) { return Number(n || 0).toLocaleString(); }

  /* ---------- 공통 툴팁 : data-tip 속성이 있는 요소 아래 8px 에 말풍선 (모양 = common.css .tip) ---------- */
  var $tip = null;
  function showTip(el) {
    var t = el.getAttribute('data-tip');
    if (!t) return;
    if (!$tip) $tip = $('<div class="tip" role="tooltip"></div>').appendTo('body');
    $tip.text(t);
    var r = el.getBoundingClientRect(), w = $tip.outerWidth(), cx = r.left + r.width / 2;
    var left = Math.max(8, Math.min(cx - w / 2, window.innerWidth - w - 8));   // 화면 오른쪽 끝을 넘으면 왼쪽으로
    $tip.css({ left: left + 'px', top: (r.bottom + 8) + 'px' }).css('--tail', Math.max(10, Math.min(w - 10, cx - left)) + 'px').addClass('show');
  }
  function hideTip() { if ($tip) $tip.removeClass('show'); }
  $(document).on('mouseenter focusin', '[data-tip]', function () { showTip(this); })
    .on('mouseleave focusout mousedown', '[data-tip]', hideTip);
  /* 테마 전환 (2차 A) : <html data-theme="dark|light">, 저장 itgeo.theme (처음은 라이트). 페이지를 열 때는 head.jspf 의 인라인 스크립트가 먼저 붙인다.
     다크일 때 달("라이트 모드로"), 라이트일 때 해("다크 모드로") : 아이콘은 CSS 가 바꾸고 여기서는 툴팁만.
     바뀌면 document 에 'wf:theme' 을 알린다 (지도 가림막 색 · 구 색칠 · 차트처럼 JS 로 색을 넣는 곳이 다시 그리도록) */
  function theme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  function syncThemeBtn() { $('#btnTheme').attr('data-tip', theme() === 'light' ? '다크 모드로' : '라이트 모드로'); }
  $(document).on('click', '#btnTheme', function () {
    var t = theme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('itgeo.theme', t); } catch (e) {}
    syncThemeBtn(); hideTip();
    $(document).trigger('wf:theme', [t]);
  });
  $(syncThemeBtn);

  /**
   * 패널 폭 끌어서 조절. 폭은 :root 의 CSS 변수로 관리하고 localStorage 에 기억한다.
   *   Common.resizer({ handle: '#lpGrip', cssVar: '--lp-w', key: 'itgeo.lpW', min: 260, max: 480, def: 300, sign: 1 })
   *   sign = 1 : 오른쪽으로 끌면 넓어짐 (왼쪽 패널) / -1 : 왼쪽으로 끌면 넓어짐 (오른쪽 패널)
   */
  var SNAP_PX = 16;   // 기본 폭에 달라붙는 거리 (px)
  function resizer(opt) {
    var root = document.documentElement, $body = $('body');
    function set(w) {
      w = Math.max(opt.min, Math.min(opt.max, Math.round(w)));
      root.style.setProperty(opt.cssVar, w + 'px');
      return w;
    }
    try {                                                   // 지난번 폭 복원 (움직이는 효과 없이)
      var saved = Number(localStorage.getItem(opt.key));
      if (saved) { $body.addClass('resizing'); set(saved); setTimeout(function () { $body.removeClass('resizing'); }, 50); }
    } catch (e) {}
    $(opt.handle).on('mousedown', function (e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest('.side-toggle'))) return;   // 여닫기 버튼에서는 크기조정을 시작하지 않는다
      e.preventDefault();
      var x0 = e.clientX, w0 = parseFloat(getComputedStyle(root).getPropertyValue(opt.cssVar)) || opt.def, w = w0;
      var $h = $(this);
      $body.addClass('resizing dragging');                  // 끄는 동안 transition 끔 (common.css)
      $(document).on('mousemove.rz', function (ev) {
        /* 기본 폭 자석 : 커서 기준 폭이 기본 폭 ±SNAP_PX 안이면 기본 폭에 딱 붙이고(점선 가이드 .snap), 벗어나면 다시 커서를 따라간다. 늘릴 때 · 줄일 때 같다 */
        var raw = w0 + (ev.clientX - x0) * opt.sign, snap = Math.abs(raw - opt.def) <= SNAP_PX;
        w = set(snap ? opt.def : raw);
        $h.toggleClass('snap', snap);
      })
        .on('mouseup.rz', function () {
          $(document).off('.rz');
          $h.removeClass('snap');
          $body.removeClass('resizing dragging');
          try { localStorage.setItem(opt.key, String(w)); } catch (err) {}
        });
    }).on('dblclick', function () {                         // 두 번 누르면 기본 폭
      set(opt.def);
      try { localStorage.removeItem(opt.key); } catch (err) {}
    });
  }

  /**
   * 대시보드 "이어서 보기" 기록 (DashboardRESTController recent.do → recent_view, 탭마다 마지막 1건).
   * 화면을 열면 자동으로 한 번. 화면 안에서 보는 대상이 바뀌면 Common.recent({ title, sub }) 로 다시 부르면 된다
   */
  var RECENT_SUB = { 'map.do': '지도 · 분석', 'fieldlist.do': '리스트 목록', 'fielddetail.do': '현장 확인 중', 'fieldedit.do': '리스트 편집 중', 'archive.do': '보관함 목록', 'archivedetail.do': '건물 확인 이력' };
  function recent(opt) {
    var $m = $('#recentMeta'), menu = $m.attr('data-menu');
    if (menu !== 'map' && menu !== 'field' && menu !== 'archive') return;
    var page = location.pathname.split('/').pop();
    if (!RECENT_SUB[page]) return;
    opt = opt || {};
    var h1 = $.trim($('.page h1').first().clone().children().remove().end().text());
    $.ajax({
      url: url('api/dashboard/recent.do'), method: 'POST', dataType: 'json',
      data: {
        menu: menu,
        url: page + location.search,
        title: opt.title || $m.attr('data-title') || h1,
        sub: opt.sub || $m.attr('data-sub') || RECENT_SUB[page]
      }
    });   /* 실패해도 화면에는 알리지 않는다 */
  }
  $(function () { recent(); });

  return { ctx: CTX, esc: esc, url: url, api: api, apiJson: apiJson, recent: recent, toast: toast, dialog: dialog, shortAddr: shortAddr, num: num, resizer: resizer, theme: theme };
})();
