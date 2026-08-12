const DEFAULT_LOCATION = {
  name: "葉山",
  latitude: 35.2842,
  longitude: 139.5658
};

document.addEventListener("DOMContentLoaded", () => {
  updateTime();

  document.getElementById("gpsButton").addEventListener("click", loadWithGps);
  document.getElementById("hayamaButton").addEventListener("click", () => {
    loadSeaData(DEFAULT_LOCATION);
  });

  loadSeaData(DEFAULT_LOCATION);
});

function updateTime() {
  const now = new Date();

  document.getElementById("currentTime").textContent =
    now.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
}

function loadWithGps() {
  setStatus("現在地を確認しています");

  if (!navigator.geolocation) {
    setStatus("GPSが使えないため、葉山を表示します");
    loadSeaData(DEFAULT_LOCATION);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const location = {
        name: "現在地",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      loadSeaData(location);
    },
    () => {
      setStatus("位置情報が許可されなかったため、葉山を表示します");
      loadSeaData(DEFAULT_LOCATION);
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 600000
    }
  );
}

async function loadSeaData(location) {
  try {
    setStatus("データを取得しています");
    document.getElementById("placeName").textContent = location.name;

    const weather = await fetchWeather(location.latitude, location.longitude);
    const marine = await fetchMarine(location.latitude, location.longitude);

    renderCurrent(weather, marine);
    renderMemo(weather, marine);
    drawLineChart("windSpeedChart", weather.nextHours, "windSpeed", "m/s");
    drawLineChart("windDirectionChart", weather.nextHours, "windDirection", "°");

    setStatus("更新しました");
  } catch (error) {
    console.error(error);
    setStatus("データを取得できませんでした");
    document.getElementById("memoText").textContent =
      "データを取得できませんでした。現地の空、風、波の様子を確認し、安全を最優先に判断してください。";
  }
}

async function fetchWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    current: "temperature_2m,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,wind_speed_10m,wind_direction_10m",
    daily: "sunset",
    timezone: "Asia/Tokyo",
    forecast_days: "1",
    wind_speed_unit: "ms"
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Weather API error");
  }

  const data = await response.json();

  const currentTime = data.current.time;
  const currentIndex = findCurrentIndex(data.hourly.time, currentTime);
  const nextHours = buildNextHours(data.hourly, currentIndex, 5);

  return {
    temperature: round(data.current.temperature_2m),
    windSpeed: round(data.current.wind_speed_10m),
    windDirection: data.current.wind_direction_10m,
    sunset: formatTime(data.daily.sunset[0]),
    nextHours: nextHours
  };
}

