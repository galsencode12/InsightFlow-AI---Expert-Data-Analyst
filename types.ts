
export type FileType = 'csv' | 'excel' | 'pdf';

export interface DataPayload {
  name: string;
  type: FileType;
  content: any; // Raw parsed data or text
  headers?: string[];
  summary?: string;
  rowCount?: number;
}

export interface AnalysisResult {
  overview: string;
  keyInsights: string[];
  suggestedCharts: ChartConfig[];
  predictions?: string;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter';
  title: string;
  xAxis: string;
  yAxis: string;
  description: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
