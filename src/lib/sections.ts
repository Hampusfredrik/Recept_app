/** Grupperar ingredienser eller steg per del ("Frosting"). Huvuddelen (utan namn) först, sedan i den ordning delarna dyker upp. */
export function bySection<T extends { section?: string | null }>(items: T[]): { section: string | null; items: T[] }[] {
  const groups: { section: string | null; items: T[] }[] = [];
  for (const it of items) {
    const sec = it.section?.trim() || null;
    let g = groups.find((x) => x.section === sec);
    if (!g) { g = { section: sec, items: [] }; if (sec === null) groups.unshift(g); else groups.push(g); }
    g.items.push(it);
  }
  return groups;
}