async function fetchMarine(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    hourly: "wave_height",
    timezone: "Asia/Tokyo",
    forecast_days: "1"
  });

  const url = `https://marine-api.open-meteo.com/v1/marine?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    return {
      waveHeight: null
    };
  }

  const data = await response.json();

  const now = new Date();
  const index = findCurrentIndexByDate(data.hourly.time, now);

  return {
    waveHeight: round(data.hourly.wave_height[index])
  };
}

function renderCurrent(weather, marine) {
  document.getElementById("windSpeed").textContent = valueOrDash(weather.windSpeed);
  document.getElementById("windDirection").textContent = valueOrDash(weather.windDirection);
  document.getElementById("windDirectionText").textContent =
    `${degreeToDirection(weather.windDirection)} / ${weather.windDirection}°`;
  document.getElementById("temperature").textContent = valueOrDash(weather.temperature);
  document.getElementById("waveHeight").textContent = valueOrDash(marine.waveHeight);
  document.getElementById("sunset").textContent = weather.sunset || "--:--";

  document.getElementById("tideName").textContent = "中潮";

  renderSeaScore(weather, marine);
}

function renderMemo(weather, marine) {
  const memo = createUmiikuMemo(weather, marine);
  document.getElementById("memoText").textContent = memo;
}

function createUmiikuMemo(weather, marine) {
  const wind = weather.windSpeed;
  const temp = weather.temperature;
  const wave = marine.waveHeight;
  const sunset = weather.sunset;

  const futureWind = weather.nextHours.map(item => item.windSpeed);
  const maxFutureWind = Math.max(...futureWind);
  const windChange = round(maxFutureWind - wind);

  let parts = [];

  if (wind < 3) {
    parts.push("今の風は穏やかで、海の変化を落ち着いて観察しやすい状況です。");
  } else if (wind < 6) {
    parts.push("ほどよい風があり、セーリングらしい感覚を楽しみやすいコンディションです。");
  } else if (wind < 9) {
    parts.push("風はやや強めです。初心者は無理をせず、指導者と一緒に判断しましょう。");
  } else {
    parts.push("風が強いため、出艇は慎重に判断してください。安全を最優先にしましょう。");
  }

  if (windChange >= 3) {
    parts.push("この先5時間で風が強まる可能性があります。早めの帰着も含めて計画しましょう。");
  } else {
    parts.push("この先5時間の大きな風速変化は少なめです。ただし風向の変化も見て判断しましょう。");
  }

  if (wave !== null && wave >= 1) {
    parts.push("波もややあります。小さな艇や初心者は、波の入り方を現地で確認してください。");
  } else if (wave !== null) {
    parts.push("波高は比較的落ち着いていますが、沿岸では実際の波の立ち方も確認しましょう。");
  }

  if (temp >= 30) {
    parts.push("気温が高いため、汗をかきやすい状況です。水分補給と休憩を意識してください。");
  }

  parts.push(`日没は${sunset}頃です。午後の活動は、帰着時間に余裕を持つと安心です。`);

  return parts.join("");
}

function buildNextHours(hourly, startIndex, count) {
  const result = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;

    if (!hourly.time[index]) break;

    result.push({
      time: formatHour(hourly.time[index]),
      windSpeed: round(hourly.wind_speed_10m[index]),
      windDirection: hourly.wind_direction_10m[index],
      temperature: round(hourly.temperature_2m[index])
    });
  }

  return result;
}

function drawLineChart(canvasId, data, key, unit) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!data || data.length === 0) {
    return;
  }

  const padding = 42;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;

  const values = data.map(item => item[key]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#d6eef5";

  for (let i = 0; i <= 4; i++) {
    const y = padding + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#0ea5c6";
  ctx.lineWidth = 4;
  ctx.beginPath();

  data.forEach((item, index) => {
    const x = padding + (width / (data.length - 1 || 1)) * index;
    const y = padding + height - ((item[key] - min) / range) * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  ctx.fillStyle = "#06394a";
  ctx.font = "18px system-ui";

  data.forEach((item, index) => {
    const x = padding + (width / (data.length - 1 || 1)) * index;
    const y = padding + height - ((item[key] - min) / range) * height;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillText(String(item[key]), x - 12, y - 12);
    ctx.fillText(item.time, x - 20, canvas.height - 12);
  });

  ctx.fillStyle = "#55788a";
  ctx.font = "15px system-ui";
  ctx.fillText(unit, 8, 24);
}

function findCurrentIndex(times, currentTime) {
  if (!times || times.length === 0) return 0;

  const target = new Date(currentTime).getTime();
  let nearestIndex = 0;
  let nearestDiff = Infinity;

  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - target);

    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function findCurrentIndexByDate(times, date) {
  if (!times || times.length === 0) return 0;

  const target = date.getTime();
  let nearestIndex = 0;
  let nearestDiff = Infinity;

  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - target);

    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function degreeToDirection(degree) {
  if (degree === null || degree === undefined) return "--";

  const directions = [
    "北", "北北東", "北東", "東北東",
    "東", "東南東", "南東", "南南東",
    "南", "南南西", "南西", "西南西",
    "西", "西北西", "北西", "北北西"
  ];

  const index = Math.round(degree / 22.5) % 16;
  return directions[index];
}

function formatTime(value) {
  const date = new Date(value);

  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatHour(value) {
  const date = new Date(value);

  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit"
  });
}

function round(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return null;
  }

  return Math.round(Number(value) * 10) / 10;
}

function valueOrDash(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return value;
}

function setStatus(text) {
  document.getElementById("statusText").textContent = text;
}
