import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  TrendType,
  PeriodKey,
  AnalyticsDataMap,
  TimeFrame,
  AnalyticsModalProps,
} from '../types/analytics.types';

const { width } = Dimensions.get('window');

// Mock data - replace with your actual API calls
const mockAnalyticsData: AnalyticsDataMap = {
  day: {
    bottles: 45,
    change: 12,
    trend: 'up',
  },
  week: {
    bottles: 287,
    change: -8,
    trend: 'down',
  },
  month: {
    bottles: 1234,
    change: 25,
    trend: 'up',
  },
  year: {
    bottles: 14820,
    change: 15,
    trend: 'up',
  },
};

const timeFrames: TimeFrame[] = [
  { key: 'day', label: 'Today', period: '24 hours' },
  { key: 'week', label: 'This Week', period: '7 days' },
  { key: 'month', label: 'This Month', period: '30 days' },
  { key: 'year', label: 'This Year', period: '365 days' },
];

export default function AnalyticsModal({ visible, onClose }: AnalyticsModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('day');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDataMap>(mockAnalyticsData);
  const [loading, setLoading] = useState<boolean>(false);

  // Helper functions
  const getDivisor = (period: PeriodKey): number => {
    switch (period) {
      case 'day': return 24;
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 1;
    }
  };

  const getPerLabel = (period: PeriodKey): string => {
    switch (period) {
      case 'day': return 'Hour';
      case 'week': return 'Day';
      case 'month': return 'Day';
      case 'year': return 'Day';
      default: return 'Day';
    }
  };

  // Simulate API call
  const fetchAnalytics = async (period: PeriodKey): Promise<void> => {
    setLoading(true);
    // Replace this with your actual API call
    setTimeout(() => {
      // For demo purposes, we're using mock data
      // In real implementation, you would fetch data based on the period
      setAnalyticsData(mockAnalyticsData);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    if (visible) {
      fetchAnalytics(selectedPeriod);
    }
  }, [visible, selectedPeriod]);

  const handlePeriodChange = (period: PeriodKey): void => {
    setSelectedPeriod(period);
  };

  const renderTrendIcon = (trend: TrendType) => {
    if (trend === 'up') {
      return <Ionicons name="trending-up" size={20} color="#28a745" />;
    } else if (trend === 'down') {
      return <Ionicons name="trending-down" size={20} color="#dc3545" />;
    }
    return <Ionicons name="remove" size={20} color="#6c757d" />;
  };

  const renderStatCard = (timeFrame: TimeFrame) => {
    const data = analyticsData[timeFrame.key];
    const changeColor = data.change > 0 ? '#28a745' : data.change < 0 ? '#dc3545' : '#6c757d';
    const changePrefix = data.change > 0 ? '+' : '';

    return (
      <View key={timeFrame.key} style={styles.statCard}>
        <View style={styles.statHeader}>
          <Text style={styles.statPeriod}>{timeFrame.label}</Text>
          <Text style={styles.statSubPeriod}>{timeFrame.period}</Text>
        </View>
        
        <View style={styles.statContent}>
          <Text style={styles.statNumber}>{data.bottles.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Bottles</Text>
        </View>
        
        <View style={styles.statTrend}>
          {renderTrendIcon(data.trend)}
          <Text style={[styles.statChange, { color: changeColor }]}>
            {changePrefix}{data.change}%
          </Text>
          <Text style={styles.statChangeLabel}>vs previous period</Text>
        </View>
      </View>
    );
  };

  const renderDetailedView = () => {
    const currentData = analyticsData[selectedPeriod];
    const timeFrame = timeFrames.find((tf: TimeFrame) => tf.key === selectedPeriod);
    
    if (!timeFrame) {
      return <View />;
    }
    
    return (
      <View style={styles.detailedView}>
        <Text style={styles.detailedTitle}>{timeFrame.label} Details</Text>
        
        <View style={styles.detailedCard}>
          <View style={styles.detailedHeader}>
            <View style={styles.detailedIconContainer}>
              <Ionicons name="water" size={32} color="#007AFF" />
            </View>
            <View style={styles.detailedInfo}>
              <Text style={styles.detailedNumber}>
                {currentData.bottles.toLocaleString()}
              </Text>
              <Text style={styles.detailedLabel}>Total Bottles</Text>
            </View>
          </View>
          
          <View style={styles.detailedStats}>
            <View style={styles.detailedStatItem}>
              <Text style={styles.detailedStatNumber}>
                {Math.round(currentData.bottles / getDivisor(selectedPeriod))}
              </Text>
              <Text style={styles.detailedStatLabel}>
                Per {getPerLabel(selectedPeriod)}
              </Text>
            </View>
            
            <View style={styles.detailedStatItem}>
              <Text style={[
                styles.detailedStatNumber, 
                { color: currentData.change > 0 ? '#28a745' : '#dc3545' }
              ]}>
                {currentData.change > 0 ? '+' : ''}{currentData.change}%
              </Text>
              <Text style={styles.detailedStatLabel}>Change</Text>
            </View>
          </View>
          
          {/* Additional metrics */}
          <View style={styles.additionalMetrics}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Peak Hour:</Text>
              <Text style={styles.metricValue}>2:00 PM - 3:00 PM</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Busiest Day:</Text>
              <Text style={styles.metricValue}>Monday</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Recycling Rate:</Text>
              <Text style={styles.metricValue}>87%</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Bottle Analytics</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Period Selector */}
          <View style={styles.periodSelector}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {timeFrames.map((timeFrame: TimeFrame) => (
                <TouchableOpacity
                  key={timeFrame.key}
                  style={[
                    styles.periodButton,
                    selectedPeriod === timeFrame.key && styles.periodButtonActive,
                  ]}
                  onPress={() => handlePeriodChange(timeFrame.key)}
                >
                  <Text style={[
                    styles.periodButtonText,
                    selectedPeriod === timeFrame.key && styles.periodButtonTextActive,
                  ]}>
                    {timeFrame.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading analytics...</Text>
            </View>
          ) : (
            <>
              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                {timeFrames.map(renderStatCard)}
              </View>

              {/* Detailed View */}
              {renderDetailedView()}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  periodSelector: {
    paddingVertical: 20,
    paddingLeft: 20,
  },
  periodButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 16,
  },
  statsGrid: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    marginBottom: 12,
  },
  statPeriod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statSubPeriod: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  statContent: {
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChange: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  statChangeLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 4,
  },
  detailedView: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  detailedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  detailedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailedIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailedInfo: {
    flex: 1,
  },
  detailedNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  detailedLabel: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 4,
  },
  detailedStats: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailedStatItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  detailedStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  detailedStatLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    textAlign: 'center',
  },
  additionalMetrics: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
});