// Shared by home.html and add.html: shrinks the fixed header once any of the
// given scroll sources (window, or an independently-scrolling pane) moves
// past a small threshold, and expands it back when all sources are near top.
function initHeaderShrink(sources) {
  const header = document.querySelector('.site-header');
  const container = document.querySelector('.container');
  const THRESHOLD = 30;

  function scrollTopOf(source) {
    return source === window ? window.scrollY : source.scrollTop;
  }

  function update() {
    const isScrolled = sources.some((source) => scrollTopOf(source) > THRESHOLD);
    header.classList.toggle('compact', isScrolled);
    if (container) container.classList.toggle('header-compact', isScrolled);
  }

  sources.forEach((source) => {
    source.addEventListener('scroll', update, { passive: true });
  });

  update();
}

// Fills the #auth-control placeholder in the header with a "Log in" link
// (logged out) or a "Log out" button (logged in). Relies on isLoggedIn()/
// logout() from auth.js, which must be loaded first.
function renderAuthControl() {
  const container = document.getElementById('auth-control');
  if (!container) return;

  container.innerHTML = '';

  if (isLoggedIn()) {
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'btn btn-secondary';
    logoutBtn.textContent = 'Log out';
    logoutBtn.addEventListener('click', () => {
      logout();
      window.location.href = 'home.html';
    });
    container.append(logoutBtn);
  } else {
    const loginLink = document.createElement('a');
    loginLink.href = 'login.html';
    loginLink.className = 'btn btn-secondary';
    loginLink.textContent = 'Log in';
    container.append(loginLink);
  }
}
