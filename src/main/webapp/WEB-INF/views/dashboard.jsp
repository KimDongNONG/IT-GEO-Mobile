<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<%@ taglib prefix="fn" uri="jakarta.tags.functions" %>
<%--
  대시보드 (DashboardController → DashboardTO d, dashJson)
  ┌ 상단 한 줄 : 기상청 현재 기온 · 기상특보 · 관측 기준 시각 (dashboard.js 가 api/dashboard/weather.do 로)
  ├ 왼쪽   : 고위험 가구 확인율 · 월간 캘린더(업무 캘린더 survey_schedule, 읽기 전용) · 이어서 보기(recent_view)
  ├ 가운데 : 오늘 일정 (달력 날짜를 누르면 그날 일정)          ┐ 위
  ├ 오른쪽 : 동별 남은 고위험 가구 (많은 순 / 가나다순)         ┘
  └ 아래   : 월별 추이 (확인 완료 건물 수, 최근 6개월) · N월 현황 보고서 (보고서 만들기 · 지난 보고서 보기)
--%>
<c:set var="pageTitle" value="대시보드"/>
<c:set var="pageCss" value="pages"/>
<c:set var="activeMenu" value="dashboard"/>
<c:set var="ctx" value="${pageContext.request.contextPath}"/>
<!DOCTYPE html>
<html lang="ko">
<%@ include file="/WEB-INF/views/include/head.jspf" %>
<body>
<%@ include file="/WEB-INF/views/include/header.jspf" %>

<%-- 화면 고정 + 내부 스크롤 (pages.css .page-scroll) : .dash2 는 최대 폭(1600px)이 있어 바깥 감싸개가 스크롤한다 → 스크롤바는 창 오른쪽 끝, 양옆 여백에서도 휠이 먹는다 --%>
<div class="page-scroll">
<div class="page dash2">
  <%-- ① 날씨 : 기온 → 특보(있을 때만) → 기상청 HH:00 --%>
  <div class="wx-line" id="wxLine" aria-live="polite">
    <b class="wx-temp" id="wxTemp">--°</b>
    <span class="wx-warns" id="wxWarns"></span>
    <span class="wx-time" id="wxTime">기상청 --:--</span>
  </div>

  <div class="d2-grid">
    <%-- ② 고위험 가구 확인율 : 내 현장확인 리스트 건물의 고위험 가구 기준 --%>
    <section class="card d2-rate">
      <h3 class="d2-title">고위험 가구 확인율</h3>
      <div class="rate-body">
        <div class="donut2" style="--pct:${d.highPct}">
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
            <circle class="dn-bg" cx="60" cy="60" r="48" fill="none"/>
            <circle class="dn-val" cx="60" cy="60" r="48" fill="none" pathLength="100" stroke-dasharray="${d.highPct} 100"/>
          </svg>
          <b>${d.highPct}%</b>
        </div>
        <dl class="rate-list">
          <div><dt>남은 곳</dt><dd class="c-remain">${d.highRemain}</dd></div>
          <div><dt>확인</dt><dd class="c-check">${d.highChecked}</dd></div>
          <div><dt>전체</dt><dd class="c-total">${d.highTotal}</dd></div>
        </dl>
      </div>
    </section>

    <%-- ③ 월간 캘린더 : 업무 캘린더와 같은 데이터, 보기만 (추가 · 수정은 캘린더 페이지) --%>
    <section class="card d2-cal">
      <div class="d2-head">
        <div class="cal-nav">
          <button type="button" id="calPrev" aria-label="이전 달">‹</button>
          <h3 class="d2-title" id="calTitle">${nowMonth}월</h3>
          <button type="button" id="calNext" aria-label="다음 달">›</button>
        </div>
        <small>날짜를 누르면 그날 일정</small>
      </div>
      <div class="cal-week"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span></div>
      <div class="cal-days" id="calDays"></div>
    </section>

    <%-- ⑤ 이어서 보기 : 탭마다 마지막으로 본 화면 (최대 3), 제목 = 상단 탭 이름 --%>
    <section class="card d2-cont">
      <h3 class="d2-title">이어서 보기</h3>
      <div class="cont-list">
        <c:forEach var="r" items="${d.recent}">
          <c:set var="tabNm" value="${r.menu == 'map' ? '취약공간 분석 지도' : r.menu == 'field' ? '현장 확인 리스트' : '보관함'}"/>
          <a class="cont-item" href="${ctx}/<c:out value='${r.url}'/>">
            <i class="cont-ico ico-${r.menu}" aria-hidden="true"></i>
            <span class="cont-txt">
              <b>${tabNm}</b>
              <small><c:out value="${r.title}"/><c:if test="${not empty r.title and not empty r.sub}"> · </c:if><c:out value="${r.sub}"/></small>
            </span>
            <time data-at="${r.viewedAt}"></time>
          </a>
        </c:forEach>
        <c:if test="${empty d.recent}"><div class="empty">최근에 본 화면이 없습니다.</div></c:if>
      </div>
    </section>

    <%-- ③ ④ 오늘 일정 (기본) / 달력에서 고른 날 일정 --%>
    <section class="card d2-today">
      <div class="d2-head">
        <h3 class="d2-title"><span id="dayTitle">오늘 일정</span> <small id="daySub"></small></h3>
        <small id="dayCount"></small>
      </div>
      <div class="sch-list" id="schList"></div>
      <div class="sch-foot"><span>일정 추가 · 수정은 <a href="${ctx}/calendar.do">업무 캘린더</a>에서 해요</span><button type="button" class="link-btn" id="backToday" hidden>오늘로 돌아가기</button></div>
    </section>

    <%-- ⑦ 동별 남은 고위험 가구 --%>
    <section class="card d2-dong">
      <div class="d2-head">
        <h3 class="d2-title">동별 남은 고위험 가구
          <span class="sort-sel"><select id="dongSort" aria-label="정렬">
            <option value="remain">많은 순</option>
            <option value="name">가나다순</option>
          </select></span>
        </h3>
        <a class="link-more" href="${ctx}/map.do">지도에서 보기 →</a>
      </div>
      <div class="dong-list" id="dongList"></div>
      <div class="d2-legend"><span><i class="lg remain"></i>아직 확인 안 함</span><span><i class="lg check"></i>확인함</span></div>
    </section>

    <%-- ⑥ 월별 추이 : 현장 확인 리스트 "확인 완료" 건물 수 (이번 달 막대만 진하게) --%>
    <section class="card d2-trend">
      <c:set var="m0" value="${d.monthly[0].ym}"/>
      <h3 class="d2-title">월별 추이 <small>${fn:substring(m0, 5, 6) == '0' ? fn:substring(m0, 6, 7) : fn:substring(m0, 5, 7)}월 ~ ${nowMonth}월</small></h3>
      <div class="trend-box"><canvas id="trendChart"></canvas></div>
      <div class="d2-legend"><span><i class="lg check"></i>확인 완료 (건물 수)</span></div>
    </section>

    <%-- ⑧ 이번 달 현황 보고서 : 숫자는 다른 그래프에 이미 있으니 박스에는 버튼과 지난 보고서만 --%>
    <section class="card d2-result rp-box">
      <div class="rep-notice" id="repNotice" role="status" hidden><i class="spin" aria-hidden="true"></i><span id="repNoticeTxt"></span></div>
      <div class="rp-head">
        <h3 class="d2-title">${nowMonth}월 현황 보고서</h3>
        <%-- 보고서 저장소 : 만든 보고서가 있으면 보인다 (보고서를 만들면 dashboard.js 가 보이게 함) --%>
        <button type="button" class="rp-folder" id="btnReportBox" title="보고서 저장소" aria-label="보고서 저장소" ${empty d.lastReport ? 'hidden' : ''}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>
        </button>
      </div>
      <p class="rp-desc">대시보드 수치로 이번 달 보고서를 만들어요</p>
      <c:choose>
        <c:when test="${not empty d.lastReport}">
          <button type="button" class="rp-last" id="lastReport" data-id="${d.lastReport.reportId}">지난 보고서 · ${d.lastReport.month}월 보고서 (${d.lastReport.createdAt}) 보기 ›</button>
        </c:when>
        <c:otherwise>
          <button type="button" class="rp-last" id="lastReport" hidden></button>
          <span class="rp-none" id="noReport">아직 만든 보고서가 없어요</span>
        </c:otherwise>
      </c:choose>
      <button type="button" class="btn-report" id="btnReport" data-month="${nowMonth}">✦ 보고서 만들기</button>
    </section>
  </div>
