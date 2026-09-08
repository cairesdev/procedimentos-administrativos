#!/usr/bin/env python3
"""
O palco da ficha hospitalar: a esteira inteira, por HTTP, com quatro pessoas.

Por que existe, se `npm test` e `verificar-migrations.py` já passam: nenhum dos
dois liga as pontas. O primeiro roda sem banco; o segundo prepara as consultas
sem executá-las. Nenhum dos dois responde à pergunta que interessa — "o médico
consegue prescrever?" — e nenhum dos dois pegaria uma rota registrada na ordem
errada, um `resolveTenant` faltando ou um gatilho que recusa o UPDATE legítimo.

Aqui sobe um Postgres descartável, aplica todas as migrations, sobe a API de
verdade e caminha pela ficha com **quatro usuários diferentes**, cada um com o
papel do seu ato. A separação de atos é o coração do módulo, e é a única coisa
que só se prova com quatro tokens.

    pip install --break-system-packages pgserver
    python3 api/db/palco-saude.py
"""
import base64
import hashlib
import hmac
import json
import os
import pathlib
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

try:
    import pgserver
except ImportError:
    sys.exit("Falta o pgserver: pip install --break-system-packages pgserver")

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MIGRATIONS = RAIZ / "db" / "migrations"
SEGREDO = "palco-da-ficha-hospitalar-0048"
PORTA = 3399
BASE = f"http://127.0.0.1:{PORTA}"

ORGAO = "11111111-1111-1111-1111-111111111111"
RECEPCAO = "aaaa0000-0000-0000-0000-000000000001"
ENFERMEIRO = "aaaa0000-0000-0000-0000-000000000002"
MEDICO = "aaaa0000-0000-0000-0000-000000000003"
TECNICO = "aaaa0000-0000-0000-0000-000000000004"
ADMIN = "aaaa0000-0000-0000-0000-000000000005"

CENARIO = f"""
INSERT INTO orgao (id, nome, cnpj, municipio, uf)
VALUES ('{ORGAO}', 'Prefeitura do Palco', '06125389000188', 'Bela Vista', 'MA');

INSERT INTO orgao_modulo (orgao_id, modulo, ativo) VALUES ('{ORGAO}', 'SAUDE', TRUE);

INSERT INTO usuario (id, orgao_id, nome, email, username, senha_hash, papel_base,
                     conselho_tipo, conselho_numero, conselho_uf)
VALUES
 ('{RECEPCAO}', '{ORGAO}', 'Carla Recepcao', 'carla@p.gov.br', 'carla', 'x',
  'SAUDE_RECEPCAO', NULL, NULL, NULL),
 ('{ENFERMEIRO}', '{ORGAO}', 'Ana Enfermeira', 'ana@p.gov.br', 'ana', 'x',
  'SAUDE_ENFERMEIRO', 'COREN', '12345', 'MA'),
 ('{MEDICO}', '{ORGAO}', 'Dr. Bruno', 'bruno@p.gov.br', 'bruno', 'x',
  'SAUDE_MEDICO', 'CRM', '54321', 'MA'),
 ('{TECNICO}', '{ORGAO}', 'Tec. Diego', 'diego@p.gov.br', 'diego', 'x',
  'SAUDE_TECNICO', NULL, NULL, NULL),
 ('{ADMIN}', '{ORGAO}', 'Elza Admin', 'elza@p.gov.br', 'elza', 'x',
  'ADMIN', NULL, NULL, NULL);
"""


def token(usuario_id: str, papel: str) -> str:
    """JWT HS256 na mão: o palco não faz login, forja a sessão."""
    def parte(dado: dict) -> str:
        crua = json.dumps(dado, separators=(",", ":")).encode()
        return base64.urlsafe_b64encode(crua).rstrip(b"=").decode()

    cabecalho = parte({"alg": "HS256", "typ": "JWT"})
    corpo = parte({
        "usuarioId": usuario_id, "orgaoId": ORGAO, "papelBase": papel,
        "exp": int(time.time()) + 3600,
    })
    assinatura = hmac.new(
        SEGREDO.encode(), f"{cabecalho}.{corpo}".encode(), hashlib.sha256
    ).digest()
    return f"{cabecalho}.{corpo}.{base64.urlsafe_b64encode(assinatura).rstrip(b'=').decode()}"


