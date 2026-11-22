<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<c:set var="pageTitle" value="업무 캘린더"/>
<c:set var="pageCss" value="pages"/>

<c:set var="activeMenu" value="calendar"/>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<%@ include file="/WEB-INF/views/include/header.jspf" %>

<%-- 달력 공용 스타일 (현장 확인 리스트 달력과 같은 파일) + 이 페이지 전용 workcal.css --%>
<link rel="stylesheet" href="${ctx}/resources/css/pages_calendar.css">
<link rel="stylesheet" href="${ctx}/resources/css/workcal.css">

<div class="page page-scroll">
  <%-- 제목 줄 : 업무 캘린더 · ‹ 2026년 11월 › · 오늘 ········ 범례 · 이번 달 리스트 n개 --%>
  <div class="wc-head">
    <h1>업무 캘린더</h1>
    <button type="button" class="wc-nav" id="wcPrev" title="이전 달">‹</button>
    <b class="wc-title" id="wcTitle"></b>
    <button type="button" class="wc-nav" id="wcNext" title="다음 달">›</button>
    <button type="button" class="btn btn-line btn-sm" id="wcToday">오늘</button>
    <div class="wc-legend">
      <span><i class="st-todo"></i>조사 전</span>
      <span><i class="st-doing"></i>조사 중</span>
      <span><i class="st-done"></i>확인 완료</span>
      <em>이번 달 리스트 <b id="wcCount">0</b>개</em>
    </div>
  </div>

  <div class="wc-grid">
    <%-- 왼쪽 : 한 달 달력. 오른쪽 "내 현장 확인 리스트" 를 끌어다 날짜에 놓으면 일정으로 들어가고, 일정 막대의 × 로 뺀다 --%>
    <div id="wcCalendar" class="fl-calendar wc-calendar"></div>

    <div class="wc-side-col" id="wcSideCol">
      <%-- 오른쪽 위 : 고른 날짜의 방문 리스트. 리스트를 누르면 그 안의 건물이 펼쳐진다 --%>
      <aside class="wc-side">
        <div class="wc-side-head"><h3 id="wcDay"></h3><small id="wcDaySub"></small></div>
        <div id="wcLists"></div>
      </aside>

      <%-- 오른쪽 아래 : 내 현장 확인 리스트 전부 (진행중 → 완료). 리스트가 늘면 아래로 계속 붙고, 건물은 접혀 있다 --%>
      <aside class="wc-side wc-all">
        <div class="wc-side-head">
          <h3>내 현장 확인 리스트 <b class="wc-all-cnt" id="wcAllCnt">0</b></h3>
          <small>리스트를 끌어다 달력 날짜에 놓으면 일정에 들어갑니다. 눌러서 건물을 펼쳐 보세요.</small>
        </div>
        <div id="wcAll"></div>
      </aside>
    </div>
  </div>
</div>

<%-- 리스트 정보 (이름 · 건물 수 · 완료 수 · 건물들). 화면에는 안 보이고 스크립트가 읽는다 --%>
<div id="wcData" style="display:none">
  <c:forEach var="f" items="${lists}">
    <div class="d-list" data-id="${f.surveyId}" data-title="<c:out value='${f.title}'/>" data-item-cnt="${f.itemCnt}" data-done-cnt="${f.doneCnt}">
      <c:forEach var="it" items="${f.items}">
        <i data-title="<c:out value='${it.title}'/>" data-addr="<c:out value='${it.addr}'/>" data-score="${it.score}" data-checked="${it.checked}" data-order="${it.visitOrder}"></i>
      </c:forEach>
    </div>
  </c:forEach>
</div>

