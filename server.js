/* ============================================
   AVORNI COFFEE POS — Local Dev Server / Production Runner
   ============================================ */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public')));

// Serverless Handler wrapper for Express local runner
function serverless(handlerPath) {
  return async (req, res) => {
    try {
      const handler = require(handlerPath);
      await handler(req, res);
    } catch (err) {
      console.error(`Error in serverless handler (${handlerPath}):`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  };
}

// Route mapping matching Vercel serverless function paths
app.all('/api/auth/login', serverless('./api/auth/login.js'));

app.all('/api/menu/available', serverless('./api/menu/available.js'));
app.all('/api/menu/category/:category', (req, res) => {
  req.query.category = req.params.category;
  return serverless('./api/menu/category/[category].js')(req, res);
});
app.all('/api/menu/:id', (req, res) => {
  req.query.id = req.params.id;
  return serverless('./api/menu/[id].js')(req, res);
});
app.all('/api/menu', serverless('./api/menu/index.js'));

app.all('/api/orders/active', serverless('./api/orders/active.js'));
app.all('/api/orders/today', serverless('./api/orders/today.js'));
app.all('/api/orders/:id/status', (req, res) => {
  req.query.id = req.params.id;
  return serverless('./api/orders/[id]/status.js')(req, res);
});
app.all('/api/orders/:id', (req, res) => {
  req.query.id = req.params.id;
  return serverless('./api/orders/[id].js')(req, res);
});
app.all('/api/orders', serverless('./api/orders/index.js'));

app.all('/api/transactions/today', serverless('./api/transactions/today.js'));
app.all('/api/transactions/summary', serverless('./api/transactions/summary.js'));
app.all('/api/transactions/chart', serverless('./api/transactions/chart.js'));
app.all('/api/transactions/pay', serverless('./api/transactions/pay.js'));
app.all('/api/transactions', serverless('./api/transactions/index.js'));

app.all('/api/users/:id', (req, res) => {
  req.query.id = req.params.id;
  return serverless('./api/users/[id].js')(req, res);
});
app.all('/api/users', serverless('./api/users/index.js'));

app.all('/api/lapak/report', serverless('./api/lapak/report.js'));
app.all('/api/lapak/:id', (req, res) => {
  req.query.id = req.params.id;
  return serverless('./api/lapak/[id].js')(req, res);
});
app.all('/api/lapak', serverless('./api/lapak/index.js'));

app.all('/api/events', serverless('./api/events.js'));

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`\n  ☕ Avorni Coffee POS Server`);
    console.log(`  🚀 Running at http://localhost:${PORT}`);
    console.log(`  📂 Serverless API routes active\n`);
  });
}

module.exports = app;
