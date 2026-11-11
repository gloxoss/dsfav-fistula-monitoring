"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
      <p className="text-sm text-zinc-600">{error.digest ?? "Erreur inattendue"}</p>
      <button type="button" onClick={reset} className="underline">
        Réessayer
      </button>
    </main>
  );
}
