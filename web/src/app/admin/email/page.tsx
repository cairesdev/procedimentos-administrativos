import { getEmailSettings } from "@/features/system-admin/queries";
import { EmailSettingsForm } from "@/features/system-admin/components/EmailSettingsForm";
import { Card, PageHeader } from "@/shared/ui/layout";

/**
 * O SMTP do produto.
 *
 * Saiu do `.env` e veio para cá: trocar de provedor, corrigir uma porta ou
 * girar a senha deixou de exigir acesso à VPS e reinício de contêiner.
 */
export default async function EmailPage() {
  const atual = await getEmailSettings();

  return (
    <>
      <PageHeader
        title="Servidor de e-mail"
        subtitle="De onde saem os avisos de toda prefeitura sem servidor próprio"
      />
      <Card>
        <EmailSettingsForm atual={atual} />
      </Card>
    </>
  );
}
