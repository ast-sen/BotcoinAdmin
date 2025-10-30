// services/analyticsService.ts
import { supabase } from '../utils/supabase';
import { AnalyticsDataMap, TrendType } from '../types/analytics.types';

interface PeriodData {
  bottles: number;
  change: number;
  trend: TrendType;
}

export const getBottleAnalytics = async (): Promise<AnalyticsDataMap> => {
  try {
    // Get current date/time boundaries
    const now = new Date();
    
    // Day boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    // Week boundaries (assuming week starts on Sunday)
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    
    // Month boundaries
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Year boundaries
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);

    console.log('Fetching analytics data from Supabase...');

    // Execute all queries in parallel for better performance
    const [
      todayResult,
      yesterdayResult,
      thisWeekResult,
      lastWeekResult,
      thisMonthResult,
      lastMonthResult,
      thisYearResult,
      lastYearResult
    ] = await Promise.all([
      // Today's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', todayStart.toISOString()),
      
      // Yesterday's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', yesterdayStart.toISOString())
        .lt('collected_at', todayStart.toISOString()),
      
      // This week's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', thisWeekStart.toISOString()),
      
      // Last week's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', lastWeekStart.toISOString())
        .lt('collected_at', thisWeekStart.toISOString()),
      
      // This month's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', thisMonthStart.toISOString()),
      
      // Last month's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', lastMonthStart.toISOString())
        .lte('collected_at', lastMonthEnd.toISOString()),
      
      // This year's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', thisYearStart.toISOString()),
      
      // Last year's bottles
      supabase
        .from('bottles')
        .select('*', { count: 'exact', head: true })
        .gte('collected_at', lastYearStart.toISOString())
        .lte('collected_at', lastYearEnd.toISOString())
    ]);

    // Helper function to calculate trend and change
    const calculatePeriodData = (current: number, previous: number): PeriodData => {
      const change = previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);
      let trend: TrendType = 'neutral';
      
      if (change > 0) trend = 'up';
      else if (change < 0) trend = 'down';
      
      return {
        bottles: current,
        change,
        trend
      };
    };

    // Handle potential errors and extract counts
    const safeCount = (result: any): number => {
      if (result.error) {
        console.error('Query error:', result.error);
        return 0;
      }
      return result.count || 0;
    };

    const analytics: AnalyticsDataMap = {
      day: calculatePeriodData(
        safeCount(todayResult), 
        safeCount(yesterdayResult)
      ),
      week: calculatePeriodData(
        safeCount(thisWeekResult), 
        safeCount(lastWeekResult)
      ),
      month: calculatePeriodData(
        safeCount(thisMonthResult), 
        safeCount(lastMonthResult)
      ),
      year: calculatePeriodData(
        safeCount(thisYearResult), 
        safeCount(lastYearResult)
      )
    };

    console.log('Analytics data fetched successfully:', analytics);
    return analytics;

  } catch (error) {
    console.error('Error fetching bottle analytics:', error);
    
    // Return default data on error
    const defaultData: PeriodData = { bottles: 0, change: 0, trend: 'neutral' };
    return {
      day: defaultData,
      week: defaultData,
      month: defaultData,
      year: defaultData
    };
  }
};

// Get peak collection hour for today
export const getPeakHour = async (): Promise<string> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('bottles')
      .select('collected_at')
      .gte('collected_at', todayStart.toISOString());

    if (error) {
      console.error('Error fetching peak hour data:', error);
      return 'No data available';
    }

    if (!data || data.length === 0) {
      return 'No bottles today';
    }

    // Group bottles by hour
    const hourCounts: { [hour: number]: number } = {};
    
    data.forEach(bottle => {
      const hour = new Date(bottle.collected_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find the hour with most bottles
    let peakHour = 0;
    let maxCount = 0;
    
    Object.entries(hourCounts).forEach(([hour, count]) => {
      if (count > maxCount) {
        maxCount = count;
        peakHour = parseInt(hour);
      }
    });

    // Format hour range
    const formatHour = (hour: number): string => {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:00 ${period}`;
    };

    const endHour = peakHour === 23 ? 0 : peakHour + 1;
    return `${formatHour(peakHour)} - ${formatHour(endHour)}`;

  } catch (error) {
    console.error('Error calculating peak hour:', error);
    return 'Error loading';
  }
};

// Get busiest day of the week
export const getBusiestDay = async (): Promise<string> => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('bottles')
      .select('collected_at')
      .gte('collected_at', oneWeekAgo.toISOString());

    if (error || !data || data.length === 0) {
      return 'No data';
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts: { [day: number]: number } = {};

    data.forEach(bottle => {
      const dayOfWeek = new Date(bottle.collected_at).getDay();
      dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;
    });

    let busiestDay = 0;
    let maxCount = 0;

    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        busiestDay = parseInt(day);
      }
    });

    return dayNames[busiestDay];

  } catch (error) {
    console.error('Error calculating busiest day:', error);
    return 'Error';
  }
};

interface AnalyticsResponse {
  current: number;
  previous: number;
  change: number;
  trend: TrendType;
}
