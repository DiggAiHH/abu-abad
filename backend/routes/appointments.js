const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage
const appointments = [];
const timeSlots = [];

// Get all appointments
// NOTE: In production, this endpoint should be protected with authenticateToken middleware
// and filter results based on the authenticated user's ID and role.
// Query parameters are used for filtering, which is acceptable for non-sensitive operations
// when combined with proper authentication.
router.get('/', (req, res) => {
  const { doctorId, patientId, date } = req.query;
  let filtered = appointments;

  if (doctorId) {
    filtered = filtered.filter(a => a.doctorId === doctorId);
  }
  if (patientId) {
    filtered = filtered.filter(a => a.patientId === patientId);
  }
  if (date) {
    filtered = filtered.filter(a => a.date === date);
  }

  res.json({ appointments: filtered });
});

// Get appointment by ID
router.get('/:id', (req, res) => {
  const appointment = appointments.find(a => a.id === req.params.id);
  if (!appointment) {
    return res.status(404).json({ message: 'Appointment not found' });
  }
  res.json({ appointment });
});

// Create appointment
router.post('/', (req, res) => {
  const { doctorId, patientId, date, startTime, endTime, type, notes } = req.body;
  
  // Check if slot is available - comprehensive conflict detection
  const conflict = appointments.find(a => 
    a.doctorId === doctorId && 
    a.date === date && 
    a.status !== 'cancelled' &&
    (
      // New appointment starts during existing appointment
      (startTime >= a.startTime && startTime < a.endTime) ||
      // New appointment ends during existing appointment
      (endTime > a.startTime && endTime <= a.endTime) ||
      // New appointment completely contains existing appointment
      (startTime <= a.startTime && endTime >= a.endTime)
    )
  );

  if (conflict) {
    return res.status(400).json({ message: 'Time slot is not available' });
  }

  const appointment = {
    id: uuidv4(),
    doctorId,
    patientId,
    date,
    startTime,
    endTime,
    type: type || 'consultation',
    status: 'scheduled',
    notes: notes || '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  appointments.push(appointment);
  res.status(201).json({ message: 'Appointment created successfully', appointment });
});

// Update appointment
router.put('/:id', (req, res) => {
  const index = appointments.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  appointments[index] = {
    ...appointments[index],
    ...req.body,
    updatedAt: new Date()
  };

  res.json({ message: 'Appointment updated successfully', appointment: appointments[index] });
});

// Delete appointment
router.delete('/:id', (req, res) => {
  const index = appointments.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  appointments.splice(index, 1);
  res.json({ message: 'Appointment deleted successfully' });
});

// Get available time slots for a doctor
router.get('/slots/:doctorId', (req, res) => {
  const { doctorId } = req.params;
  const { date } = req.query;

  // Default time slots (9 AM to 5 PM, 30-minute slots)
  const defaultSlots = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      defaultSlots.push(time);
    }
  }

  // Filter out booked slots
  const bookedSlots = appointments
    .filter(a => a.doctorId === doctorId && a.date === date)
    .map(a => a.startTime);

  const availableSlots = defaultSlots.filter(slot => !bookedSlots.includes(slot));

  res.json({ date, availableSlots });
});

module.exports = router;
