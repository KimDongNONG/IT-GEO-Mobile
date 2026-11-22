/*
 * 05 건물 확인 이력 : 모바일 미확인 현장조사기록 모달 (include/mobile-link-modal.jspf)
 *  - 타임라인 위 [N개의 미확인 현장조사기록이 있습니다] → 왼쪽 목록 + 오른쪽 정리내용
 *  - 정리내용 : ① 취약점수(1 ~ 5 수정) ② 메모(수정) ③ 사진(삭제만) ④ 녹취록(삭제만). 추가 기능은 없다
 *  - [수정 내용 저장] api/mobile-link/update.do
 *  - [AI 정리]       api/mobile-link/summarize.do : 요약 → 날짜별 현장조사이력에 기존 형식으로 기재 → 화면 새로 고침
 */
$(function () {
  var $page = $('#adPage'), $m = $('#mlModal');
  if (!$page.length || !$m.length) return;
  var bldId = String($page.attr('data-bld')), place = String($page.attr('data-place') || '');
  var esc = Common.esc;
  var LABELS = {}, WARN = 4;
  var items = [], curId = null, busy = false;
  var edits = {};        // linkId → { scores: {키: 점수}, memo: '…' } (저장 전 수정 내용)

  /* ---------- 열고 닫기 ---------- */
  function openModal() {
    $m.prop('hidden', false);
    setTimeout(function () { $m.addClass('open'); }, 0);
    $('body').addClass('ml-lock');
  }
  function closeModal() {
    $m.removeClass('open');
    setTimeout(function () { $m.prop('hidden', true); }, 150);
    $('body').removeClass('ml-lock');
  }
  function tryClose() {
    if (busy) return;
    if (!Object.keys(edits).length) { closeModal(); return; }
    Common.dialog({ title: '저장하지 않은 수정 내용', text: '저장하지 않은 수정 내용이 있습니다. 닫으면 수정한 내용이 사라집니다.', okText: '닫기', cancelText: '계속 수정' })
      .done(function (ok) { if (ok) { edits = {}; closeModal(); } });
  }
  $('#btnMobileLink').on('click', function () {
    openModal();
    $('#mlDetail').html('<p class="muted ml-empty">기록을 불러오는 중…</p>');
    load();
  });
  $m.on('click', '[data-ml-close]', tryClose);
  $m.on('mousedown', function (e) { if (e.target === this) tryClose(); });
  $(document).on('keydown.ml', function (e) {
    if (e.key === 'Escape' && !$m.prop('hidden') && !$('.dlg-bg').length) tryClose();   // 확인 창이 떠 있으면 그 창만 닫힌다
  });

  /* ---------- 데이터 ---------- */
  function load(keepId) {
    return Common.api('GET', 'api/mobile-link/list.do', { bldId: bldId }).done(function (r) {
      items = r.items || [];
      LABELS = r.scoreLabels || {};
      WARN = r.warnScore || 4;
      items.forEach(tidy);
      Object.keys(edits).forEach(function (id) { if (!find(Number(id))) delete edits[id]; });   // 이미 확인된 기록의 수정은 버린다
      $('#mlCnt').text(items.length);
      var keep = keepId && items.some(function (x) { return x.linkId === keepId; });
      curId = items.length ? (keep ? keepId : items[0].linkId) : null;
      renderList();
      renderDetail();
    });
  }
  function find(id) {
    for (var i = 0; i < items.length; i++) if (items[i].linkId === id) return items[i];
    return null;
  }
  function origScore(it, key) {
    for (var i = 0; i < it.scoreItems.length; i++) if (it.scoreItems[i].key === key) return it.scoreItems[i].score;
    return null;
  }
  function scoreOf(it, key) {
    var e = edits[it.linkId];
    return e && e.scores && Object.prototype.hasOwnProperty.call(e.scores, key) ? e.scores[key] : origScore(it, key);
  }
  function memoOf(it) {
    var e = edits[it.linkId];
    return e && e.memo !== undefined ? e.memo : (it.memo || '');
  }
  /** 화면의 항목 = 앱 기본 항목 + 앱이 보낸 다른 항목 */
  function scoreKeys(it) {
    var keys = Object.keys(LABELS);
    it.scoreItems.forEach(function (s) { if (keys.indexOf(s.key) < 0) keys.push(s.key); });
    return keys;
  }
  function labelOf(it, key) {
    if (LABELS[key]) return LABELS[key];
    for (var i = 0; i < it.scoreItems.length; i++) if (it.scoreItems[i].key === key) return it.scoreItems[i].label;
    return key;
  }
  function warnCount(it) {
    return scoreKeys(it).filter(function (k) { var v = scoreOf(it, k); return v != null && v >= WARN; }).length;
  }
  /** 원래 값과 같아진 수정은 지운다 (수정 중 표시 · 닫기 확인이 정확하도록) */
  function tidy(it) {
    var e = edits[it.linkId];
    if (!e) return;
    if (e.scores) {
      Object.keys(e.scores).forEach(function (k) { if (e.scores[k] === origScore(it, k)) delete e.scores[k]; });
      if (!Object.keys(e.scores).length) delete e.scores;
    }
    if (e.memo !== undefined && e.memo === (it.memo || '')) delete e.memo;
    if (!e.scores && e.memo === undefined) delete edits[it.linkId];
  }
  function edit(it) { return edits[it.linkId] || (edits[it.linkId] = {}); }

  /* ---------- 왼쪽 목록 ---------- */
  function renderList() {
    var $l = $('#mlList').empty();
    if (!items.length) { $l.append('<li class="ml-none">받은 기록이 없습니다.</li>'); return; }
    items.forEach(function (it) {
      var on = it.linkId === curId;
      $('<li role="option" tabindex="0"></li>')
        .attr({ 'data-id': it.linkId, 'aria-selected': on ? 'true' : 'false' })
        .toggleClass('on', on)
        .html('<b>' + esc(it.visitedAt) + (edits[it.linkId] ? ' <i class="ml-edited">수정 중</i>' : '') + '</b>'
          + '<span>' + esc(it.authorNm || '작성자 미상') + ' · ' + esc(it.resultLabel) + (it.residentStatus ? ' · 거주자 ' + esc(it.residentStatus) : '') + '</span>'
          + '<small>주의 ' + warnCount(it) + ' · 사진 ' + it.photos.length + (it.transcript ? ' · 녹취록' : '') + '</small>')
        .appendTo($l);
    });
  }
  $('#mlList').on('click keydown', 'li[data-id]', function (e) {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    curId = Number($(this).attr('data-id'));
    renderList();
    renderDetail();
  });

  /* ---------- 오른쪽 정리내용 ---------- */
  function sec(n, title, note, body) {
    return '<section class="ml-sec"><h4><span class="ml-num">' + n + '</span>' + title + (note ? '<small>' + note + '</small>' : '') + '</h4>' + body + '</section>';
  }
  function renderDetail(keepScroll) {
    var it = find(curId), $d = $('#mlDetail'), top = $d.scrollTop();
    $('#mlSave, #mlAi').prop('disabled', !it || busy);
    if (!it) { $d.html('<p class="muted ml-empty">확인할 현장조사기록이 없습니다.</p>'); $('#mlDirty').text(''); return; }

    var rs = it.residentStatus, rsCls = rs === '긴급' ? 'danger' : rs === '주의' ? 'warn' : '';
    var h = '<div class="ml-meta"><b>' + esc(it.visitedAt) + '</b><span>작성 ' + esc(it.authorNm || '미상') + ' · 방문 결과 ' + esc(it.resultLabel)
      + (rs ? ' · 거주자 상태 <i class="ml-rs ' + rsCls + '">' + esc(rs) + '</i>' : '') + ' · 받은 시각 ' + esc(it.receivedAt) + '</span></div>';
    var extra = [];
    if (it.checkText) extra.push('사전 탐지 요인 확인 : ' + esc(it.checkText));
    if (it.supportList && it.supportList.length) extra.push('필요한 지원 : ' + esc(it.supportList.join(', ')));
    if (extra.length) h += '<p class="ml-meta2">' + extra.join('<br>') + '</p>';

    // ① 취약점수
    var rows = scoreKeys(it).map(function (k) {
      var v = scoreOf(it, k), btns = '';
      for (var i = 1; i <= 5; i++) {
        btns += '<button type="button" role="radio" class="s' + i + (v === i ? ' on' : '') + '" data-v="' + i + '" aria-checked="' + (v === i) + '" aria-label="' + i + '점">' + i + '</button>';
      }
      return '<div class="ml-score" data-key="' + esc(k) + '"><span>' + esc(labelOf(it, k)) + '</span>'
        + '<div class="ml-pick" role="radiogroup" aria-label="' + esc(labelOf(it, k)) + '">' + btns + '</div>'
        + '<em class="ml-warn"' + (v != null && v >= WARN ? '' : ' hidden') + '>주의</em>'
        + (v == null ? '<small class="muted">미입력</small>' : '') + '</div>';
    }).join('');
    h += sec(1, '취약점수', '1 양호 ~ 5 위험 · ' + WARN + '점 이상 주의', '<div class="ml-scores">' + rows + '</div>');

    // ② 메모
    h += sec(2, '메모', '', '<textarea class="field ml-memo" id="mlMemo" rows="4" maxlength="5000" placeholder="메모가 없습니다. 필요하면 적어 주세요.">' + esc(memoOf(it)) + '</textarea>');

    // ③ 사진 (삭제만)
    var ph = it.photos.length
      ? '<div class="ml-photos">' + it.photos.map(function (p) {
          var src = Common.url('api/mobile-link/photo.do?photoId=' + p.photoId);
          return '<figure><a href="' + src + '" target="_blank" rel="noopener"><img src="' + src + '" alt="' + esc(p.label || '현장 사진') + '" loading="lazy"></a>'
            + '<button type="button" class="ml-x" data-photo="' + p.photoId + '" aria-label="사진 삭제">×</button>'
            + '<figcaption>' + esc(p.label || '현장 사진') + '</figcaption></figure>';
        }).join('') + '</div>'
      : '<p class="muted ml-none-txt">사진이 없습니다.</p>';
    h += sec(3, '사진', it.photos.length ? it.photos.length + '장 · 삭제만 할 수 있습니다' : '', ph);

    // ④ 녹취록 (삭제만)
    var tr = it.transcript
      ? '<div class="ml-transcript">' + esc(it.transcript) + '</div><div class="ml-sec-tools"><button type="button" class="btn btn-line btn-sm" id="mlDelTr">녹취록 삭제</button></div>'
      : '<p class="muted ml-none-txt">녹취록이 없습니다.</p>';
    h += sec(4, '녹취록', it.transcript ? '삭제만 할 수 있습니다' : '', tr);

    $d.html(h).scrollTop(keepScroll ? top : 0);
    $('#mlDirty').text(edits[it.linkId] ? '저장하지 않은 수정 내용이 있습니다.' : '');
  }
  function markDirty(it) {
    tidy(it);
    $('#mlDirty').text(edits[it.linkId] ? '저장하지 않은 수정 내용이 있습니다.' : '');
    renderList();
  }

  // 점수 고르기 (같은 점수를 다시 누르면 그대로)
  $('#mlDetail').on('click', '.ml-pick button', function () {
    var it = find(curId); if (!it || busy) return;
    var $row = $(this).closest('.ml-score'), key = String($row.attr('data-key')), v = Number($(this).attr('data-v'));
    var e = edit(it); e.scores = e.scores || {}; e.scores[key] = v;
    $row.find('.ml-pick button').each(function () {
      var on = Number($(this).attr('data-v')) === v;
      $(this).toggleClass('on', on).attr('aria-checked', String(on));
    });
    $row.find('.ml-warn').prop('hidden', v < WARN);
    $row.find('small.muted').remove();
    markDirty(it);
  });
  // 메모
  $('#mlDetail').on('input', '#mlMemo', function () {
    var it = find(curId); if (!it) return;
    edit(it).memo = this.value;
    markDirty(it);
  });

  // 사진 삭제
  $('#mlDetail').on('click', '.ml-x', function () {
    var it = find(curId), id = Number($(this).attr('data-photo'));
    if (!it || busy) return;
    Common.dialog({ title: '사진 삭제', text: '이 사진을 삭제할까요? 삭제한 사진은 되돌릴 수 없습니다.', okText: '삭제' }).done(function (ok) {
      if (!ok) return;
      Common.api('POST', 'api/mobile-link/photo/delete.do', { photoId: id }).done(function () {
        it.photos = it.photos.filter(function (p) { return p.photoId !== id; });
        renderList();
        renderDetail(true);
        Common.toast('사진을 삭제했습니다.');
      });
    });
  });
  // 녹취록 삭제
  $('#mlDetail').on('click', '#mlDelTr', function () {
    var it = find(curId);
    if (!it || busy) return;
    Common.dialog({ title: '녹취록 삭제', text: '이 기록의 녹취록을 삭제할까요? 삭제한 녹취록은 되돌릴 수 없습니다.', okText: '삭제' }).done(function (ok) {
      if (!ok) return;
      Common.api('POST', 'api/mobile-link/transcript/delete.do', { linkId: it.linkId }).done(function () {
        it.transcript = null;
        renderList();
        renderDetail(true);
        Common.toast('녹취록을 삭제했습니다.');
      });
    });
  });

  /* ---------- 저장 · AI 정리 ---------- */
  function payload(it) {
    var e = edits[it.linkId] || {};
    return { linkId: it.linkId, scores: e.scores || {}, memo: memoOf(it) };
  }
  $('#mlSave').on('click', function () {
    var it = find(curId); if (!it || busy) return;
    if (!edits[it.linkId]) { Common.toast('바뀐 내용이 없습니다.'); return; }
    busy = true;
    $('#mlSave, #mlAi').prop('disabled', true);
    Common.apiJson('api/mobile-link/update.do', payload(it)).done(function (r) {
      for (var i = 0; i < items.length; i++) if (items[i].linkId === it.linkId) items[i] = r.item;
      delete edits[it.linkId];
      Common.toast('수정 내용을 저장했습니다.');
    }).always(function () {
      busy = false;
      renderList();
      renderDetail(true);
    });
  });

  $('#mlAi').on('click', function () {
    var it = find(curId); if (!it || busy) return;
    Common.dialog({
      title: 'AI 정리',
      html: '<div class="dlg-info"><span class="t">' + esc(it.visitedAt) + ' 현장조사기록</span><span class="s">작성 ' + esc(it.authorNm || '미상') + '</span></div>'
        + '취약점수 · 메모 · 녹취록을 AI 가 요약해 <b>날짜별 현장조사이력</b>에 기재합니다.<br>기재한 기록은 이 목록에서 빠지고, 더 이상 수정할 수 없습니다.',
      okText: 'AI 정리'
    }).done(function (ok) {
      if (!ok) return;
      busy = true;
      $('#mlSave').prop('disabled', true);
      $('#mlAi').prop('disabled', true).text('AI 정리 중…');
      $('#mlDirty').text('AI 가 정리하고 있습니다. 잠시만 기다려 주세요.');
      var body = payload(it);
      body.place = place;
      Common.apiJson('api/mobile-link/summarize.do', body).done(function (r) {
        delete edits[it.linkId];
        Common.dialog({
          title: '현장조사이력에 기재했습니다',
          html: '<div class="dlg-info"><span class="t">' + esc(it.visitedAt) + '</span><span class="s">관찰 메모 (AI 정리)</span></div><p>' + esc(r.summary) + '</p>'
            + (r.pendingCount ? '<p class="muted" style="margin-top:8px">남은 미확인 기록 ' + r.pendingCount + '건</p>' : ''),
          cancelText: null
        }).always(function () { location.reload(); });
      }).fail(function () {
        busy = false;
        $('#mlAi').text('AI 정리');
        load(it.linkId);       // 수정 내용은 서버에 저장됐을 수 있으므로 다시 읽는다 (저장된 값과 같은 수정은 load 가 지운다)
      });
    });
  });
});
