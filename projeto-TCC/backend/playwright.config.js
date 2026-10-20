module.exports = {
 testDir: './browser-tests', timeout: 30000, workers: 1, fullyParallel: false,
 use: { baseURL: 'http://127.0.0.1:3018', headless: true,
  launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' },
  screenshot: 'only-on-failure', trace: 'retain-on-failure' },
 reporter: [['list']],
};
