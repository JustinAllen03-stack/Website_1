const STORAGE_KEY = 'readingList';

function loadBooks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveBooks(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function render() {
  const books = loadBooks();
  const container = document.getElementById('book-list');
  container.innerHTML = '';

  if (books.length === 0) {
    container.innerHTML = '<p class="empty-state">No books yet — add one above.</p>';
    return;
  }

  books.forEach((book, index) => {
    const percent = Math.min(100, Math.round((book.current / book.total) * 100));
    const summaryHtml = book.summary
      ? `<p class="book-summary">${escapeHtml(book.summary)}</p>`
      : book.summaryStatus === 'loading'
        ? `<p class="book-summary loading">Looking up summary…</p>`
        : '';

    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-header">
        <strong>${escapeHtml(book.title)}</strong>
        <button class="remove-btn" data-index="${index}" aria-label="Remove ${escapeHtml(book.title)}">&times;</button>
      </div>
      ${summaryHtml}
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percent}%"></div>
      </div>
      <div class="book-footer">
        <label>
          Page
          <input type="number" class="current-input" data-index="${index}" min="0" max="${book.total}" value="${book.current}">
          of ${book.total}
        </label>
        <span class="percent">${percent}%</span>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.current-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.index);
      const books = loadBooks();
      let value = Number(e.target.value);
      value = Math.max(0, Math.min(value, books[idx].total));
      books[idx].current = value;
      saveBooks(books);
      render();
    });
  });

  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.target.dataset.index);
      const books = loadBooks();
      books.splice(idx, 1);
      saveBooks(books);
      render();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Trims text to a max length without cutting off mid-word, adding an
// ellipsis unless the cut lands on a natural sentence break.
function truncateToSentence(text, maxLen) {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastBreak > maxLen * 0.4) return slice.slice(0, lastBreak + 1);
  const lastSpace = slice.lastIndexOf(' ');
  return slice.slice(0, lastSpace > 0 ? lastSpace : maxLen) + '…';
}

// Looks up a short description for a book title via Open Library's public
// search API (no key required). Falls back silently if nothing is found.
async function fetchBookSummary(title) {
  try {
    const searchRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=1`);
    const searchData = await searchRes.json();
    const doc = searchData.docs && searchData.docs[0];
    if (!doc) return null;

    if (doc.first_sentence) {
      const fs = doc.first_sentence;
      return Array.isArray(fs) ? fs[0] : fs;
    }

    const workKey = doc.key;
    if (!workKey) return null;

    const workRes = await fetch(`https://openlibrary.org${workKey}.json`);
    const workData = await workRes.json();
    if (!workData.description) return null;

    const desc = typeof workData.description === 'string'
      ? workData.description
      : workData.description.value;

    return desc ? truncateToSentence(desc.split('\n')[0], 220) : null;
  } catch (err) {
    console.warn('Book summary lookup failed:', err);
    return null;
  }
}

document.getElementById('add-book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('book-title').value.trim();
  const current = Number(document.getElementById('book-current').value);
  const total = Number(document.getElementById('book-total').value);

  if (!title || total <= 0) return;

  const books = loadBooks();
  const newIndex = books.length;
  books.push({ title, current: Math.min(current, total), total, summary: null, summaryStatus: 'loading' });
  saveBooks(books);
  render();
  e.target.reset();

  const summary = await fetchBookSummary(title);
  const latestBooks = loadBooks();
  if (latestBooks[newIndex]) {
    latestBooks[newIndex].summary = summary;
    latestBooks[newIndex].summaryStatus = summary ? 'done' : 'none';
    saveBooks(latestBooks);
    render();
  }
});

render();
