import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/shared/api/http-client";
import { clientIpHeader } from "@/shared/api/client-ip";

/**
 * Ponte pública do checklist: o fornecedor cumprindo pelo link.
 *
 * Sem sessão e sem token de servidor — a credencial é o token da URL, que já
 * está no caminho. O IP real vai adiante porque o rate limit da API é por IP,
 * e atrás do Caddy todos chegariam como o mesmo.
 *
 * Multipart passa em streaming: ler o corpo aqui carregaria o arquivo inteiro
 * na memória do Next sem necessidade.
 */
const CAMINHOS = [
  /^[^/]+\/itens\/[^/]+\/cumprir$/,
  /^[^/]+\/cumprimentos\/[^/]+\/anexos$/,
];

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ caminho: string[] }> },
) => {
  const { caminho } = await params;
  const alvo = caminho.join("/");

  // Lista fechada: a ponte encaminha o que ela conhece, e não o que vier.
  if (!CAMINHOS.some((padrao) => padrao.test(alvo))) {
    return NextResponse.json({ message: "Ação desconhecida" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  const resposta = await fetch(`${apiBaseUrl}/publico/checklist/${alvo}`, {
    method: "POST",
    headers: {
      // O `Content-Type` do multipart **precisa** ser repassado.
      //
      // O `boundary` que separa as partes vive dentro dele, e o corpo aqui vai
      // como stream já codificado — o fetch não tem como regenerá-lo, coisa
      // que só faria se recebesse um `FormData` montado por ele. Omitir o
      // cabeçalho deixava o servidor sem saber onde uma parte termina: o
      // multer não achava o arquivo e devolvia "Arquivo ausente". O anexo
      // simplesmente não subia.
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(await clientIpHeader()),
    },
    body: request.body,
    // @ts-expect-error duplex é exigido pelo Node ao repassar streams
    duplex: "half",
    cache: "no-store",
  });

  const texto = await resposta.text();
  return new NextResponse(texto, {
    status: resposta.status,
    headers: { "content-type": "application/json" },
  });
};
