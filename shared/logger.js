const log = (level, message, data) => {
  const time = new Date().toISOString();
  if (data) {
    console.log(`[${time}] [${level}]`, message, data);
  } else {
    console.log(`[${time}] [${level}]`, message);
  }
};

module.exports = {
  info:  (message, data) => log('INFO ', message, data),
  warn:  (message, data) => log('WARN ', message, data),
  error: (message, data) => log('ERROR', message, data),
};