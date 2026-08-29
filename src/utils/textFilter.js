import { scoreMatch } from './fuzzy';

/**
 * Filtering lists the dashboard already holds in memory.
 *
 * The song list is searched on the server, which has the whole catalogue and an
 * index. These lists — artists, fingerprints — are already loaded in full, so
 * sending a query back to the API to filter what is sitting in a local array
 * would be slower and no more accurate. What they must not do is be *worse* at
 * it: a filter that only does `includes()` fails on the two things people
 * actually type, a missing diacritic and a typo.
 */

/**
 * đ and Đ are separate letters, not a base letter plus an accent, so NFD leaves
 * them alone — without this "Đorđe" folds to "ore" and never matches "dorde".
 * Same rule the API's slugify follows, for the same reason.
 */
const DSTROKE = /[đĐð]/g;

/**
 * Strip a string down to what somebody would type on a keyboard with no Bosnian
 * layout: lowercase, no accents, punctuation reduced to spaces.
 */
export function fold(text) {
  return String(text ?? '')
    .replace(DSTROKE, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Filter and rank a list against a typed query.
 *
 * `textOf` returns everything worth matching for one row — a title and its
 * performer, joined — so typing either finds the row.
 *
 * An empty query returns the list untouched and in its original order: sorting
 * a full list by relevance to nothing would shuffle it for no reason.
 */
export function filterByQuery(items, query, textOf) {
  const q = fold(query);
  if (!q) return items;

  return items
    .map((item) => ({ item, score: scoreMatch(q, fold(textOf(item))) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}
