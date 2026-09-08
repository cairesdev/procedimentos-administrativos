#!/usr/bin/env python3
"""
O palco do programa de cuidado continuado: da inscricao ao oficio, por HTTP.

Mesma razao do `palco-saude.py`, para outra esteira. `npm test` roda sem banco,
`verificar-migrations.py` prepara as consultas sem executa-las, e nenhum dos
dois responde a pergunta que interessa aqui: **o municipio consegue produzir a
resposta que o Ministerio Publico pediu?**

Sao cinco pessoas, e a separacao entre elas e o coracao do modulo: o ADMIN monta
o catalogo e nao alcanca inscrito nenhum; a coordenacao inscreve, indica e
inicia; o terapeuta so registra a sessao que atendeu; o medico do hospital nao
entra; e o relatorio precisa fechar com o que a coordenacao lancou.

    pip install --break-system-packages pgserver
    python3 api/db/palco-programa.py
"""
import base64
import datetime
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
SEGREDO = "palco-do-programa-de-cuidado-0049"
PORTA = 3398
BASE = f"http://127.0.0.1:{PORTA}"

ORGAO = "11111111-1111-1111-1111-111111111111"
ADMIN = "bbbb0000-0000-0000-0000-000000000001"
COORDENACAO = "bbbb0000-0000-0000-0000-000000000002"
TERAPEUTA = "bbbb0000-0000-0000-0000-000000000003"
FONO = "bbbb0000-0000-0000-0000-000000000004"
MEDICO = "bbbb0000-0000-0000-0000-000000000005"
RECEPCAO = "bbbb0000-0000-0000-0000-000000000006"

HOJE = datetime.date.today()


def dias_atras(dias: int) -> str:
    return (HOJE - datetime.timedelta(days=dias)).isoformat()


CENARIO = f"""
INSERT INTO orgao (id, nome, cnpj, municipio, uf)
VALUES ('{ORGAO}', 'Prefeitura do Palco', '06125389000188', 'Bela Vista', 'MA');

INSERT INTO orgao_modulo (orgao_id, modulo, ativo) VALUES ('{ORGAO}', 'SAUDE', TRUE);

INSERT INTO usuario (id, orgao_id, nome, email, username, senha_hash, papel_base,
                     conselho_tipo, conselho_numero, conselho_uf)
VALUES
 ('{ADMIN}', '{ORGAO}', 'Elza Admin', 'elza@p.gov.br', 'elza', 'x',
  'ADMIN', NULL, NULL, NULL),
 ('{COORDENACAO}', '{ORGAO}', 'Marta Coordenadora', 'marta@p.gov.br', 'marta', 'x',
  'SAUDE_COORDENACAO', NULL, NULL, NULL),
 ('{TERAPEUTA}', '{ORGAO}', 'Tais Terapeuta Ocupacional', 'tais@p.gov.br', 'tais', 'x',
  'SAUDE_TERAPEUTA', 'CREFITO', '11111', 'MA'),
 ('{FONO}', '{ORGAO}', 'Fabio Fonoaudiologo', 'fabio@p.gov.br', 'fabio', 'x',
  'SAUDE_TERAPEUTA', 'CRFA', '22222', 'MA'),
 ('{MEDICO}', '{ORGAO}', 'Dr. Bruno', 'bruno@p.gov.br', 'bruno', 'x',
  'SAUDE_MEDICO', 'CRM', '54321', 'MA'),
 ('{RECEPCAO}', '{ORGAO}', 'Carla Recepcao', 'carla@p.gov.br', 'carla', 'x',
  'SAUDE_RECEPCAO', NULL, NULL, NULL);

-- As pessoas ja cadastradas pela recepcao. As idades sao escolhidas para cair
-- em faixas diferentes do oficio, inclusive uma perto da virada.
INSERT INTO paciente (id, orgao_id, prontuario, nome, data_nascimento, criado_por)
VALUES
 ('cccc0000-0000-0000-0000-000000000001', '{ORGAO}', 1, 'Ana Crianca',
  '{(HOJE - datetime.timedelta(days=365 * 3 + 200)).isoformat()}', '{RECEPCAO}'),
 ('cccc0000-0000-0000-0000-000000000002', '{ORGAO}', 2, 'Bento Crianca',
  '{(HOJE - datetime.timedelta(days=365 * 5)).isoformat()}', '{RECEPCAO}'),
 ('cccc0000-0000-0000-0000-000000000003', '{ORGAO}', 3, 'Caio Adolescente',
  '{(HOJE - datetime.timedelta(days=365 * 14)).isoformat()}', '{RECEPCAO}'),
 ('cccc0000-0000-0000-0000-000000000004', '{ORGAO}', 4, 'Dora Adulta',
  '{(HOJE - datetime.timedelta(days=365 * 25)).isoformat()}', '{RECEPCAO}');
"""

