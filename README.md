# Abu Abad - Neurologist Patient Management System

A comprehensive telemedicine and patient management platform for neurologists and their patients, featuring video calls, appointment scheduling, and calendar management.

## Features

- 🏥 **Patient Management**: Complete patient records and profile management
- 👨‍⚕️ **Doctor Profiles**: Specialized neurologist profiles with credentials
- 📅 **Appointment Scheduling**: Smart calendar with time slot management
- 📞 **Video Calls**: Integrated WebRTC-based video consultation
- 🔐 **Authentication**: Secure JWT-based authentication system
- 📱 **Mobile App**: React Native mobile application
- 💻 **Web Portal**: React-based web interface
- 🐳 **Docker Support**: Full Docker containerization for easy deployment

## Architecture

The application consists of three main components:

1. **Backend API** (Node.js/Express)
   - RESTful API for all operations
   - Socket.IO for real-time video call signaling
   - JWT authentication
   - In-memory data storage (can be replaced with database)

2. **Frontend Web** (React)
   - Material-UI components
   - Responsive dashboard
   - Video call interface
   - Calendar and scheduling

3. **Mobile App** (React Native/Expo)
   - Native mobile experience
   - Video call support
   - Push notifications ready
   - Cross-platform (iOS/Android)

## Prerequisites

- Node.js 18+ (for local development)
- Docker and Docker Compose (for containerized deployment)
- npm or yarn

## Quick Start with Docker

1. Clone the repository:
```bash
git clone https://github.com/DiggAiHH/abu-abad.git
cd abu-abad
```

2. Start all services with Docker Compose:
```bash
docker-compose up -d
```

3. Access the applications:
   - Backend API: http://localhost:5000
   - Frontend Web: http://localhost:3000

## Local Development Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

The backend will run on http://localhost:5000

### Frontend

```bash
cd frontend
npm install
npm start
```

The frontend will run on http://localhost:3000

### Mobile App

```bash
cd mobile
npm install
npm start
```

This will start Expo DevTools. You can then:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR code with Expo Go app on your phone

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Patients
- `GET /api/patients` - Get all patients
- `GET /api/patients/:id` - Get patient by ID
- `POST /api/patients` - Create new patient
- `PUT /api/patients/:id` - Update patient
- `DELETE /api/patients/:id` - Delete patient

### Doctors
- `GET /api/doctors` - Get all doctors
- `GET /api/doctors/:id` - Get doctor by ID
- `POST /api/doctors` - Create new doctor
- `PUT /api/doctors/:id` - Update doctor
- `DELETE /api/doctors/:id` - Delete doctor

### Appointments
- `GET /api/appointments` - Get all appointments (supports filters)
- `GET /api/appointments/:id` - Get appointment by ID
- `GET /api/appointments/slots/:doctorId` - Get available time slots
- `POST /api/appointments` - Create new appointment
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Delete appointment

### Video Calls
- `POST /api/video/create-room` - Create video call room
- `GET /api/video/room/:roomId` - Get room details
- `POST /api/video/end-call/:roomId` - End video call

## Environment Variables

### Backend (.env)
```
PORT=5000
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### Frontend
```
REACT_APP_API_URL=http://localhost:5000/api
```

### Mobile
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

## Docker Configuration

The `docker-compose.yml` file orchestrates two services:
- **backend**: Node.js API server
- **frontend**: React web application

To rebuild containers after code changes:
```bash
docker-compose up -d --build
```

To stop all services:
```bash
docker-compose down
```

To view logs:
```bash
docker-compose logs -f
```

## Technology Stack

### Backend
- Node.js & Express.js
- Socket.IO (WebRTC signaling)
- JWT for authentication
- bcryptjs for password hashing

### Frontend Web
- React 18
- Material-UI
- React Router
- Axios
- Socket.IO Client

### Mobile
- React Native
- Expo
- React Navigation
- React Native Paper
- React Native Calendars
- Socket.IO Client

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Configurable CORS (not wildcard in production)
- Environment variable management
- Secure video call room generation
- Authentication middleware available (backend/middleware/auth.js)

**Important Security Notes:**
- The current implementation uses in-memory storage for demonstration
- Before production deployment:
  - Enable authentication middleware on all protected routes
  - Use HTTPS/SSL certificates
  - Implement rate limiting
  - Add request validation
  - Set up proper logging and monitoring
  - Use a real database with proper access controls
  - Review and update CORS configuration for production domains

## Future Enhancements

- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] File upload for medical records
- [ ] Email notifications
- [ ] SMS reminders
- [ ] Advanced reporting and analytics
- [ ] Multi-language support
- [ ] Payment integration
- [ ] Medical prescription management
- [ ] Chat functionality

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, please open an issue in the GitHub repository.

## Acknowledgments

- Built for neurologists and their patients
- Designed to facilitate remote consultations
- Focus on ease of use and accessibility
