// Error tracking — Better Stack (Sentry SDK-compatible)
// DSN берется из window.SENTRY_DSN (проставляется ниже) чтобы не дублировать в коде
Sentry.init({
  dsn: "https://R7JSGwhtXdp9GFas1ovrFhQS@s2391221.eu-fsn-3.betterstackdata.com/2391221",
  tracesSampleRate: 0, // performance monitoring отключен — экономим квоту
  beforeSend: function(event) {
    // Не отправляем ошибки с localhost
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
    return event;
  }
});
