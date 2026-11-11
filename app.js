const releaseDetails = document.querySelector('#release-details');
const pressViewer = document.querySelector('#press-viewer');
const releaseData = JSON.parse(document.querySelector('#release-data').textContent);
let focusedBeforeDialog = null;
const openDialog = (dialog, trigger) => {
  focusedBeforeDialog = trigger;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  dialog.scrollTop = 0;
};
[pressViewer].forEach(dialog => {
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }});
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    focusedBeforeDialog?.focus();
  });
});
document.querySelector('.press-scan-card')?.addEventListener('click', event => openDialog(pressViewer, event.currentTarget));
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const renderRelease = (release, link) => {
  const image = document.querySelector('#release-dialog-art');
  image.src = link.querySelector('img').src;
  image.alt = `${release.title} cover art`;
  document.querySelector('#release-dialog-title').textContent = release.title;
  document.querySelector('#release-dialog-meta').textContent = release.year;
  const tracks = document.querySelector('#release-track-list');
  tracks.replaceChildren();
  if (release.tracks.length) release.tracks.forEach(track => {
    const row = element('li');
    row.append(element('span', track.title, 'track-title'));
    if (track.duration) row.append(element('span', track.duration, 'track-duration'));
    tracks.append(row);
  });
  const credits = document.querySelector('#release-credit-list');
  credits.replaceChildren();
  if (release.creditsText) credits.append(element('p', release.creditsText, 'release-credits-verbatim'));
  else if (release.credits.length) release.credits.forEach(credit => credits.append(element('p', credit)));
  if (release.copyright) credits.append(element('p', release.copyright, 'release-copyright'));
  const links = document.querySelector('#release-dialog-links');
  links.replaceChildren();
  links.className = 'release-dialog-links platform-links';
  links.setAttribute('aria-label', 'Stream or purchase ' + release.title);
  [['stream', 'Stream'], ['purchase', 'Purchase']].forEach(([key, label]) => {
    const destinations = release.platforms[key] || [];
    if (!destinations.length) return;
    const group = element('div', undefined, 'platform-group');
    group.append(element('span', label, 'platform-label'));
    const icons = element('div', undefined, 'platform-icons');
    destinations.forEach(destination => {
      const anchor = element('a');
      anchor.href = destination.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.title = `${label} ${release.title} on ${destination.platform}`;
      anchor.setAttribute('aria-label', anchor.title + ' (opens in a new tab)');
      anchor.dataset.platform = destination.platform;
      const template = document.getElementById('platform-icon-' + destination.icon);
      anchor.append(template.content.cloneNode(true));
      icons.append(anchor);
    });
    group.append(icons);
    links.append(group);
  });
};

