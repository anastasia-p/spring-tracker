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

// --- JSON → Excel ---
// Скачивает шаблон с GitHub, заполняет данными плана, сохраняет

function jsonToExcel(plan, sectionName) {
  var baseUrl = location.origin + location.pathname.replace('index.html', '');
  var templateUrl = baseUrl + 'plans/' + sectionName + '_template.xlsx?v=' + Date.now();

  fetch(templateUrl)
    .then(function(r) {
      if (!r.ok) throw new Error('Шаблон не найден: ' + templateUrl);
      return r.arrayBuffer();
    })
    .then(function(buffer) {
      var wb = XLSX.read(buffer, { type: 'array', cellStyles: true });

      DAYS_ORDER.forEach(function(dayName) {
        var ws = wb.Sheets[dayName];
        if (!ws) return;

        var dayData = plan.find(function(d) { return d.day === dayName; });
        if (!dayData) return;

        // B1 — тип дня
        ws['B1'] = ws['B1'] || {};
        ws['B1'].v = DAY_TYPE_TO_LABEL[dayData.type] || dayData.type;
        ws['B1'].t = 's';

        // Упражнения начиная со строки 4
        var exercises = dayData.exercises || [];
        var range = XLSX.utils.decode_range(ws['!ref'] || 'A1:E20');

        exercises.forEach(function(ex, i) {
          var row = 4 + i; // 1-indexed
          var rowData = [
            ex.name || '',
            ex.desc || '',
            ex.note || '',
            ex.trackValue ? 'да' : '',
            ex.unit || '',
          ];
          rowData.forEach(function(val, colIdx) {
            var cellAddr = XLSX.utils.encode_cell({ r: row - 1, c: colIdx });
            ws[cellAddr] = ws[cellAddr] || {};
            ws[cellAddr].v = val;
            ws[cellAddr].t = 's';
          });
          if (row - 1 > range.e.r) range.e.r = row - 1;
        });

        ws['!ref'] = XLSX.utils.encode_range(range);
      });

      var filename = sectionName + '_plan.xlsx';
      XLSX.writeFile(wb, filename);
    })
    .catch(function(e) {
      alert('Ошибка при создании файла: ' + e.message);
    });
}

