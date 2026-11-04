'use strict';
// Progressive enhancement only: no analytics, account collection or remote scripts.
document.querySelectorAll('.faq details').forEach(item => {
  item.addEventListener('toggle', () => {
    if (item.open) document.querySelectorAll('.faq details').forEach(other => {
      if (other !== item) other.open = false;
    });
  });
});
