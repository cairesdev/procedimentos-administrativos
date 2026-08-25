import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import { limiteDeLogin, limiteGlobal } from "../../src/interface/http/middlewares/rateLimit";

/**
 * Os limites contra um Express de verdade. O que importa aqui não é o número,
 * é a **chave**: a API só recebe conexão do container do Next, então limite por
 * IP de socket colocaria a prefeitura inteira no mesmo balde.
 */
const comServidor = async (
  montar: (app: express.Express) => void,
  corpo: (base: string) => Promise<void>,
): Promise<void> => {
  const app = express();
  app.set("trust proxy", "uniquelocal");
  app.use(express.json());
  montar(app);

  const servidor = app.listen(0);
  await new Promise((resolve) => servidor.once("listening", resolve));
  try {
    await corpo(`http://127.0.0.1:${(servidor.address() as AddressInfo).port}`);
  } finally {
    servidor.close();
  }
};

describe("freio de força bruta no login", () => {
  it("barra a partir da sexta tentativa errada do mesmo par", async () => {
    await comServidor(
      (app) => {
        app.post("/auth/login", limiteDeLogin, (req, res) => {
          if (req.body.senha === "certa") return res.json({ token: "ok" });
          return res.status(401).json({ message: "Credenciais inválidas" });
        });
      },
      async (base) => {
        const tentar = (identificador: string, senha: string, ip: string) =>
          fetch(`${base}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Client-IP": ip },
            body: JSON.stringify({ identificador, senha }),
          });

        for (let vez = 1; vez <= 5; vez += 1) {
          assert.equal((await tentar("joao", "errada", "200.1.1.1")).status, 401, `tentativa ${vez}`);
        }
        const barrado = await tentar("joao", "errada", "200.1.1.1");
        assert.equal(barrado.status, 429);
        assert.ok(barrado.headers.get("ratelimit"), "sem cabeçalho RateLimit");

        // Travar um usuário não pode travar os colegas do mesmo prédio…
        assert.equal((await tentar("maria", "errada", "200.1.1.1")).status, 401);
        // …nem o mesmo usuário de outro lugar.
        assert.equal((await tentar("joao", "errada", "200.9.9.9")).status, 401);
      },
    );
  });

  it("acerto de senha não consome cota", async () => {
    // Uso legítimo nunca pode esbarrar no freio.
    await comServidor(
      (app) => {
        app.post("/auth/login", limiteDeLogin, (req, res) =>
          (req.body.senha === "certa"
            ? res.json({ token: "ok" })
            : res.status(401).json({ message: "não" })));
      },
      async (base) => {
        for (let vez = 1; vez <= 10; vez += 1) {
          const resposta = await fetch(`${base}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Client-IP": "200.2.2.2" },
            body: JSON.stringify({ identificador: "ana", senha: "certa" }),
          });
          assert.equal(resposta.status, 200, `acerto ${vez} foi contado`);
        }
      },
    );
  });
});

describe("teto geral por usuário", () => {
  it("um usuário no teto não derruba os outros", async () => {
    await comServidor(
      (app) => {
        app.use(
          "/dados",
          (req, _res, proximo) => {
            // Faz o papel do `authenticate`: o teto vem depois de saber quem é.
            req.sessao = { usuarioId: req.get("x-usuario") ?? "anon" } as never;
            proximo();
          },
          limiteGlobal,
          (_req, res) => res.json({ ok: true }),
        );
      },
      async (base) => {
        const bater = (usuario: string, vezes: number) =>
          Promise.all(Array.from({ length: vezes }, () =>
            fetch(`${base}/dados`, { headers: { "X-Usuario": usuario } })));

        const primeiras = await bater("u1", 300);
        assert.ok(primeiras.every((resposta) => resposta.ok), "as 300 primeiras deveriam passar");
        assert.equal((await bater("u1", 1))[0]!.status, 429);
        assert.equal((await bater("u2", 1))[0]!.status, 200, "outro usuário foi punido");
      },
    );
  });
});
