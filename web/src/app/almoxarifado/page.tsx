import { enterWorkspace } from "@/shared/workspace/entrypoint";

export default async function WarehouseHome() {
  await enterWorkspace("almoxarifado");
}
