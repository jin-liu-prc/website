// Based on Wowchemy navigation (MIT licence); fast linear banner scrolling.
/* ---------------------------------------------------------------------------
 * Responsive scrolling for URL hashes.
 * --------------------------------------------------------------------------- */

// Dynamically get responsive navigation bar height for offsetting Scrollspy.
function getNavBarHeight() {
  let navbar = document.getElementById('navbar-main');
  let navbarHeight = navbar ? navbar.getBoundingClientRect().height : 0;
  console.debug('Navbar height: ' + navbarHeight);
  return navbarHeight;
}

/**
 * Responsive hash scrolling.
 * Check for a URL hash as an anchor.
 * If page anchor matches hash, scroll to it responsively considering dynamic height elements.
 * If `target` argument omitted (e.g. after event), assume it's the window's hash.
 * Default to 0ms animation duration as don't want animation for fixing scrollspy Book page ToC highlighting.
 */
function scrollToAnchor(target, duration = 0) {
  // If `target` is undefined or HashChangeEvent object, set it to window's hash.
  // Decode the hash as browsers can encode non-ASCII characters (e.g. Chinese symbols).
  target =
    typeof target === 'undefined' || typeof target === 'object' ? decodeURIComponent(window.location.hash) : target;

  // If target element exists, scroll to it taking into account fixed navigation bar offset.
  if ($(target).length) {
    // Escape special chars from IDs, such as colons found in Markdown footnote links.
    target = '#' + $.escapeSelector(target.substring(1)); // Previously, `target = target.replace(/:/g, '\\:');`

    let elementOffset = Math.ceil($(target).offset().top - getNavBarHeight()); // Round up to highlight right ID!
    $('body').addClass('scrolling');
    $('html, body').animate(
      {
        scrollTop: elementOffset,
      },
      duration,
      function () {
        $('body').removeClass('scrolling');
      },
    );
  } else {
    console.debug('Cannot scroll to target `#' + target + '`. ID not found!');
  }
}

// Make Scrollspy responsive.
function fixScrollspy() {
  let $body = $('body');
  let data = $body.data('bs.scrollspy');
  if (data) {
    data._config.offset = getNavBarHeight();
    $body.data('bs.scrollspy', data);
    $body.scrollspy('refresh');
  }
}

/* ---------------------------------------------------------------------------
 * Add smooth scrolling to all links inside the main navbar.
 * --------------------------------------------------------------------------- */

// Delegate clicks because automatic translation can insert nested elements or replace link contents.
$(document).on('click', '#navbar-main li.nav-item a.nav-link, .js-scroll', function (event) {
  const link = $(event.target).closest('a')[0];
  if (!link) return;

  const hash = link.hash;
  const samePageSection = link.pathname === window.location.pathname && hash &&
    document.getElementById(hash.substring(1)) && $('.js-widget-page').length > 0;
  const $menu = $('#navbar-content');
  const mobileMenuOpen = window.matchMedia('(max-width: 991px)').matches && $menu.hasClass('show');

  const scrollToSection = function () {
    if (!samePageSection) return;
    $('html, body').stop(true);
    const section = document.getElementById(hash.substring(1));
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const elementOffset = Math.max(0, Math.min(
      Math.ceil($(section).offset().top - getNavBarHeight()), maxScroll,
    ));
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0 : Math.abs(elementOffset - window.scrollY) / 24;
    $('html, body').animate({scrollTop: elementOffset}, duration, 'linear');
  };

  if (samePageSection) event.preventDefault();
  if (mobileMenuOpen && !$(link).hasClass('dropdown-toggle')) {
    // Measure the destination after the expanded menu finishes closing.
    if (samePageSection) $menu.one('hidden.bs.collapse', scrollToSection);
    $menu.collapse('hide');
  } else {
    scrollToSection();
  }
});

// Automatic main menu dropdowns on mouse over.
$('body').on('mouseenter mouseleave', '.dropdown', function (e) {
  var dropdown = $(e.target).closest('.dropdown');
  var menu = $('.dropdown-menu', dropdown);
  dropdown.addClass('show');
  menu.addClass('show');
  setTimeout(function () {
    dropdown[dropdown.is(':hover') ? 'addClass' : 'removeClass']('show');
    menu[dropdown.is(':hover') ? 'addClass' : 'removeClass']('show');
  }, 300);
});

// Call `fixScrollspy` when window is resized.
let resizeTimer;
$(window).resize(function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fixScrollspy, 200);
});

// Check for hash change event and fix responsive offset for hash links (e.g. Markdown footnotes).
window.addEventListener('hashchange', scrollToAnchor);

export {fixScrollspy, scrollToAnchor};
