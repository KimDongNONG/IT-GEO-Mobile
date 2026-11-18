/* 대시보드 (dashboard.jsp) : Chart.js 도넛 · 월별 막대 */
$(function () {
  /* 기간 버튼 (1 · 3 · 6개월) : 고른 기준 월 · 구 그대로 바로 조회 */
  $('#monthSeg button').on('click', function () {
    $('#monthField').val($(this).data('month'));
    $(this).closest('form').trigger('submit');
  });

  var D = window.DASH; if (!window.Chart || !D) return;
  var charts = [];

  /* 색은 CSS 토큰에서 읽는다 → 라이트 / 다크를 바꾸면(common.js 'themechange') 다시 그린다 */
  function draw() {
    charts.forEach(function (c) { c.destroy(); });
    var css = getComputedStyle(document.documentElement);
    var col = function (v) { return css.getPropertyValue(v).trim(); };
    Chart.defaults.color = col('--text-2');
    Chart.defaults.font.family = col('--font') || 'Pretendard, sans-serif';

    charts = [
      new Chart($('#donut')[0], {
        type: 'doughnut',
        data: { labels: ['확인 완료', '조사 중', '조사 대기'], datasets: [{ data: [D.status.done, D.status.doing, D.status.todo], backgroundColor: [col('--primary'), col('--warn'), col('--ok')], borderWidth: 0, hoverOffset: 4 }] },
        options: { cutout: '68%', plugins: { legend: { display: false } }, animation: { duration: 500 } }
      }),
      new Chart($('#monthly')[0], {
        type: 'bar',
        data: { labels: D.monthly.map(function (m) { return Number(m.ym.slice(5)) + '월'; }), datasets: [{ data: D.monthly.map(function (m) { return m.cnt; }), backgroundColor: col('--primary'), borderRadius: 3, maxBarThickness: 34 }] },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.parsed.y + '건'; } } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: col('--line-soft') } } }
        }
      })
    ];
  }
  draw();
  $(document).on('themechange', draw);
});
