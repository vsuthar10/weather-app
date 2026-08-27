require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.OPENWEATHER_API_KEY;

app.get('/api/weather', async (req, res) => {
  const city = req.query.city;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('City not found');
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/forecast', async (req, res) => {
  const city = req.query.city;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('City not found');
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/climate', async (req, res) => {
  const city = req.query.city;

  if (!city) {
    return res.status(400).json({ error: 'City is required' });
  }

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    const { latitude, longitude } = geoData.results[0];

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 5);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 5);
    const fmt = (d) => d.toISOString().split('T')[0];

    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

    const archiveRes = await fetch(archiveUrl);
    if (!archiveRes.ok) {
      throw new Error('Climate data unavailable');
    }
    const archiveData = await archiveRes.json();

    res.json(archiveData);
  } catch (err) {
    console.log("ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});