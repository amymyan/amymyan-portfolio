/* Shared 2-column portrait masonry — items stack independently per column */

function createPortraitMasonryColumns(container) {
  container.innerHTML = '';
  container.classList.add('portrait-masonry');
  const cols = [
    document.createElement('div'),
    document.createElement('div')
  ];
  cols.forEach(col => {
    col.className = 'portrait-grid-col';
    container.appendChild(col);
  });
  return cols;
}

function portraitMasonryColumnIndex(index) {
  return index % 2;
}

function readPortraitMasonryOrder(container, itemSelector = '.portrait-grid-item, figure') {
  const cols = container.querySelectorAll('.portrait-grid-col');
  if (cols.length < 2) {
    return [...container.querySelectorAll(itemSelector)].map(el => el.dataset.id).filter(Boolean);
  }

  const left = [...cols[0].querySelectorAll(itemSelector)].map(el => el.dataset.id).filter(Boolean);
  const right = [...cols[1].querySelectorAll(itemSelector)].map(el => el.dataset.id).filter(Boolean);
  const ids = [];
  const maxLen = Math.max(left.length, right.length);
  for (let i = 0; i < maxLen; i++) {
    if (left[i]) ids.push(left[i]);
    if (right[i]) ids.push(right[i]);
  }
  return ids;
}

function findPortraitMasonryDropTarget(board, clientX, clientY, dragEl) {
  const cols = [...board.querySelectorAll('.portrait-grid-col')];
  if (!cols.length) return null;

  for (const col of cols) {
    const rect = col.getBoundingClientRect();
    if (clientX < rect.left - 12 || clientX > rect.right + 12) continue;

    const items = [...col.querySelectorAll('.portrait-grid-item')].filter(el => el !== dragEl);
    if (!items.length) return { col, before: null };

    for (const item of items) {
      const itemRect = item.getBoundingClientRect();
      if (clientY < itemRect.top + itemRect.height / 2) {
        return { col, before: item };
      }
    }
    return { col, before: null };
  }
  return null;
}

function applyPortraitMasonryDropTarget(dragEl, target) {
  if (!target?.col || !dragEl) return false;
  const { col, before } = target;

  if (before) {
    if (dragEl.nextSibling === before) return false;
    col.insertBefore(dragEl, before);
    return true;
  }

  if (col.lastElementChild === dragEl) return false;
  col.appendChild(dragEl);
  return true;
}

function portraitMasonryDropKey(target) {
  if (!target?.col) return '';
  return target.col.className + '|' + (target.before?.dataset.id || 'end');
}
