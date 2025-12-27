import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Card, Title, List, Button } from 'react-native-paper';

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
    // Load available slots for this date
    loadAvailableSlots(day.dateString);
  };

  const loadAvailableSlots = async (date) => {
    // Mock slots for demo
    const slots = [
      '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30'
    ];
    setAvailableSlots(slots);
  };

  return (
    <ScrollView style={styles.container}>
      <Calendar
        onDayPress={onDayPress}
        markedDates={{
          [selectedDate]: { selected: true, selectedColor: '#6200ee' }
        }}
        theme={{
          selectedDayBackgroundColor: '#6200ee',
          todayTextColor: '#6200ee',
          arrowColor: '#6200ee',
        }}
      />

      {selectedDate && (
        <Card style={styles.card}>
          <Card.Content>
            <Title>Available Time Slots</Title>
            <Title style={styles.date}>{selectedDate}</Title>
          </Card.Content>
          
          <View style={styles.slotsContainer}>
            {availableSlots.map((slot, index) => (
              <List.Item
                key={index}
                title={slot}
                left={props => <List.Icon {...props} icon="clock-outline" />}
                right={props => (
                  <Button mode="contained" compact onPress={() => {}}>
                    Book
                  </Button>
                )}
                style={styles.slotItem}
              />
            ))}
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 10,
    elevation: 4,
  },
  date: {
    fontSize: 18,
    color: '#6200ee',
    marginTop: 5,
  },
  slotsContainer: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  slotItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
});
