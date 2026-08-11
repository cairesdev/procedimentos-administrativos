# Painel web — convenções

Next.js 16 (App Router, React 19, React Compiler), TypeScript, CSS Modules.
A API fica em `../api`; contexto do produto em `../CLAUDE.md` e `../docs/decisoes.md`.

## Nomes

- Código em inglês: componentes, props, hooks, funções, variáveis (`InputField`, `label`,
  `required`, `onSubmit`, `listUnits`).
- Domínio permanece em português onde espelha a API e as rotas (`Contrato`, `papelBase`,
  `/solicitacoes`) — não traduzir campos que vêm do backend.
- Textos de interface em pt-BR.
- Arquivos: componentes `PascalCase.tsx`; demais `kebab-case.ts`; CSS Modules com o mesmo nome
  do arquivo que estilizam. Classes CSS em `snake_case`.

## Estrutura

```
src/
  app/
    (auth)/login          rotas sem sessão
    (dashboard)/…         rotas autenticadas (layout com topbar + menu)
    api/auth/[...nextauth]  handlers do NextAuth
    api/proxy/[...path]     ponte autenticada para chamadas client-side
  features/<modulo>/
    components/  UI da feature (PascalCase)
    actions.ts   server actions ("use server")
    queries.ts   leituras server-side (sem "use server")
    schemas.ts   Zod — mesmo schema valida no cliente e revalida na action
    types.ts     tipos espelhando a resposta da API
  shared/
    api/    http-client.ts, endpoints.ts, action-result.ts
    ui/     Button, form-field, layout (Card, Table, Badge, Alert), use-resource-form
  styles/ tokens em app/globals.css
  auth.ts  configuração NextAuth
  proxy.ts middleware (Next 16 chama de proxy)
```

Regra: `actions.ts` só exporta funções async ("use server" proíbe outros exports).
Leituras ficam em `queries.ts`.

## Níveis de acesso

`shared/auth/permissions.ts` guarda a matriz papel → permissões, do mais amplo ao mais básico:
ADMIN (tudo) · GESTOR · CONTROLADORIA · COMPRAS · PROTOCOLO · NUTRICIONISTA · SERVIDOR.
A API continua sendo a autoridade final (papel base + `usuario_permissao`); a matriz do front
serve para esconder o que o usuário não pode fazer.

- Página: `const viewer = await requirePermission("units:read", "PROCESSOS")` — redireciona para
  `/modulo-indisponivel` se o módulo não estiver habilitado e chama `forbidden()` sem permissão
  (renderiza `app/forbidden.tsx`; exige `experimental.authInterrupts`).
- Dentro da página: `viewer.can("units:write")` decide se o formulário aparece.
- Menu: `shared/auth/navigation.ts` declara permissão e módulo de cada link; o layout filtra.

## Padrões

- Autenticação: NextAuth v5 Credentials chama `POST /auth/login`, guarda o JWT da API em
  `session.accessToken` e replica papel, órgão e módulos habilitados no token.
- `proxy.ts` redireciona sem sessão para `/login?retorno=…` e bloqueia rota de módulo não
  habilitado (`/modulo-indisponivel`).
- Leituras: Server Components chamando `queries.ts` → `apiRequest`. Só use `/api/proxy` quando a
  chamada precisar sair do navegador (upload, autocomplete).
- Formulários: `useResourceForm` (React Hook Form + Zod) valida no cliente; a server action
  revalida com o mesmo schema antes de chamar a API e devolve `{ error }` ou `{ success }`.
- Toda action que altera dados chama `revalidatePath` da rota afetada.
- **Server → Client não aceita função como prop.** `ModalTrigger` recebe JSX pronto em `children`;
  o formulário obtém o fechamento com `useModalClose()` (contexto), nunca por render prop.
  Exceção: server actions são serializáveis — passe com `.bind(null, id)`
  (`onDelete={deleteUnit.bind(null, unit.id)}`), nunca `() => deleteUnit(id)`.
- Ações de linha usam `RowActions` (editar em modal, inativar e excluir com confirmação).
  A exclusão é definitiva e só passa sem vínculo; o caminho normal é inativar.
- Formulários servem para criar e editar: recebem o registro opcional
  (`<UnitForm unit={unit} />`) e alternam a action e o rótulo do botão.
- Valores monetários usam `CurrencyField` (guarda número, exibe 1.234,56);
  seleção múltipla usa `TagSelect`; listas de itens usam `ItemsEditor` (aceita colar planilha).
- Cores, espaçamento e raios saem das variáveis em `globals.css` — nunca hex solto no componente.

## Verificação

`npm run typecheck` e `npm run build`. A fonte Inter vem do Google Fonts em build time: ambiente
sem acesso à internet falha nessa etapa (o restante do build é independente disso).
