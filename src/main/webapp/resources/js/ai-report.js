/*
 * AI 현장 확인보고서 (05 건물 확인 이력, 인수인계 아래 [AI 현장 확인보고서 생성]). 대시보드 "보고서 만들기"와 같은 화면 흐름
 *  1) 파일 형식 고르기 (Common.dialog + .fmt-list, 대시보드와 같은 모양) : PDF · 한글(HWPX). Excel · Word 는 준비 중
 *  2) "보고서를 작성 중입니다" 알림 (.rep-notice) → api/report/generate.do (본문은 LLM, 1 ~ 2분 걸릴 수 있음)
 *  3) 미리보기 창 (.pdf-view, 대시보드 PDF 보기 창과 같은 모양) : PDF 는 만든 PDF 를 그대로, 한글은 같은 내용을 화면 양식으로
 *  4) 다운로드 아이콘 = api/report/save.do (고른 형식으로 서버에 저장) → api/report/file.do 로 내려받기
 * 보고서명 = 사용한 현장조사이력의 가장 오래된 날짜 ~ 가장 최근 날짜 + " AI 보고서" (예: 2025.10.14~2026.11.22 AI 보고서)
 */
$(function () {
  var $page = $('#adPage'), $btn = $('#btnAiReport');
  if (!$page.length || !$btn.length) return;
  var bldId = String($page.attr('data-bld'));
  var esc = Common.esc;

  var FORMATS = [
    { v: 'PDF',  label: 'PDF',  sub: '인쇄 · 배포용, 바로 열어 봅니다', on: true },
    { v: 'HWPX', label: '한글 (hwpx)', sub: '한글에서 바로 고쳐 쓸 수 있어요', on: true },
    { v: 'XLSX', label: 'Excel (xlsx)', sub: '준비 중', on: false },
    { v: 'DOCX', label: 'Word (docx)', sub: '준비 중', on: false }
  ];
  var DL_ICO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';

  function dot(d) { return String(d || '').replace(/-/g, '.'); }

  /* 버튼 위 알림 (대시보드 .rep-notice 와 같은 모양) */
  var noticeTimer = null;
  function notice(text, busy) {
    clearTimeout(noticeTimer);
    $('#rpNoticeTxt').text(text);
    $('#rpNotice').toggleClass('busy', !!busy).prop('hidden', false);
    if (!busy) noticeTimer = setTimeout(function () { $('#rpNotice').prop('hidden', true); }, 4000);
  }
  function fail(msg) {
    $('#rpNotice').prop('hidden', true);
    Common.toast(msg);
  }

  /* 1) 파일 형식 고르기 */
  var picked = 'PDF';
  $(document).on('change', 'input[name="adRepFmt"]', function () { picked = this.value; });   // 창이 닫히면 DOM 이 지워지므로 미리 읽어 둔다

  $btn.on('click', function () {
    if (this.disabled) return;
    var from = $page.attr('data-from'), to = $page.attr('data-to'), n = $page.attr('data-rec-cnt');
    picked = 'PDF';
    var html = '<div class="dlg-info"><span class="t">' + esc(dot(from) + '~' + dot(to) + ' AI 보고서') + '</span>'
      + '<span class="s">' + esc($page.attr('data-place') || '') + ' · 현장조사이력 ' + esc(n) + '건'
      + ' (' + esc(dot(from)) + ' ~ ' + esc(dot(to)) + ')</span><span class="s">웹 · 모바일 앱에서 남긴 현장조사이력(관찰 메모 · 항목 점수 · 녹취록)을 함께 정리합니다.</span></div>'
      + '<div class="fmt-list">' + FORMATS.map(function (f, i) {
          return '<label class="fmt-opt' + (f.on ? '' : ' off') + '"><input type="radio" name="adRepFmt" value="' + f.v + '"' + (i === 0 ? ' checked' : '') + (f.on ? '' : ' disabled') + '>'
            + '<b>' + f.label + '</b><small>' + f.sub + '</small></label>';
        }).join('') + '</div>';
    Common.dialog({ title: 'AI 현장 확인보고서 만들기', html: html, okText: '생성' }).done(function (ok) {
      if (ok) make(picked);
    });
  });

  /* 2) 생성 */
  function make(fmt) {
    $btn.prop('disabled', true);
    notice('AI 현장 확인보고서를 작성 중입니다 (1 ~ 2분)', true);
    Common.api('POST', 'api/report/generate.do', { bldId: bldId, format: fmt })
      .done(function (r) {
        if (!r || !r.ok) { fail((r && r.msg) || '보고서를 만들지 못했습니다.'); return; }
        notice('보고서를 만들었어요. 다운로드 아이콘을 누르면 서버에 저장됩니다', false);
        showPreview(r);
      })
      .fail(function () { $('#rpNotice').prop('hidden', true); })   /* 문구는 Common.api 가 토스트로 */
      .always(function () { $btn.prop('disabled', false); });
  }

  /* 3) 미리보기 창 + 4) 다운로드 아이콘 */
  function showPreview(r) {
    var isPdf = r.format === 'PDF';
    var body = isPdf
      ? '<iframe title="보고서 미리보기" src="' + Common.url(r.previewUrl) + '"></iframe>'
      : '<div class="pv-doc"><p class="pv-note">한글(HWPX) 파일은 다운로드한 뒤 한글에서 열어 주세요. 아래는 같은 내용의 미리보기입니다.</p>' + r.html + '</div>';   /* html = 서버(ReportHtml)가 이스케이프해서 만든 양식 */
    var $v = $('<div class="pdf-view" role="dialog" aria-modal="true"></div>').attr('aria-label', r.title)
      .append('<div class="pv-box"><div class="pv-head"><b></b>'
        + '<span class="pv-act"><button type="button" class="pv-dl" title="' + (isPdf ? 'PDF' : '한글(HWPX)') + ' 파일로 서버에 저장하고 내려받기" aria-label="다운로드">' + DL_ICO + '</button>'
        + '<button type="button" class="pv-x" aria-label="닫기">×</button></span></div>' + body + '</div>')
      .appendTo('body');
    $v.find('.pv-head b').text(r.title + ' (' + (isPdf ? 'PDF' : '한글') + ')');

    function close() { $(document).off('keydown.adpv'); $v.remove(); }
    $v.on('click', function (e) { if (e.target === this) close(); });
    $v.find('.pv-x').on('click', close);
    $(document).on('keydown.adpv', function (e) { if (e.key === 'Escape' && !$('.dlg-bg').length) close(); });

    var saving = false;
    $v.find('.pv-dl').on('click', function () {
      if (saving) return;
      saving = true;
      var $d = $(this).prop('disabled', true).addClass('busy');
      Common.api('POST', 'api/report/save.do', { draftId: r.draftId }).done(function (s) {
        Common.toast('서버에 저장했습니다 : ' + s.fileName);
        window.location.href = Common.url(s.downloadUrl);
      }).always(function () { saving = false; $d.prop('disabled', false).removeClass('busy'); });
    });
  }
});
