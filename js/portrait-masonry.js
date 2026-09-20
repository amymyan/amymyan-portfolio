/* Shared 3-column portrait masonry — each column stacks independently */

const PORTRAIT_COLUMN_COUNT = 3;

function normalizePortraitColumn(value, index) {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 0 && n < PORTRAIT_COLUMN_COUNT) return n;
  return index % PORTRAIT_COLUMN_COUNT;
}

function createPortraitMasonryColumns(container, count = PORTRAIT_COLUMN_COUNT) {
  container.innerHTML = '';
  container.classList.add('portrait-masonry');
  const cols = [];
  for (let i = 0; i < count; i++) {
    const col = document.createElement('div');
    col.className = 'portrait-grid-col';
    col.dataset.col = String(i);
    container.appendChild(col);
    cols.push(col);
  }
  return cols;
}

function portraitMasonryColumnIndex(index, col) {
  return normalizePortraitColumn(col, index);
}

function readPortraitMasonryOrder(container, itemSelector = '.portrait-grid-item, figure') {
  const cols = [...container.querySelectorAll('.portrait-grid-col')];
  const ids = [];
  const colById = {};

  cols.forEach((col, colIndex) => {
    [...col.querySelectorAll(itemSelector)].forEach(el => {
      const id = el.dataset.id;
      if (!id || el.classList.contains('is-lifted')) return;
      ids.push(id);
      colById[id] = colIndex;
    });
  });

  return { ids, colById };
}

function findPortraitMasonryDropTarget(board, clientX, clientY, dragEl) {
  const cols = [...board.querySelectorAll('.portrait-grid-col')];
  if (!cols.length) return null;

  let col = cols.find(candidate => {
    const rect = candidate.getBoundingClientRect();
    return clientX >= rect.left - 20 && clientX <= rect.right + 20;
  });

  if (!col) {
    let best = null;
    cols.forEach(candidate => {
      const rect = candidate.getBoundingClientRect();
      const dist = Math.abs(clientX - (rect.left + rect.width / 2));
      if (!best || dist < best.dist) best = { col: candidate, dist };
    });
    col = best?.col;
  }
  if (!col) return null;

  const items = [...col.querySelectorAll('.portrait-grid-item')].filter(el => (
    el !== dragEl && !el.classList.contains('is-lifted')
  ));

  for (const item of items) {
    const itemRect = item.getBoundingClientRect();
    if (clientY < itemRect.top + itemRect.height / 2) {
      return { col, before: item };
    }
  }
  return { col, before: null };
}

function applyPortraitMasonryPlaceholder(placeholder, target) {
  if (!placeholder || !target?.col) return false;
  const { col, before } = target;

  if (before) {
    if (placeholder.nextSibling === before && placeholder.parentNode === col) return false;
    col.insertBefore(placeholder, before);
    return true;
  }

  if (col.lastElementChild === placeholder) return false;
  col.appendChild(placeholder);
  return true;
}

function portraitMasonryDropKey(target) {
  if (!target?.col) return '';
  return (target.col.dataset.col || '') + '|' + (target.before?.dataset.id || 'end');
}
