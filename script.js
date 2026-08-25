const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const errorMsg = document.getElementById("errorMsg");
const weatherResult = document.getElementById("weatherResult");

searchBtn.addEventListener("click", getWeather);
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getWeather();
});

async function getWeather() {
  const city = cityInput.value.trim();
  if (!city) return;

  const url = `http://localhost:3000/api/weather?city=${city}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("City not found");
    }
    const data = await response.json();
    displayWeather(data);
  } catch (err) {
    showError(err.message);
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
}

function showError(message) {
  weatherResult.classList.add("hidden");
  errorMsg.classList.remove("hidden");
  errorMsg.textContent = message;
}