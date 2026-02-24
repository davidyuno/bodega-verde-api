import 'dotenv/config';
import app from '../src/app.js';

const PORT = process.env.PORT || 3000;

// Only listen when not in Vercel (local dev)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`Bodega Verde API running on port ${PORT}`));
}

export default app;
