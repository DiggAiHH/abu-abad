import api from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
};

export const patientService = {
  getAllPatients: async () => {
    const response = await api.get('/patients');
    return response.data;
  },

  getPatient: async (id) => {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  createPatient: async (patientData) => {
    const response = await api.post('/patients', patientData);
    return response.data;
  },

  updatePatient: async (id, patientData) => {
    const response = await api.put(`/patients/${id}`, patientData);
    return response.data;
  },

  deletePatient: async (id) => {
    const response = await api.delete(`/patients/${id}`);
    return response.data;
  },
};

export const appointmentService = {
  getAllAppointments: async (filters = {}) => {
    const response = await api.get('/appointments', { params: filters });
    return response.data;
  },

  getAppointment: async (id) => {
    const response = await api.get(`/appointments/${id}`);
    return response.data;
  },

  createAppointment: async (appointmentData) => {
    const response = await api.post('/appointments', appointmentData);
    return response.data;
  },

  updateAppointment: async (id, appointmentData) => {
    const response = await api.put(`/appointments/${id}`, appointmentData);
    return response.data;
  },

  deleteAppointment: async (id) => {
    const response = await api.delete(`/appointments/${id}`);
    return response.data;
  },

  getAvailableSlots: async (doctorId, date) => {
    const response = await api.get(`/appointments/slots/${doctorId}`, {
      params: { date },
    });
    return response.data;
  },
};

export const videoService = {
  createRoom: async (appointmentId, doctorId, patientId) => {
    const response = await api.post('/video/create-room', {
      appointmentId,
      doctorId,
      patientId,
    });
    return response.data;
  },

  getRoom: async (roomId) => {
    const response = await api.get(`/video/room/${roomId}`);
    return response.data;
  },

  endCall: async (roomId) => {
    const response = await api.post(`/video/end-call/${roomId}`);
    return response.data;
  },
};
