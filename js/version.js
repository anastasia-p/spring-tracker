// Авто-перезаписывается в CI на каждом деплое (шаг "Stamp version" в deploy.yml).
// Локально этот файл всегда содержит 'dev' / 'local' — это сигнал "не продакшн".
window.APP_VERSION = { sha: 'dev', date: 'local', branch: 'local' };
