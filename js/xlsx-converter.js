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
  // 1. Заменяем B1 — ищем тег с r="B1"
  sheetXml = sheetXml.replace(
    /<c r="B1"[^>]*>.*?<\/c>/s,
    '<c r="B1" t="inlineStr"><is><t>' + xmlEscape(typeLabel) + '</t></is></c>'
  );

  // 2. Удаляем все строки начиная с row 4
  sheetXml = sheetXml.replace(/<row r="(\d+)"[^>]*>.*?<\/row>/gs, function(match, rowNum) {
    return parseInt(rowNum) >= 4 ? '' : match;
  });

  // 3. Вставляем строки упражнений и пустые строки перед </sheetData>
  var newRows = '';
  var totalRows = Math.max(exercises.length, 1) + 8; // упражнения + 8 пустых строк

  for (var i = 0; i < totalRows; i++) {
    var rowNum = 4 + i;
    var ex = exercises[i];
    var cells = '';
    ['A','B','C','D','E'].forEach(function(col, ci) {
      var val = '';
      if (ex) {
        if (ci === 0) val = ex.name || '';
        if (ci === 1) val = ex.desc || '';
        if (ci === 2) val = ex.note || '';
        if (ci === 3) val = ex.trackValue ? 'да' : '';
        if (ci === 4) val = ex.unit || '';
      }
      if (val !== '') {
        cells += '<c r="' + col + rowNum + '" t="inlineStr"><is><t>' + xmlEscape(val) + '</t></is></c>';
      } else {
        cells += '<c r="' + col + rowNum + '"/>';
      }
    });
    newRows += '<row r="' + rowNum + '" ht="20" customHeight="1">' + cells + '</row>';
  }

  sheetXml = sheetXml.replace('</sheetData>', newRows + '</sheetData>');
  return sheetXml;
}

// --- Главная функция ---

function jsonToExcel(plan, sectionName) {
  var baseUrl = location.origin + location.pathname.replace('index.html', '');
  var templateUrl = baseUrl + 'plans/plan_template.xlsx?v=' + Date.now();

  fetch(templateUrl)
    .then(function(r) {
      if (!r.ok) throw new Error('Шаблон не найден');
      return r.arrayBuffer();
    })
    .then(function(buffer) {
      return JSZip.loadAsync(buffer);
    })
    .then(function(zip) {
      // Находим маппинг имён листов → файлов через workbook.xml + rels
      return Promise.all([
        zip.file('xl/workbook.xml').async('string'),
        zip.file('xl/_rels/workbook.xml.rels').async('string'),
      ]).then(function(results) {
        var wbXml = results[0];
        var relsXml = results[1];

        // name → rId
        var sheetMap = {};
        var sheetMatches = wbXml.match(/<sheet\b[^>]+>/g) || [];
        sheetMatches.forEach(function(m) {
          var nameM = m.match(/name="([^"]+)"/);
          var ridM = m.match(/r:id="([^"]+)"/i) || m.match(/id="([^"]+)"/i);
          if (nameM && ridM) sheetMap[nameM[1]] = ridM[1];
        });

        // rId → target path
        var fileMap = {};
        var relMatches = relsXml.match(/<Relationship\b[^>]+>/g) || [];
        relMatches.forEach(function(m) {
          var idM = m.match(/\bId="([^"]+)"/);
          var targetM = m.match(/\bTarget="([^"]+)"/);
          if (idM && targetM) fileMap[idM[1]] = targetM[1];
        });

        return { zip: zip, sheetMap: sheetMap, fileMap: fileMap };
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
        var path = target.replace(/^\//, ''); // убираем начальный слеш если есть
        if (!path.startsWith('xl/')) path = 'xl/' + path.replace('../', '');

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


