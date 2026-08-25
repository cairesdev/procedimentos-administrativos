"use client";

import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField, TextareaField } from "@/shared/ui/form-field";
import { Alert, Card, Stack } from "@/shared/ui/layout";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { openService } from "../actions";
import { serviceSchema, type ServiceInput } from "../schemas";
import { REQUESTER_TYPES, type ProtocolSubject, type Requester } from "../types";

/**
 * Atendimento de balcão. O documento vem primeiro de propósito: quem já foi
 * atendido antes tem o cadastro puxado, e o atendente não redigita nada — nem
 * cria um segundo cadastro que partiria o histórico da pessoa em dois.
 */
export const ServiceForm = ({ assuntos }: { assuntos: ProtocolSubject[] }) => {
  const [buscando, iniciarBusca] = useTransition();
  const [encontrado, setEncontrado] = useState<Requester | null>(null);

  const { form, onSubmit, isSubmitting } = useResourceForm<ServiceInput>({
    schema: serviceSchema as never,
    defaultValues: {
      assuntoId: assuntos[0]?.id ?? "",
      descricaoPedido: "",
      tipo: "CIDADAO",
      documento: "",
      nome: "",
      contatoEmail: "",
      contatoTelefone: "",
    },
    resetOnSuccess: false,
    action: (values) => openService(values),
  });

  const buscarRequerente = () => {
    const documento = form.getValues("documento").replace(/\D/g, "");
    if (documento.length < 11) {
      toast.error("Digite o CPF ou CNPJ completo");
      return;
    }

    iniciarBusca(async () => {
      const resposta = await fetch(`/api/proxy/protocolo/requerentes/${documento}`, {
        cache: "no-store",
      });
      if (!resposta.ok) {
        setEncontrado(null);
        toast.info("Nenhum cadastro com este documento. Preencha os dados do requerente.");
        return;
      }
      const requerente = (await resposta.json()) as Requester;
      setEncontrado(requerente);
      form.setValue("nome", requerente.nome);
      form.setValue("tipo", requerente.tipo);
      form.setValue("contatoEmail", requerente.contatoEmail ?? "");
      form.setValue("contatoTelefone", requerente.contatoTelefone ?? "");
      toast.success(`Cadastro de ${requerente.nome} carregado`);
    });
  };

  const assuntoEscolhido = assuntos.find((a) => a.id === form.watch("assuntoId"));

  return (
    <form onSubmit={onSubmit}>
      <Stack>
        <Card title="Requerente">
          <Stack>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <InputField
                  label="CPF ou CNPJ"
                  required
                  placeholder="Só números"
                  hint="O documento é a chave do acompanhamento — confira antes de seguir."
                  error={form.formState.errors.documento?.message}
                  {...form.register("documento")}
                />
              </div>
              <Button type="button" variant="secondary" onClick={buscarRequerente} disabled={buscando}>
                <Search size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
                {buscando ? "Buscando…" : "Buscar"}
              </Button>
            </div>

            {encontrado ? (
              <Alert tone="success">
                Requerente já cadastrado. Os dados abaixo vieram do último atendimento — corrija se
                mudaram.
              </Alert>
            ) : null}

            <InputField
              label="Nome"
              required
              error={form.formState.errors.nome?.message}
              {...form.register("nome")}
            />

            <SelectField
              label="Tipo"
              required
              options={REQUESTER_TYPES.map((tipo) => ({ value: tipo.value, label: tipo.label }))}
              error={form.formState.errors.tipo?.message}
              {...form.register("tipo")}
            />

            <InputField
              label="E-mail"
              type="email"
              hint="Opcional, mas é por onde a prefeitura avisa do andamento."
              error={form.formState.errors.contatoEmail?.message}
              {...form.register("contatoEmail")}
            />

            <InputField
              label="Telefone"
              error={form.formState.errors.contatoTelefone?.message}
              {...form.register("contatoTelefone")}
            />
          </Stack>
        </Card>

        <Card title="Pedido">
          <Stack>
            {assuntos.length === 0 ? (
              <Alert tone="error">
                Nenhum assunto ativo cadastrado. O administrador define os assuntos atendidos em
                Administração › Assuntos do protocolo.
              </Alert>
            ) : (
              <SelectField
                label="Assunto"
                required
                options={assuntos.map((assunto) => ({ value: assunto.id, label: assunto.nome }))}
                hint={
                  assuntoEscolhido?.setorNome
                    ? `Vai direto para ${assuntoEscolhido.setorNome}`
                    : "Sem setor definido: segue o fluxo de atendimento externo."
                }
                error={form.formState.errors.assuntoId?.message}
                {...form.register("assuntoId")}
              />
            )}

            <TextareaField
              label="Descrição do pedido"
              required
              rows={5}
              placeholder="O que o requerente está pedindo, nas palavras dele."
              error={form.formState.errors.descricaoPedido?.message}
              {...form.register("descricaoPedido")}
            />

            <div>
              <Button type="submit" disabled={isSubmitting || assuntos.length === 0}>
                {isSubmitting ? "Abrindo…" : "Abrir atendimento"}
              </Button>
            </div>
          </Stack>
        </Card>
      </Stack>
    </form>
  );
};
