/**
 * 跨模式弹幕避让。
 *
 * 插件 getDanmuTop 只比较同 mode 的弹幕（`visibles.filter(item => item.mode === target.mode)`），
 * 滚动弹幕与顶部/底部固定弹幕各排各的行，会压在同一位置。
 * 这里在弹幕上屏后按行重新分配，让不同 mode 不共用行。
 */

/** 行间额外留白 */
const ROW_GAP = 2;
/** 冲突时最多向外试探的行数 */
const MAX_SCAN_ROWS = 40;

export interface DanmuRefLike {
  mode?: number;
  $ref?: HTMLElement | null;
}

interface RowItem {
  top: number;
  height: number;
  mode: number;
}

const isOverlap = (top: number, height: number, row: RowItem): boolean =>
  top < row.top + row.height + ROW_GAP && row.top < top + height + ROW_GAP;

/**
 * 把与其它 mode 占同一行的弹幕挪到最近的空闲行。
 * 找不到空行时：固定弹幕隐藏，滚动弹幕保持原位交给插件兜底。
 */
export const resolveDanmuOverlap = (
  danmu: DanmuRefLike,
  marginTop: number,
  marginBottom: number,
): void => {
  const el = danmu.$ref;
  const player = el?.parentElement?.closest<HTMLElement>('.artplayer');
  if (!el || !player) return;

  const mode = danmu.mode ?? 0;
  const height = el.clientHeight;
  if (height <= 0) return;

  const nodes: HTMLElement[] = [];
  player.querySelectorAll<HTMLElement>('[data-mode]').forEach((node) => {
    if (node === el) return;
    if (!node.isConnected || node.style.visibility === 'hidden') return;
    nodes.push(node);
  });
  if (nodes.length === 0) return;

  const playerRect = player.getBoundingClientRect();
  const topInPlayer = (node: HTMLElement) =>
    node.getBoundingClientRect().top - playerRect.top;

  const zoneTop = Math.max(0, Math.round(marginTop));
  const maxTop = Math.round(playerRect.height - marginBottom) - height;
  if (maxTop <= zoneTop) return;

  const allRows: RowItem[] = nodes.map((node) => ({
    top: topInPlayer(node),
    height: node.clientHeight,
    mode: Number(node.dataset.mode) || 0,
  }));
  // 滚动弹幕之间可以同排跟随，同模式交给插件；固定弹幕是静态居中的，必须全避让
  const rows = mode === 0 ? allRows.filter((row) => row.mode !== 0) : allRows;
  if (rows.length === 0) return;

  const current = topInPlayer(el);
  if (!rows.some((row) => isOverlap(current, height, row))) return;

  const step = height + ROW_GAP;
  let delta = 0;
  for (let index = 1; index <= MAX_SCAN_ROWS && delta === 0; index += 1) {
    for (const candidate of [current + step * index, current - step * index]) {
      if (candidate < zoneTop || candidate > maxTop) continue;
      if (rows.some((row) => isOverlap(candidate, height, row))) continue;
      delta = candidate - current;
      break;
    }
  }

  if (delta === 0) {
    if (mode !== 0) el.style.visibility = 'hidden';
    return;
  }

  el.style.top = `${(parseFloat(el.style.top) || 0) + delta}px`;
};
