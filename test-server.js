// QUICK TEST SERVER - Minimal Express ohne Middleware
import express from 'express';

const app = express();
const PORT = 4000;

// Minimal middleware
app.use(express.json());

// Test routes
app.get('/health', (req, res) => {
  console.log('Health check received!');
  res.json({ status: 'OK', message: 'Test server running' });
});

app.get('/api/health', (req, res) => {
  console.log('API Health check received!');
  res.json({ status: 'OK', message: 'Test API server running' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Root endpoint works!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Test server listening on http://0.0.0.0:${PORT}`);
  console.log(`Try: curl http://localhost:${PORT}/health`);
});
