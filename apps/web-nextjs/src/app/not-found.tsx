import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-text-primary">Page introuvable</h1>
      <p className="text-sm text-text-secondary">Cette adresse ne correspond à aucune page DSFAV.</p>
      <Link href="/" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">
        Revenir à l’accueil
      </Link>
    </main>
  );
}
