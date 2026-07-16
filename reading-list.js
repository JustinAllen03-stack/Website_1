import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const booksCol = collection(db, "books");

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncateToSentence(text, maxLen) {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  if (lastBreak > maxLen * 0.4) return slice.slice(0, lastBreak + 1);
  const lastSpace = slice.lastIndexOf(' ');
  return slice.slice(0, lastSpace > 0 ? lastSpace : maxLen) + '…';
}

async function fetchBookSummary(title) {
  try {
    const searchRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(title)}&limit=1`);
    const searchData = await searchRes.json();
    const bookDoc = searchData.docs && searchData.docs[0];
    if (!bookDoc) return null;

    if (bookDoc.first_sentence) {
      const fs = bookDoc.first_sentence;
      return truncateToSentence(Array.isArray(fs) ? fs[0] : fs, 220);
    }

    const workKey = bookDoc.key;
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

function render(books) {
  const container = document.getElementById('book-list');
  container.innerHTML = '';

  if (!books || books.length === 0) {
    container.innerHTML = '<p class="empty-state">No books yet — add one above.</p>';
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
        <button class="remove-btn" data-id="${book.id}" aria-label="Remove ${escapeHtml(book.title)}">&times;</button>
      </div>
      ${summaryHtml}
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percent}%"></div>
      </div>
      <div class="book-footer">
        <label>
          Page
          <input type="number" class="current-input" data-id="${book.id}" min="0" max="${book.total}" value="${book.current}">
          of ${book.total}
        </label>
        <span class="percent">${percent}%</span>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.current-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const max = Number(e.target.max);
      const value = Math.max(0, Math.min(Number(e.target.value), max));
      await updateDoc(doc(db, "books", id), { current: value });
    });
  });

  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      await deleteDoc(doc(db, "books", id));
    });
  });
}

onSnapshot(booksCol, (snapshot) => {
  const books = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  render(books);
}, (err) => {
  console.error('Firestore listen failed:', err);
  document.getElementById('book-list').innerHTML =
    '<p class="empty-state">Couldn\'t load reading list.</p>';
});

document.getElementById('add-book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('book-title').value.trim();
  const current = Number(document.getElementById('book-current').value);
  const total = Number(document.getElementById('book-total').value);

  if (!title || total <= 0) return;

  e.target.reset();

  const summary = await fetchBookSummary(title);
  await addDoc(booksCol, {
    title,
    current: Math.min(current, total),
    total,
    summary: summary || null
  });
});
