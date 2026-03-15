import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { alertsAPI } from '../../src/services/api';
import { COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, SHADOWS, ALERT_TYPES } from '../../src/constants/theme';
import Card from '../../src/components/Card';
import LoadingSpinner from '../../src/components/LoadingSpinner';
import { format } from 'date-fns';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await alertsAPI.getAll();
      setAlerts(response.data);
    } catch (error) {
      console.log('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const renderAlert = ({ item }: { item: any }) => {
    const alertConfig = ALERT_TYPES[item.alert_type as keyof typeof ALERT_TYPES] || ALERT_TYPES.info;
    
    return (
      <TouchableOpacity onPress={() => setSelectedAlert(item)} activeOpacity={0.7}>
        <Card style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <View style={[styles.alertIcon, { backgroundColor: alertConfig.color }]}>
              <Ionicons name={alertConfig.icon as any} size={20} color={COLORS.white} />
            </View>
            <View style={styles.alertInfo}>
              <Text style={styles.alertType}>
                {item.alert_type.charAt(0).toUpperCase() + item.alert_type.slice(1)}
              </Text>
              <Text style={styles.alertTime}>
                {format(new Date(item.created_at), 'MMM d, yyyy · h:mm a')}
              </Text>
            </View>
          </View>
          <Text style={styles.alertTitle}>{item.title}</Text>
          <Text style={styles.alertMessage} numberOfLines={2}>
            {item.message}
          </Text>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading alerts..." />;
  }

  if (selectedAlert) {
    const alertConfig = ALERT_TYPES[selectedAlert.alert_type as keyof typeof ALERT_TYPES] || ALERT_TYPES.info;
    
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedAlert(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>Alert Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.detailContent}>
          <View style={[styles.detailIcon, { backgroundColor: alertConfig.color }]}>
            <Ionicons name={alertConfig.icon as any} size={32} color={COLORS.white} />
          </View>
          <Text style={styles.detailType}>
            {selectedAlert.alert_type.charAt(0).toUpperCase() + selectedAlert.alert_type.slice(1)}
          </Text>
          <Text style={styles.detailTitle}>{selectedAlert.title}</Text>
          <Text style={styles.detailTime}>
            {format(new Date(selectedAlert.created_at), 'EEEE, MMMM d, yyyy · h:mm a')}
          </Text>
          <View style={styles.detailMessageContainer}>
            <Text style={styles.detailMessage}>{selectedAlert.message}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Campus Alerts</Text>
      </View>
      
      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off" size={64} color={COLORS.gray[300]} />
          <Text style={styles.emptyText}>No alerts at this time</Text>
          <Text style={styles.emptySubtext}>Stay safe!</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          renderItem={renderAlert}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.md, paddingTop: SPACING.sm },
  title: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.gray[800] },
  listContent: { padding: SPACING.md, paddingTop: 0 },
  alertCard: { marginBottom: SPACING.md },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  alertIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm },
  alertInfo: { flex: 1 },
  alertType: { fontSize: FONT_SIZE.xs, fontWeight: '600', color: COLORS.gray[500], textTransform: 'uppercase', letterSpacing: 0.5 },
  alertTime: { fontSize: FONT_SIZE.xs, color: COLORS.gray[400], marginTop: 2 },
  alertTitle: { fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.gray[800], marginBottom: 4 },
  alertMessage: { fontSize: FONT_SIZE.sm, color: COLORS.gray[600], lineHeight: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyText: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.gray[500], marginTop: SPACING.md },
  emptySubtext: { fontSize: FONT_SIZE.md, color: COLORS.gray[400], marginTop: SPACING.xs },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[200] },
  backButton: { padding: 4 },
  detailHeaderTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: COLORS.gray[800] },
  detailContent: { flex: 1, alignItems: 'center', padding: SPACING.lg },
  detailIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  detailType: { fontSize: FONT_SIZE.sm, fontWeight: '600', color: COLORS.gray[500], textTransform: 'uppercase', letterSpacing: 1 },
  detailTitle: { fontSize: FONT_SIZE.xxl, fontWeight: 'bold', color: COLORS.gray[800], textAlign: 'center', marginTop: SPACING.sm },
  detailTime: { fontSize: FONT_SIZE.sm, color: COLORS.gray[500], marginTop: SPACING.xs },
  detailMessageContainer: { backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginTop: SPACING.lg, width: '100%', ...SHADOWS.sm },
  detailMessage: { fontSize: FONT_SIZE.md, color: COLORS.gray[700], lineHeight: 24 },
});
