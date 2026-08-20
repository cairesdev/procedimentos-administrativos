import { enterWorkspace } from "@/shared/workspace/entrypoint";

export default async function FleetHome() {
  await enterWorkspace("frotas");
}
