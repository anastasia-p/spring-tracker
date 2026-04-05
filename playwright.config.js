// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tools/tests',
  timeout: 15000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tools/tests/report' }]],
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:8080',
    headless: true,
  },
});
