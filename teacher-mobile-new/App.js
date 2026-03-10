import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { supabase } from './supabase';
import { Users, Calendar, BookOpen, RefreshCw } from 'lucide-react-native';

export default function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents();
  };

  const renderStudent = ({ item }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentDetails}>{item.grade}ኛ ክፍል • {item.gender === 'Male' ? 'ወንድ' : 'ሴት'}</Text>
      </View>
      <TouchableOpacity style={styles.presentButton}>
        <Text style={styles.buttonText}>Present</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Teacher Portal</Text>
          <Text style={styles.headerSubtitle}>Senbet Student Management</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing}>
          <RefreshCw size={24} color="#166534" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statBox, { backgroundColor: '#f0fdf4' }]}>
          <Users size={20} color="#166534" />
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#eff6ff' }]}>
          <Calendar size={20} color="#1e40af" />
          <Text style={styles.statNumber}>Today</Text>
          <Text style={styles.statLabel}>Attendance</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Class List</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#166534" />
        </View>
      ) : (
        <FlatList
          data={students}
          renderItem={renderStudent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No students found. Sync from Admin.</Text>
            </View>
          }
        />
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Users size={24} color="#166534" />
          <Text style={[styles.navText, { color: '#166534' }]}>Students</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Calendar size={24} color="#64748b" />
          <Text style={styles.navText}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <BookOpen size={24} color="#64748b" />
          <Text style={styles.navText}>Marks</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  statBox: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  studentDetails: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  presentButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: 10,
  },
  navItem: {
    alignItems: 'center',
  },
  navText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});
