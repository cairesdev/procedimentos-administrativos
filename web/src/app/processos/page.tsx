import { enterWorkspace } from "@/shared/workspace/entrypoint";

export default async function ProcessesHome() {
  await enterWorkspace("processos");
}
