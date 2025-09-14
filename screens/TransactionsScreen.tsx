import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { RedemptionRequest, Transaction } from '../types/admin.types';

export default function TransactionsScreen() {
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RedemptionRequest | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    if (refreshing) return; // Prevent duplicate calls
    
    setLoading(true);
    try {
      await Promise.all([fetchRedemptionRequests(), fetchTransactionHistory()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [refreshing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchRedemptionRequests(), fetchTransactionHistory()]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

// Check if current user is admin using your admin table
const checkAdminStatus = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('No authenticated user');
      return false;
    }

    console.log('Checking admin status for user:', user.id);

    const { data, error } = await supabase
      .from('admins')
      .select('id, name, role')
      .eq('id', user.id)
      .single();

    if (error) {
      console.log('Not an admin user or error:', error.message);
      return false;
    }

    console.log('Admin record found:', data);
    return !!data;
  } catch (error) {
    console.error('Error in checkAdminStatus:', error);
    return false;
  }
};

// Updated fetch functions
const fetchRedemptionRequests = async () => {
  try {
    console.log('Fetching redemption requests...');
    
    // Check if user is admin first
    const isAdmin = await checkAdminStatus();
    console.log('User is admin:', isAdmin);

    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have admin privileges');
      setRedemptionRequests([]);
      return;
    }

    const { data, error } = await supabase
      .from('redemption_requests')
      .select(`
        *,
        user_profiles (
          user_id,
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    console.log('Redemption requests response:', { data, error });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Transform into our interface
    const transformedRequests: RedemptionRequest[] = data?.map(item => ({
      ...item,
      user: item.user_profiles ? {
        id: item.user_profiles.user_id,
        full_name: item.user_profiles.full_name,
      } : undefined,
    })) || [];

    console.log('Transformed requests:', transformedRequests);
    setRedemptionRequests(transformedRequests);
  } catch (error) {
    console.error('Error fetching redemption requests:', error);
    Alert.alert('Error', 'Failed to load redemption requests. Please try again.');
    throw error;
  }
};

const fetchTransactionHistory = async () => {
  try {
    console.log('Fetching transaction history...');
    
    // Check if user is admin first
    const isAdmin = await checkAdminStatus();
    console.log('User is admin:', isAdmin);

    if (!isAdmin) {
      Alert.alert('Access Denied', 'You do not have admin privileges');
      setTransactionHistory([]);
      return;
    }

    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        user_profiles (
          user_id,
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    console.log('Transaction history response:', { data, error });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Transform the data to match your Transaction interface
    const transformedTransactions: Transaction[] = data?.map(item => ({
      ...item,
      user: item.user_profiles ? {
        id: item.user_profiles.user_id,
        full_name: item.user_profiles.full_name,
      } : undefined,
    })) || [];

    console.log('Transformed transactions:', transformedTransactions);
    setTransactionHistory(transformedTransactions);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    Alert.alert('Error', 'Failed to load transaction history. Please try again.');
    throw error;
  }
};


const handleRequestAction = async (request: RedemptionRequest, action: 'pending' |'completed' | 'rejected') => {
  if (processingAction) return;
  
  setProcessingAction(true);
  try {
    const updateData: any = {
      status: action,
      updated_at: new Date().toISOString(),
    };

    if (action !== 'pending') {
      updateData.processed_at = new Date().toISOString();
    }

    // Update the redemption request status
    const { error } = await supabase
      .from('redemption_requests')
      .update(updateData)
      .eq('id', request.id);

    if (error) throw error;
    
    if (action === 'completed') {
      // THIS IS THE CRITICAL SECTION - DEDUCT POINTS FROM USER
      
      console.log('Starting completion process for user:', request.user_id);
      
      // 1. Get current user profile
      const { data: currentProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('available_points, redeemed_points, total_points')
        .eq('user_id', request.user_id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        throw profileError;
      }

      console.log('Current user profile:', currentProfile);
      console.log('Points to redeem:', request.points_redeemed);

      // 2. Check if user still has enough points
      if (currentProfile.available_points < request.points_redeemed) {
        throw new Error(`User no longer has sufficient points. Available: ${currentProfile.available_points}, Required: ${request.points_redeemed}`);
      }

      // 3. Calculate new point values
      const newAvailablePoints = currentProfile.available_points - request.points_redeemed;
      const newRedeemedPoints = currentProfile.redeemed_points + request.points_redeemed;

      console.log('New available points:', newAvailablePoints);
      console.log('New redeemed points:', newRedeemedPoints);

      // 4. Update user's points in user_profiles table
      const { error: pointsError } = await supabase
        .from('user_profiles')
        .update({
          available_points: newAvailablePoints,
          redeemed_points: newRedeemedPoints,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', request.user_id);

      if (pointsError) {
        console.error('Error updating user points:', pointsError);
        throw pointsError;
      }

      console.log('Successfully updated user points');

      // 5. Check if transaction already exists, if not create it
      const { data: existingTransaction, error: checkError } = await supabase
        .from('transactions')
        .select('id, status')
        .eq('reference_id', request.id)
        .eq('type', 'redeemed')
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking for existing transaction:', checkError);
        throw checkError;
      }

      if (existingTransaction) {
        // Update existing transaction
        const { error: transactionError } = await supabase
          .from('transactions')
          .update({
            status: 'completed',
            description: `GCash redemption - ₱${request.cash_amount.toFixed(2)} (Completed)`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTransaction.id);

        if (transactionError) {
          console.error('Error updating transaction:', transactionError);
          // Don't throw here as the main operation succeeded
        }
      } else {
        // Create new transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: request.user_id,
            type: 'redeemed',
            amount: -request.points_redeemed, // Negative because points are being deducted
            description: `GCash redemption - ₱${request.cash_amount.toFixed(2)} (Completed)`,
            status: 'completed',
            reference_id: request.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (transactionError) {
          console.error('Error creating transaction record:', transactionError);
          // Don't throw here as the main operation succeeded
        }
      }

      console.log('Redemption completion process finished successfully');
    } 
    else if (action === 'rejected') {
      // Update the existing transaction to failed status
      console.log('Updating transaction to failed for reference_id:', request.id);
      
      const { data: updatedTransaction, error: transactionError } = await supabase
        .from('transactions')
        .update({
          status: 'failed',
          description: `GCash redemption - ₱${request.cash_amount.toFixed(2)} (Rejected)`,
          updated_at: new Date().toISOString(),
        })
        .eq('reference_id', request.id)
        .eq('type', 'redeemed')
        .select();

      console.log('Transaction rejection update result:', { updatedTransaction, transactionError });

      if (transactionError) {
        console.error('Error marking transaction as failed:', transactionError);
        throw transactionError;
      }

      if (!updatedTransaction || updatedTransaction.length === 0) {
        console.warn('No transaction was updated during rejection.');
      } else {
        console.log('Transaction marked as failed successfully:', updatedTransaction);
      }
    }

    // Update local state optimistically
    setRedemptionRequests(prev =>
      prev.map(req =>
        req.id === request.id
          ? { ...req, status: action, processed_at: new Date().toISOString() }
          : req
      )
    );

    Alert.alert(
      'Success',
      `Request has been ${action === 'completed' ? 'approved and completed' : action}`
    );
    setModalVisible(false);
    
    // Refresh data to get latest state
    await Promise.all([fetchRedemptionRequests(), fetchTransactionHistory()]);
  } catch (error) {
    console.error(`Error ${action}ing request:`, error);
    Alert.alert('Error', `Failed to ${action} request: ${error}`);
  } finally {
    setProcessingAction(false);
  }
};
  const renderRedemptionRequest = ({ item }: { item: RedemptionRequest }) => (
    <TouchableOpacity
      style={[styles.requestItem, getStatusStyle(item.status)]}
      onPress={() => {
        setSelectedRequest(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.requestHeader}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
          <Text style={[styles.statusText, getStatusTextStyle(item.status)]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.requestDetails}>
        <Text style={styles.pointsRequested}>{item.points_redeemed} points</Text>
        <Text style={styles.cashAmount}>₱{item.cash_amount.toFixed(2)}</Text>
      </View>
      <Text style={styles.gcashNumber}>GCash: {item.gcash_number}</Text>
      <Text style={styles.requestDate}>
        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
      </Text>
    </TouchableOpacity>
  );

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <Text style={styles.userName}>{item.user?.full_name || 'Unknown User'}</Text>
        <Text style={[
          styles.pointsAmount,
          { color: item.amount > 0 ? '#28a745' : '#dc3545' }
        ]}>
          {item.amount > 0 ? '+' : ''}{item.amount}
        </Text>
      </View>
      <Text style={styles.transactionDescription}>{item.description}</Text>
      <View style={styles.transactionFooter}>
        <Text style={styles.transactionType}>{item.type.toUpperCase()}</Text>
        <View style={[styles.transactionStatusBadge, getTransactionStatusStyle(item.status)]}>
          <Text style={[styles.transactionStatusText, getTransactionStatusTextStyle(item.status)]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.transactionDate}>
        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString()}
      </Text>
    </View>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { borderLeftColor: '#ffc107', borderLeftWidth: 4 };
      case 'processing':
        return { borderLeftColor: '#17a2b8', borderLeftWidth: 4 };
      case 'completed':
        return { borderLeftColor: '#28a745', borderLeftWidth: 4 };
      case 'rejected':
        return { borderLeftColor: '#dc3545', borderLeftWidth: 4 };
      default:
        return {};
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#fff3cd' };
      case 'processing':
        return { backgroundColor: '#d1ecf1' };
      case 'completed':
        return { backgroundColor: '#d4edda' };
      case 'rejected':
        return { backgroundColor: '#f8d7da' };
      default:
        return { backgroundColor: '#e9ecef' };
    }
  };

  const getStatusTextStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#856404' };
      case 'processing':
        return { color: '#0c5460' };
      case 'completed':
        return { color: '#155724' };
      case 'rejected':
        return { color: '#721c24' };
      default:
        return { color: '#495057' };
    }
  };

  const getTransactionStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#fff3cd' };
      case 'completed':
        return { backgroundColor: '#d4edda' };
      case 'failed':
        return { backgroundColor: '#f8d7da' };
      default:
        return { backgroundColor: '#e9ecef' };
    }
  };

  const getTransactionStatusTextStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: '#856404' };
      case 'completed':
        return { color: '#155724' };
      case 'failed':
        return { color: '#721c24' };
      default:
        return { color: '#495057' };
    }
  };

  const pendingRequests = redemptionRequests.filter(req => req.status === 'pending');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="refresh" size={24} color="#007AFF" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Redemption Requests</Text>
          <Text style={styles.sectionCount}>({pendingRequests.length} pending)</Text>
        </View>
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={pendingRequests}
            renderItem={renderRedemptionRequest}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            style={styles.requestsList}
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>No pending redemption requests</Text>
            )}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : (
          <FlatList
            data={transactionHistory}
            renderItem={renderTransaction}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={() => (
              <Text style={styles.emptyText}>No transaction history</Text>
            )}
          />
        )}
      </View>

      {/* Request Action Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => !processingAction && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Redemption Request</Text>
            {selectedRequest && (
              <>
                <Text style={styles.modalText}>User: {selectedRequest.full_name}</Text>
                <Text style={styles.modalText}>GCash: {selectedRequest.gcash_number}</Text>
                <Text style={styles.modalText}>Points: {selectedRequest.points_redeemed}</Text>
                <Text style={styles.modalText}>Cash Amount: ₱{selectedRequest.cash_amount.toFixed(2)}</Text>
                <Text style={styles.modalText}>
                  Date: {new Date(selectedRequest.created_at).toLocaleDateString()}
                </Text>
                
                {selectedRequest.status === 'pending' && (
                  <View style={styles.modalButtons}>   
                    <TouchableOpacity
                      style={[styles.modalButton, styles.approveButton]}
                      onPress={() => handleRequestAction(selectedRequest, 'completed')}
                      disabled={processingAction}
                    >
                      <Text style={styles.approveButtonText}>Complete</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.modalButton, styles.rejectButton]}
                      onPress={() => handleRequestAction(selectedRequest, 'rejected')}
                      disabled={processingAction}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                  disabled={processingAction}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  refreshButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  section: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  requestsList: {
    maxHeight: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
  requestItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pointsRequested: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  cashAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  gcashNumber: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
  },
  transactionItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointsAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  transactionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionType: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transactionStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  modalButtons: {
    gap: 8,
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  processingButton: {
    backgroundColor: '#17a2b8',
  },
  processingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    backgroundColor: '#28a745',
  },
  approveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
  },
});