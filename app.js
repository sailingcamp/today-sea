const DEFAULT_LOCATION = {
  name: "葉山（E海面）",
  latitude: 35.2792,
  longitude: 139.5533
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
drawChart(
  "windSpeedChart",

  weather.nextHours.map(x => x.time),

  weather.nextHours.map(x => x.windSpeed),

  "風速",

  "#0ea5c6"
);

drawChart(
  "windDirectionChart",

  weather.nextHours.map(x => x.time),

  weather.nextHours.map(x => x.windDirection),

  "風向",

  "#f59e0b"
);

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
    current: "temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,wind_speed_10m,wind_direction_10m",
    daily: "sunrise,sunset",
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
  windGust: round(data.current.wind_gusts_10m),
  windDirection: data.current.wind_direction_10m,
  sunrise: formatTime(data.daily.sunrise[0]),
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
document.getElementById("windSpeed").textContent =
  `${valueOrDash(weather.windSpeed)} / ${valueOrDash(weather.windGust)}`;
document.getElementById("windDirection").textContent =
  degreeToDirection(weather.windDirection);
document.getElementById("windDirectionText").textContent =
  `${weather.windDirection}°`;
  document.getElementById("temperature").textContent = valueOrDash(weather.temperature);
  document.getElementById("waveHeight").textContent = valueOrDash(marine.waveHeight);
  document.getElementById("sunset").textContent = weather.sunset || "--:--";
const daylight =
  getDaylightStatus(
    weather.sunrise,
    weather.sunset
  );

document.getElementById("sunsetCountdown").textContent =
  daylight.detail;

document.getElementById("sunset").textContent =
  daylight.title;
  document.getElementById("tideName").textContent = "中潮";

  renderSeaScore(weather, marine);
}

function renderSeaScore(weather, marine) {
  const result = calculateSeaScore(weather, marine);

  document.getElementById("seaScore").textContent = result.score;
  document.getElementById("seaScoreText").textContent = result.label;
}

