"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { Alert, Badge, FieldGrid, Table } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { toDate } from "@/shared/ui/labels";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { createSystemAdmin, resetSystemAdminPassword, setSystemAdminActive } from "../actions";
import {
  resetPasswordSchema, systemAdminSchema,
  type ResetPasswordInput, type SystemAdminInput,
} from "../schemas";
import type { SystemAdmin } from "../types";

export const SystemAdminsPanel = ({ admins }: { admins: SystemAdmin[] }) => {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [redefinindo, setRedefinindo] = useState<SystemAdmin | null>(null);
  const [alterando, setAlterando] = useState<string | null>(null);

  const ativos = admins.filter((admin) => admin.ativo).length;

  const alternar = async (admin: SystemAdmin) => {
    setAlterando(admin.id);
    const resultado = await setSystemAdminActive(admin.id, !admin.ativo);
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
      <div style={{ marginBottom: "14px" }}>
        <Button type="button" onClick={() => setCriando(true)}>
          Novo administrador
        </Button>
      </div>

      {ativos === 1 ? (
        <Alert tone="info">
          Só um administrador ativo. Se esse acesso se perder, voltar exige mexer direto no banco —
          vale cadastrar um segundo.
        </Alert>
      ) : null}

      <Table
        columns={["Nome", "E-mail", "Desde", "Situação", ""]}
        isEmpty={admins.length === 0}
        emptyMessage="Nenhum administrador cadastrado."
      >
        {admins.map((admin) => (
          <tr key={admin.id}>
            <td>{admin.nome}</td>
            <td>{admin.email}</td>
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

      <Modal
        open={criando}
        onClose={() => setCriando(false)}
        title="Novo administrador do sistema"
        description="Acesso ao painel do produto, com poder sobre todas as prefeituras."
      >
        <SystemAdminForm onDone={() => setCriando(false)} />
      </Modal>

      <Modal
        open={redefinindo !== null}
        onClose={() => setRedefinindo(null)}
        title="Redefinir senha"
        description={redefinindo ? `Nova senha de ${redefinindo.nome}.` : undefined}
      >
        {redefinindo ? (
          <ResetForm admin={redefinindo} onDone={() => setRedefinindo(null)} />
        ) : null}
      </Modal>
    </>
  );
};

const SystemAdminForm = ({ onDone }: { onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<SystemAdminInput>({
    schema: systemAdminSchema,
    defaultValues: { nome: "", email: "", senha: "" },
    action: createSystemAdmin,
    onDone,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Este acesso enxerga e altera <strong>todas</strong> as prefeituras. Só para a sua equipe.
      </Alert>

      <InputField
        label="Nome"
        required
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <FieldGrid>
        <InputField
          label="E-mail"
          type="email"
          required
          error={errors.email?.message}
          {...form.register("email")}
        />
        <InputField
          label="Senha provisória"
          type="password"
          required
          autoComplete="new-password"
          error={errors.senha?.message}
          {...form.register("senha")}
        />
      </FieldGrid>

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Criando…" : "Criar administrador"}
        </Button>
      </div>
    </form>
  );
};

const ResetForm = ({ admin, onDone }: { admin: SystemAdmin; onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<ResetPasswordInput>({
    schema: resetPasswordSchema,
    defaultValues: { senha: "" },
    action: (values) => resetSystemAdminPassword(admin.id, values),
    onDone,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
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