class Palco:
    def __init__(self) -> None:
        self.pasta = tempfile.mkdtemp(prefix="palco-saude-")
        self.servidor = pgserver.get_server(self.pasta)
        self.uri = self.servidor.get_uri()
        self.psql = str(
            pathlib.Path(pgserver.__file__).parent / "pginstall" / "bin" / "psql"
        )
        self.host = str(self.servidor.get_postmaster_info().socket_dir)
        self.api: subprocess.Popen | None = None

    def sql(self, texto: str) -> None:
        resultado = subprocess.run(
            [self.psql, "-h", self.host, "-U", "postgres", "-d", "postgres",
             "-v", "ON_ERROR_STOP=1", "-q"],
            capture_output=True, text=True, input=texto,
        )
        if resultado.returncode != 0:
            raise RuntimeError(resultado.stderr.strip()[-2000:])

    def migrar(self) -> None:
        """
        As migrations vao numa chamada so.

        Uma por arquivo seriam quase cinquenta processos `psql`, e o palco
        passaria mais tempo abrindo conexao do que encenando. A ordem continua
        sendo a do nome do arquivo, que e o que o `npm run migrate` faz.
        """
        # O pgcrypto nao vem no pacote do pip, e `gen_random_uuid()` e nativo
        # desde o Postgres 13 — mesma exclusao de `verificar-migrations.py`.
        tudo = "\n".join(
            re.sub(r"CREATE EXTENSION[^;]*pgcrypto[^;]*;", "", arquivo.read_text(encoding="utf-8"), flags=re.I)
            for arquivo in sorted(MIGRATIONS.glob("*.sql"))
        )
        self.sql(tudo)

    def subir_api(self) -> None:
        ambiente = {
            **os.environ,
            "DATABASE_URL": self.uri,
            "JWT_SECRET": SEGREDO,
            "PORT": str(PORTA),
            "DOTENV_CONFIG_PATH": "/dev/null",
        }
        self.api = subprocess.Popen(
            ["npx", "tsx", "src/server.ts"],
            cwd=RAIZ, env=ambiente,
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        )
        for _ in range(60):
            try:
                urllib.request.urlopen(f"{BASE}/saude/unidades", timeout=1)
                return
            except urllib.error.HTTPError:
                return  # 401/403 ja e sinal de que subiu
            except Exception:
                time.sleep(1)
        raise RuntimeError("a API nao subiu")

    def encerrar(self) -> None:
        if self.api and self.api.poll() is None:
            self.api.send_signal(signal.SIGTERM)
            self.api.wait(timeout=10)
        shutil.rmtree(self.pasta, ignore_errors=True)


