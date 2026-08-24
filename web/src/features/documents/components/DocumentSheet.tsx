import QRCode from "qrcode";
import { LetterheadSheet } from "@/shared/letterhead/LetterheadSheet";
import type { Letterhead } from "@/shared/letterhead/queries";
import { Alert } from "@/shared/ui/layout";
import { toDateTime } from "@/shared/ui/labels";
import type { DocumentCheck, IssuedDocument } from "../types";
import styles from "./DocumentSheet.module.css";

/**
 * A peça em si: corpo congelado na emissão, dentro da folha timbrada, com o
 * bloco de autoria, o código verificador, o QR e a linha para assinar à mão.
 *
 * O mesmo componente serve a tela interna e a conferência pública — se as duas
 * divergissem, o QR atestaria uma coisa e o papel mostraria outra.
 */
export const DocumentSheet = async ({
  documento,
  letterhead,
  orgName,
  baseUrl,
}: {
  documento: IssuedDocument | DocumentCheck;
  letterhead: Letterhead;
  orgName: string;
  baseUrl: string;
}) => {
  const enderecoDeConferencia = `${baseUrl}/conferencia/${documento.codigo}`;
  const qr = await QRCode.toString(enderecoDeConferencia, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });

  return (
    <LetterheadSheet
      letterhead={letterhead}
      orgName={orgName}
      title={documento.titulo}
      emitidoPor={`${documento.emitidoPorNome} (${documento.emitidoPorCargo})`}
      emitidoEm={documento.data}
    >
      {documento.canceladoEm ? (
        <div className={styles.cancelado}>
          <Alert tone="error">
            <strong>Documento cancelado</strong> em {toDateTime(documento.canceladoEm)}
            {documento.canceladoMotivo ? ` — ${documento.canceladoMotivo}` : ""}. Esta peça não
            produz efeito.
          </Alert>
        </div>
      ) : null}

      {/* O corpo vem do banco já interpolado e higienizado na emissão. */}
      <div
        className={styles.corpo}
        dangerouslySetInnerHTML={{ __html: documento.corpo }}
      />

      <div className={styles.assinatura}>
        <div className={styles.linha} />
        <p className={styles.autor}>{documento.emitidoPorNome}</p>
        <p className={styles.cargo}>{documento.emitidoPorCargo}</p>
      </div>

      <div className={styles.verificacao}>
        <div className={styles.qr} dangerouslySetInnerHTML={{ __html: qr }} />
        <div>
          <p className={styles.codigo}>{documento.codigo}</p>
          <p className={styles.instrucao}>
            Confira a autenticidade em {baseUrl}/conferencia informando o código acima.
          </p>
        </div>
      </div>
    </LetterheadSheet>
  );
};
