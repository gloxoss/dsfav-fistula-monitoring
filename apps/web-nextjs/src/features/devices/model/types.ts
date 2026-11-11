import type { components } from "@dsfav/shared-types";
import type { UserRole } from "@/libs/auth/session";

export type ApiDeviceSummary = components["schemas"]["DeviceSummary"];
export type ApiConfig = components["schemas"]["ConfigVersionResponse"];

export interface DeviceThresholds {
  batteryWarnPct: number;
  batteryBlockPct: number;
  gainTolerancePct: number;
}

export interface CalibrationState {
  error: string | null;
  ok: boolean;
}

export type CalibrationAction = (
  state: CalibrationState,
  formData: FormData,
) => Promise<CalibrationState>;

export type CalibrationAuditDetails = { calibrationGain: number; reason: string };
export type CalibrationAuditEvent = Omit<
  components["schemas"]["AuditEventSummary"],
  "after"
> & { after: CalibrationAuditDetails | null };

export interface DevicesViewProps {
  devices: ApiDeviceSummary[];
  role: UserRole | null;
  thresholds: DeviceThresholds | null;
  calibrationHistory?: CalibrationAuditEvent[];
  unavailable?: boolean;
  onCalibrate?: CalibrationAction;
}
