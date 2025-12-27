import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Card, Title, Paragraph, Button } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appointmentService } from '../services';

export default function HomeScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);

  useEffect(() => {
    loadUserData();
    loadTodayAppointments();
  }, []);

  const loadUserData = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const loadTodayAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await appointmentService.getAllAppointments({ date: today });
      setTodayAppointments(response.appointments || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>Welcome, {user?.name || 'User'}!</Title>
        <Paragraph style={styles.subtitle}>
          {user?.role === 'doctor' ? 'Neurologist Dashboard' : 'Patient Dashboard'}
        </Paragraph>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Today's Appointments</Title>
          <Paragraph>You have {todayAppointments.length} appointments today</Paragraph>
        </Card.Content>
        <Card.Actions>
          <Button onPress={() => navigation.navigate('Appointments')}>
            View All
          </Button>
        </Card.Actions>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Quick Actions</Title>
        </Card.Content>
        <Card.Actions>
          <Button 
            icon="calendar-plus"
            onPress={() => navigation.navigate('Calendar')}
          >
            Schedule
          </Button>
          <Button 
            icon="account-group"
            onPress={() => navigation.navigate('Patients')}
          >
            Patients
          </Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#6200ee',
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  card: {
    margin: 10,
    elevation: 4,
  },
});
