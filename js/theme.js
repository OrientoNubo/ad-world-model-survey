/**
 * Dark/Light theme toggle.
 */

export function initTheme() {
  const btn = document.getElementById('themeBtn');
  const saved = localStorage.getItem('adwm-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    btn.textContent = 'Light';
  }

  btn.addEventListener('click', toggleTheme);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? '' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  document.getElementById('themeBtn').textContent = isDark ? 'Dark' : 'Light';
  localStorage.setItem('adwm-theme', newTheme);
}
