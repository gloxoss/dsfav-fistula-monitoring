import { DISCLAIMER } from "@/libs/clinical/disclaimer";

export function Disclaimer() {
  return (
    <p role="note" className="text-sm text-zinc-600">
      {DISCLAIMER}
    </p>
  );
}
