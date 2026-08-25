"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, Card, Stack, SummaryGrid } from "@/shared/ui/layout";

export type PublicSubject = {
  id: string;
  nome: string;
  descricao: string | null;
  prazoDias: number | null;
};

type Aberto = { protocolo: string; documento: string };

/**
 * Abertura de pedido pelo próprio cidadão. Sem login: o que identifica é o
 * CPF/CNPJ, e é ele que depois abre o acompanhamento — por isso a tela insiste
 * tanto em conferir o número antes de enviar.
 */
export const PublicRequestForm = ({
  cnpj,
  assuntos,
}: {
  cnpj: string;
  assuntos: PublicSubject[];
}) => {
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const [assuntoId, setAssuntoId] = useState(assuntos[0]?.id ?? "");

  const escolhido = assuntos.find((assunto) => assunto.id === assuntoId);

  const enviar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const campos = new FormData(evento.currentTarget);
    setEnviando(true);

    try {
      const resposta = await fetch(`/api/publico/${cnpj}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assuntoId: campos.get("assuntoId"),
          descricaoPedido: campos.get("descricaoPedido"),
          tipo: campos.get("tipo"),
          documento: campos.get("documento"),
          nome: campos.get("nome"),
          contatoEmail: campos.get("contatoEmail") || undefined,
          contatoTelefone: campos.get("contatoTelefone") || undefined,
          site: campos.get("site") || undefined,
        }),
      });

      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        toast.error(dados?.message ?? "Não foi possível abrir o pedido");
        return;
      }
      setAberto({
        protocolo: dados.protocolo as string,
        documento: String(campos.get("documento") ?? ""),
      });
    } catch {
      toast.error("Não foi possível falar com a prefeitura. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  if (aberto) {
    return (
      <Stack>
        <Alert tone="success">
          Pedido registrado. <strong>Anote o número do protocolo</strong> — é com ele e com o seu
          CPF/CNPJ que você acompanha o andamento.
        </Alert>

        <Card title="Comprovante">
          <SummaryGrid
            items={[
              { label: "Protocolo", value: <strong>{aberto.protocolo}</strong> },
              { label: "Documento informado", value: aberto.documento },
            ]}
          />
          <div style={{ marginTop: "14px" }}>
            <Link
              href={`/protocolo?protocolo=${encodeURIComponent(aberto.protocolo)}&documento=${encodeURIComponent(aberto.documento)}`}
            >
              <Button type="button">Acompanhar este pedido</Button>
            </Link>
          </div>
        </Card>
      </Stack>
    );
  }

  return (
    <form onSubmit={enviar}>
      <Stack>
        {assuntos.length === 0 ? (
          <Alert tone="error">
            Esta prefeitura ainda não publicou os assuntos atendidos pela internet. Procure o
            protocolo presencialmente.
          </Alert>
        ) : null}

        <Card title="O que você precisa">
          <Stack>
            <SelectField
              name="assuntoId"
              label="Assunto"
              required
              options={assuntos.map((assunto) => ({ value: assunto.id, label: assunto.nome }))}
              value={assuntoId}
              onChange={(evento) => setAssuntoId(evento.target.value)}
              hint={
                escolhido?.prazoDias
                  ? `Prazo de resposta: ${escolhido.prazoDias} dias`
                  : undefined
              }
            />

            {escolhido?.descricao ? (
              <Alert tone="info">{escolhido.descricao}</Alert>
            ) : null}

            <TextareaField
              name="descricaoPedido"
              label="Descreva seu pedido"
              required
              rows={5}
              minLength={10}
              placeholder="Explique com suas palavras o que você está pedindo."
            />
          </Stack>
        </Card>

        <Card title="Seus dados">
          <Stack>
            <SelectField
              name="tipo"
              label="Você está pedindo como"
              required
              options={[
                { value: "CIDADAO", label: "Cidadão" },
                { value: "FORNECEDOR", label: "Empresa fornecedora" },
                { value: "OUTRO_ORGAO", label: "Outro órgão público" },
              ]}
            />

            <InputField
              name="documento"
              label="CPF ou CNPJ"
              required
              placeholder="Só números"
              hint="Guarde este número: junto com o protocolo, é ele que abre o acompanhamento."
            />

            <InputField name="nome" label="Nome completo" required minLength={3} />
            <InputField name="contatoEmail" label="E-mail" type="email" />
            <InputField name="contatoTelefone" label="Telefone" />

            {/*
              Armadilha para robô: escondida da tela e do leitor de tela, mas
              preenchida por preenchedor automático. Vindo preenchida, a API
              descarta o pedido sem avisar que percebeu.
            */}
            <div style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">
              <label htmlFor="site">Não preencha este campo</label>
              <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
            </div>
          </Stack>
        </Card>

        <Card>
          <Stack>
            <Alert tone="info">
              Ao enviar, seu pedido entra na fila da prefeitura com número de protocolo. A resposta
              vem pelo mesmo canal — acompanhe com protocolo e documento.
            </Alert>
            <div>
              <Button type="submit" disabled={enviando || assuntos.length === 0}>
                {enviando ? "Enviando…" : "Enviar pedido"}
              </Button>
            </div>
          </Stack>
        </Card>
      </Stack>
    </form>
  );
};
