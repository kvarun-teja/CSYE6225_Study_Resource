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
