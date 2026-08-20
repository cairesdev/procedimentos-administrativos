"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField, SelectField } from "@/shared/ui/form-field";
import { Alert, Badge, FieldGrid, Table } from "@/shared/ui/layout";
import { Modal } from "@/shared/ui/Modal";
import { humanize } from "@/shared/ui/labels";
import { useResourceForm, type ActionResult } from "@/shared/ui/use-resource-form";
import { ROLES } from "@/features/users/types";
import {
  createTenantSector, createTenantUnit, createTenantUser, deleteTenantSector, deleteTenantUnit,
  deleteTenantUser, resetTenantUserPassword, setTenantSectorActive, setTenantUnitActive,
  setTenantUserActive, updateTenantSector, updateTenantUnit,
} from "../actions";
import {
  resetPasswordSchema, tenantSectorSchema, tenantUnitSchema, tenantUserSchema,
  type ResetPasswordInput, type TenantSectorInput, type TenantUnitInput, type TenantUserInput,
} from "../schemas";
import { SECTOR_TYPES, type TenantSector, type TenantUnit, type TenantUser } from "../types";

type Aba = "unidades" | "setores" | "usuarios";

export const TenantRegistriesPanel = ({
  tenantId,
  units,
  sectors,
  users,
}: {
  tenantId: string;
  units: TenantUnit[];
  sectors: TenantSector[];
  users: TenantUser[];
}) => {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("unidades");
  const [criando, setCriando] = useState(false);
  const [editandoUnidade, setEditandoUnidade] = useState<TenantUnit | null>(null);
  const [editandoSetor, setEditandoSetor] = useState<TenantSector | null>(null);
  const [redefinindo, setRedefinindo] = useState<TenantUser | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const executar = async (chave: string, operacao: () => Promise<ActionResult>) => {
    setOcupado(chave);
    const resultado = await operacao();
    setOcupado(null);

    if (resultado.error) {
      toast.error(resultado.error);
      return;
    }
    toast.success(resultado.success ?? "Pronto");
    router.refresh();
  };

  const abas: { id: Aba; label: string; total: number }[] = [
    { id: "unidades", label: "Unidades", total: units.length },
    { id: "setores", label: "Setores", total: sectors.length },
    { id: "usuarios", label: "Usuários", total: users.length },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        {abas.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant={aba === item.id ? "primary" : "secondary"}
            onClick={() => setAba(item.id)}
          >
            {item.label} ({item.total})
          </Button>
        ))}

        <Button type="button" variant="secondary" onClick={() => setCriando(true)}>
          <Plus size={15} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: "6px" }} />
          Novo
        </Button>
      </div>

      {aba === "unidades" ? (
        <Table
          columns={["Nome", "Sigla", "Situação", ""]}
          isEmpty={units.length === 0}
          emptyMessage="Nenhuma unidade cadastrada."
        >
          {units.map((unit) => (
            <tr key={unit.id}>
              <td>{unit.nome}</td>
              <td>{unit.sigla ?? "—"}</td>
              <td>
                <Badge tone={unit.ativo ? "success" : "neutral"}>
                  {unit.ativo ? "ativa" : "inativa"}
                </Badge>
              </td>
              <td>
                <Acoes
                  ocupado={ocupado === unit.id}
                  onEditar={() => setEditandoUnidade(unit)}
                  onAlternar={() =>
                    executar(unit.id, () => setTenantUnitActive(tenantId, unit.id, !unit.ativo))
                  }
                  onExcluir={() => executar(unit.id, () => deleteTenantUnit(tenantId, unit.id))}
                  ativo={unit.ativo}
                  nome={unit.nome}
                />
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {aba === "setores" ? (
        <Table
          columns={["Nome", "Tipo", "Situação", ""]}
          isEmpty={sectors.length === 0}
          emptyMessage="Nenhum setor cadastrado."
        >
          {sectors.map((sector) => (
            <tr key={sector.id}>
              <td>{sector.nome}</td>
              <td>{humanize(sector.tipo)}</td>
              <td>
                <Badge tone={sector.ativo ? "success" : "neutral"}>
                  {sector.ativo ? "ativo" : "inativo"}
                </Badge>
              </td>
              <td>
                <Acoes
                  ocupado={ocupado === sector.id}
                  onEditar={() => setEditandoSetor(sector)}
                  onAlternar={() =>
                    executar(sector.id, () =>
                      setTenantSectorActive(tenantId, sector.id, !sector.ativo),
                    )
                  }
                  onExcluir={() =>
                    executar(sector.id, () => deleteTenantSector(tenantId, sector.id))
                  }
                  ativo={sector.ativo}
                  nome={sector.nome}
                />
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      {aba === "usuarios" ? (
        <Table
          columns={["Nome", "E-mail", "Papel", "Situação", ""]}
          isEmpty={users.length === 0}
          emptyMessage="Nenhum usuário cadastrado."
        >
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.nome}</td>
              <td>{user.email}</td>
              <td>{humanize(user.papelBase)}</td>
              <td>
                <Badge tone={user.ativo ? "success" : "neutral"}>
                  {user.ativo ? "ativo" : "inativo"}
                </Badge>
              </td>
              <td>
                <span style={{ display: "inline-flex", gap: "6px" }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRedefinindo(user)}
                    title="Redefinir senha"
                    aria-label={`Redefinir senha de ${user.nome}`}
                  >
                    <KeyRound size={15} aria-hidden="true" />
                  </Button>
                  <Acoes
                    ocupado={ocupado === user.id}
                    onAlternar={() =>
                      executar(user.id, () => setTenantUserActive(tenantId, user.id, !user.ativo))
                    }
                    onExcluir={() => executar(user.id, () => deleteTenantUser(tenantId, user.id))}
                    ativo={user.ativo}
                    nome={user.nome}
                  />
                </span>
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      <Modal
        open={criando}
        onClose={() => setCriando(false)}
        title={
          aba === "unidades" ? "Nova unidade" : aba === "setores" ? "Novo setor" : "Novo usuário"
        }
      >
        {aba === "unidades" ? (
          <UnitForm tenantId={tenantId} onDone={() => setCriando(false)} />
        ) : null}
        {aba === "setores" ? (
          <SectorForm tenantId={tenantId} onDone={() => setCriando(false)} />
        ) : null}
        {aba === "usuarios" ? (
          <UserForm tenantId={tenantId} onDone={() => setCriando(false)} />
        ) : null}
      </Modal>

      <Modal
        open={editandoUnidade !== null}
        onClose={() => setEditandoUnidade(null)}
        title="Editar unidade"
      >
        {editandoUnidade ? (
          <UnitForm
            tenantId={tenantId}
            unit={editandoUnidade}
            onDone={() => setEditandoUnidade(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={editandoSetor !== null}
        onClose={() => setEditandoSetor(null)}
        title="Editar setor"
      >
        {editandoSetor ? (
          <SectorForm
            tenantId={tenantId}
            sector={editandoSetor}
            onDone={() => setEditandoSetor(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={redefinindo !== null}
        onClose={() => setRedefinindo(null)}
        title="Redefinir senha"
        description={redefinindo ? `Nova senha de ${redefinindo.nome}.` : undefined}
      >
        {redefinindo ? (
          <UserPasswordForm
            tenantId={tenantId}
            user={redefinindo}
            onDone={() => setRedefinindo(null)}
          />
        ) : null}
      </Modal>
    </>
  );
};

const Acoes = ({
  ocupado,
  ativo,
  nome,
  onEditar,
  onAlternar,
  onExcluir,
}: {
  ocupado: boolean;
  ativo: boolean;
  nome: string;
  onEditar?: () => void;
  onAlternar: () => void;
  onExcluir: () => void;
}) => (
  <span style={{ display: "inline-flex", gap: "6px" }}>
    {onEditar ? (
      <Button type="button" variant="ghost" onClick={onEditar} aria-label={`Editar ${nome}`}>
        Editar
      </Button>
    ) : null}
    <Button
      type="button"
      variant="ghost"
      disabled={ocupado}
      onClick={onAlternar}
      title={ativo ? "Inativar" : "Reativar"}
      aria-label={`${ativo ? "Inativar" : "Reativar"} ${nome}`}
    >
      <Power size={15} aria-hidden="true" />
    </Button>
    <Button
      type="button"
      variant="ghost"
      disabled={ocupado}
      onClick={onExcluir}
      title="Excluir"
      aria-label={`Excluir ${nome}`}
    >
      <Trash2 size={15} aria-hidden="true" />
    </Button>
  </span>
);

const UnitForm = ({
  tenantId,
  unit,
  onDone,
}: {
  tenantId: string;
  unit?: TenantUnit;
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<TenantUnitInput>({
    schema: tenantUnitSchema,
    defaultValues: { nome: unit?.nome ?? "", sigla: unit?.sigla ?? "" },
    action: (values) =>
      unit ? updateTenantUnit(tenantId, unit.id, values) : createTenantUnit(tenantId, values),
    resetOnSuccess: !unit,
    onDone,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Secretaria Municipal de Saúde"
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <InputField
        label="Sigla"
        placeholder="SMS"
        error={errors.sigla?.message}
        {...form.register("sigla")}
      />
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : unit ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

const SectorForm = ({
  tenantId,
  sector,
  onDone,
}: {
  tenantId: string;
  sector?: TenantSector;
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<TenantSectorInput>({
    schema: tenantSectorSchema,
    defaultValues: { nome: sector?.nome ?? "", tipo: sector?.tipo ?? "" },
    action: (values) =>
      sector
        ? updateTenantSector(tenantId, sector.id, values)
        : createTenantSector(tenantId, values),
    resetOnSuccess: !sector,
    onDone,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        label="Nome"
        required
        placeholder="Protocolo Geral"
        error={errors.nome?.message}
        {...form.register("nome")}
      />
      <SelectField
        label="Tipo"
        required
        emptyOption="Selecione"
        options={SECTOR_TYPES.map((tipo) => ({ value: tipo, label: humanize(tipo) }))}
        error={errors.tipo?.message}
        {...form.register("tipo")}
      />
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : sector ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

const UserForm = ({ tenantId, onDone }: { tenantId: string; onDone: () => void }) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<TenantUserInput>({
    schema: tenantUserSchema,
    defaultValues: { nome: "", email: "", username: "", senha: "", papelBase: "SERVIDOR" },
    action: (values) => createTenantUser(tenantId, values),
    onDone,
  });

  const { errors } = form.formState;

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Nasce sem lotação. Quem define unidade e setor é o administrador da prefeitura, na tela de
        usuários dela.
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
          label="Nome de usuário"
          required
          placeholder="joao.silva"
          error={errors.username?.message}
          {...form.register("username")}
        />
        <SelectField
          label="Papel"
          required
          options={ROLES.map((papel) => ({ value: papel, label: humanize(papel) }))}
          error={errors.papelBase?.message}
          {...form.register("papelBase")}
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
          {isSubmitting ? "Criando…" : "Cadastrar usuário"}
        </Button>
      </div>
    </form>
  );
};

const UserPasswordForm = ({
  tenantId,
  user,
  onDone,
}: {
  tenantId: string;
  user: TenantUser;
  onDone: () => void;
}) => {
  const { form, onSubmit, isSubmitting } = useResourceForm<ResetPasswordInput>({
    schema: resetPasswordSchema,
    defaultValues: { senha: "" },
    action: (values) => resetTenantUserPassword(tenantId, user.id, values),
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
