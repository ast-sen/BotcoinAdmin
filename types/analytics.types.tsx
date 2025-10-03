export type TrendType = 'up' | 'down' | 'neutral';

export type PeriodKey = 'day' | 'week' | 'month' | 'year';

export interface AnalyticsData {
  bottles: number;
  change: number;
  trend: TrendType;
}

export interface AnalyticsDataMap {
  day: AnalyticsData;
  week: AnalyticsData;
  month: AnalyticsData;
  year: AnalyticsData;
}

export interface TimeFrame {
  key: PeriodKey;
  label: string;
  period: string;
}

export interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const timeFrames: TimeFrame[] = [
  { key: 'day', label: 'Today', period: '24 hours' },
  { key: 'week', label: 'This Week', period: '7 days' },
  { key: 'month', label: 'This Month', period: '30 days' },
  { key: 'year', label: 'This Year', period: '365 days' },
];