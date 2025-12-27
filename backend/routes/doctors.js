const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage
const doctors = [];

// Get all doctors
router.get('/', (req, res) => {
  res.json({ doctors });
});

// Get doctor by ID
router.get('/:id', (req, res) => {
  const doctor = doctors.find(d => d.id === req.params.id);
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor not found' });
  }
  res.json({ doctor });
});

// Create doctor
router.post('/', (req, res) => {
  const { name, email, phone, specialization, licenseNumber } = req.body;
  
  const doctor = {
    id: uuidv4(),
    name,
    email,
    phone,
    specialization,
    licenseNumber,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  doctors.push(doctor);
  res.status(201).json({ message: 'Doctor created successfully', doctor });
});

// Update doctor
router.put('/:id', (req, res) => {
  const index = doctors.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  doctors[index] = {
    ...doctors[index],
    ...req.body,
    updatedAt: new Date()
  };

  res.json({ message: 'Doctor updated successfully', doctor: doctors[index] });
});

// Delete doctor
router.delete('/:id', (req, res) => {
  const index = doctors.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  doctors.splice(index, 1);
  res.json({ message: 'Doctor deleted successfully' });
});

module.exports = router;
