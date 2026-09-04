"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/shared/ui/button";
import { FileField, InputField } from "@/shared/ui/form-field";
import { Alert, Badge, Card, EmptyState, Stack, Table } from "@/shared/ui/layout";
import { humanize, toDateTime } from "@/shared/ui/labels";
import type { Attachment } from "../types";

/**
 * O mesmo teto que a API aplica, repetido aqui de propósito.
 *
 * A regra vive na API — é lá que ela é obrigatória. Este número existe só para
 * a tela poder dizer "9 de 10" e esconder o formulário no décimo, em vez de
 * deixar a pessoa escolher o arquivo, subir e ouvir não.
 */
const TETO = 10;

/** O caminho guardado é `<uuid>-<nome original>`; o nome legível sai dele. */
const nomeDoArquivo = (caminho: string) =>
  (caminho.split("/").pop() ?? "arquivo").replace(/^[0-9a-f-]{36}-/i, "");

/**
 * Os arquivos do processo.
 *
 * A API guarda anexo desde a primeira fatia, e a tela interna nunca teve onde
 * mostrá-lo: só o portal do cidadão anexava, respondendo exigência. Na prática
 * o servidor juntava a nota fiscal por fora do sistema — e o processo chegava
 * à prestação de contas sem os documentos que o justificam.
 *
 * O painel faz as duas pontas: juntar arquivo a qualquer momento do processo
 * aberto, e levar tudo embora num pacote só — anexos e peças emitidas juntos,
 * que é como o Tribunal pede e como a tela, dividida em dois cards, não
 * entregava.
 */
export const AttachmentPanel = ({
  processoId,
  anexos,
  podeAnexar,
}: {
  processoId: string;
  anexos: Attachment[];
  /** Processo aberto e quem olha pode despachar. Fechado, a lista fica só de leitura. */
  podeAnexar: boolean;
}) => {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [tipo, setTipo] = useState("");
  const campoDoArquivo = useRef<HTMLInputElement>(null);

  // A cota conta só o que o servidor juntou — igual à API. O que o requerente
  // mandou respondendo exigência aparece na lista e não ocupa vaga.
  const doServidor = anexos.filter((anexo) => anexo.origem === "SERVIDOR").length;
  const cheio = doServidor >= TETO;

  const enviar = async () => {
    const arquivo = campoDoArquivo.current?.files?.[0];
    if (!arquivo) {
      toast.error("Escolha o arquivo que você quer juntar ao processo.");
      return;
    }
    if (tipo.trim().length < 2) {
      toast.error("Diga o que é este documento — nota fiscal, ofício, parecer.");
      return;
    }

    const corpo = new FormData();
    corpo.append("arquivo", arquivo);
    corpo.append("tipoDocumento", tipo.trim());

    setEnviando(true);
    try {
      const resposta = await fetch(`/api/proxy/processos/${processoId}/anexos`, {
        method: "POST",
        body: corpo,
      });

      if (!resposta.ok) {
        // A API explica o motivo — teto atingido, processo encerrado. Trocar
        // isso por "não foi possível" apagaria a única frase útil da tela.
        const erro = (await resposta.json().catch(() => null)) as { message?: string } | null;
        toast.error(erro?.message ?? "Não foi possível anexar o arquivo.");
        return;
      }

      toast.success("Arquivo anexado ao processo");
      setTipo("");
      if (campoDoArquivo.current) campoDoArquivo.current.value = "";
      router.refresh();
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (anexo: Attachment) => {
    const nome = nomeDoArquivo(anexo.arquivo);
    if (!window.confirm(`Remover "${nome}" do processo?`)) return;

    const resposta = await fetch(`/api/proxy/processos/${processoId}/anexos/${anexo.id}`, {
      method: "DELETE",
    });
    if (!resposta.ok) {
      toast.error("Não foi possível remover o anexo.");
      return;
    }
    toast.success("Anexo removido");
    router.refresh();
  };

  return (
    <Card
      title={podeAnexar ? `Arquivos (${doServidor} de ${TETO})` : "Arquivos"}
      action={
        // O pacote sai mesmo sem anexo: as peças emitidas entram nele, e a API
        // recusa com a frase certa quando não há nada para levar.
        <LinkButton href={`/api/proxy/processos/${processoId}/autos.zip`} arquivo>
          <Download size={15} aria-hidden="true" />
          Baixar os autos
        </LinkButton>
      }
    >
      <Stack>
        <Table
          columns={["Arquivo", "O que é", "Quando", ""]}
          isEmpty={anexos.length === 0}
          emptyMessage="Nenhum arquivo juntado."
          empty={
            <EmptyState
              titulo="Nenhum arquivo juntado a este processo"
              descricao={
                "Junte aqui a nota fiscal, o ofício recebido, a certidão, o comprovante — "
                + "o que sustenta o que está sendo decidido. Vale a qualquer momento, "
                + "enquanto o processo estiver aberto."
              }
            />
          }
        >
          {anexos.map((anexo) => (
            <tr key={anexo.id}>
              <td>
                <a href={`/api/proxy/processos/${processoId}/anexos/${anexo.id}/download`} download>
                  <Paperclip size={13} aria-hidden="true" />{" "}
                  {nomeDoArquivo(anexo.arquivo)}
                </a>
                {anexo.origem === "REQUERENTE" ? (
                  <>
                    {" "}
                    <Badge tone="neutral">do requerente</Badge>
                  </>
                ) : null}
              </td>
              <td>{humanize(anexo.tipoDocumento)}</td>
              <td>{toDateTime(anexo.data)}</td>
              <td>
                {/*
                  O que o requerente mandou não se apaga daqui.
                  É prova que ele juntou por exigência do processo, e quem a
                  removesse estaria desfazendo o ato dele.
                */}
                {podeAnexar && anexo.origem === "SERVIDOR" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => void remover(anexo)}
                    aria-label={`Remover ${nomeDoArquivo(anexo.arquivo)}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>

        {podeAnexar && cheio ? (
          <Alert tone="info">
            Este processo chegou ao limite de {TETO} arquivos. Remova um que não seja mais
            necessário antes de juntar outro.
          </Alert>
        ) : null}

        {podeAnexar && !cheio ? (
          <>
            <InputField
              label="O que é este documento"
              name="tipoDocumento"
              placeholder="Nota fiscal, ofício, parecer…"
              hint="Aparece na lista acima e ajuda quem for procurar depois."
              value={tipo}
              onChange={(evento) => setTipo(evento.target.value)}
            />
            <FileField label="Arquivo" name="arquivo" ref={campoDoArquivo} />
            <div>
              <Button type="button" onClick={() => void enviar()} disabled={enviando}>
                {enviando ? "Enviando…" : "Anexar ao processo"}
              </Button>
            </div>
          </>
        ) : null}
      </Stack>
    </Card>
  );
};
