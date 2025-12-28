# Setup Guide

This guide will help you set up the Abu Abad patient management system on your local machine or server.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (usually comes with Node.js)
- **Docker** and **Docker Compose** (for containerized deployment)
- **Git** (for cloning the repository)

### Optional (for mobile development)
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)

## Installation Methods

### Method 1: Docker (Recommended for Production)

This is the easiest way to get started with all services running.

1. **Clone the repository:**
```bash
git clone https://github.com/DiggAiHH/abu-abad.git
cd abu-abad
```

2. **Start all services:**
```bash
docker compose up -d
```

This will:
- Build and start the backend API on port 5000
- Build and start the frontend web app on port 3000
- Set up a Docker network for communication between services

3. **Verify services are running:**
```bash
docker compose ps
```

4. **Access the applications:**
- Backend API: http://localhost:5000
- Frontend Web: http://localhost:3000

5. **View logs:**
```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only
docker compose logs -f frontend
```

6. **Stop services:**
```bash
docker compose down
```

### Method 2: Local Development

This method is better for development as it provides hot-reloading and easier debugging.

#### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
cp .env.example .env
```

4. **Edit .env file (optional):**
```bash
# Open .env in your editor and modify if needed
nano .env
```

5. **Start the backend:**
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The backend will be available at http://localhost:5000

#### Frontend Web Setup

1. **Open a new terminal and navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the frontend:**
```bash
npm start
```

The frontend will be available at http://localhost:3000

#### Mobile App Setup

1. **Open a new terminal and navigate to mobile directory:**
```bash
cd mobile
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start Expo:**
```bash
npm start
```

This will open Expo DevTools in your browser. From there you can:
- Press `a` to open in Android emulator
- Press `i` to open in iOS simulator
- Scan the QR code with Expo Go app on your physical device

## Testing the Backend

We provide a test script to verify all backend endpoints are working correctly.

1. **Ensure the backend is running** (either via Docker or locally)

2. **Run the test script:**
```bash
./test-api.sh
```

This will test:
- Health check endpoint
- User registration
- User login
- Patient creation
- Appointment creation
- Available time slots
- Video room creation

## Configuration

### Backend Configuration

Edit `backend/.env`:

```env
PORT=5000                                    # Backend port
JWT_SECRET=your-secret-key-here             # Change in production!
NODE_ENV=development                         # development or production
```

### Frontend Configuration

Create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

For production, change to your actual backend URL.

### Mobile Configuration

Edit `mobile/.env` or `mobile/app.json`:

```env
EXPO_PUBLIC_API_URL=http://your-server-ip:5000/api
```

**Note:** For mobile development, you need to use your computer's IP address (not localhost) so the mobile device can access the backend. Find your IP with:

```bash
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

## Development Workflow

### Working on Backend

1. Make changes to files in `backend/`
2. If using `npm run dev`, changes will auto-reload
3. Test endpoints using curl, Postman, or the test script
4. Check logs for errors

### Working on Frontend

1. Make changes to files in `frontend/src/`
2. Changes will auto-reload in the browser
3. Check browser console for errors

### Working on Mobile

1. Make changes to files in `mobile/src/`
2. Save files and Expo will auto-reload
3. Shake device to open developer menu
4. Check console in Expo DevTools for errors

## Common Issues

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find and kill process on port 5000 (backend)
lsof -ti:5000 | xargs kill -9

# Find and kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Docker Build Fails

```bash
# Clean up Docker resources
docker compose down -v
docker system prune -a

# Rebuild
docker compose up -d --build
```

### Mobile Can't Connect to Backend

1. Make sure you're using your computer's IP address, not localhost
2. Check firewall settings
3. Ensure backend is accessible: `curl http://your-ip:5000/health`

### Module Not Found Errors

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Production Deployment

### Security Checklist

Before deploying to production:

1. ✅ Change JWT_SECRET to a strong random string
2. ✅ Set NODE_ENV=production
3. ✅ Use HTTPS for all connections
4. ✅ Set up proper CORS configuration
5. ✅ Add rate limiting
6. ✅ Set up database instead of in-memory storage
7. ✅ Configure proper logging
8. ✅ Set up monitoring and alerts
9. ✅ Regular security updates
10. ✅ Backup strategy

### Environment Variables for Production

```env
# Backend
PORT=5000
JWT_SECRET=your-very-strong-secret-key-at-least-32-chars
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/database

# Frontend
REACT_APP_API_URL=https://your-domain.com/api

# Mobile
EXPO_PUBLIC_API_URL=https://your-domain.com/api
```

### Database Setup

The current implementation uses in-memory storage. For production, you should:

1. Choose a database (PostgreSQL, MongoDB, MySQL)
2. Install appropriate npm packages (pg, mongoose, mysql2)
3. Update models to use database
4. Add database connection to server.js
5. Run migrations if needed

## Next Steps

1. **Customize the Application**: Modify colors, logos, and branding
2. **Add Database**: Replace in-memory storage with a real database
3. **Implement Real WebRTC**: Complete video call implementation
4. **Add Tests**: Write unit and integration tests
5. **Deploy**: Deploy to your production environment
6. **Monitor**: Set up logging and monitoring

## Support

For issues or questions:
1. Check the [API Documentation](./API_DOCS.md)
2. Review the [README](./README.md)
3. Open an issue on GitHub

## License

ISC License - See LICENSE file for details
