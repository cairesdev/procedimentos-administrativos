import { Card } from "./layout";
import styles from "./Skeleton.module.css";

/**
 * A forma da tela enquanto ela vem.
 *
 * O sistema é feito de server components: entre o clique e a resposta, o
 * navegador segura a página anterior e nada acontece na tela. Quem está do
 * outro lado não sabe se clicou, e clica de novo.
 *
 * O esqueleto não é enfeite: é a resposta imediata que diz "recebi, está
 * vindo" — e, por ter a forma do que vem, evita o pulo de layout quando o
 * conteúdo chega.
 */

export const SkeletonBlock = ({ width, height = 14 }: { width: string; height?: number }) => (
  <div className={styles.bloco} style={{ width, height }} aria-hidden="true" />
);

/** Cabeçalho da página: título e subtítulo. */
export const SkeletonHeader = () => (
  <div className={styles.cabecalho}>
    <SkeletonBlock width="240px" height={22} />
    <SkeletonBlock width="360px" height={13} />
  </div>
);

/**
 * Uma listagem carregando.
 *
 * `role="status"` com texto para leitor de tela: quem não enxerga o cinza
 * precisa ouvir que a tela está carregando, e não o silêncio.
 */
export const SkeletonTable = ({ linhas = 6 }: { linhas?: number }) => (
  <div role="status" aria-live="polite">
    <span className="visually-hidden">Carregando…</span>
    <SkeletonHeader />
    <Card padded={false}>
      <div className={styles.linhas}>
        {Array.from({ length: linhas }, (_, indice) => (
          <SkeletonBlock key={indice} width={indice === 0 ? "100%" : `${92 - indice * 4}%`} />
        ))}
      </div>
    </Card>
  </div>
);

/** Uma tela de detalhe: resumo em grade e um bloco de conteúdo. */
export const SkeletonDetail = () => (
  <div role="status" aria-live="polite">
    <span className="visually-hidden">Carregando…</span>
    <SkeletonHeader />
    <Card>
      <div className={styles.linhas} style={{ padding: 0 }}>
        <SkeletonBlock width="70%" />
        <SkeletonBlock width="55%" />
        <SkeletonBlock width="62%" />
      </div>
    </Card>
  </div>
);
