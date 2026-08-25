"use client";

import { RowActions } from "@/shared/ui/RowActions";
import type { Sector } from "@/features/sectors/types";
import { deleteSubject, updateSubject } from "../actions";
import { SubjectForm } from "./SubjectForm";
import type { ProtocolSubject } from "../types";

export const SubjectRowActions = ({
  assunto,
  setores,
  canWrite,
}: {
  assunto: ProtocolSubject;
  setores: Sector[];
  canWrite: boolean;
}) => {
  if (!canWrite) return null;

  const dados = {
    nome: assunto.nome,
    descricao: assunto.descricao ?? "",
    setorId: assunto.setorId ?? "",
    prazoDias: assunto.prazoDias ?? undefined,
  };

  return (
    <RowActions
      label={`assunto ${assunto.nome}`}
      editTitle="Editar assunto"
      editForm={<SubjectForm assunto={assunto} setores={setores} />}
      isActive={assunto.ativo}
      onToggleActive={() => updateSubject(assunto.id, { ...dados, ativo: !assunto.ativo })}
      // A API recusa exclusão de assunto com atendimento; o aviso antecipa isso
      // em vez de deixar o erro aparecer só depois do clique.
      onDelete={assunto.atendimentos === 0 ? () => deleteSubject(assunto.id) : undefined}
      deleteWarning={
        assunto.atendimentos > 0
          ? `Este assunto já tem ${assunto.atendimentos} atendimento(s).`
          : undefined
      }
    />
  );
};
