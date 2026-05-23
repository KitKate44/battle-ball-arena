const express = require('express');
const path = require('path');

const app = express();
const balls = require('./data/balls');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/balls', (req, res) => {
  res.json(balls);
});

app.post('/api/game/result', (req, res) => {
  const { winnerId, loserId, duration, playerDamage } = req.body;
  console.log(`[Battle] ${winnerId} defeated ${loserId} in ${Math.round(duration)}s (${Math.round(playerDamage)} dmg dealt)`);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Battle Ball Arena running at http://localhost:${PORT}`);
});
