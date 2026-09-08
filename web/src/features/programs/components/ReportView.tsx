import { Card, SummaryGrid, Table, numericCell } from "@/shared/ui/layout";
import { SITUACAO_ROTULO, VINCULO_ROTULO, type ProgramReport } from "../types";

const umDia = (valor: number) => (valor === 1 ? "1 dia" : `${valor} dias`);

/**
 * Os três itens do ofício, na ordem em que ele os pediu.
 *
 * Nenhuma conta acontece aqui. Média, mediana e faixa etária chegam prontas do
 * domínio da API — as mesmas que a peça impressa usa. Recalcular no cliente
 * seria uma segunda implementação das mesmas regras, e no dia em que
 * divergissem a tela diria um número e o documento entregue à Promotoria diria
 * outro.
 */
export const ReportView = ({ relatorio }: { relatorio: ProgramReport }) => (
  <>
    <Card title="1. Pessoas acompanhadas">
      <SummaryGrid
        items={[
          { label: "Em acompanhamento", value: `${relatorio.pessoas.totalAtivos}` },
          ...relatorio.pessoas.porSituacao.map((linha) => ({
            label: SITUACAO_ROTULO[linha.situacao] ?? linha.situacao,
            value: `${linha.quantidade}`,
          })),
        ]}
      />

      <div style={{ marginTop: "16px" }}>
        <Table
          columns={["Faixa etária", "Pessoas"]}
          isEmpty={relatorio.pessoas.porFaixa.length === 0}
          emptyMessage="Ninguém em acompanhamento no programa."
        >
          {/*
            As faixas vazias continuam na tabela. "0" é uma resposta — some da
            lista e o leitor não sabe se ninguém tem aquela idade ou se a faixa
            não foi apurada.
          */}
          {relatorio.pessoas.porFaixa.map((faixa) => (
            <tr key={faixa.faixa}>
              <td>{faixa.rotulo}</td>
              <td className={numericCell}>{faixa.quantidade}</td>
            </tr>
          ))}
        </Table>
      </div>
    </Card>

    <Card title="2. Fila de espera e periodicidade" padded={false}>
      <Table
        columns={[
          "Terapia", "Na fila", "Espera mais antiga", "Espera média (fila)",
          "Já iniciaram", "Média até iniciar", "Mediana", "Sessões/semana",
        ]}
        isEmpty={relatorio.fila.length === 0}
        emptyMessage="Nenhuma terapia indicada no período."
      >
        {relatorio.fila.map((linha) => (
          <tr key={linha.terapiaId}>
            <td>{linha.terapiaNome}</td>
            <td className={numericCell}>{linha.naFila}</td>
            <td className={numericCell}>
              {linha.naFila > 0 ? umDia(linha.esperaMaisAntiga) : "—"}
            </td>
            <td className={numericCell}>
              {linha.naFila > 0 ? umDia(linha.mediaNaFila) : "—"}
            </td>
            <td className={numericCell}>{linha.iniciados}</td>
            <td className={numericCell}>
              {linha.iniciados > 0 ? umDia(linha.mediaAteIniciar) : "—"}
            </td>
            <td className={numericCell}>
              {linha.iniciados > 0 ? umDia(linha.medianaAteIniciar) : "—"}
            </td>
            <td className={numericCell}>
              {/*
                Combinada e apurada lado a lado: a primeira é o que foi
                prometido à família, a segunda é o que ela recebeu. A diferença
                entre as duas é a pergunta do item 2, e escondê-la faria o
                serviço parecer melhor do que é.
              */}
              {linha.periodicidadeApurada}
              {linha.periodicidadeCombinada !== null ? (
                <>
                  <br />
                  <small style={{ color: "var(--texto_suave)" }}>
                    combinado {linha.periodicidadeCombinada}
                    {linha.aderencia !== null ? ` · ${linha.aderencia}%` : ""}
                  </small>
                </>
              ) : null}
            </td>
          </tr>
        ))}
      </Table>
    </Card>

    <Card title="3. Profissionais">
      <SummaryGrid
        items={[
          { label: "Profissionais", value: `${relatorio.resumoDaEquipe.profissionais}` },
          {
            label: "Horas contratadas",
            value: `${relatorio.resumoDaEquipe.horasContratadas}h`,
          },
          {
            label: "Horas no programa",
            value: `${relatorio.resumoDaEquipe.horasNoPrograma}h`,
          },
          { label: "Dedicação exclusiva", value: `${relatorio.resumoDaEquipe.exclusivos}` },
          { label: "Dedicação parcial", value: `${relatorio.resumoDaEquipe.parciais}` },
        ]}
      />

      <div style={{ marginTop: "16px" }}>
        <Table
          columns={["Profissional", "Terapia", "Local", "Vínculo", "Carga", "No programa", "Dedicação"]}
          isEmpty={relatorio.equipe.length === 0}
          emptyMessage="Nenhum profissional vinculado ao programa."
        >
          {relatorio.equipe.filter((membro) => !membro.encerradoEm).map((membro) => (
            <tr key={membro.id}>
              <td>
                {membro.nome}
                {membro.conselho ? (
                  <>
                    <br />
                    <small style={{ color: "var(--texto_suave)" }}>{membro.conselho}</small>
                  </>
                ) : null}
              </td>
              <td>{membro.terapiaNome ?? "—"}</td>
              <td>{membro.unidadeSaudeNome ?? membro.localNome ?? "—"}</td>
              <td>{VINCULO_ROTULO[membro.tipoVinculo] ?? membro.tipoVinculo}</td>
              <td className={numericCell}>{membro.cargaHorariaSemanal}h</td>
              <td className={numericCell}>{membro.horasNoPrograma}h</td>
              <td>
                {Number(membro.horasNoPrograma) >= Number(membro.cargaHorariaSemanal)
                  ? "Exclusiva"
                  : "Parcial"}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </Card>
  </>
);
