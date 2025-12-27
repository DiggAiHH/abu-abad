const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage
const patients = [];

// Get all patients
router.get('/', (req, res) => {
  res.json({ patients });
});

// Get patient by ID
router.get('/:id', (req, res) => {
  const patient = patients.find(p => p.id === req.params.id);
  if (!patient) {
    return res.status(404).json({ message: 'Patient not found' });
  }
  res.json({ patient });
});

// Create patient
router.post('/', (req, res) => {
  const { name, email, phone, dateOfBirth, medicalHistory } = req.body;
  
  const patient = {
    id: uuidv4(),
    name,
    email,
    phone,
    dateOfBirth,
    medicalHistory: medicalHistory || '',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  patients.push(patient);
  res.status(201).json({ message: 'Patient created successfully', patient });
});

// Update patient
router.put('/:id', (req, res) => {
  const index = patients.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  patients[index] = {
    ...patients[index],
    ...req.body,
    updatedAt: new Date()
  };

  res.json({ message: 'Patient updated successfully', patient: patients[index] });
});

// Delete patient
router.delete('/:id', (req, res) => {
  const index = patients.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Patient not found' });
  }

  patients.splice(index, 1);
  res.json({ message: 'Patient deleted successfully' });
});

module.exports = router;
