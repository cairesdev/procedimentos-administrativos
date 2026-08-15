import { enterWorkspace } from "@/shared/workspace/entrypoint";

export default async function AssetsHome() {
  await enterWorkspace("patrimonio");
}
