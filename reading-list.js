function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function render(books) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';

  if (!books || books.length === 0) {
    container.innerHTML = '<p class="empty-state">No books yet.</p>';
    return;
  }

  books.forEach(book => {
    const percent = Math.min(100, Math.round((book.current / book.total) * 100));
    const summaryHtml = book.summary
      ? `<p class="book-summary">${escapeHtml(book.summary)}</p>`
      : '';

    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-header">
        <strong>${escapeHtml(book.title)}</strong>
      </div>
      ${summaryHtml}
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percent}%"></div>
      </div>
      <div class="book-footer">
        <span>Page ${book.current} of ${book.total}</span>
        <span class="percent">${percent}%</span>
      </div>
    `;
    container.appendChild(card);
  });
}

fetch('books.json')
  .then(res => res.json())
  .then(render)
  .catch(err => {
    console.error('Failed to load books.json:', err);
    document.getElementById('book-list').innerHTML =
      '<p class="empty-state">Couldn\'t load reading list.</p>';
  });
