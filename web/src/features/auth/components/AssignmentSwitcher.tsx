"use client";

import { useRef } from "react";
import { setActiveAssignment } from "../assignment";
import type { Assignment } from "../types";
import styles from "./AssignmentSwitcher.module.css";

// Contexto de atuação: toda ação de tramitação é registrada em nome da lotação ativa.
export const AssignmentSwitcher = ({
  assignments,
  activeId,
}: {
  assignments: Assignment[];
  activeId?: string;
}) => {
  const formRef = useRef<HTMLFormElement>(null);

  if (assignments.length === 0) {
    return <span className={styles.missing}>Sem lotação definida</span>;
  }

  if (assignments.length === 1) {
    return (
      <span className={styles.switcher}>
        <span className={styles.label}>Atuando como</span>
        <span className={styles.fixed}>{assignments[0]!.destino}</span>
      </span>
    );
  }

  return (
    <form ref={formRef} action={setActiveAssignment} className={styles.switcher}>
      <label className={styles.label} htmlFor="assignmentId">
        Atuando como
      </label>
      <select
        id="assignmentId"
        name="assignmentId"
        className={styles.control}
        defaultValue={activeId ?? assignments[0]!.id}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {assignments.map((assignment) => (
          <option key={assignment.id} value={assignment.id}>
            {assignment.destino}
          </option>
        ))}
      </select>
    </form>
  );
};
