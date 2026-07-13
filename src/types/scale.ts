// src/types/scale.ts
export interface ScaleReading {
  weight: number;
  unit: string;
  stable: boolean;
  timestamp: Date;
}

export interface ScaleConfig {
  vendorId?: number;
  productId?: number;
  baudRate: number;
  dataFormat: string;
  unit: string;
  stableThreshold: number;
  stabilityWaitTime: number;
}

export interface USBScaleReaderProps {
  onWeightRead: (weight: number) => void;
  onWeightStable?: (weight: number) => void;
  productName?: string;
  autoAdd?: boolean;
  onClose?: () => void;
}