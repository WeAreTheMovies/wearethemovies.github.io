const releaseViewer = document.querySelector('#release-viewer');
const pressViewer = document.querySelector('#press-viewer');
const releaseData = JSON.parse(document.querySelector('#release-data').textContent);
let focusedBeforeDialog = null;
const openDialog = (dialog, trigger) => {
  focusedBeforeDialog = trigger;
  document.body.style.overflow = 'hidden';
  dialog.showModal();
  dialog.scrollTop = 0;
};
[releaseViewer, pressViewer].filter(Boolean).forEach(dialog => {
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
document.querySelectorAll('[data-release-id]').forEach(link => link.addEventListener('click', event => {
  const release = releaseData.find(item => String(item.id) === link.dataset.releaseId);
  if (!release) return;
  event.preventDefault();
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
  openDialog(releaseViewer, link);
}));

// Load the native YouTube player after a play click; only one is active at a time.
const videoCards = document.querySelectorAll('[data-video-id]');
videoCards.forEach(card => {
  const poster = card.querySelector('.video-poster');
  poster.addEventListener('click', () => {
    videoCards.forEach(other => {
      other.querySelector('iframe')?.remove();
      other.querySelector('.video-poster').hidden = false;
      other.classList.remove('is-playing');
    });
    const frame = document.createElement('iframe');
    const origin = /^https?:$/.test(location.protocol) ? '&origin=' + encodeURIComponent(location.origin) : '';
    frame.src = `https://www.youtube-nocookie.com/embed/${card.dataset.videoId}?autoplay=1&controls=1&rel=0&playsinline=1${origin}`;
    frame.title = card.querySelector('h3').textContent + ' YouTube player';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    poster.hidden = true;
    card.querySelector('.video-stage').append(frame);
    card.classList.add('is-playing');
    frame.focus();
  });
});
