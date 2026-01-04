const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000', 'http://localhost:19006'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const patientsRoutes = require('./routes/patients');
const doctorsRoutes = require('./routes/doctors');
const appointmentsRoutes = require('./routes/appointments');
const videoRoutes = require('./routes/video');
const symptomDiaryRoutes = require('./routes/symptom-diary');
const therapyNotesRoutes = require('./routes/therapy-notes');
const diagnosesRoutes = require('./routes/diagnoses');
const screeningsRoutes = require('./routes/screenings');
const crisisPlanRoutes = require('./routes/crisis-plan');
const medicationsRoutes = require('./routes/medications');
const exercisesRoutes = require('./routes/exercises');
const remindersRoutes = require('./routes/reminders');
const reportsRoutes = require('./routes/reports');
const waitingRoomRoutes = require('./routes/waiting-room');
const billingRoutes = require('./routes/billing');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/symptom-diary', symptomDiaryRoutes);
app.use('/api/therapy-notes', therapyNotesRoutes);
app.use('/api/diagnoses', diagnosesRoutes);
app.use('/api/screenings', screeningsRoutes);
app.use('/api/crisis-plan', crisisPlanRoutes);
app.use('/api/medications', medicationsRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/waiting-room', waitingRoomRoutes);
app.use('/api/billing', billingRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Socket.IO for video calls
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });

  socket.on('offer', (data) => {
    socket.to(data.room).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.room).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.room).emit('ice-candidate', data);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
