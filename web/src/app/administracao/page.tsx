import { enterWorkspace } from "@/shared/workspace/entrypoint";

export default async function AdministrationHome() {
  await enterWorkspace("administracao");
}