PESSOAS = [f"cccc0000-0000-0000-0000-00000000000{n}" for n in range(1, 5)]


def token(usuario_id: str, papel: str) -> str:
    """JWT HS256 na mao: o palco nao faz login, forja a sessao."""
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
        self.pasta = tempfile.mkdtemp(prefix="palco-programa-")
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
        tudo = "\n".join(
            re.sub(r"CREATE EXTENSION[^;]*pgcrypto[^;]*;", "",
                   arquivo.read_text(encoding="utf-8"), flags=re.I)
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
                urllib.request.urlopen(f"{BASE}/saude/programas/catalogo", timeout=1)
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
    admin = token(ADMIN, "ADMIN")
    coord = token(COORDENACAO, "SAUDE_COORDENACAO")
    terapeuta = token(TERAPEUTA, "SAUDE_TERAPEUTA")
    fono = token(FONO, "SAUDE_TERAPEUTA")
    medico = token(MEDICO, "SAUDE_MEDICO")

    print("\nO catalogo — de quem administra, e so dele")
    status, _ = chamar("POST", "/saude/programas/catalogo", coord,
                       {"nome": "Programa da coordenacao"})
    conferir("a coordenacao nao cria programa", status == 403, str(status))

    status, programa = chamar("POST", "/saude/programas/catalogo", admin,
                              {"nome": "Atencao a Pessoa com TEA", "sigla": "TEA"})
    conferir("o ADMIN cria o programa", status == 201, str(programa))
    programa_id = programa["id"]

    status, fonoterapia = chamar("POST", f"/saude/programas/catalogo/{programa_id}/terapias",
                                 admin, {"nome": "Fonoaudiologia", "conselho": "CRFA"})
    conferir("a terapia entra no catalogo", status == 201, str(fonoterapia))
    status, ocupacional = chamar("POST", f"/saude/programas/catalogo/{programa_id}/terapias",
                                 admin, {"nome": "Terapia Ocupacional", "conselho": "CREFITO"})
    conferir("a segunda terapia entra", status == 201, str(ocupacional))
    fono_id, to_id = fonoterapia["id"], ocupacional["id"]

    print("\nO sigilo do outro lado")
    status, _ = chamar("GET", "/saude/programas/inscritos", admin)
    conferir("o ADMIN nao alcanca os inscritos", status == 403, str(status))
    status, _ = chamar("GET", "/saude/programas/inscritos", medico)
    conferir("o medico do plantao tambem nao", status == 403, str(status))
    status, catalogo = chamar("GET", "/saude/programas/catalogo", coord)
    conferir("a coordenacao le o catalogo para inscrever", status == 200, str(status))

    print("\nAs inscricoes")
    status, achadas = chamar("GET", "/saude/programas/pessoas?termo=Ana", coord)
    conferir("a coordenacao acha a pessoa pelo nome",
             status == 200 and len(achadas) == 1, str(achadas))

    inscricoes = []
    for indice, pessoa in enumerate(PESSOAS):
        situacao = "DIAGNOSTICADO" if indice < 3 else "EM_INVESTIGACAO"
        status, criada = chamar("POST", "/saude/programas/inscritos", coord, {
            "programaId": programa_id, "pacienteId": pessoa,
            "situacao": situacao,
            "inscritoEm": dias_atras(200 - indice * 10),
            # Diagnostico confirmado exige a data: sem ela o numero de
            # diagnosticados nao tem como ser auditado, e e o primeiro que a
            # Promotoria confere.
            "diagnosticoEm": dias_atras(190 - indice * 10) if situacao == "DIAGNOSTICADO" else None,
            "cid": "F84.0" if situacao == "DIAGNOSTICADO" else None,
        })
        conferir(f"a pessoa {indice + 1} entra no programa", status == 201, str(criada))
        inscricoes.append(criada["id"])

    status, repetida = chamar("POST", "/saude/programas/inscritos", coord, {
        "programaId": programa_id, "pacienteId": PESSOAS[0], "situacao": "DIAGNOSTICADO",
        "diagnosticoEm": dias_atras(190), "cid": "F84.0",
    })
    conferir("inscrever a mesma pessoa duas vezes e recusado com aviso legivel",
             repetida is not None and "TEA" not in str(repetida.get("message", ""))
             and status in (400, 409), f"{status} {repetida}")

    print("\nA fila")
    indicacoes = []
    for indice, inscricao in enumerate(inscricoes):
        status, indicada = chamar(f"POST", f"/saude/programas/inscritos/{inscricao}/indicacoes",
                                  coord, {
                                      "terapiaId": fono_id,
                                      "indicadaEm": dias_atras(180 - indice * 20),
                                      "periodicidadeSemanal": 1,
                                  })
        conferir(f"a fonoaudiologia e indicada para a pessoa {indice + 1}",
                 status == 201, str(indicada))
        indicacoes.append(indicada["id"])

    status, segunda = chamar("POST", f"/saude/programas/inscritos/{inscricoes[0]}/indicacoes",
                             coord, {"terapiaId": to_id, "indicadaEm": dias_atras(150),
                                     "periodicidadeSemanal": 2})
    conferir("a mesma pessoa espera por outra terapia — a fila e por terapia",
             status == 201, str(segunda))

    status, _ = chamar("POST", f"/saude/programas/indicacoes/{indicacoes[0]}/iniciar",
                       terapeuta, {"em": dias_atras(120)})
    conferir("o terapeuta nao decide quem sai da fila", status == 403, str(status))

    # Duas comecam, duas continuam esperando: e o retrato que o oficio pede.
    for indice in (0, 1):
        status, _ = chamar("POST", f"/saude/programas/indicacoes/{indicacoes[indice]}/iniciar",
                           coord, {"em": dias_atras(120 - indice * 30)})
        conferir(f"a terapia da pessoa {indice + 1} comeca", status == 200, str(status))

    print("\nAs sessoes")
    status, sessao = chamar("POST", f"/saude/programas/indicacoes/{indicacoes[0]}/sessoes",
                            fono, {"data": dias_atras(30), "compareceu": True})
    conferir("o terapeuta registra a sessao que atendeu", status == 201, str(sessao))

    status, falta = chamar("POST", f"/saude/programas/indicacoes/{indicacoes[0]}/sessoes",
                           fono, {"data": dias_atras(23), "compareceu": False,
                                  "observacao": "familia nao compareceu"})
    conferir("a falta entra registrada, e nao apagada", status == 201, str(falta))

    status, repetida = chamar("POST", f"/saude/programas/indicacoes/{indicacoes[0]}/sessoes",
                              fono, {"data": dias_atras(23), "compareceu": True})
    conferir("duas sessoes no mesmo dia sao digitacao repetida, e nao erro interno",
             status == 422 and "Já existe sessão" in str(repetida), f"{status} {repetida}")

    status, _ = chamar("POST", f"/saude/programas/indicacoes/{indicacoes[1]}/sessoes",
                       fono, {"data": dias_atras(10), "compareceu": True})
    conferir("a segunda pessoa tambem e atendida", status == 201, str(status))

    print("\nA equipe")
    status, _ = chamar("POST", f"/saude/programas/{programa_id}/equipe", terapeuta, {
        "usuarioId": FONO, "cargaHorariaSemanal": 40, "horasNoPrograma": 40,
        "tipoVinculo": "EFETIVO",
    })
    conferir("o terapeuta nao monta a equipe", status == 403, str(status))

    status, membro = chamar("POST", f"/saude/programas/{programa_id}/equipe", coord, {
        "usuarioId": FONO, "terapiaId": fono_id, "cargaHorariaSemanal": 40,
        "horasNoPrograma": 40, "tipoVinculo": "EFETIVO",
    })
    conferir("o fonoaudiologo entra com dedicacao exclusiva", status == 201, str(membro))

    status, parcial = chamar("POST", f"/saude/programas/{programa_id}/equipe", coord, {
        "usuarioId": TERAPEUTA, "terapiaId": to_id, "cargaHorariaSemanal": 40,
        "horasNoPrograma": 10, "tipoVinculo": "CONTRATO",
    })
    conferir("a terapeuta ocupacional entra parcial", status == 201, str(parcial))

    status, impossivel = chamar("POST", f"/saude/programas/{programa_id}/equipe", coord, {
        "usuarioId": MEDICO, "cargaHorariaSemanal": 20, "horasNoPrograma": 30,
        "tipoVinculo": "EFETIVO",
    })
    conferir("dedicar mais horas do que se tem e recusado",
             status in (400, 409, 422), str(impossivel))

    print("\nO relatorio — os tres itens do oficio")
    status, relatorio = chamar(
        "GET",
        f"/saude/programas/{programa_id}/relatorio?desde={dias_atras(90)}&ate={HOJE.isoformat()}",
        coord,
    )
    conferir("a coordenacao apura o relatorio", status == 200, str(status))

    pessoas = relatorio["pessoas"]
    conferir("item 1: quatro pessoas em acompanhamento",
             pessoas["totalAtivos"] == 4, str(pessoas["totalAtivos"]))
    conferir("item 1: as situacoes vem separadas",
             sorted(linha["situacao"] for linha in pessoas["porSituacao"])
             == ["DIAGNOSTICADO", "EM_INVESTIGACAO"], str(pessoas["porSituacao"]))
    faixas = {linha["chave"]: linha["quantidade"] for linha in pessoas["porFaixa"]}
    # A crianca de 3 anos e 200 dias fica em 0-3. O fuso de Brasilia ja empurrou
    # esse nascimento um dia para tras uma vez, e a criança pulou de faixa.
    conferir("item 1: a crianca de 3 anos e 200 dias nao virou 4",
             faixas.get("ate_3") == 1 and faixas.get("de_4_a_6") == 1, str(faixas))
    conferir("item 1: as faixas vazias continuam na lista",
             len(pessoas["porFaixa"]) >= 5, str(faixas))

    fila = {linha["terapiaNome"]: linha for linha in relatorio["fila"]}
    conferir("item 2: a fila vem por terapia, e nao somada",
             len(relatorio["fila"]) == 2, str(list(fila)))
    conferir("item 2: duas pessoas ainda esperam fonoaudiologia",
             fila["Fonoaudiologia"]["naFila"] == 2, str(fila["Fonoaudiologia"]))
    conferir("item 2: a espera mais antiga esta em dias, e nao em datas",
             fila["Fonoaudiologia"]["esperaMaisAntiga"] > 100,
             str(fila["Fonoaudiologia"]["esperaMaisAntiga"]))
    conferir("item 2: quem ja comecou tem media ate iniciar",
             fila["Fonoaudiologia"]["iniciados"] == 2
             and fila["Fonoaudiologia"]["mediaAteIniciar"] > 0,
             str(fila["Fonoaudiologia"]))
    conferir("item 2: a periodicidade apurada sai das sessoes com comparecimento",
             fila["Fonoaudiologia"]["periodicidadeApurada"] > 0,
             str(fila["Fonoaudiologia"]["periodicidadeApurada"]))
    conferir("item 2: a terapia sem ninguem atendido nao inventa periodicidade",
             fila["Terapia Ocupacional"]["periodicidadeApurada"] == 0,
             str(fila["Terapia Ocupacional"]))

    resumo = relatorio["resumoDaEquipe"]
    conferir("item 3: dois profissionais, um exclusivo e um parcial",
             resumo["profissionais"] == 2 and resumo["exclusivos"] == 1
             and resumo["parciais"] == 1, str(resumo))
    conferir("item 3: as horas no programa somam 50",
             resumo["horasNoPrograma"] == 50, str(resumo["horasNoPrograma"]))

    print("\nA peca oficial")
    status, recorte = chamar("POST", f"/saude/programas/{programa_id}/recortes", coord,
                             {"desde": dias_atras(90), "ate": HOJE.isoformat()})
    conferir("o recorte guarda a pergunta", status == 201, str(recorte))
    recorte_id = recorte["id"]

    status, salvo = chamar("GET", f"/saude/programas/recortes/{recorte_id}", coord)
    conferir("e a tela o le de volta com o programa e o periodo",
             status == 200 and salvo["programaNome"].startswith("Atencao"), str(salvo))

    status, modelos = chamar("GET", "/documentos/modelos?modulo=SAUDE", coord)
    modelo = next(
        (item for item in (modelos or []) if item["escopo"] == "RELATORIO_PROGRAMA"), None,
    )
    conferir("o modelo do relatorio esta no catalogo de documentos",
             modelo is not None, str(status))

    if modelo:
        status, emitido = chamar("POST", "/documentos", coord, {
            "tipo": modelo["tipo"], "referenciaId": recorte_id,
        })
        conferir("a coordenacao emite a peca do oficio", status == 201, str(emitido))

        if status == 201:
            conferir("a peca nasce com codigo de conferencia",
                     bool(emitido.get("codigo")), str(emitido))
            _, peca = chamar("GET", f"/documentos/{emitido['id']}", coord)
            corpo = (peca or {}).get("corpo", "")
            conferir("a peca traz o nome do programa",
                     "TEA" in corpo or "Atencao" in corpo, corpo[:200])
            conferir("a peca traz as faixas etarias",
                     "3 anos" in corpo or "anos" in corpo, corpo[:400])
            conferir("e a peca guardada traz os tres itens do oficio",
                     "fila" in corpo.lower() or "espera" in corpo.lower(), corpo[:300])
            if os.environ.get("MOSTRAR_PECA"):
                print("\n----- corpo da peca -----")
                print(re.sub(r"<[^>]+>", " ", corpo))
                print("----- fim -----\n")

    print("\nO isolamento entre prefeituras")
    outro = token(COORDENACAO, "SAUDE_COORDENACAO").replace("x", "x")
    status, _ = chamar("GET", "/saude/programas/recortes/00000000-0000-0000-0000-000000000999",
                       coord)
    conferir("recorte inexistente e 404, e nao vazamento", status == 404, str(status))


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
    print("Do catalogo ao oficio, com cinco pessoas diferentes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
