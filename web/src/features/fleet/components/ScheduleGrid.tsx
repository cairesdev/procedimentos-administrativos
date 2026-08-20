import Link from "next/link";
import type { ScheduleRow, TripStatus } from "../types";
import styles from "./ScheduleGrid.module.css";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const LEGENDA: { status: TripStatus; label: string }[] = [
  { status: "SOLICITADA", label: "Solicitada" },
  { status: "REMARCADA", label: "Remarcada" },
  { status: "APROVADA", label: "Aprovada" },
  { status: "RETIRADA", label: "Em viagem" },
  { status: "FINALIZADA", label: "Finalizada" },
];

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const diaDoMes = (data: Date) =>
  data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Chave estável de dia local, para casar a viagem com a coluna certa. */
const chaveDoDia = (data: Date) =>
  `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`;

export const ScheduleGrid = ({
  rows,
  weekStart,
}: {
  rows: ScheduleRow[];
  /** Domingo da semana exibida. */
  weekStart: Date;
}) => {
  const dias = Array.from({ length: 7 }, (_, indice) => {
    const data = new Date(weekStart);
    data.setDate(weekStart.getDate() + indice);
    return data;
  });

  const hojeChave = chaveDoDia(new Date());

  return (
    <>
      <div className={styles.wrapper}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.vehicle}>Veículo</th>
              {dias.map((dia) => (
                <th
                  key={dia.toISOString()}
                  className={chaveDoDia(dia) === hojeChave ? styles.today : undefined}
                >
                  {DIAS[dia.getDay()]}
                  <br />
                  <small>{diaDoMes(dia)}</small>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.veiculoId}>
                <td className={styles.vehicle}>
                  <span className={styles.plate}>{row.placa}</span>
                  <br />
                  <span className={styles.model}>{row.modelo}</span>
                  {row.emManutencao ? (
                    <>
                      <br />
                      <span className={styles.maintenance}>em manutenção</span>
                    </>
                  ) : null}
                  {!row.ativo && !row.emManutencao ? (
                    <>
                      <br />
                      <span className={styles.maintenance}>inativo</span>
                    </>
                  ) : null}
                </td>

                {dias.map((dia) => {
                  const doDia = row.viagens.filter(
                    (trip) =>
                      chaveDoDia(new Date(trip.dataHoraRemarcada ?? trip.dataHoraDesejada)) ===
                      chaveDoDia(dia),
                  );

                  return (
                    <td
                      key={dia.toISOString()}
                      className={`${styles.day} ${
                        chaveDoDia(dia) === hojeChave ? styles.today : ""
                      }`}
                    >
                      {doDia.length === 0 ? (
                        <span className={styles.empty_day}>—</span>
                      ) : (
                        doDia.map((trip) => (
                          <Link
                            key={trip.id}
                            href={`/frotas/viagens/${trip.id}`}
                            className={`${styles.trip} ${styles[`status_${trip.status}`] ?? ""}`}
                            title={trip.motivo}
                          >
                            <span className={styles.trip_time}>
                              {hora(trip.dataHoraRemarcada ?? trip.dataHoraDesejada)}
                            </span>
                            <span className={styles.trip_who}>{trip.motoristaNome}</span>
                            <span className={styles.trip_who}>
                              {trip.unidadeSolicitanteNome}
                            </span>
                          </Link>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.legend}>
        {LEGENDA.map((item) => (
          <span key={item.status} className={styles.legend_item}>
            <span
              className={`${styles.legend_dot} ${styles[`dot_${item.status}`]}`}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
      </div>
    </>
  );
};
