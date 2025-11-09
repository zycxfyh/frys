#!/usr/bin/env node

/**
 * 天气查询工具
 * 模拟天气查询功能，返回格式化的天气信息
 */

// 模拟天气数据
const weatherData = {
  北京: {
    temperature: 22,
    humidity: 45,
    windSpeed: 12,
    description: '晴朗',
    feelsLike: 24,
  },
  上海: {
    temperature: 25,
    humidity: 70,
    windSpeed: 8,
    description: '多云',
    feelsLike: 28,
  },
  广州: {
    temperature: 28,
    humidity: 80,
    windSpeed: 15,
    description: '阴天',
    feelsLike: 32,
  },
  深圳: {
    temperature: 27,
    humidity: 75,
    windSpeed: 10,
    description: '小雨',
    feelsLike: 30,
  },
  'New York': {
    temperature: 18,
    humidity: 60,
    windSpeed: 20,
    description: 'Clear',
    feelsLike: 16,
  },
  London: {
    temperature: 15,
    humidity: 85,
    windSpeed: 25,
    description: 'Cloudy',
    feelsLike: 13,
  },
  Tokyo: {
    temperature: 23,
    humidity: 65,
    windSpeed: 5,
    description: 'Sunny',
    feelsLike: 25,
  },
};

// 默认天气数据（用于未知城市）
const defaultWeather = {
  temperature: 20,
  humidity: 50,
  windSpeed: 10,
  description: '未知',
  feelsLike: 20,
};

function getWeatherData(city) {
  return weatherData[city] || { ...defaultWeather, city: city };
}

function formatWeatherSimple(city, weather) {
  return `${city}天气：${weather.description}，温度${weather.temperature}°C，体感${weather.feelsLike}°C`;
}

function formatWeatherDetailed(city, weather) {
  return `${city}详细天气信息：
🌡️ 温度：${weather.temperature}°C
🌡️ 体感温度：${weather.feelsLike}°C
💧 湿度：${weather.humidity}%
💨 风速：${weather.windSpeed}km/h
🌤️ 天气：${weather.description}`;
}

function queryWeather(city, format = 'simple') {
  try {
    const weather = getWeatherData(city);

    if (format === 'detailed') {
      return formatWeatherDetailed(city, weather);
    } else {
      return formatWeatherSimple(city, weather);
    }
  } catch (error) {
    return `查询天气失败：${error.message}`;
  }
}

function main() {
  // 从stdin读取输入
  let input = '';
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });

  process.stdin.on('end', () => {
    try {
      // 解析输入参数
      const params = JSON.parse(input.trim());

      // 验证必需参数
      if (!params.city) {
        const errorResult = {
          status: 'error',
          error: '缺少必需参数：city',
        };
        console.log(JSON.stringify(errorResult));
        process.exit(1);
      }

      // 执行天气查询
      const result = queryWeather(params.city, params.format);

      // 返回成功结果
      const successResult = {
        status: 'success',
        result: result,
        city: params.city,
        format: params.format || 'simple',
      };

      console.log(JSON.stringify(successResult));
      process.exit(0);
    } catch (error) {
      // 返回错误结果
      const errorResult = {
        status: 'error',
        error: `处理请求失败：${error.message}`,
      };

      console.log(JSON.stringify(errorResult));
      process.exit(1);
    }
  });

  // 设置超时
  setTimeout(() => {
    const timeoutResult = {
      status: 'error',
      error: '请求处理超时',
    };
    console.log(JSON.stringify(timeoutResult));
    process.exit(1);
  }, 8000); // 8秒超时
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { queryWeather, getWeatherData };
