/**
 * Turning per-drawing guesses into one consistent reading of the book.
 *
 * Matching each callout to its nearest inventory thumbnail on its own throws
 * away the strongest thing known about the problem: the book draws each element
 * one way, so distinct callout drawings and inventory elements very nearly pair
 * off one to one — 273 drawings against 276 elements in the sample. Left to
 * decide alone, twenty drawings piled onto one popular element while fifty-nine
 * elements were never claimed at all.
 *
 * So the choice is made once, globally, as a minimum-cost assignment. That is
 * what stops a confident wrong match crowding out a less confident right one:
 * taking an element costs every other drawing the chance to take it.
 *
 * The pairing prior is about how the book is drawn, not about how many pieces
 * the set holds, so scoring the result against the printed quantities stays an
 * independent check. Feeding those quantities into the cost as well is a
 * separate, clearly-labelled variant, and it forfeits that independence.
 */

/**
 * Rectangular linear assignment, minimising total cost.
 *
 * Jonker-Volgenant shortest-augmenting-path over a rows <= columns matrix;
 * returns the column chosen for each row. Rows are the callout drawings and
 * columns the elements, so a taller-than-wide problem is transposed by the
 * caller adding dummy columns rather than by this routine guessing.
 */
export function assign(cost, rows, columns) {
  if (rows > columns) {
    throw new Error(
      `assign needs at least as many columns as rows: got ${rows} rows and ${columns} columns. ` +
        `Pad the column side with a high-cost "unassigned" option before calling.`,
    );
  }
  const INFINITE = Number.POSITIVE_INFINITY;
  const u = new Float64Array(rows + 1);
  const v = new Float64Array(columns + 1);
  const path = new Int32Array(columns + 1).fill(0);
  const way = new Int32Array(columns + 1).fill(0);

  for (let row = 1; row <= rows; row += 1) {
    path[0] = row;
    let column0 = 0;
    const minimum = new Float64Array(columns + 1).fill(INFINITE);
    const used = new Uint8Array(columns + 1);
    do {
      used[column0] = 1;
      const row0 = path[column0];
      let delta = INFINITE;
      let column1 = 0;
      for (let column = 1; column <= columns; column += 1) {
        if (used[column]) continue;
        const current = cost[(row0 - 1) * columns + (column - 1)] - u[row0] - v[column];
        if (current < minimum[column]) {
          minimum[column] = current;
          way[column] = column0;
        }
        if (minimum[column] < delta) {
          delta = minimum[column];
          column1 = column;
        }
      }
      for (let column = 0; column <= columns; column += 1) {
        if (used[column]) {
          u[path[column]] += delta;
          v[column] -= delta;
        } else {
          minimum[column] -= delta;
        }
      }
      column0 = column1;
    } while (path[column0] !== 0);
    do {
      const column1 = way[column0];
      path[column0] = path[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const rowToColumn = new Int32Array(rows).fill(-1);
  for (let column = 1; column <= columns; column += 1) {
    if (path[column] > 0) rowToColumn[path[column] - 1] = column - 1;
  }
  return rowToColumn;
}

/** Cost of pairing one callout drawing with one element, before any assignment. */
export function pairCost(distance, { picked, pieces, held, useQuantities }) {
  // A vision pick is a vote, not a verdict: it lowers the cost of the element it
  // names so the assignment prefers it, and loses to a strong contrary pairing.
  let cost = distance - (picked ? 0.22 : 0);
  if (useQuantities) {
    cost += 0.12 * Math.min(2, Math.abs(Math.log((pieces + 1) / (held + 1))));
  }
  return cost;
}

/**
 * One element per drawing, chosen globally.
 *
 * Drawings outnumber elements when a part is drawn two ways, so the column side
 * is padded with an "unassigned" option priced above any real pairing; a drawing
 * that lands there is reported rather than forced onto whatever was left.
 */
export function assignDrawings(drawings, elements, options) {
  const rows = drawings.length;
  const spare = Math.max(0, rows - elements.length);
  const columns = elements.length + spare;
  const UNASSIGNED = 1.5;
  const cost = new Float64Array(rows * columns).fill(UNASSIGNED);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < elements.length; column += 1) {
      cost[row * columns + column] = pairCost(drawings[row].distanceTo[column], {
        picked: drawings[row].picked === elements[column].elementId,
        pieces: drawings[row].pieces,
        held: elements[column].held,
        useQuantities: options.useQuantities,
      });
    }
  }
  const chosen = assign(cost, rows, columns);
  return [...chosen].map((column) =>
    column >= 0 && column < elements.length ? elements[column].elementId : null,
  );
}
