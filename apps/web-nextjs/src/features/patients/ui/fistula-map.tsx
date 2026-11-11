"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatSessionDate } from "../model/format";
import { armSideLabel, fistulaLabel, formatDecimal, formatSignedPercent } from "../model/format";
import type { BaselineFeatures, SessionView } from "../model/types";

type ZoneId = "anastomosis" | "vein" | "sensor" | "artery";

const ZONES: Array<{ id: ZoneId; label: string }> = [
  { id: "anastomosis", label: "Anastomose" },
  { id: "vein", label: "Veine de drainage" },
  { id: "sensor", label: "Site du capteur" },
  { id: "artery", label: "Artère d’apport" },
];

/** Drawing coordinates per fistula site, in a 520 x 150 box (arm outline, vessels, key points). */
const GEOMETRY = {
  wrist: {
    outline: "M30 42 C30 32 40 27 60 27 L300 40 C322 42 336 46 340 52 L468 57 C498 59 508 70 508 80 C508 92 498 100 468 102 L340 108 C336 114 322 118 300 120 L60 126 C40 126 30 121 30 111 Z",
    crease: "M342 56 C348 70 348 90 342 106",
    artery: "M338 90 C250 92 150 95 56 97",
    vein: "M330 84 C306 66 262 62 210 60 C150 58 96 54 50 52",
    thrill: { cx: 270, cy: 66, rx: 52, ry: 20 },
    anastomosis: { cx: 332, cy: 87 },
    sensor: { cx: 268, cy: 62 },
  },
  elbow: {
    outline: "M14 38 C14 30 24 26 44 26 L200 34 C226 36 240 40 260 42 L318 44 L468 57 C498 59 508 70 508 80 C508 92 498 100 468 102 L318 110 L260 114 C240 116 226 120 200 122 L44 128 C24 128 14 124 14 114 Z",
    crease: "M206 38 C214 62 214 92 206 118",
    artery: "M22 96 C80 96 150 94 208 90 C250 92 300 96 340 96",
    vein: "M212 86 C190 66 150 58 100 56 C70 55 44 53 24 52",
    thrill: { cx: 150, cy: 66, rx: 56, ry: 20 },
    anastomosis: { cx: 212, cy: 88 },
    sensor: { cx: 148, cy: 62 },
  },
} as const;

/** Illustrated brachial fistula (public/fistula-brachio-arm.webp, 2000 x 1116): the zones are laid over the picture. */
const PHOTO = {
  image: "/fistula-brachio-arm.webp",
  /* the picture has wide empty margins: the view is cropped to the arm */
  box: "60 140 1880 680",
  scale: 3.85,
  artery: "M320 458 C380 540 440 590 503 590 C640 640 760 690 900 650 C1050 600 1200 590 1362 645",
  vein: "M503 587 C580 560 640 495 740 488 C800 480 840 500 900 515 C1000 545 1150 540 1280 525",
  anastomosis: { cx: 503, cy: 587 },
  sensor: { cx: 813, cy: 502 },
} as const;

export interface FistulaMapProps {
  fistulaType: string;
  armSide: string;
  baseline: BaselineFeatures | null;
  /** latest valid (exploitable) session, or null when there is none */
  latest: SessionView | null;
  className?: string;
}

interface Detail {
  title: string;
  value: string;
  unit?: string;
  compare: string | null;
  note: string;
}

function pct(latest: number, base: number): string {
  return `${formatSignedPercent(((latest - base) / base) * 100)} vs référence`;
}

function buildDetail(zone: ZoneId, baseline: BaselineFeatures | null, latest: SessionView): Detail {
  if (zone === "anastomosis") {
    const hz = latest.peakFreqHz;
    return {
      title: "Anastomose · pic spectral",
      value: hz === null ? "—" : formatDecimal(hz, 0),
      unit: hz === null ? undefined : "Hz",
      compare: baseline ? `Référence ${formatDecimal(baseline.peakFreqHz, 0)} Hz` : "Référence en cours",
      note: "Fréquence dominante du thrill, là où l’artère rejoint la veine.",
    };
  }
  if (zone === "vein") {
    const rms = latest.rmsG;
    return {
      title: "Veine de drainage · énergie RMS",
      value: rms === null ? "—" : formatDecimal(rms, 3),
      unit: rms === null ? undefined : "g",
      compare:
        baseline && rms !== null && baseline.rmsG > 0 ? pct(rms, baseline.rmsG) : "Référence en cours",
      note: "Énergie du thrill dans la bande 15 à 450 Hz, mesurée sur le trajet veineux.",
    };
  }
  if (zone === "sensor") {
    const kpa = latest.avgPressureKpa;
    return {
      title: "Site du capteur · appui moyen",
      value: kpa === null ? "—" : formatDecimal(kpa, 1),
      unit: kpa === null ? undefined : "kPa",
      compare: "Cible 3,0 à 8,5 kPa",
      note:
        latest.cleanDurationSec === null
          ? "Là où le boîtier est posé, sans comprimer la fistule."
          : `Là où le boîtier est posé. Durée propre ${formatDecimal(latest.cleanDurationSec, 1)} s.`,
    };
  }
  return {
    title: "Artère d’apport",
    value: "Non mesurée",
    compare: null,
    note: "Dessinée pour le repère. Le capteur mesure le thrill veineux, pas le flux artériel.",
  };
}

/**
 * Interactive fistula figure. The drawing and the zone chips drive one detail panel. The chips are the accessible
 * control (radio group, keyboard); the hotspots on the drawing are a pointer shortcut to the same choice.
 */
