import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { UserProfile, Notification } from '../types/admin.types';
import { useAuth } from '../contexts/AuthContext';

export default function HomeScreen() {
  const { admin } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscription
    const notificationSubscription = supabase
      .channel('system_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_notifications',
        filter: 'active=eq.true'
      }, (payload) => {
        console.log('Notification change received:', payload);
        
        if (payload.eventType === 'INSERT') {
          const newNotification: Notification = {
            id: payload.new.id,
            title: payload.new.title,
            message: payload.new.message,
            type: getNotificationType(payload.new.priority),
            created_at: payload.new.created_at,
            read: false,
          };
          setNotifications(prev => [newNotification, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev =>
            prev.map(notif =>
              notif.id === payload.new.id
                ? {
                    ...notif,
                    title: payload.new.title,
                    message: payload.new.message,
                    type: getNotificationType(payload.new.priority),
                  }
                : notif
            )
          );
        } else if (payload.eventType === 'DELETE') {
          setNotifications(prev => prev.filter(notif => notif.id !== payload.old.id));
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(notificationSubscription);
    };
  }, []);

  const getNotificationType = (priority: string): 'info' | 'warning' | 'error' | 'success' => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      default:
        return 'info';
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchUsers(), fetchNotifications()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Maps to your Notification type
      const mappedNotifications: Notification[] = (data || []).map(notif => ({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: getNotificationType(notif.priority),
        created_at: notif.created_at,
        read: false,
      }));
      
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      // Update local state immediately
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );

      // You can add a database update here if you want to persist read status
      // For example, add a 'read_by' column or similar
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update to set active = false instead of deleting
              const { error } = await supabase
                .from('system_notifications')
                .update({ active: false })
                .eq('id', notificationId);

              if (error) throw error;

              // Remove from local state
              setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
              
              Alert.alert('Success', 'Notification deleted successfully');
            } catch (error) {
              console.error('Error deleting notification:', error);
              Alert.alert('Error', 'Failed to delete notification');
            }
          },
        },
      ]
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return { name: 'warning', color: '#FF9500' };
      case 'error':
        return { name: 'alert-circle', color: '#FF3B30' };
      case 'success':
        return { name: 'checkmark-circle', color: '#34C759' };
      default:
        return { name: 'information-circle', color: '#007AFF' };
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);
    
    return (
      <View
        style={[styles.notificationItem, !item.read && styles.unreadNotification]}
      >
        <TouchableOpacity
          style={styles.notificationContent}
          onPress={() => markNotificationAsRead(item.id)}
        >
          <Ionicons name={icon.name as any} size={24} color={icon.color} style={styles.notificationIcon} />
          <View style={styles.notificationTextContainer}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationTime}>
                {new Date(item.created_at).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
            <Text style={styles.notificationMessage}>{item.message}</Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
        
        <View style={styles.notificationActions}>
          {!item.read && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => markNotificationAsRead(item.id)}
            >
              <Ionicons name="checkmark-done" size={18} color="#007AFF" />
              <Text style={styles.actionButtonText}>Mark Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteNotification(item.id)}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderUser = ({ item }: { item: UserProfile }) => (
    <TouchableOpacity style={styles.userItem}>
      <View style={styles.userAvatar}>
        <Text style={styles.userAvatarText}>
          {item.full_name ? item.full_name.charAt(0).toUpperCase() : "?"}
        </Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>
      <View style={styles.userPoints}>
        <Text style={styles.pointsText}>{item.total_points}</Text>
        <Text style={styles.pointsLabel}>points</Text>
      </View>
    </TouchableOpacity>
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Welcome, {admin?.name}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchData}>
          <Ionicons name="refresh" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllButton}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={true}
          style={styles.notificationList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Users</Text>
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={true}
          style={styles.userList}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchData} />
          }
        />
      </View>
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
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  notificationList: {
    maxHeight: 330,
  },
  userList: {
    maxHeight: 300,
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  unreadNotification: {
    backgroundColor: '#f0f8ff',
    borderColor: '#007AFF',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  notificationTextContainer: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginLeft: 8,
    marginTop: 6,
  },
  notificationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#fff0f0',
  },
  deleteButtonText: {
    color: '#FF3B30',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userPoints: {
    alignItems: 'flex-end',
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  pointsLabel: {
    fontSize: 12,
    color: '#666',
  },
});