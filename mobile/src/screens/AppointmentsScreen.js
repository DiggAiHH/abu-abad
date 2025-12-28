import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Title, Paragraph, Button, Chip } from 'react-native-paper';
import { appointmentService } from '../services';

export default function AppointmentsScreen({ navigation }) {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const response = await appointmentService.getAllAppointments();
      setAppointments(response.appointments || []);
    } catch (error) {
      // Silently fail to avoid disrupting the UI
      setAppointments([]);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return '#4CAF50';
      case 'completed':
        return '#2196F3';
      case 'cancelled':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const renderAppointment = ({ item }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Title>{item.date}</Title>
          <Chip 
            style={{ backgroundColor: getStatusColor(item.status) }}
            textStyle={{ color: '#fff' }}
          >
            {item.status}
          </Chip>
        </View>
        <Paragraph>Time: {item.startTime} - {item.endTime}</Paragraph>
        <Paragraph>Type: {item.type}</Paragraph>
        {item.notes && <Paragraph>Notes: {item.notes}</Paragraph>}
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => {
          // Navigate to video call with appointment details
          navigation.navigate('VideoCall', { 
            appointmentId: item.id,
            doctorId: item.doctorId,
            patientId: item.patientId
          });
        }}>
          Join Call
        </Button>
      </Card.Actions>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={appointments}
        renderItem={renderAppointment}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 10,
  },
  card: {
    marginBottom: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
});