export function FistulaMap({ fistulaType, armSide, baseline, latest, className = "" }: FistulaMapProps) {
  const [zone, setZone] = useState<ZoneId>("anastomosis");
  const [hover, setHover] = useState<ZoneId | null>(null);
  const isPhoto = /BRACHIO|brachio/.test(fistulaType);
  const site = isPhoto ? PHOTO : GEOMETRY.wrist;
  const k = isPhoto ? PHOTO.scale : 1;
  const mirrored = armSide === "RIGHT";
  const detail = latest ? buildDetail(zone, baseline, latest) : null;
  const when = latest ? formatSessionDate(latest.recordedAt) : null;
  const focus = hover ?? zone;

  const halo = (id: ZoneId) => (focus === id ? 1 : 0);
  const hotspot = (id: ZoneId) => ({
    "data-zone": id,
    onClick: () => setZone(id),
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
    className: "cursor-pointer",
  });

  return (
    <Card className={`flex flex-col gap-5 p-5 md:p-6 ${className}`}>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-medium tracking-wide text-text-label">Fistule</h2>
          <span className="text-sm font-medium text-text-primary">
            {fistulaLabel(fistulaType)} · {armSideLabel(armSide)}
          </span>
        </div>

        <div className={`rounded-[20px] bg-well p-3 ${mirrored ? "-scale-x-100" : ""}`}>
          <svg
            viewBox={isPhoto ? PHOTO.box : "0 0 520 150"}
            role="img"
            aria-label={`Schéma interactif de la fistule ${fistulaLabel(fistulaType)}, bras ${armSideLabel(armSide)}. Choisissez une zone avec les boutons sous le schéma.`}
            className="block h-auto w-full select-none"
          >
            {isPhoto ? (
              /* multiply blends the picture's white ground into the card surface */
              <image href={PHOTO.image} width="2000" height="1116" style={{ mixBlendMode: "multiply" }} />
            ) : (
              <>
                <path d={GEOMETRY.wrist.outline} fill="var(--bg-surface)" stroke="var(--hairline)" strokeWidth="2" strokeLinejoin="round" />
                <path d={GEOMETRY.wrist.crease} fill="none" stroke="var(--hairline)" strokeWidth="1.5" strokeLinecap="round" />
                <path d={GEOMETRY.wrist.artery} fill="none" stroke="var(--critical)" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
                <path d={GEOMETRY.wrist.vein} fill="none" stroke="var(--cyan)" strokeWidth="7" strokeLinecap="round" opacity="0.9" />
                <ellipse {...GEOMETRY.wrist.thrill} fill="var(--accent)" opacity="0.28" />
              </>
            )}

            {/* focus halos: a quiet opacity change, no looping animation */}
            <g className="transition-opacity duration-200" aria-hidden="true">
              <path d={site.artery} fill="none" stroke="var(--critical)" strokeWidth={14 * k} strokeLinecap="round" opacity={halo("artery") * 0.18} />
              <path d={site.vein} fill="none" stroke="var(--cyan)" strokeWidth={16 * k} strokeLinecap="round" opacity={halo("vein") * 0.22} />
              <circle {...site.anastomosis} r={20 * k} fill="none" stroke="var(--accent)" strokeWidth={3 * k} opacity={halo("anastomosis")} />
              <circle {...site.sensor} r={17 * k} fill="none" stroke="var(--primary)" strokeWidth={3 * k} opacity={halo("sensor")} />
            </g>

            {isPhoto ? null : (
              <>
                <circle {...site.anastomosis} r="11" fill="var(--accent-tint)" stroke="var(--accent)" strokeWidth="3" />
                <circle {...site.anastomosis} r="4" fill="var(--warning-text)" />
                <circle {...site.sensor} r="8" fill="var(--bg-surface)" stroke="var(--primary)" strokeWidth="3" />
                <circle {...site.sensor} r="2.5" fill="var(--primary)" />
              </>
            )}

            {/* pointer hotspots, on top; larger than the marks so they are easy to hit */}
            <path d={site.artery} fill="none" stroke="transparent" strokeWidth={22 * k} strokeLinecap="round" {...hotspot("artery")} />
            <path d={site.vein} fill="none" stroke="transparent" strokeWidth={24 * k} strokeLinecap="round" {...hotspot("vein")} />
            <circle {...site.anastomosis} r={22 * k} fill="transparent" {...hotspot("anastomosis")} />
            <circle {...site.sensor} r={20 * k} fill="transparent" {...hotspot("sensor")} />
          </svg>
        </div>

        <div role="radiogroup" aria-label="Zone de la fistule" className="flex flex-wrap gap-2">
          {ZONES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={zone === entry.id}
              onClick={() => setZone(entry.id)}
              onMouseEnter={() => setHover(entry.id)}
              onMouseLeave={() => setHover(null)}
              className={`min-h-11 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                zone === entry.id ? "bg-primary text-white" : "bg-well text-text-secondary hover:text-text-primary"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Détail de la zone" aria-live="polite" className="min-w-0 rounded-[20px] bg-well p-5">
        {detail ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:gap-8">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-label">{detail.title}</p>
              <p className="font-tabular">
                <span className={`font-medium tracking-tight text-text-primary ${detail.unit ? "text-5xl" : "text-3xl"}`}>{detail.value}</span>
                {detail.unit ? <span className="ml-2 text-base text-text-muted">{` ${detail.unit}`}</span> : null}
              </p>
              {detail.compare ? <p className="text-sm font-medium text-text-secondary">{detail.compare}</p> : null}
            </div>
            <div className="space-y-2 self-center">
              <p className="text-sm leading-relaxed text-text-secondary">{detail.note}</p>
              {when ? <p className="text-xs text-text-muted">Dernière mesure valide : {when}</p> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">Pas encore de mesure valide</p>
            <p className="text-sm text-text-secondary">Les valeurs de chaque zone apparaissent après la première mesure conforme.</p>
          </div>
        )}
      </section>
    </Card>
  );
}
