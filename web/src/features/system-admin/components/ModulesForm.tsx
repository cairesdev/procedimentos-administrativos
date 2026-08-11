"use client";

import { Button } from "@/shared/ui/button";
import { Alert } from "@/shared/ui/layout";
import { useModalClose } from "@/shared/ui/Modal";
import { TagSelect } from "@/shared/ui/TagSelect";
import { useResourceForm } from "@/shared/ui/use-resource-form";
import { z } from "zod";
import { setTenantModules } from "../actions";
import { MODULES, type Tenant } from "../types";

const schema = z.object({ modulos: z.array(z.string()) });
type ModulesInput = z.input<typeof schema>;

export const ModulesForm = ({ tenant }: { tenant: Tenant }) => {
  const closeModal = useModalClose();

  const { form, onSubmit, isSubmitting } = useResourceForm<ModulesInput>({
    schema: schema as never,
    defaultValues: { modulos: tenant.modulos },
    action: (values) => setTenantModules(tenant.id, values.modulos as string[]),
    resetOnSuccess: false,
    onDone: closeModal,
  });

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px" }}>
      <Alert tone="info">
        Desmarcar um módulo esconde as telas dele para todos os usuários desta prefeitura, sem
        apagar nenhum dado.
      </Alert>

      <TagSelect
        control={form.control}
        name="modulos"
        label="Módulos habilitados"
        options={MODULES.map((module) => ({ value: module, label: module.toLowerCase() }))}
        searchPlaceholder="Buscar módulo…"
      />

      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar módulos"}
        </Button>
      </div>
    </form>
  );
};
