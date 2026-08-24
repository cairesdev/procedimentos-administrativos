import type { ReactNode } from "react";
import { Alert } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import type { Letterhead } from "./queries";
import { PrintBar } from "./PrintBar";
import styles from "./Letterhead.module.css";

/**
 * Folha com o timbre da prefeitura — cabeçalho, logomarca e rodapé vindos do
 * painel do produto. É o que dá ao documento cara de papel oficial; sem timbre
 * configurado, imprime assim mesmo e avisa quem pode resolver.
 */
export const LetterheadSheet = ({
  letterhead,
  orgName,
  title,
  subtitle,
  emitidoPor,
  children,
}: {
  letterhead: Letterhead;
  orgName: string;
  title: string;
  subtitle?: string;
  emitidoPor: string;
  children: ReactNode;
}) => {
  const semTimbre = !letterhead.cabecalhoTimbre && !letterhead.arquivoLogomarca;

  return (
    <>
      <PrintBar />

      <div className={styles.folha}>
        {semTimbre ? (
          <div className={styles.sem_timbre}>
            <Alert tone="info">
              Esta prefeitura ainda não tem timbre configurado — o documento sai sem cabeçalho
              oficial. Quem configura é o administrador do sistema.
            </Alert>
          </div>
        ) : (
          <header className={styles.timbre}>
            {letterhead.arquivoLogomarca ? (
              // eslint-disable-next-line @next/next/no-img-element -- streaming da API, sem otimização
              <img
                src="/api/proxy/auth/timbre/logomarca"
                alt=""
                className={styles.logo}
                aria-hidden="true"
              />
            ) : null}
            <p className={styles.cabecalho}>{letterhead.cabecalhoTimbre ?? orgName}</p>
          </header>
        )}

        <h1 className={styles.titulo}>{title}</h1>
        {subtitle ? <p className={styles.subtitulo}>{subtitle}</p> : null}

        {children}

        {letterhead.rodapeTimbre ? (
          <footer className={styles.rodape}>{letterhead.rodapeTimbre}</footer>
        ) : null}

        <p className={styles.emissao}>
          Emitido por {emitidoPor} em {toDateTime(new Date().toISOString())}
        </p>
      </div>
    </>
  );
};