</div>
</div><%-- /.page-scroll --%>

<%-- 보고서 저장소 (폴더 아이콘) : 왼쪽 = 만든 보고서 목록, 오른쪽 = 내용 확인 · 종합 의견과 상태(초안/확정) 수정 · 저장 · PDF 로 보기 (dashboard.js) --%>
<div class="ml-bg" id="rbModal" role="dialog" aria-modal="true" aria-labelledby="rbTitle" hidden>
  <div class="ml-modal rb-modal">
    <div class="ml-head">
      <div>
        <h3 id="rbTitle">보고서 저장소 <b id="rbCnt">0</b>건</h3>
        <p class="muted">만든 AI 통계 보고서입니다. 항목을 누르면 내용을 다시 보고, 종합 의견과 상태를 고쳐 저장할 수 있어요. 1 ~ 4번 숫자는 대시보드 집계값이라 고치지 않습니다.</p>
      </div>
      <button type="button" class="dlg-x" data-rb-close aria-label="닫기">×</button>
    </div>
    <div class="ml-body">
      <ul class="ml-list" id="rbList" role="listbox" aria-label="보고서 목록"></ul>
      <div class="ml-right">
        <div class="ml-detail" id="rbDetail"><p class="muted ml-empty">보고서를 고르세요.</p></div>
        <div class="ml-foot">
          <span class="muted" id="rbDirty"></span>
          <button type="button" class="btn btn-line" id="rbPdf" disabled>PDF 로 보기</button>
          <button type="button" class="btn btn-primary" id="rbSave" disabled>저장</button>
        </div>
      </div>
    </div>
  </div>
</div>

<script>window.DASH = ${dashJson};</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<%-- 보고서 PDF : 보고서 양식(HTML)을 그림으로(html2canvas) → A4 PDF(jsPDF). 브라우저 안에서만 만들고 보기 창으로 연다 --%>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="${ctx}/resources/js/common.js"></script>
<script src="${ctx}/resources/js/dashboard.js"></script>
</body>
</html>
