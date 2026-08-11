import { Client } from "minio";
import type { ArmazenamentoArquivos } from "../../application/ports/ArmazenamentoArquivos";

const bucket = process.env.MINIO_BUCKET ?? "procedimentos";

const cliente = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
  region: process.env.MINIO_REGIAO,
  useSSL: process.env.MINIO_USE_SSL === "true",
  accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
  secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
});

export class MinioArmazenamento implements ArmazenamentoArquivos {
  salvar = async (
    caminho: string,
    conteudo: Buffer,
    mimeType: string,
  ): Promise<void> => {
    const existe = await cliente.bucketExists(bucket);
    if (!existe) await cliente.makeBucket(bucket);
    await cliente.putObject(bucket, caminho, conteudo, conteudo.length, {
      "Content-Type": mimeType,
    });
  };

  remover = async (caminho: string): Promise<void> => {
    await cliente.removeObject(bucket, caminho);
  };

  urlTemporaria = (
    caminho: string,
    expiraEmSegundos: number,
  ): Promise<string> =>
    cliente.presignedGetObject(bucket, caminho, expiraEmSegundos);
}
