// xlsx-converter.js — конвертация между JSON планом и Excel файлом
// Использует библиотеку SheetJS (XLSX)

// Маппинг: type code → русское название (для экспорта)
var DAY_TYPE_TO_LABEL = {
  'legs':    'Ноги + таз',
  'legs2':   'Ноги',
  'upper':   'Верх + кор',
  'upper2':  'Верх тела',
  'full':    'Полное тело',
  'cardio':  'Кардио',
  'stretch': 'Растяжка',
  'yoga':    'Йога',
  'wc':      'Вин Чун',
  'qi':      'Цигун',
  'rest':    'Отдых',
  'test':    'Отдых + тест',
};

// Маппинг: русское название → type code (для импорта)
var DAY_LABEL_TO_TYPE = {};
Object.keys(DAY_TYPE_TO_LABEL).forEach(function(k) {
  DAY_LABEL_TO_TYPE[DAY_TYPE_TO_LABEL[k]] = k;
});

var DAYS_ORDER = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

var COL_HEADERS = ['Название', 'Описание', 'Заметка', 'Ввод значения', 'Единица'];

// --- JSON → Excel ---

function jsonToExcel(plan, sectionName) {
  var wb = XLSX.utils.book_new();

  // Лист инструкции
  var infoData = [
    ['Spring Tracker — план тренировок: ' + (sectionName || '')],
    [''],
    ['КАК РЕДАКТИРОВАТЬ:'],
    ['1. Выбери лист нужного дня'],
    ['2. Измени тип дня в строке 1 (выбери из выпадающего списка)'],
    ['3. Редактируй упражнения начиная со строки 4'],
    ['4. Если нужно фиксировать результат — напиши "да" в колонке "Ввод значения"'],
    ['5. В колонке "Единица" напиши мин / сек / раз'],
    [''],
    ['Сохрани файл и загрузи обратно через кнопку "Загрузить план" в настройках'],
  ];
  var wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  wsInfo['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Инструкция');

  // Листы по дням
  DAYS_ORDER.forEach(function(dayName) {
    var dayData = plan.find(function(d) { return d.day === dayName; });
    var typeLabel = dayData ? (DAY_TYPE_TO_LABEL[dayData.type] || dayData.type) : '';
    var exercises = dayData ? (dayData.exercises || []) : [];

    var rows = [];

    // Строка 1: тип дня
    rows.push(['Тип дня', typeLabel, '', '', '']);

    // Строка 2: пустая
    rows.push(['', '', '', '', '']);

    // Строка 3: заголовки
    rows.push(COL_HEADERS);

    // Упражнения
    exercises.forEach(function(ex) {
      rows.push([
        ex.name || '',
        ex.desc || '',
        ex.note || '',
        ex.trackValue ? 'да' : '',
        ex.unit || '',
      ]);
    });

    // 9 пустых строк для добавления
    for (var i = 0; i < 9; i++) {
      rows.push(['', '', '', '', '']);
    }

    var ws = XLSX.utils.aoa_to_sheet(rows);

    // Ширина колонок
    ws['!cols'] = [
      { wch: 22 },
      { wch: 42 },
      { wch: 28 },
      { wch: 16 },
      { wch: 12 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, dayName);
  });

  // Генерируем файл и скачиваем
  var filename = (sectionName || 'plan') + '_plan.xlsx';
  XLSX.writeFile(wb, filename);
}