function calculateSeaScore(weather, marine) {
  let score = 100;

  const wind = weather.windSpeed;
  const wave = marine.waveHeight;
  const temp = weather.temperature;

  if (wind === null || wind === undefined) {
    return {
      score: "--",
      label: "風データなし"
    };
  }

  if (wind < 2) {
    score -= 8;
  } else if (wind < 6) {
    score -= 0;
  } else if (wind < 9) {
    score -= 18;
  } else if (wind < 12) {
    score -= 38;
  } else {
    score -= 60;
  }

  if (wave !== null && wave !== undefined) {
    if (wave >= 1.5) {
      score -= 25;
    } else if (wave >= 1.0) {
      score -= 15;
    } else if (wave >= 0.6) {
      score -= 7;
    }
  }

  if (temp >= 32) {
    score -= 12;
  } else if (temp >= 30) {
    score -= 7;
  } else if (temp <= 8) {
    score -= 10;
  }

  const futureWinds = weather.nextHours.map(item => item.windSpeed).filter(v => v !== null);
  const maxFutureWind = Math.max(...futureWinds);
  const windIncrease = maxFutureWind - wind;

  if (windIncrease >= 4) {
    score -= 15;
  } else if (windIncrease >= 2.5) {
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label = "";

  if (score >= 85) {
    label = "初心者も活動しやすい";
  } else if (score >= 70) {
    label = "概ね良好";
  } else if (score >= 50) {
    label = "注意して活動";
  } else {
    label = "慎重に判断";
  }

  return {
    score,
    label
  };
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

  const futureWind = weather.nextHours.map(item => item.windSpeed).filter(v => v !== null);
  const maxFutureWind = Math.max(...futureWind);
  const minFutureWind = Math.min(...futureWind);
  const windChange = round(maxFutureWind - minFutureWind);

  const futureDirections = weather.nextHours.map(item => item.windDirection).filter(v => v !== null);
  const directionChange = calculateDirectionChange(futureDirections);

  let parts = [];

  if (wind < 3) {
    parts.push("現在の風は穏やかです。初心者でも海の様子を観察しながら活動しやすいコンディションです。");
  } else if (wind < 6) {
    parts.push("現在はほどよい風があります。セーリングの感覚を楽しみやすく、練習にも向いた状況です。");
  } else if (wind < 9) {
    parts.push("現在の風はやや強めです。初心者は無理をせず、指導者と一緒に出艇可否を判断しましょう。");
  } else {
    parts.push("現在の風は強めです。出艇する場合は、艇の種類、参加者の経験、現地の波を含めて慎重に判断してください。");
  }

  if (windChange >= 4) {
    parts.push("この先5時間で風速の変化が大きくなる可能性があります。出艇前だけでなく、帰着時の風も意識してください。");
  } else if (windChange >= 2) {
    parts.push("この先5時間で風が少し変化しそうです。活動中も風の上がり方を確認しましょう。");
  } else {
    parts.push("この先5時間の大きな風速変化は少なめです。ただし、風向の変化もあわせて確認しましょう。");
  }

  if (directionChange >= 60) {
    parts.push("風向の変化が大きめです。コース取りや帰着方向が変わる可能性があります。");
  } else if (directionChange >= 30) {
    parts.push("風向はやや変化しそうです。沖に出る前に、戻りやすい方向を確認しておくと安心です。");
  } else {
    parts.push("風向の変化は比較的小さめです。海面のブローや波の入り方を見ながら判断しましょう。");
  }

  if (wave !== null && wave !== undefined) {
    if (wave >= 1.5) {
      parts.push("波高が高めです。小型艇や初心者は、波の入り方を現地でよく確認してください。");
    } else if (wave >= 1.0) {
      parts.push("波はややあります。出艇場所や帰着場所で波が立ちやすくないか確認しましょう。");
    } else {
      parts.push("波高は比較的落ち着いています。ただし沿岸では実際の波の立ち方が変わることがあります。");
    }
  }

  if (temp >= 30) {
    parts.push("気温が高く、汗をかきやすい状況です。水分補給、帽子、休憩を意識しましょう。");
  } else if (temp <= 10) {
    parts.push("気温が低めです。濡れた後に体が冷えやすいため、防寒と着替えを準備しましょう。");
  }

  parts.push(`日没は${sunset}頃です。午後の活動では、片付けと帰着の時間に余裕を持つと安心です。`);

  return parts.join("");
}

function calculateDirectionChange(directions) {
  if (!directions || directions.length < 2) {
    return 0;
  }

  let maxChange = 0;

  for (let i = 1; i < directions.length; i++) {
    const diff = Math.abs(directions[i] - directions[i - 1]);
    const circularDiff = Math.min(diff, 360 - diff);

    if (circularDiff > maxChange) {
      maxChange = circularDiff;
    }
  }

  return Math.round(maxChange);
}

function getDaylightStatus(sunriseStr, sunsetStr) {

  const now = new Date();

  const [sunriseHour, sunriseMin] =
    sunriseStr.split(":").map(Number);

  const [sunsetHour, sunsetMin] =
    sunsetStr.split(":").map(Number);

  const sunrise = new Date();
  sunrise.setHours(sunriseHour, sunriseMin, 0, 0);

  const sunset = new Date();
  sunset.setHours(sunsetHour, sunsetMin, 0, 0);

  // 日の出前
  if (now < sunrise) {

    const diff =
      Math.floor((sunrise - now) / 60000);

    const h = Math.floor(diff / 60);
    const m = diff % 60;

    return {
      title: `日の出まで`,
      detail: `${h}時間${m}分`
    };
  }

  // 日中
  if (now < sunset) {

    const diff =
      Math.floor((sunset - now) / 60000);

    const h = Math.floor(diff / 60);
    const m = diff % 60;

    return {
      title: `活動可能`,
      detail: `あと${h}時間${m}分`
    };
  }

  // 日没後

  const diff =
    Math.floor((now - sunset) / 60000);

  const h = Math.floor(diff / 60);
  const m = diff % 60;

  return {
    title: `夜間`,
    detail: `${h}時間${m}分経過`
  };
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

function drawChart(canvasId, labels, values, label, color) {

  const canvas = document.getElementById(canvasId);

  if (!canvas) return;

  new Chart(canvas, {

    type: "line",

    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: values,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3
      }]
    },

    options: {
      responsive: true,

      plugins: {
        legend: {
          display: false
        }
      },

      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
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