def chamar(metodo: str, caminho: str, autor: str, corpo=None):
    pedido = urllib.request.Request(
        f"{BASE}{caminho}", method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={
            "Authorization": f"Bearer {autor}",
            **({"Content-Type": "application/json"} if corpo is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(pedido, timeout=20) as resposta:
            bruto = resposta.read().decode()
            return resposta.status, (json.loads(bruto) if bruto else None)
    except urllib.error.HTTPError as erro:
        bruto = erro.read().decode()
        return erro.code, (json.loads(bruto) if bruto else None)


FALHAS: list[str] = []


def conferir(nome: str, condicao: bool, detalhe: str = "") -> None:
    print(f"  {'ok  ' if condicao else 'FALHA'} {nome}{'' if condicao else f' — {detalhe}'}")
    if not condicao:
        FALHAS.append(nome)


def encenar() -> None:
    recepcao = token(RECEPCAO, "SAUDE_RECEPCAO")
    enfermeiro = token(ENFERMEIRO, "SAUDE_ENFERMEIRO")
    medico = token(MEDICO, "SAUDE_MEDICO")
    tecnico = token(TECNICO, "SAUDE_TECNICO")
    admin = token(ADMIN, "ADMIN")

    print("\nCadastro da unidade")
    status, _ = chamar("POST", "/saude/unidades", recepcao,
                       {"nome": "Posto do Centro", "codigoCnes": "2644398"})
    conferir("a recepcao nao cadastra unidade de saude", status == 403, str(status))

    status, criada = chamar("POST", "/saude/unidades", admin,
                            {"nome": "Hospital Municipal", "codigoCnes": "7572883"})
    conferir("o ADMIN cadastra a unidade", status == 201, str(criada))
    unidade_id = criada["id"]

    status, repetida = chamar("POST", "/saude/unidades", admin,
                              {"nome": "Hospital (de novo)", "codigoCnes": "7572883"})
    conferir("o mesmo CNES duas vezes partiria a serie historica, e e recusado",
             status == 409, str(status))

    # A direcao le o servico e nao executa ato clinico. O ADMIN acompanha a
    # fila do plantao — e nao abre ficha, que e assinatura de quem atende.
    status, _ = chamar("GET", "/saude/atendimentos", admin)
    conferir("o ADMIN acompanha o plantao", status == 200, str(status))

    status, negado = chamar("POST", "/saude/atendimentos", admin,
                            {"unidadeSaudeId": unidade_id})
    conferir("mas nao abre atendimento: isso e ato de quem atende",
             status == 403, str(negado))

    status, unidades = chamar("GET", "/saude/unidades", recepcao)
    conferir("a recepcao le as unidades", status == 200, str(status))

    print("\nPaciente")
    status, paciente = chamar("POST", "/saude/pacientes", recepcao, {
        "nome": "Jose da Silva", "nomeMae": "Maria da Silva",
        "cpf": "529.982.247-25", "cns": "286122138783757",
    })
    conferir("a recepcao cadastra o paciente", status == 201, str(paciente))
    paciente_id = paciente["id"]
    conferir("o prontuario comeca em 1", paciente["prontuario"] == 1, str(paciente))

    status, repetido = chamar("POST", "/saude/pacientes", recepcao, {
        "nome": "Jose de novo", "cpf": "52998224725",
    })
    conferir("o mesmo CPF devolve o cadastro que ja existe", status == 409, str(status))

    status, invalido = chamar("POST", "/saude/pacientes", recepcao, {
        "nome": "Fulano", "cpf": "11111111111",
    })
    conferir("CPF com os onze digitos repetidos e recusado", status == 422, str(status))

    status, _ = chamar("POST", f"/saude/pacientes/{paciente_id}/condicoes", enfermeiro,
                       {"tipo": "ALERGIA", "descricao": "dipirona"})
    conferir("o enfermeiro registra a alergia", status == 201, str(status))

    status, _ = chamar("POST", f"/saude/pacientes/{paciente_id}/condicoes", enfermeiro,
                       {"tipo": "ALERGIA"})
    conferir("alergia sem dizer a que e recusada", status == 422, str(status))

    print("\nAbertura")
    status, sem_nome = chamar("POST", "/saude/atendimentos", recepcao,
                              {"unidadeSaudeId": unidade_id})
    conferir("a ficha abre sem paciente identificado", status == 201, str(sem_nome))
    anonimo = sem_nome["id"]

    status, atendimento = chamar("POST", "/saude/atendimentos", recepcao,
                                 {"unidadeSaudeId": unidade_id, "pacienteId": paciente_id})
    conferir("a ficha abre com paciente", status == 201, str(atendimento))
    ficha_id = atendimento["id"]
    conferir("o numero segue o formato do sistema",
             atendimento["numero"].endswith("/" + str(time.gmtime().tm_year)),
             atendimento["numero"])

    print("\nTriagem — ato privativo do enfermeiro")
    status, recusa = chamar("POST", f"/saude/atendimentos/{ficha_id}/triagem", medico,
                            {"temperatura": 37})
    conferir("o medico nao tria", status == 403, str(status))

    status, absurdo = chamar("POST", f"/saude/atendimentos/{ficha_id}/triagem", enfermeiro,
                             {"temperatura": 368})
    conferir("temperatura de 368 graus e recusada", status == 422, str(absurdo))

    status, grave = chamar("POST", f"/saude/atendimentos/{ficha_id}/triagem", enfermeiro, {
        "saturacao": 71, "temperatura": 41.5, "paSistolica": 180, "paDiastolica": 100,
        "queixa": "Falta de ar", "conduta": "URGENCIA", "prioridade": True,
    })
    conferir("saturacao 71 e temperatura 41,5 entram", status == 201, str(grave))
    conferir("e voltam como aviso, nao como erro",
             bool(grave and grave.get("avisos")), str(grave))

    status, segunda = chamar("POST", f"/saude/atendimentos/{ficha_id}/triagem", enfermeiro,
                             {"temperatura": 36})
    conferir("a segunda triagem e conflito", status == 409, str(segunda))

    print("\nServico medico")
    status, _ = chamar("POST", f"/saude/atendimentos/{ficha_id}/avaliacao", enfermeiro,
                       {"queixaClinica": "x"})
    conferir("o enfermeiro nao avalia", status == 403, str(status))

    status, avaliacao = chamar("POST", f"/saude/atendimentos/{ficha_id}/avaliacao", medico,
                               {"queixaClinica": "Dispneia ha dois dias."})
    conferir("o medico avalia e assina", status == 201, str(avaliacao))

    status, exame = chamar("POST", f"/saude/atendimentos/{ficha_id}/exames", medico,
                           {"descricao": "Raio-X de torax"})
    conferir("o medico solicita exame", status == 201, str(exame))
    exame_id = exame["id"]

    status, _ = chamar("PUT", f"/saude/atendimentos/{ficha_id}/exames/{exame_id}",
                       enfermeiro, {"resultado": "Infiltrado em base direita."})
    conferir("o enfermeiro transcreve o resultado", status == 200, str(status))

    print("\nPrescricao e horarios")
    status, prescricao = chamar("POST", f"/saude/atendimentos/{ficha_id}/prescricoes",
                                medico, {
                                    "orientacoes": "Repouso relativo.",
                                    "itens": [{
                                        "medicamento": "Dipirona", "dose": "500mg",
                                        "via": "IV", "frequencia": "6/6h",
                                    }],
                                })
    conferir("o medico prescreve", status == 201, str(prescricao))
    conferir("a alergia a dipirona volta como alerta, e nao bloqueia",
             bool(prescricao and prescricao.get("alertas")), str(prescricao))

    status, ficha = chamar("GET", f"/saude/atendimentos/{ficha_id}", tecnico)
    conferir("o tecnico le a ficha", status == 200, str(status))
    item_id = ficha["prescricoes"][0]["itens"][0]["id"]

    duas_horas_atras = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 7200))
    status, _ = chamar("POST", f"/saude/itens-prescritos/{item_id}/administracoes", medico,
                       {"horario": duas_horas_atras})
    conferir("o medico nao carimba o horario da enfermagem", status == 403, str(status))

    status, dose = chamar("POST", f"/saude/itens-prescritos/{item_id}/administracoes",
                          tecnico, {"horario": duas_horas_atras})
    conferir("o tecnico carimba o horario", status == 201, str(dose))

    daqui_a_pouco = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 7200))
    status, adiantado = chamar(
        "POST", f"/saude/itens-prescritos/{item_id}/administracoes",
        tecnico, {"horario": daqui_a_pouco},
    )
    conferir("horario no futuro e recusado: registra-se depois de dar o remedio",
             status == 422, str(adiantado))

    print("\nEvolucao, procedimento e saida")
    agora = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    status, _ = chamar("POST", f"/saude/atendimentos/{ficha_id}/evolucoes", medico,
                       {"tipo": "ENFERMAGEM", "texto": "x"})
    conferir("o medico nao escreve evolucao de enfermagem", status == 403, str(status))

    status, _ = chamar("POST", f"/saude/atendimentos/{ficha_id}/evolucoes", enfermeiro,
                       {"tipo": "ENFERMAGEM", "texto": "Paciente em observacao."})
    conferir("o enfermeiro evolui", status == 201, str(status))

    status, _ = chamar("POST", f"/saude/atendimentos/{ficha_id}/procedimentos", medico,
                       {"tipo": "OUTRO"})
    conferir("procedimento OUTRO sem dizer qual e recusado", status == 422, str(status))

    status, _ = chamar("POST", f"/saude/atendimentos/{ficha_id}/procedimentos", medico,
                       {"tipo": "NEBULIZACAO"})
    conferir("o medico registra o procedimento", status == 201, str(status))

    status, sem_saida = chamar("POST", f"/saude/atendimentos/{anonimo}/desfecho",
                               enfermeiro,
                               {"tipo": "ALTA", "horario": agora})
    conferir("ficha sem paciente nao encerra", status == 422, str(sem_saida))

    status, _ = chamar("POST", f"/saude/atendimentos/{ficha_id}/desfecho", enfermeiro,
                       {"tipo": "ENCAMINHAMENTO", "horario": agora})
    conferir("encaminhamento sem destino e recusado", status == 422, str(status))

    # De proposito no mesmo minuto da abertura: e o caso de quem chega, e
    # triado e e dispensado — e a comparacao de milissegundo contra minuto
    # recusava a ficha inteira.
    status, saida = chamar("POST", f"/saude/atendimentos/{ficha_id}/desfecho", enfermeiro,
                           {"tipo": "ALTA", "horario": agora})
    conferir("o enfermeiro assina a saida no mesmo minuto da abertura",
             status == 201, str(saida))

    print("\nDepois da alta")
    status, tarde = chamar("POST", f"/saude/atendimentos/{ficha_id}/evolucoes", enfermeiro,
                           {"tipo": "ENFERMAGEM", "texto": "tarde demais"})
    conferir("atendimento encerrado nao recebe evolucao", status == 422, str(status))

    status, correcao = chamar("POST", f"/saude/atendimentos/{ficha_id}/retificacoes",
                              enfermeiro, {
                                  "tabelaOrigem": "evolucao",
                                  "registroId": ficha["atendimento"]["id"],
                                  "texto": "Onde se le consciente, leia-se sonolento.",
                              })
    conferir("a retificacao entra depois da alta", status == 201, str(correcao))

    print("\nSigilo")
    status, _ = chamar("GET", f"/saude/pacientes/{paciente_id}/historico", recepcao)
    conferir("a recepcao nao le o historico clinico", status == 403, str(status))

    status, historico = chamar("GET", f"/saude/pacientes/{paciente_id}/historico", medico)
    conferir("o medico le o historico", status == 200, str(status))
    conferir("e o historico traz as duas visitas do paciente",
             isinstance(historico, list) and len(historico) == 1, str(historico))


def main() -> int:
    palco = Palco()
    try:
        print("Subindo o Postgres e aplicando as migrations…")
        palco.migrar()
        palco.sql(CENARIO)
        print("Subindo a API…")
        palco.subir_api()
        encenar()
    except Exception as erro:  # noqa: BLE001
        print(f"\nERRO: {erro}")
        if palco.api and palco.api.stderr:
            palco.api.terminate()
            print(palco.api.stderr.read().decode()[-3000:])
        return 1
    finally:
        palco.encerrar()

    print()
    if FALHAS:
        print(f"{len(FALHAS)} cena(s) falharam: {', '.join(FALHAS)}")
        return 1
    print("A esteira inteira passou, com quatro pessoas diferentes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
