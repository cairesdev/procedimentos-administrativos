"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert, Badge, Table } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import {
  promoteEntityAdmin, resetEntityAdminPassword, setEntityAdminActive,
} from "../actions";
import {
  promoteSchema, resetPasswordSchema,
  type PromoteInput, type ResetPasswordInput,
} from "../schemas";
import type { EntityAdmin, PromotableUser } from "../types";

export const EntityAdminsPanel = ({
  tenantId,
  tenantName,
  admins,
  promotable,
}: {
  tenantId: string;
  tenantName: string;
  admins: EntityAdmin[];
  promotable: PromotableUser[];
}) => {
  const router = useRouter();
  const [redefinindo, setRedefinindo] = useState<EntityAdmin | null>(null);
  const [promovendo, setPromovendo] = useState(false);
  const [alterando, setAlterando] = useState<string | null>(null);

  const ativos = admins.filter((admin) => admin.ativo).length;

  const alternar = async (admin: EntityAdmin) => {
    setAlterando(admin.id);
    const resultado = await setEntityAdminActive(tenantId, admin.id, !admin.ativo);
    setAlterando(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Situação alterada");
    router.refresh();
  };

  return (
    <>
      {ativos === 0 ? (
        <Alert tone="error">
          {tenantName} está <strong>sem administrador ativo</strong> — ninguém lá dentro consegue
          cadastrar usuário ou configurar nada. Reative um dos abaixo ou crie outro.
        </Alert>
      ) : null}

      {ativos === 1 ? (
        <Alert tone="info">
          Só um administrador ativo. Se ele perder o acesso, a prefeitura depende de você para
          voltar — vale cadastrar um segundo.
        </Alert>
      ) : null}

      <Table
        columns={["Nome", "Acesso", "Desde", "Situação", ""]}
        isEmpty={admins.length === 0}
        emptyMessage="Nenhum administrador nesta prefeitura."
      >
        {admins.map((admin) => (
          <tr key={admin.id}>
            <td>{admin.nome}</td>
            <td>
              {admin.username}
              <br />
              <small>{admin.email}</small>
            </td>
            <td>{toDate(admin.criadoEm)}</td>
            <td>
              <Badge tone={admin.ativo ? "success" : "neutral"}>
                {admin.ativo ? "ativo" : "inativo"}
              </Badge>
            </td>
            <td>
              <span style={{ display: "inline-flex", gap: "6px" }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRedefinindo(admin)}
                  title="Redefinir senha"
                  aria-label={`Redefinir senha de ${admin.nome}`}
                >
                  <KeyRound size={15} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={alterando === admin.id}
                  onClick={() => alternar(admin)}
                  title={admin.ativo ? "Inativar" : "Reativar"}
                  aria-label={`${admin.ativo ? "Inativar" : "Reativar"} ${admin.nome}`}
                >
                  <Power size={15} aria-hidden="true" />
                </Button>
              </span>
            </td>
          </tr>
        ))}
      </Table>

      {promotable.length > 0 ? (
        <div style={{ marginTop: "12px" }}>
          <Button type="button" variant="secondary" onClick={() => setPromovendo(true)}>
            Promover servidor existente
          </Button>
        </div>
      ) : null}

      <Modal
        open={redefinindo !== null}
        onClose={() => setRedefinindo(null)}
        title="Redefinir senha"
        description={
          redefinindo
            ? `A senha de ${redefinindo.nome} passa a ser a que você digitar aqui.`
            : undefined
        }
      >
        {redefinindo ? (
          <ResetPasswordForm
            tenantId={tenantId}
            admin={redefinindo}
            onDone={() => setRedefinindo(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={promovendo}
        onClose={() => setPromovendo(false)}
        title="Promover a administrador"
        description="O servidor mantém o login e passa a ter papel ADMIN."
      >
        <PromoteForm
          tenantId={tenantId}
          users={promotable}
          onDone={() => setPromovendo(false)}
        />
      </Modal>
    </>
  );
};

const ResetPasswordForm = ({
  tenantId,
  admin,
  onDone,
}: {
  tenantId: string;
  admin: EntityAdmin;
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<ResetPasswordInput>({
    schema: resetPasswordSchema,
    defaultValues: { senha: "" },
    action: (values) => resetEntityAdminPassword(tenantId, admin.id, values),
    onDone,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Combine a senha por um canal seguro e peça para trocar no primeiro acesso. A redefinição
        fica registrada na auditoria da prefeitura, com o seu nome.
      </Alert>

      <InputField
        label="Nova senha"
        type="password"
        required
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres."
        error={form.formState.errors.senha?.message}
        {...form.register("senha")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Redefinindo…" : "Redefinir senha"}
        </Button>
      </div>
    </form>
  );
};

const PromoteForm = ({
  tenantId,
  users,
  onDone,
}: {
  tenantId: string;
  users: PromotableUser[];
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<PromoteInput>({
    schema: promoteSchema,
    defaultValues: { usuarioId: "" },
    action: (values) => promoteEntityAdmin(tenantId, values),
    onDone,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <SelectField
        label="Servidor"
        required
        emptyOption="Selecione"
        options={users.map((user) => ({
          value: user.id,
          label: `${user.nome} (${user.papelBase.toLowerCase()}) — ${user.email}`,
        }))}
        error={form.formState.errors.usuarioId?.message}
        {...form.register("usuarioId")}
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Promovendo…" : "Promover"}
        </Button>
      </div>
    </form>
  );
};
