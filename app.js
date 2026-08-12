const DEFAULT_LOCATION = {
  name: "葉山",
  latitude: 35.2842,
  longitude: 139.5658
};

document.addEventListener("DOMContentLoaded", () => {
  updateTime();
  fetchWeather(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude);
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

async function fetchWeather(latitude, longitude) {
  try {
    const params = new URLSearchParams({
      latitude: latitude,
      longitude: longitude,
      current: "temperature_2m,wind_speed_10m,wind_direction_10m",
      daily: "sunset",
      timezone: "Asia/Tokyo",
      forecast_days: "1",
      wind_speed_unit: "ms"
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    const temp = data.current.temperature_2m;
    const windSpeed = data.current.wind_speed_10m;
    const windDirection = data.current.wind_direction_10m;
    const sunset = data.daily.sunset[0];

    document.getElementById("temperature").textContent = `${temp}℃`;
    document.getElementById("windSpeed").textContent = `${windSpeed}m/s`;
    document.getElementById("windDirection").textContent =
      `${degreeToDirection(windDirection)} ${windDirection}°`;
    document.getElementById("sunset").textContent = formatTime(sunset);

    document.getElementById("memoText").textContent =
      createMemo(temp, windSpeed, sunset);

  } catch (error) {
    console.error(error);
    document.getElementById("memoText").textContent =
      "データを取得できませんでした。現地の空、風、波の様子を確認してください。";
  }
}

function degreeToDirection(degree) {
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

function createMemo(temp, windSpeed, sunset) {
  if (windSpeed < 3) {
    return `風は穏やかで、初心者にも扱いやすいコンディションです。日没は${formatTime(sunset)}頃なので、午後の活動は帰着時間に余裕を持ちましょう。`;
  }

  if (windSpeed < 6) {
    return `ほどよい風があり、セーリングや海辺の活動を楽しみやすい状況です。気温は${temp}℃です。水分補給も意識しましょう。`;
  }

  if (windSpeed < 9) {
    return `やや風が強めです。初心者は指導者と一緒に、無理のない範囲で活動してください。日没時間も確認しておきましょう。`;
  }

  return `風が強いため、出艇は慎重な判断が必要です。現地の風、波、空模様を必ず確認し、安全を最優先にしてください。`;
}
