"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Disclaimer } from "@/components/shared/disclaimer";
import { PillButton } from "@/components/ui/pill-button";
import { SEEDED_ACCOUNTS } from "@/libs/auth/session";

function useSessionExpired() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("popstate", onChange);
      return () => window.removeEventListener("popstate", onChange);
    },
    () => new URLSearchParams(window.location.search).get("expired") === "1",
    () => false,
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionExpired = useSessionExpired();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setErrorMessage("Identifiant ou mot de passe incorrect");
        } else {
          const data = await res.json().catch(() => null);
          setErrorMessage(
            data?.error ?? "Identifiant ou mot de passe incorrect",
          );
        }
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const redirectUrl = data.homeUrl ?? "/dashboard";
      router.push(redirectUrl);
    } catch {
      setErrorMessage("Identifiant ou mot de passe incorrect");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = (accId: string) => {
    setIdentifier(accId);
    setPassword("demo1234");
    setErrorMessage(null);
  };

  const isDev = process.env.NODE_ENV === "development";

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[1040px] bg-surface rounded-[28px] shadow-[0_1px_2px_rgba(20,27,52,0.04)] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px]">
        {/* Left column: Dark Feature Panel */}
        <div className="md:col-span-5 bg-dark p-8 lg:p-10 text-white flex flex-col justify-between relative overflow-hidden rounded-[24px] m-2">
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-periwinkle/20 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[14px] bg-primary flex items-center justify-center text-white shadow-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">DSFAV</span>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl lg:text-3xl font-semibold tracking-tight leading-snug">
                Surveillance objective de la FAV
              </h2>
              <p className="text-text-muted text-sm mt-2 leading-relaxed">
                Mesure du thrill par accéléromètre haute sensibilité et aide à la décision clinique.
              </p>
            </div>

            {/* Three steps */}
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-cyan/15 text-cyan text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span className="text-sm font-medium text-white/90">Mesurer en 25 secondes</span>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-cyan/15 text-cyan text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span className="text-sm font-medium text-white/90">Vérifier la qualité du signal</span>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="w-6 h-6 rounded-full bg-cyan/15 text-cyan text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span className="text-sm font-medium text-white/90">Suivre l’évolution du patient</span>
              </div>
            </div>
          </div>

          {/* Bottom pulse ribbon vector & privacy note */}
          <div className="relative z-10 pt-8 mt-6 border-t border-white/10 space-y-4">
            <svg
              className="w-full h-12 opacity-80"
              viewBox="0 0 320 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M0 24H90L102 6L116 42L130 18L142 30L150 24H320"
                stroke="url(#pulse-gradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="pulse-gradient" x1="0" y1="24" x2="320" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2B7A6F" />
                  <stop offset="0.5" stopColor="#3CC4E4" />
                  <stop offset="1" stopColor="#6F6CF2" />
                </linearGradient>
              </defs>
            </svg>
            <p className="text-xs text-text-muted">
              Dossiers patients strictement pseudonymisés (aucun nom ni identité civile enregistrée).
            </p>
          </div>
        </div>

        {/* Right column: Form */}
        <div className="md:col-span-7 p-8 lg:p-12 flex flex-col justify-between">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
                Connexion <span className="text-text-muted font-normal text-2xl">à DSFAV</span>
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Accédez à votre espace clinique sécurisé.
              </p>
              {sessionExpired ? (
                <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Votre session a expiré. Veuillez vous reconnecter.
                </p>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Identifier input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="identifier"
                  className="block text-xs font-semibold uppercase tracking-wider text-text-label"
                >
                  Identifiant ou e-mail de la clinique
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex: nurse@dsfav.local"
                  className="w-full px-4 py-3 rounded-full bg-well border border-hairline text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                />
              </div>

              {/* Password input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-text-label"
                  >
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs font-medium text-text-secondary hover:text-text-primary transition"
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-full bg-well border border-hairline text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Error banner */}
              {errorMessage ? (
                <div
                  role="alert"
                  className="p-3 rounded-full bg-critical-tint text-critical-text text-xs font-medium flex items-center justify-center gap-2 border border-critical-text/10"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              {/* Submit Button */}
              <div className="pt-2">
                <PillButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full"
                >
                  {isLoading ? "Connexion en cours…" : "Se connecter"}
                </PillButton>
              </div>
            </form>

            {/* Seeded development accounts (strictly development environment) */}
            {isDev ? (
              <div className="pt-4 border-t border-hairline">
                <p className="text-xs font-semibold text-text-label uppercase tracking-wider mb-2">
                  Comptes préconfigurés (développement)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {SEEDED_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.identifier}
                      type="button"
                      onClick={() => handleSelectAccount(acc.identifier)}
                      className="text-left p-2.5 rounded-[14px] bg-well hover:bg-zinc-200/60 transition text-xs border border-transparent hover:border-hairline"
                    >
                      <div className="font-semibold text-text-primary">{acc.roleLabel}</div>
                      <div className="text-[11px] text-text-secondary truncate">{acc.identifier}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer & Disclaimer */}
          <div className="max-w-md w-full mx-auto pt-8 mt-6 border-t border-hairline space-y-3">
            <p className="text-xs text-text-secondary text-center">
              Centre d’hémodialyse Casablanca · démonstration
            </p>
            <div className="text-center">
              <Disclaimer />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