// Keep cards in DOM order: wrapping flex rows fill the available width, while
// the active card takes a whole row. FLIP animates from the actual on-screen
// rectangles, including interrupted animations, without moving live iframes.
const videoCards = [...document.querySelectorAll('[data-video-id]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const videoAnimations = new Map();
let activeVideo = null;
const cancelVideoAnimations = () => {
  videoAnimations.forEach(animation => animation.cancel());
  videoAnimations.clear();
};
reducedMotion.addEventListener('change', cancelVideoAnimations);
window.addEventListener('resize', cancelVideoAnimations);
const animateVideoLayout = (change, revealCard = null) => {
  const before = new Map(videoCards.map(card => [card, card.getBoundingClientRect()]));
  cancelVideoAnimations();
  change();
  // Read final untransformed geometry before starting FLIP. Using the animated
  // rectangle here would scroll toward the old thumbnail instead of the player.
  const finalRects = new Map(videoCards.map(card => [card, card.getBoundingClientRect()]));
  if (revealCard) {
    const target = finalRects.get(revealCard);
    const top = target.top + window.scrollY - 20;
    const visibleHeight = Math.min(target.height, window.innerHeight - 40);
    if (target.top < 20 || target.top + visibleHeight > window.innerHeight - 20) {
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }
  if (reducedMotion.matches) return;
  videoCards.forEach(card => {
    const first = before.get(card);
    const last = finalRects.get(card);
    if (!last.width || !last.height) return;
    const animation = card.animate([
      { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})` },
      { transform: 'none' }
    ], { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    videoAnimations.set(card, animation);
    animation.onfinish = () => {
      if (videoAnimations.get(card) === animation) videoAnimations.delete(card);
    };
  });
};
const resetVideo = card => {
  card.querySelector('iframe')?.remove();
  const poster = card.querySelector('.video-poster');
  poster.hidden = false;
  poster.setAttribute('aria-expanded', 'false');
  card.querySelector('.video-collapse').hidden = true;
  card.classList.remove('is-playing');
};
videoCards.forEach(card => {
  const poster = card.querySelector('.video-poster');
  const stage = card.querySelector('.video-stage');
  stage.id = `video-stage-${card.dataset.videoId}`;
  poster.setAttribute('aria-controls', stage.id);
  poster.setAttribute('aria-expanded', 'false');
  const collapse = element('button', 'Close theater ×', 'video-collapse');
  collapse.type = 'button';
  collapse.hidden = true;
  collapse.setAttribute('aria-label', 'Close theater for ' + card.querySelector('h3').textContent);
  card.querySelector('.video-actions').append(collapse);
  collapse.addEventListener('click', () => {
    animateVideoLayout(() => {
      resetVideo(card);
      activeVideo = null;
    }, card);
    poster.focus({ preventScroll: true });
  });
  poster.addEventListener('click', () => {
    if (activeVideo === card) return;
    const frame = document.createElement('iframe');
    const origin = /^https?:$/.test(location.protocol) ? '&origin=' + encodeURIComponent(location.origin) : '';
    frame.src = `https://www.youtube-nocookie.com/embed/${card.dataset.videoId}?autoplay=1&controls=1&rel=0&playsinline=1${origin}`;
    frame.title = card.querySelector('h3').textContent + ' YouTube player';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    animateVideoLayout(() => {
      if (activeVideo) resetVideo(activeVideo);
      activeVideo = card;
      poster.hidden = true;
      poster.setAttribute('aria-expanded', 'true');
      collapse.hidden = false;
      stage.append(frame);
      card.classList.add('is-playing');
    }, card);
    frame.focus({ preventScroll: true });
  });
});

// Inline release details: move the selected article first in its own group so
// visual and keyboard order agree; restore the saved order on collapse.
const releaseArtToggle = releaseDetails.querySelector('#release-art-toggle');
const releaseCards = [...document.querySelectorAll('.release-card')];
const releaseGroups = [...document.querySelectorAll('.release-grid')].map(grid => ({
  grid, cards: releaseCards.filter(card => card.parentElement === grid)
}));
const releaseMotion = matchMedia('(prefers-reduced-motion: reduce)');
const releaseAnimations = new Map();
let activeRelease = null;
const cancelReleaseAnimations = () => {
  releaseAnimations.forEach(animation => animation.cancel());
  releaseAnimations.clear();
};
releaseMotion.addEventListener('change', cancelReleaseAnimations);
window.addEventListener('resize', cancelReleaseAnimations);
// Full desktop rows, with no isolated giant thumbnail: 13 => 4/3/3/3.
const releaseRowSizes = (count, maximum = 4) => {
  if (!count) return [];
  const rows = Math.ceil(count / maximum);
  const base = Math.floor(count / rows);
  return Array.from({ length: rows }, (_, index) => base + (index < count % rows ? 1 : 0));
};
const layoutReleaseGroups = () => releaseGroups.forEach(({ grid, cards }) => {
  const selected = cards.includes(activeRelease) ? activeRelease : null;
  grid.classList.toggle('has-expanded-release', Boolean(selected));
  const inactive = cards.filter(card => card !== selected);
  cards.forEach(card => card.style.removeProperty('--release-columns'));
  if (selected) {
    let offset = 0;
    releaseRowSizes(inactive.length, grid.classList.contains('featured-releases') ? 3 : 4).forEach(size => {
      inactive.slice(offset, offset + size).forEach(card => card.style.setProperty('--release-columns', size));
      offset += size;
    });
  }
  // Do not reparent unaffected cards or disturb their current focus.
  const order = selected ? [selected, ...inactive] : cards;
  order.forEach((card, index) => {
    if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] || null);
  });
});
const animateReleaseLayout = (change, revealCard) => {
  const before = new Map(releaseCards.map(card => [card, card.getBoundingClientRect()]));
  cancelReleaseAnimations();
  change();
  layoutReleaseGroups();
  const finalRects = new Map(releaseCards.map(card => [card, card.getBoundingClientRect()]));
  const target = finalRects.get(revealCard);
  const visibleHeight = Math.min(target.height, window.innerHeight - 40);
  if (target.top < 20 || target.top + visibleHeight > window.innerHeight - 20) {
    window.scrollTo({ top: Math.max(0, target.top + window.scrollY - 20), behavior: releaseMotion.matches ? 'instant' : 'smooth' });
  }
  if (releaseMotion.matches) return;
  releaseCards.forEach(card => {
    const first = before.get(card), last = finalRects.get(card);
    if (!last.width || !last.height) return;
    const animation = card.animate([
      { transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})` },
      { transform: 'none' }
    ], { duration: 520, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    releaseAnimations.set(card, animation);
    animation.onfinish = () => {
      if (releaseAnimations.get(card) === animation) releaseAnimations.delete(card);
    };
  });
};
const resetRelease = card => {
  card.classList.remove('is-expanded');
  const trigger = card.querySelector('[data-release-id]');
  trigger.hidden = false;
  trigger.setAttribute('aria-expanded', 'false');
  card.querySelector('.release-meta').hidden = false;
};
const closeRelease = () => {
  if (!activeRelease) return;
  const card = activeRelease;
  animateReleaseLayout(() => {
    releaseDetails.hidden = true;
    releaseArtToggle.setAttribute('aria-expanded', 'false');
    resetRelease(card);
    activeRelease = null;
  }, card);
  card.querySelector('[data-release-id]').focus({ preventScroll: true });
};
releaseArtToggle.addEventListener('click', closeRelease);
releaseDetails.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeRelease();
  }
});
releaseCards.forEach(card => {
  const link = card.querySelector('[data-release-id]');
  link.setAttribute('role', 'button');
  link.setAttribute('aria-controls', 'release-details');
  link.setAttribute('aria-expanded', 'false');
  link.addEventListener('keydown', event => {
    if (event.key === ' ') { event.preventDefault(); link.click(); }
  });
  link.addEventListener('click', event => {
    // Keep modified clicks as ordinary fallback navigation.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const release = releaseData.find(item => String(item.id) === link.dataset.releaseId);
    if (!release) return;
    event.preventDefault();
    if (activeRelease === card) return;
    animateReleaseLayout(() => {
      if (activeRelease) resetRelease(activeRelease);
      activeRelease = card;
      renderRelease(release, link);
      card.append(releaseDetails);
      releaseDetails.hidden = false;
      releaseArtToggle.setAttribute('aria-expanded', 'true');
      releaseArtToggle.setAttribute('aria-label', 'Collapse details for ' + release.title);
      link.hidden = true;
      link.setAttribute('aria-expanded', 'true');
      card.querySelector('.release-meta').hidden = true;
      card.classList.add('is-expanded');
    }, card);
    releaseArtToggle.focus({ preventScroll: true });
  });
});