<script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.15/locales/ko.global.min.js"></script>
<script src="${ctx}/resources/js/common.js"></script>
<script>
  $(function () {
    /* ---------- 리스트 정보 읽기 : LISTS[surveyId] = {id, title, itemCnt, doneCnt, status, items[]}, ORDER = 화면 순서 ---------- */
    var LISTS = {}, ORDER = [];
    $('#wcData .d-list').each(function () {
      var $l = $(this), id = String($l.data('id')), item = Number($l.data('itemCnt')) || 0, done = Number($l.data('doneCnt')) || 0;
      LISTS[id] = {
        id: id, title: String($l.data('title')), itemCnt: item, doneCnt: done,
        status: done === 0 ? 'todo' : (done >= item ? 'done' : 'doing'),
        items: $l.find('i').map(function () {
          var $i = $(this);
          return { title: String($i.data('title')), addr: String($i.data('addr') || ''), score: $i.data('score'), checked: String($i.data('checked')) === 'true' };
        }).get()
      };
      ORDER.push(id);
    });
    var ST_NAME = { todo: '조사 전', doing: '조사 중', done: '확인 완료' };
    var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
    function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function listOf(ev) { return LISTS[String(ev.extendedProps.surveyId)] || { title: ev.title, itemCnt: 0, doneCnt: 0, status: 'todo', items: [] }; }
    function failMsg(xhr, def) { return (xhr && xhr.responseJSON && xhr.responseJSON.msg) || def; }

    var selDate = ymd(new Date());
    var openDay = {};   /* 오른쪽 위 : 펼친 일정 (scheduleId) */
    var openAll = {};   /* 오른쪽 아래 : 펼친 리스트 (surveyId) */

    /* ---------- 달력 ---------- */
    var calendar = new FullCalendar.Calendar(document.getElementById('wcCalendar'), {
      initialView: 'dayGridMonth',
      locale: 'ko',
      headerToolbar: false,                  /* 제목 · 이전/다음은 위 wc-head 에서 */
      height: 'auto',
      fixedWeekCount: false,                 /* 그 달에 필요한 주만 */
      dayMaxEvents: 3,
      moreLinkContent: function (a) { return '+' + a.num + ' 더보기'; },
      dayCellContent: function (a) { return a.date.getDate(); },   /* "1일" 대신 "1" */
      editable: true,                        /* 일정을 끌어 다른 날로 */
      eventDurationEditable: false,
      droppable: true,                       /* 오른쪽 리스트를 끌어와 놓기 */
      events: {
        url: '${ctx}/api/field/schedule.do',
        method: 'GET',
        failure: function () { Common.toast('달력 일정을 불러오지 못했습니다.'); }
      },
      /* 상태(조사 전 · 조사 중 · 확인 완료)별 색 + 오른쪽에 × (이 날짜에서 빼기) */
      eventDidMount: function (info) {
        info.el.classList.add('st-' + listOf(info.event).status);
        if (!info.event.id) return;          /* 끌어다 놓는 중인 임시 막대에는 × 없음 */
        var x = document.createElement('span');
        x.className = 'fc-x'; x.title = '이 날짜에서 빼기'; x.textContent = '×';
        info.el.appendChild(x);
      },
      eventsSet: function () { renderSide(); countMonth(); },
      datesSet: function () { $('#wcTitle').text(calendar.view.title); countMonth(); },
      dateClick: function (info) { selDate = info.dateStr; renderSide(); },
      /* × 를 누르면 빼기, 막대의 나머지를 누르면 그 날짜 · 그 리스트를 오른쪽에 펼침 */
      eventClick: function (info) {
        info.jsEvent.preventDefault();
        if ($(info.jsEvent.target).closest('.fc-x').length) { removeEvent(info.event); return; }
        selDate = ymd(info.event.start); openDay[info.event.id] = true; renderSide();
      },
      dayCellClassNames: function (a) { return ymd(a.date) === selDate ? ['wc-sel'] : []; },
      eventDrop: function (info) {
        Common.api('POST', 'api/field/schedule/move.do', { scheduleId: info.event.id, date: ymd(info.event.start) }).done(function (res) {
          if (!res || !res.ok) { info.revert(); Common.toast((res && res.msg) || '일정을 옮기지 못했습니다.'); return; }
          selDate = ymd(info.event.start); renderSide();
        }).fail(function (xhr) { info.revert(); Common.toast(failMsg(xhr, '일정을 옮기지 못했습니다.')); });
      },
      /* 오른쪽 리스트를 날짜에 놓음 → 저장. 저장되면 서버 기준으로 다시 그림 (scheduleId 를 받으려고) */
      eventReceive: function (info) {
        var ev = info.event, date = ymd(ev.start), title = ev.title;
        ev.remove();
        Common.api('POST', 'api/field/schedule/add.do', { surveyId: ev.extendedProps.surveyId, date: date }).done(function (res) {
          if (res && res.ok) { selDate = date; calendar.refetchEvents(); Common.toast('"' + title + '" 을(를) ' + date + ' 에 넣었습니다.'); }
          else Common.toast((res && res.msg) || '일정을 넣지 못했습니다.');
        }).fail(function (xhr) { Common.toast(failMsg(xhr, '일정을 넣지 못했습니다.')); });
      }
    });
    calendar.render();
    $('#wcPrev').on('click', function () { calendar.prev(); });
    $('#wcNext').on('click', function () { calendar.next(); });
    $('#wcToday').on('click', function () { calendar.today(); selDate = ymd(new Date()); renderSide(); });

    /* 오른쪽 리스트 카드(위 · 아래 둘 다)의 머리 줄을 달력으로 끌 수 있게 (현장 확인 리스트 화면과 같은 방식).
       살짝(8px) 움직여야 끌기로 보므로 클릭(⌄ 펼치기 · 수정 · 빼기)은 그대로 */
    new FullCalendar.Draggable(document.getElementById('wcSideCol'), {
      itemSelector: '.wc-card .wc-row',
      minDistance: 8,
      eventData: function (el) {
        var L = LISTS[String($(el).closest('.wc-card').data('id'))] || {};
        return { title: L.title, extendedProps: { surveyId: L.id }, create: true };
      }
    });

    /* 끄는 중 표시 : 카드 머리를 누르고 8px 넘게 움직이면 body.wc-dragging (달력 칸 점선 · 잡은 카드 흐리게), 놓으면 끔.
       FullCalendar Draggable 은 외부 끌기 시작/끝 이벤트가 없어서 포인터로 직접 본다. 클릭(펼치기 · 수정 · 빼기)은 그대로 */
    (function () {
      var down = null;
      $('#wcSideCol').on('pointerdown', '.wc-card .wc-row', function (e) {
        if (e.button !== 0 || $(e.target).closest('a, button').length) return;
        down = { x: e.clientX, y: e.clientY, $card: $(this).closest('.wc-card') };
      });
      $(document).on('pointermove.wcdrag', function (e) {
        if (!down || $('body').hasClass('wc-dragging')) return;
        if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) >= 8) { $('body').addClass('wc-dragging'); down.$card.addClass('wc-src'); }
      }).on('pointerup.wcdrag pointercancel.wcdrag', function () {
        if (down) down.$card.removeClass('wc-src');
        down = null; $('body').removeClass('wc-dragging');
      });
    })();

    /* 일정 빼기 (리스트 자체는 남는다). 달력 × 와 오른쪽 위 [빼기] 가 같이 쓴다 */
    function removeEvent(ev) {
      if (!ev || !confirm('"' + ev.title + '" 을(를) ' + ymd(ev.start) + ' 일정에서 뺄까요?\n리스트 자체는 지워지지 않습니다.')) return;
      Common.api('POST', 'api/field/schedule/delete.do', { scheduleId: ev.id }).done(function (res) {
        if (res && res.ok) { delete openDay[ev.id]; ev.remove(); renderSide(); countMonth(); }
        else Common.toast((res && res.msg) || '일정을 빼지 못했습니다.');
      }).fail(function (xhr) { Common.toast(failMsg(xhr, '일정을 빼지 못했습니다.')); });
    }

    /* 이번 달(보고 있는 달)에 들어 있는 리스트 수 */
    function countMonth() {
      var m = calendar.getDate().getMonth(), y = calendar.getDate().getFullYear();
      var n = calendar.getEvents().filter(function (e) { return e.id && e.start.getMonth() === m && e.start.getFullYear() === y; }).length;
      $('#wcCount').text(n);
    }

    /* ---------- 리스트 카드 하나 (머리 줄 + 접히는 건물 목록). 오른쪽 위 · 아래가 같이 쓴다 ---------- */
    function card(L, key, open, acts) {
      var $c = $('<div class="wc-card">').toggleClass('open', !!open).attr('data-id', L.id).attr('data-key', key);
      var $row = $('<div class="wc-row">');
      $row.append($('<span class="wc-grip" title="잡고 끌어서 달력 날짜에 놓기" aria-hidden="true">'));   /* ||| 손잡이 : 끌 수 있다는 표시 */
      $row.append($('<i class="dot">').addClass('st-' + L.status));
      $row.append($('<div class="tx">').append($('<b>').text(L.title)).append($('<small>').text(L.itemCnt + '개 건물 · ' + L.doneCnt + '개 완료')));
      var $right = $('<div class="rt">');
      if (acts) $right.append(acts);
      else $right.append($('<span class="st-badge">').addClass('st-' + L.status).text(ST_NAME[L.status]));
      $right.append($('<button type="button" class="wc-caret" title="건물 펼치기" aria-label="건물 펼치기">'));
      $row.append($right);
      $c.append($row);

      var $bld = $('<div class="wc-bld">');
      L.items.forEach(function (it) {
        $bld.append($('<div class="wc-b">')
          .append($('<div class="tx">').append($('<b>').text(it.title)).append($('<small>').text((it.addr ? it.addr + ' · ' : '') + (it.checked ? '확인 완료' : '조사 전'))))
          .append($('<div class="sc">').append($('<b>').text(it.score)).append($('<small>').text('취약도'))));
      });
      if (!L.items.length) $bld.append($('<div class="wc-empty">').text('담긴 건물이 없습니다.'));
      $c.append($bld);
      return $c;
    }

    /* ---------- 오른쪽 패널 ---------- */
    function renderSide() {
      /* 고른 날짜 칸 테두리 */
      $('#wcCalendar .fc-daygrid-day').removeClass('wc-sel').filter('[data-date="' + selDate + '"]').addClass('wc-sel');

      /* 위 : 고른 날짜의 일정 */
      var d = new Date(selDate + 'T00:00:00');
      var evs = calendar.getEvents().filter(function (e) { return e.id && ymd(e.start) === selDate; });
      $('#wcDay').text((d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WEEK[d.getDay()] + ')');
      $('#wcDaySub').text('방문 리스트 ' + evs.length + '개' + (evs.length ? ' · ⠿ 를 잡고 끌어서 다른 날짜에도 넣을 수 있어요' : ''));
      var $lists = $('#wcLists').empty();
      if (!evs.length) $lists.append($('<div class="wc-empty">').text('이 날짜에 넣은 리스트가 없습니다. 아래 "내 현장 확인 리스트" 에서 끌어다 놓으세요.'));
      evs.forEach(function (ev) {
        var L = listOf(ev);
        var $act = $('<div class="acts">')
          .append($('<a class="btn btn-line btn-sm">').attr('href', '${ctx}/fieldedit.do?listId=' + ev.extendedProps.surveyId).text('수정'))
          .append($('<button type="button" class="btn btn-line btn-sm wc-del">').attr('data-ev', ev.id).text('빼기'));
        $lists.append(card($.extend({}, L, { id: String(ev.extendedProps.surveyId) }), ev.id, openDay[ev.id], $act));
      });

      /* 아래 : 내 리스트 전부 */
      var $all = $('#wcAll').empty();
      $('#wcAllCnt').text(ORDER.length);
      if (!ORDER.length) $all.append($('<div class="wc-empty">').text('현장 확인 리스트가 없습니다. 현장 확인 리스트 화면에서 먼저 만들어 주세요.'));
      ORDER.forEach(function (id) { $all.append(card(LISTS[id], id, openAll[id])); });
    }

    /* 카드 머리를 누르면 건물 접기/펼치기 (버튼 · 링크는 제외, ⌄ 는 포함) */
    $('#wcLists, #wcAll').on('click', '.wc-row', function (e) {
      if ($(e.target).closest('a, button:not(.wc-caret)').length) return;
      var $c = $(this).closest('.wc-card'), key = String($c.data('key'));
      var store = $(e.delegateTarget).is('#wcAll') ? openAll : openDay;
      store[key] = !store[key];
      $c.toggleClass('open', store[key]);
    });
    /* 오른쪽 위 [빼기] */
    $('#wcLists').on('click', '.wc-del', function () { removeEvent(calendar.getEventById(String($(this).data('ev')))); });
  });
</script>
</body>
</html>
