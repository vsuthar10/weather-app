const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const errorMsg = document.getElementById("errorMsg");
const weatherResult = document.getElementById("weatherResult");
const forecastResult = document.getElementById("forecastResult");
const hourlyResult = document.getElementById("hourlyResult");
const cityTime = document.getElementById("cityTime");
const climateResult = document.getElementById("climateResult");
const climateMonths = document.getElementById("climateMonths");

let clockIntervalId = null;

const RENDER_API = "https://weather-app-backend-iye5.onrender.com";
const sameOriginAsBackend =
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname) ||
  window.location.hostname.endsWith(".onrender.com");
const API_BASE = sameOriginAsBackend ? "" : RENDER_API;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

searchBtn.addEventListener("click", getWeather);
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getWeather();
});

async function getWeather() {
  const city = cityInput.value.trim();
  if (!city) return;

  const weatherUrl = `${API_BASE}/api/weather?city=${city}`;
  const forecastUrl = `${API_BASE}/api/forecast?city=${city}`;

  try {
    const [weatherRes, forecastRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(forecastUrl),
    ]);

    if (!weatherRes.ok || !forecastRes.ok) {
      throw new Error("City not found");
    }

    const weatherData = await weatherRes.json();
    const forecastData = await forecastRes.json();

    displayWeather(weatherData);
    displayHourly(forecastData);
    displayForecast(forecastData);
  } catch (err) {
    showError(err.message);
    return;
  }

  loadClimate(city);
}

async function loadClimate(city) {
  try {
    const climateRes = await fetch(`${API_BASE}/api/climate?city=${city}`);
    if (!climateRes.ok) {
      throw new Error("Climate data unavailable");
    }
    const climateData = await climateRes.json();
    displayClimate(climateData);
  } catch (err) {
    climateResult.classList.add("hidden");
  }
}

function displayWeather(data) {
  errorMsg.classList.add("hidden");
  weatherResult.classList.remove("hidden");

  document.getElementById("cityName").textContent = `${data.name}, ${data.sys.country}`;
  document.getElementById("description").textContent = data.weather[0].description;
  document.getElementById("temperature").textContent = `${Math.round(data.main.temp)}°C`;
  document.getElementById("feelsLike").textContent = `${Math.round(data.main.feels_like)}°C`;
  document.getElementById("humidity").textContent = `${data.main.humidity}%`;
  document.getElementById("windSpeed").textContent = `${data.wind.speed} m/s`;
  document.getElementById("pressure").textContent = `${data.main.pressure} hPa`;

  startCityClock(data.timezone);
}

function startCityClock(tzOffsetSeconds) {
  clearInterval(clockIntervalId);

  function tick() {
    const localTime = new Date(Date.now() + tzOffsetSeconds * 1000);
    cityTime.textContent = localTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
  }

  tick();
  clockIntervalId = setInterval(tick, 1000);
}

function displayHourly(data) {
  const upcoming = data.list.slice(0, 2);
  const tzOffset = data.city.timezone;

  hourlyResult.innerHTML = "";
  hourlyResult.classList.remove("hidden");

  for (const item of upcoming) {
    const localTime = new Date((item.dt + tzOffset) * 1000);
    const timeLabel = localTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      hour12: true,
      timeZone: "UTC",
    });

    const slot = document.createElement("div");
    slot.className = "hourly-slot";
    slot.innerHTML = `
      <span class="hourly-time">${timeLabel}</span>
      <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" alt="${item.weather[0].description}">
      <span class="hourly-temp">${Math.round(item.main.temp)}°</span>
    `;

    hourlyResult.appendChild(slot);
  }
}

function groupForecastByDay(list) {
  const days = [];
  const byDate = {};

  for (const item of list) {
    const date = item.dt_txt.split(" ")[0];
    if (!byDate[date]) {
      byDate[date] = { date, temps: [], midday: null };
      days.push(byDate[date]);
    }
    byDate[date].temps.push(item.main.temp);

    const hour = item.dt_txt.split(" ")[1];
    if (hour === "12:00:00" || !byDate[date].midday) {
      byDate[date].midday = item;
    }
  }

  return days.slice(0, 5).map((day) => ({
    date: day.date,
    minTemp: Math.round(Math.min(...day.temps)),
    maxTemp: Math.round(Math.max(...day.temps)),
    icon: day.midday.weather[0].icon,
    description: day.midday.weather[0].description,
  }));
}

function displayForecast(data) {
  const days = groupForecastByDay(data.list);

  forecastResult.innerHTML = "";
  forecastResult.classList.remove("hidden");

  for (const day of days) {
    const card = document.createElement("div");
    card.className = "forecast-day";

    const dayName = new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

    card.innerHTML = `
      <span class="forecast-day-name">${dayName}</span>
      <img src="https://openweathermap.org/img/wn/${day.icon}@2x.png" alt="${day.description}">
      <span class="forecast-temps"><strong>${day.maxTemp}°</strong> / ${day.minTemp}°</span>
    `;

    forecastResult.appendChild(card);
  }
}

function groupClimateByMonth(data) {
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum } = data.daily;

  const now = new Date();
  const targetMonths = [1, 2, 3].map((offset) => (now.getMonth() + offset) % 12);

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return targetMonths.map((monthIndex) => {
    const highs = [];
    const lows = [];
    let rainyDays = 0;
    let totalDays = 0;

    time.forEach((dateStr, i) => {
      const month = parseInt(dateStr.split("-")[1], 10) - 1;
      if (month === monthIndex) {
        highs.push(temperature_2m_max[i]);
        lows.push(temperature_2m_min[i]);
        totalDays++;
        if (precipitation_sum[i] > 1) rainyDays++;
      }
    });

    return {
      monthName: new Date(2020, monthIndex, 1).toLocaleDateString("en-US", { month: "long" }),
      avgHigh: Math.round(avg(highs)),
      avgLow: Math.round(avg(lows)),
      rainChance: Math.round((rainyDays / totalDays) * 100),
    };
  });
}

function displayClimate(data) {
  const months = groupClimateByMonth(data);

  climateMonths.innerHTML = "";
  climateResult.classList.remove("hidden");

  for (const month of months) {
    const card = document.createElement("div");
    card.className = "climate-month";

    card.innerHTML = `
      <span class="climate-month-name">${month.monthName}</span>
      <span class="climate-temps"><strong>${month.avgHigh}°</strong> / ${month.avgLow}°</span>
      <span class="climate-rain">${month.rainChance}% rain</span>
    `;

    climateMonths.appendChild(card);
  }
}

function showError(message) {
  clearInterval(clockIntervalId);
  weatherResult.classList.add("hidden");
  hourlyResult.classList.add("hidden");
  forecastResult.classList.add("hidden");
  climateResult.classList.add("hidden");
  errorMsg.classList.remove("hidden");
  errorMsg.textContent = message;
}