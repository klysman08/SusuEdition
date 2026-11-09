/**
 * Quem ainda usa cada mídia registrada. Vídeo, colagem e música compartilham o
 * registro do Rust (o id é o hash do arquivo): só liberamos um arquivo quando
 * nenhum deles o referencia mais.
 */
const sources = new Set<() => Iterable<string>>();

/** Registra uma fonte de ids em uso. Retorna a função para removê-la. */
export function trackMediaUsage(source: () => Iterable<string>): () => void {
  sources.add(source);
  return () => sources.delete(source);
}

/** Libera do registro os `ids` que nenhuma fonte usa mais (chamar depois de remover do estado). */
export async function releaseMedia(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const used = new Set<string>();
  for (const source of sources) for (const id of source()) used.add(id);
  const free = ids.filter((id) => !used.has(id));
  if (free.length === 0) return;
  const { getMediaBackend } = await import("./index");
  await (await getMediaBackend()).unregister(free);
}
