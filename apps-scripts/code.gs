const APP_CONFIG = Object.freeze({
  appName: 'Gobinath Family Expense',
  spreadsheetId: 'https://script.google.com/macros/s/AKfycbwKFk7CfOfJ6kr2tOczkmqZtZvphj2GfAJWl3C-c-Qred37TxlvYV_owLZBSiSTuxVncg/exec',
  sheets: {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    categories: 'Categories',
    settlement: 'Settlement'
  },
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  maxRecentTransactions: 100,
  sessionHours: 10 // 10-hour login session limit
});

function getConfig_() {
  return APP_CONFIG;
}
