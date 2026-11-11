const FISTULA_LABELS: Record<string, string> = {
  RADIO_CEPHALIC: "FAV radio-céphalique",
  BRACHIO_CEPHALIC: "FAV brachio-céphalique",
  BRACHIO_BASILIC: "FAV brachio-basilique",
};

const SIDE_LABELS: Record<string, string> = {
  LEFT: "gauche",
  RIGHT: "droite",
};

export function fistulaLabel(type: string): string {
  return FISTULA_LABELS[type] ?? type;
}

export function armSideLabel(side: string): string {
  return SIDE_LABELS[side] ?? side;
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function formatGrams(value: number): string {
  return `${formatDecimal(value, 3)} g`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${formatDecimal(value, digits)} %`;
}

export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatDecimal(value, 0)} %`;
}

export function formatSessionDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
