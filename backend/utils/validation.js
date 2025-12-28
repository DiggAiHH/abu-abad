/**
 * Input validation utilities
 * Provides comprehensive validation for all input types
 */

const validateEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  if (!password) return false;
  // Minimum 6 characters
  return password.length >= 6;
};

const validateDate = (dateString) => {
  if (!dateString) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

const validateTime = (timeString) => {
  if (!timeString) return false;
  const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  return regex.test(timeString);
};

const validatePhone = (phone) => {
  if (!phone) return false;
  // Basic phone validation: allows + and digits
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone);
};

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  // Basic HTML entity encoding to prevent XSS
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

const validateUserRegistration = (data) => {
  const errors = [];
  
  if (!data.email || !validateEmail(data.email)) {
    errors.push('Invalid email format');
  }
  
  if (!data.password || !validatePassword(data.password)) {
    errors.push('Password must be at least 6 characters');
  }
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!data.role || !['doctor', 'patient'].includes(data.role)) {
    errors.push('Role must be either doctor or patient');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateAppointment = (data) => {
  const errors = [];
  
  if (!data.doctorId) {
    errors.push('Doctor ID is required');
  }
  
  if (!data.patientId) {
    errors.push('Patient ID is required');
  }
  
  if (!validateDate(data.date)) {
    errors.push('Invalid date format (YYYY-MM-DD required)');
  }
  
  if (!validateTime(data.startTime)) {
    errors.push('Invalid start time format (HH:MM required)');
  }
  
  if (!validateTime(data.endTime)) {
    errors.push('Invalid end time format (HH:MM required)');
  }
  
  // Check that end time is after start time
  if (data.startTime && data.endTime && data.startTime >= data.endTime) {
    errors.push('End time must be after start time');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validatePatient = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!data.email || !validateEmail(data.email)) {
    errors.push('Invalid email format');
  }
  
  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Invalid phone format');
  }
  
  if (data.dateOfBirth && !validateDate(data.dateOfBirth)) {
    errors.push('Invalid date of birth format (YYYY-MM-DD required)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateEmail,
  validatePassword,
  validateDate,
  validateTime,
  validatePhone,
  sanitizeString,
  validateUserRegistration,
  validateAppointment,
  validatePatient
};
