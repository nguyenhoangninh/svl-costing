// Light / dark theme toggle (v1.14.91, audit SEC-03): was an inline <script> in index.html; moved here so the
// Content-Security-Policy can drop 'unsafe-inline' from script-src. Classic script, loaded before the app module.
(function () {
  try { var t = localStorage.getItem('svl.theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  var btn = document.getElementById('theme');
  if (btn) btn.addEventListener('click', function () {
    var cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx;
    try { localStorage.setItem('svl.theme', nx); } catch (e) {}
  });
})();
