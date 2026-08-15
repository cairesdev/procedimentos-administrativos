"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { InputField } from "@/shared/ui/form-field";
import { createAssetCategory } from "../actions";
import type { AssetCategory } from "../types";

// Cadastro relâmpago no meio do assistente: só o nome, e já devolve a
// categoria criada para o lote que a pediu.
export const QuickCategoryForm = ({
  onCreated,
}: {
  onCreated: (category: AssetCategory) => void;
}) => {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nome = name.trim();
    if (!nome) {
      toast.error("Informe o nome da categoria");
      return;
    }

    setSaving(true);
    const result = await createAssetCategory({ nome });
    setSaving(false);

    if (result.error || !result.id) {
      toast.error(result.error ?? "Não foi possível cadastrar a categoria");
      return;
    }

    toast.success(`Categoria "${nome}" cadastrada`);
    onCreated({ id: result.id, nome, ativo: true, bens: 0 });
    setName("");
  };

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "14px" }}>
      <InputField
        name="nome"
        label="Nome"
        required
        autoFocus
        placeholder="Informática"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div>
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Cadastrar e usar"}
        </Button>
      </div>
    </form>
  );
};
