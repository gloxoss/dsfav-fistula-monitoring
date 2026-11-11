import Link from "next/link";
import { PageTitle } from "@/components/shell/page-title";

export default function ForbiddenPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-4 py-12" role="alert">
      <PageTitle first="Accès refusé" subtitle="Cette page n’est pas disponible pour votre profil." />
      <p className="text-sm text-text-secondary">Votre rôle ne permet pas d’ouvrir cette page.</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">
        Revenir à l’accueil
      </Link>
    </section>
  );
}
