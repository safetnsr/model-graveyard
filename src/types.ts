export type ModelStatus = 'active' | 'deprecated' | 'eol';

export interface ModelEntry {
  id: string;
  provider: string;
  aliases?: string[];
  status: ModelStatus;
  eol?: string;
  successor?: string;
  notes?: string;
}

export interface Registry {
  models: ModelEntry[];
}

export interface Match {
  file: string;
  line: number;
  column: number;
  raw: string;         // the matched model string
  context: string;     // the full line
  model: ModelEntry | null; // resolved registry entry, null if unknown
}

export interface ScanReport {
  scannedAt: string;
  rootPath: string;
  filesScanned: number;
  matches: Match[];
  summary: {
    total: number;
    deprecated: number;
    eol: number;
    active: number;
    unknown: number;
  };
}

export interface MigrationChange {
  file: string;
  line: number;
  from: string;
  to: string;
  applied: boolean;
}

export interface MigrationReport {
  changes: MigrationChange[];
  applied: boolean;
}
