// xlsx-converter.js — конвертация между JSON планом и Excel файлом
// Использует JSZip для прямой XML манипуляции (сохраняет data validation)

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

var DAY_LABEL_TO_TYPE = {};
Object.keys(DAY_TYPE_TO_LABEL).forEach(function(k) {
  DAY_LABEL_TO_TYPE[DAY_TYPE_TO_LABEL[k]] = k;
});

var DAYS_ORDER = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

// Экранирование для XML
function xmlEscape(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

// Построить XML строки упражнений для вставки в лист
// Строки 4+ (row index 3+), колонки A-E
function buildExerciseRowsXml(exercises, sharedStrings) {
  var rows = '';
  exercises.forEach(function(ex, i) {
    var rowNum = 4 + i;
    var vals = [
      ex.name || '',
      ex.desc || '',
      ex.note || '',
      ex.trackValue ? 'да' : '',
      ex.unit || '',
    ];
    var cells = '';
    ['A','B','C','D','E'].forEach(function(col, ci) {
      var v = xmlEscape(vals[ci]);
      if (v !== '') {
        cells += '<c r="' + col + rowNum + '" t="inlineStr"><is><t>' + v + '</t></is></c>';
      } else {
        cells += '<c r="' + col + rowNum + '"/>';
      }
    });
    rows += '<row r="' + rowNum + '">' + cells + '</row>';
  });
  return rows;
}

// Заменить данные на листе: тип дня (B1) и упражнения (строки 4+)
function patchSheetXml(sheetXml, typeLabel, exercises) {
  // 1. Заменяем значение B1
  sheetXml = sheetXml.replace(
    /(<c r="B1"[^>]*>).*?(<\/c>)/s,
    '$1<is><t>' + xmlEscape(typeLabel) + '</t></is>$2'
  );
  // Если B1 был t="s" (shared string) - заменяем на inlineStr
  sheetXml = sheetXml.replace(
    /<c r="B1" t="s"><v>\d+<\/v><\/c>/,
    '<c r="B1" t="inlineStr"><is><t>' + xmlEscape(typeLabel) + '</t></is></c>'
  );

  // 2. Убираем старые строки упражнений (строки 4 и дальше, до dataValidations)
  // Заменяем все <row r="N"> где N >= 4 до конца sheetData
  sheetXml = sheetXml.replace(
    /(<row r="[1-9]\d{1,}[^"]*"[^>]*>.*?<\/row>|<row r="[4-9]"[^>]*>.*?<\/row>)/gs,
    function(match) {
      var m = match.match(/r="(\d+)"/);
      if (m && parseInt(m[1]) >= 4) return '';
      return match;
    }
  );

  // 3. Вставляем новые строки упражнений перед </sheetData>
  var newRows = buildExerciseRowsXml(exercises);
  sheetXml = sheetXml.replace('</sheetData>', newRows + '</sheetData>');

  return sheetXml;
}

// --- Главная функция ---

function jsonToExcel(plan, sectionName) {
  var baseUrl = location.origin + location.pathname.replace('index.html', '');
  var templateUrl = baseUrl + 'plans/' + sectionName + '_template.xlsx?v=' + Date.now();

  fetch(templateUrl)
    .then(function(r) {
      if (!r.ok) throw new Error('Шаблон не найден');
      return r.arrayBuffer();
    })
    .then(function(buffer) {
      return JSZip.loadAsync(buffer);
    })
    .then(function(zip) {
      // Находим маппинг имён листов → файлов
      return zip.file('xl/workbook.xml').async('string').then(function(wbXml) {
        var sheetMap = {};
        var matches = wbXml.matchAll(/<sheet name="([^"]+)"[^>]+r:id="([^"]+)"/g);
        for (var m of matches) {
          sheetMap[m[1]] = m[2]; // name → rId
        }

        // Читаем relationships для маппинга rId → файл
        return zip.file('xl/_rels/workbook.xml.rels').async('string').then(function(relsXml) {
          var fileMap = {};
          var relMatches = relsXml.matchAll(/Id="([^"]+)"[^>]+Target="([^"]+)"/g);
          for (var r of relMatches) {
            fileMap[r[1]] = r[2]; // rId → target path
          }
          return { zip: zip, sheetMap: sheetMap, fileMap: fileMap };
        });
      });
    })
    .then(function(ctx) {
      var zip = ctx.zip;
      var promises = [];

      DAYS_ORDER.forEach(function(dayName) {
        var rId = ctx.sheetMap[dayName];
        if (!rId) return;
        var target = ctx.fileMap[rId];
        if (!target) return;
        var path = 'xl/' + target.replace('../', '');

        var dayData = plan.find(function(d) { return d.day === dayName; });
        if (!dayData) return;

        var typeLabel = DAY_TYPE_TO_LABEL[dayData.type] || dayData.type;
        var exercises = dayData.exercises || [];

        promises.push(
          zip.file(path).async('string').then(function(xml) {
            var patched = patchSheetXml(xml, typeLabel, exercises);
            zip.file(path, patched);
          })
        );
      });

      return Promise.all(promises).then(function() { return zip; });
    })
    .then(function(zip) {
      return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    })
    .then(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = sectionName + '_plan.xlsx';
      a.click();
      setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    })
    .catch(function(e) {
      alert('Ошибка при создании файла: ' + e.message);
      console.error(e);
    });
}


