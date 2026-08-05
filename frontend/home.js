const cardList = document.getElementById('card-list');
const statusMessage = document.getElementById('status-message');
const detailBody = document.getElementById('detail-body');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

let allResources = [];
let selectedCard = null;

function createActionLink(href, label, stopPropagation) {
  const link = document.createElement('a');
  link.className = 'btn btn-open';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  if (stopPropagation) link.addEventListener('click', (event) => event.stopPropagation());
  return link;
}

function createCard(resource) {
  const article = document.createElement('article');
  article.className = 'card';

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('h2');
  title.className = 'card-title';
  title.textContent = resource.title;

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = resource.subject;

  header.append(title, tag);
  article.append(header);

  if (resource.note) {
    const note = document.createElement('p');
    note.className = 'card-note';
    note.textContent = resource.note;
    article.append(note);

    const readNotesBtn = document.createElement('button');
    readNotesBtn.type = 'button';
    readNotesBtn.className = 'read-notes-btn';
    readNotesBtn.textContent = 'Read notes ↗';
    readNotesBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      selectCard(article, resource);
    });
    article.append(readNotesBtn);
  }

  const footer = document.createElement('div');
  footer.className = 'card-footer';

  const votes = document.createElement('div');
  votes.className = 'votes';

  const likeBtn = document.createElement('button');
  likeBtn.className = 'vote-btn like';
  likeBtn.textContent = `\u{1F44D} ${resource.likes}`;

  const dislikeBtn = document.createElement('button');
  dislikeBtn.className = 'vote-btn dislike';
  dislikeBtn.textContent = `\u{1F44E} ${resource.dislikes}`;

  likeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    castVote(resource.id, 'like', likeBtn, dislikeBtn);
  });
  dislikeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    castVote(resource.id, 'dislike', likeBtn, dislikeBtn);
  });

  votes.append(likeBtn, dislikeBtn);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  if (resource.url) actions.append(createActionLink(resource.url, 'Open link ↗', true));
  if (resource.fileUrl) actions.append(createActionLink(resource.fileUrl, 'Download file ↓', true));

  footer.append(votes, actions);
  article.append(footer);

  article.addEventListener('click', () => selectCard(article, resource));

  return article;
}

function selectCard(cardEl, resource) {
  if (selectedCard) selectedCard.classList.remove('selected');
  cardEl.classList.add('selected');
  selectedCard = cardEl;
  showDetail(resource);
}

async function castVote(id, kind, likeBtn, dislikeBtn) {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  likeBtn.disabled = true;
  dislikeBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/resources/${id}/${kind}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.status === 401) {
      logout();
      window.location.href = 'login.html';
      return;
    }
    if (!res.ok) throw new Error(`Vote failed with status ${res.status}`);
    const data = await res.json();
    likeBtn.textContent = `\u{1F44D} ${data.likes}`;
    dislikeBtn.textContent = `\u{1F44E} ${data.dislikes}`;
  } catch (err) {
    console.error(err);
  } finally {
    likeBtn.disabled = false;
    dislikeBtn.disabled = false;
  }
}

function fileExtension(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return '';
  }
}

function buildFilePreview(fileUrl, title) {
  const path = fileExtension(fileUrl);
  if (path.endsWith('.pdf')) {
    const iframe = document.createElement('iframe');
    iframe.className = 'detail-pdf';
    iframe.src = fileUrl;
    iframe.title = title;
    return iframe;
  }
  if (path.endsWith('.mp4')) {
    const video = document.createElement('video');
    video.className = 'detail-video';
    video.src = fileUrl;
    video.controls = true;
    return video;
  }
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'No inline preview for this file type — use the download button below.';
  return hint;
}

function showDetail(resource) {
  detailBody.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = resource.title;

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = resource.subject;

  detailBody.append(title, tag);

  const noteLabel = document.createElement('span');
  noteLabel.className = 'detail-note-label';
  noteLabel.textContent = 'Notes';
  detailBody.append(noteLabel);

  const note = document.createElement('p');
  note.className = 'detail-note';
  note.textContent = resource.note || 'No notes added for this resource.';
  detailBody.append(note);

  if (resource.url) {
    const preview = document.createElement('div');
    preview.className = 'detail-preview';
    const urlText = document.createElement('p');
    urlText.className = 'detail-url';
    urlText.textContent = resource.url;
    preview.append(urlText);
    detailBody.append(preview);
    detailBody.append(createActionLink(resource.url, 'Open link ↗', false));
  }

  if (resource.fileUrl) {
    const preview = document.createElement('div');
    preview.className = 'detail-preview';
    preview.append(buildFilePreview(resource.fileUrl, resource.title));
    detailBody.append(preview);
    detailBody.append(createActionLink(resource.fileUrl, 'Download file ↓', false));
  }
}

function normalizeWords(text) {
  return text.toLowerCase().trim().split(/\s+/).filter(Boolean);
}

// Matches a subject against a search query that might be a single word,
// a fragment, or a whole sentence — not just an exact/prefix match.
function subjectMatches(subject, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const s = subject.trim().toLowerCase();
  if (s.includes(q) || q.includes(s)) return true;

  const subjectWords = normalizeWords(subject);
  const queryWords = normalizeWords(query);
  return subjectWords.some((sw) => queryWords.some((qw) => sw.includes(qw) || qw.includes(sw)));
}

function renderCards(resources) {
  cardList.innerHTML = '';
  selectedCard = null;

  if (resources.length === 0) {
    statusMessage.textContent = allResources.length === 0
      ? 'No resources yet — be the first to add one.'
      : 'No resources match that subject.';
    statusMessage.style.display = 'block';
    return;
  }

  statusMessage.style.display = 'none';
  resources.forEach((resource) => cardList.append(createCard(resource)));
}

function applySearch() {
  const query = searchInput.value;
  const filtered = query.trim()
    ? allResources.filter((resource) => subjectMatches(resource.subject, query))
    : allResources;
  renderCards(filtered);
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applySearch();
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  renderCards(allResources);
});

async function loadResources() {
  try {
    const res = await fetch(`${API_BASE}/resources`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    allResources = await res.json();
    applySearch();
  } catch (err) {
    statusMessage.textContent = 'Could not load resources. Is the server running?';
    statusMessage.style.display = 'block';
    console.error(err);
  }
}

const addResourceLink = document.getElementById('add-resource-link');
addResourceLink.addEventListener('click', (event) => {
  if (!isLoggedIn()) {
    event.preventDefault();
    window.location.href = 'login.html';
  }
});

loadResources();
renderAuthControl();
initHeaderShrink([document.getElementById('list-pane'), document.getElementById('detail-pane')]);
