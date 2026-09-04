"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert, FieldGrid, Stack } from "@/shared/ui/layout";
import { saveEmailSettings, testEmailSettings } from "../actions";
import type { EmailSettings } from "../queries";

/**
 * A configuração de SMTP, editada pelo administrativo geral.
 *
 * Sem `tenantId` é a do produto, que atende toda prefeitura sem configuração
 * própria. Com `tenantId` é a da prefeitura, que vence a global — quem tem
 * domínio próprio manda do domínio próprio, e o bloqueio de um não derruba os
 * outros.
 */
export const EmailSettingsForm = ({
  atual,
  tenantId,
  nomeDoTenant,
}: {
  atual: EmailSettings | null;
  tenantId?: string;
  nomeDoTenant?: string;
}) => {
  const [host, setHost] = useState(atual?.host ?? "");
  const [porta, setPorta] = useState(String(atual?.porta ?? 587));
  const [usuario, setUsuario] = useState(atual?.usuario ?? "");
  const [senha, setSenha] = useState("");
  const [remetente, setRemetente] = useState(atual?.remetente ?? "");
  const [tlsDireto, setTlsDireto] = useState(atual?.tlsDireto ?? false);
  const [ativo, setAtivo] = useState(atual?.ativo ?? true);
  const [paraTeste, setParaTeste] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const salvar = async () => {
    setOcupado(true);
    const resultado = await saveEmailSettings(
      {
        host, porta: Number(porta), usuario, senha, remetente, tlsDireto, ativo,
      },
      tenantId,
    );
    setOcupado(false);

    if (!resultado.success) {
      toast.error(resultado.error ?? "Não foi possível salvar");
      return;
    }
    // A senha some do formulário depois de salva: deixá-la ali convida a
    // reenviar sem querer, e o campo em branco já significa "não mexe".
    setSenha("");
    toast.success("Configuração salva");
  };

  const testar = async () => {
    if (!paraTeste.trim()) {
      toast.error("Informe o e-mail que deve receber o teste.");
      return;
    }
    setOcupado(true);
    const resultado = await testEmailSettings(paraTeste.trim(), tenantId);
    setOcupado(false);

    if (!resultado.success) {
      // O erro vem do servidor de e-mail como ele veio — "535 authentication
      // failed" diz o que corrigir, e resumir isso apagaria a única
      // informação útil.
      toast.error(resultado.error ?? "O teste não foi entregue");
      return;
    }
    toast.success(`Teste enviado para ${paraTeste.trim()}`);
  };

  return (
    <Stack>
      {tenantId ? (
        <Alert tone="info">
          {atual
            ? `${nomeDoTenant ?? "Esta prefeitura"} manda pelo próprio servidor. `
              + "Remover esta configuração faz voltar ao remetente do produto."
            : `${nomeDoTenant ?? "Esta prefeitura"} usa o servidor do produto. `
              + "Preencha abaixo para ela mandar pelo domínio dela."}
        </Alert>
      ) : (
        <Alert tone="info">
          É por aqui que sai o e-mail de toda prefeitura sem servidor próprio. Sem
          nada configurado, os avisos ficam parados na fila — e aparecem lá com o
          motivo.
        </Alert>
      )}

      <FieldGrid>
        <InputField
          label="Servidor (host)"
          name="host"
          placeholder="smtp.provedor.com.br"
          value={host}
          onChange={(evento) => setHost(evento.target.value)}
        />
        <InputField
          label="Porta"
          name="porta"
          type="number"
          hint="587 com STARTTLS, 465 com TLS direto, 25 sem criptografia."
          value={porta}
          onChange={(evento) => setPorta(evento.target.value)}
        />
        <InputField
          label="Usuário"
          name="usuario"
          hint="Em branco para servidor interno que não pede autenticação."
          value={usuario}
          onChange={(evento) => setUsuario(evento.target.value)}
        />
        <InputField
          label="Senha"
          name="senha"
          type="password"
          placeholder={atual?.temSenha ? "•••••••• (já configurada)" : ""}
          hint={
            atual?.temSenha
              ? "Em branco mantém a senha atual. Preencha só para trocá-la."
              : "Guardada cifrada; não volta a aparecer aqui depois de salva."
          }
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
        />
        <InputField
          label="Remetente"
          name="remetente"
          type="email"
          placeholder="naoresponda@prefeitura.ma.gov.br"
          hint="O nome da prefeitura vai na frente dele automaticamente."
          value={remetente}
          onChange={(evento) => setRemetente(evento.target.value)}
        />
        <SelectField
          label="Criptografia"
          name="tlsDireto"
          value={tlsDireto ? "direto" : "starttls"}
          onChange={(evento) => setTlsDireto(evento.target.value === "direto")}
          options={[
            { value: "starttls", label: "STARTTLS (porta 587)" },
            { value: "direto", label: "TLS direto (porta 465)" },
          ]}
        />
        <SelectField
          label="Situação"
          name="ativo"
          hint="Desligado, os e-mails ficam na fila em vez de sair por outro servidor."
          value={ativo ? "sim" : "nao"}
          onChange={(evento) => setAtivo(evento.target.value === "sim")}
          options={[
            { value: "sim", label: "Ativo" },
            { value: "nao", label: "Desativado" },
          ]}
        />
      </FieldGrid>

      <div>
        <Button type="button" disabled={ocupado} onClick={() => void salvar()}>
          {ocupado ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>

      {/*
        O teste usa o que **está salvo**, e não o que está no formulário:
        testar o digitado e gravar outra coisa seria testar o que não vai valer.
        Por isso ele fica depois do botão de salvar, e o texto diz isso.
      */}
      <FieldGrid>
        <InputField
          label="Enviar teste para"
          name="paraTeste"
          type="email"
          hint="Usa a configuração já salva. Salve antes de testar uma mudança."
          value={paraTeste}
          onChange={(evento) => setParaTeste(evento.target.value)}
        />
      </FieldGrid>

      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={ocupado || !atual}
          onClick={() => void testar()}
        >
          Enviar teste
        </Button>
      </div>
    </Stack>
  );
};
