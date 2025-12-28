const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage for video sessions
const videoSessions = [];

// Create video call room
router.post('/create-room', (req, res) => {
  const { appointmentId, doctorId, patientId } = req.body;
  
  const roomId = uuidv4();
  const session = {
    roomId,
    appointmentId,
    doctorId,
    patientId,
    status: 'active',
    createdAt: new Date()
  };

  videoSessions.push(session);
  
  res.status(201).json({
    message: 'Video room created successfully',
    roomId,
    session
  });
});

// Get room details
router.get('/room/:roomId', (req, res) => {
  const session = videoSessions.find(s => s.roomId === req.params.roomId);
  if (!session) {
    return res.status(404).json({ message: 'Room not found' });
  }
  res.json({ session });
});

// End video call
router.post('/end-call/:roomId', (req, res) => {
  const index = videoSessions.findIndex(s => s.roomId === req.params.roomId);
  if (index === -1) {
    return res.status(404).json({ message: 'Room not found' });
  }

  videoSessions[index].status = 'ended';
  videoSessions[index].endedAt = new Date();

  res.json({ message: 'Call ended successfully' });
});

module.exports = router;
