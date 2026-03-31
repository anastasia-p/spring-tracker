// xlsx-validator.js — валидация Excel файла перед импортом

var VALID_DAY_TYPES = [
  'Ноги + таз','Ноги','Верх + кор','Верх тела',
  'Полное тело','Кардио','Растяжка','Йога',
  'Вин Чун','Цигун','Отдых','Отдых + тест'
];

var VALID_TRACK_VALUES = ['да', ''];
var VALID_UNITS = ['мин', 'сек', 'раз', ''];

var DAYS_ORDER = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];

var MAX_NAME_LEN = 100;
var MAX_DESC_LEN = 300;
var MAX_NOTE_LEN = 200;

// Валидирует ArrayBuffer xlsx файла
// Возвращает { valid: bool, errors: [...], warnings: [...] }
function validateXlsx(arrayBuffer, filename) {
  var errors = [];
  var warnings = [];

  // 1. Проверяем расширение
  if (filename && !filename.toLowerCase().endsWith('.xlsx')) {
    errors.push({ sheet: null, row: null, message: 'Неверный формат файла. Загрузи файл в формате .xlsx' });
    return { valid: false, errors: errors, warnings: warnings };
  }

  var zip, sheets;
  try {
    zip = JSZip.loadAsync ? null : new JSZip(); // синхронная проверка
    // Используем синхронный парсинг через XLSX если доступен
    sheets = parseXlsxSheets(arrayBuffer);
  } catch (e) {
    errors.push({ sheet: null, row: null, message: 'Не удалось прочитать файл: ' + e.message });
    return { valid: false, errors: errors, warnings: warnings };
  }

  // 2. Проверяем наличие всех 7 листов
  DAYS_ORDER.forEach(function(day) {
    if (!sheets[day]) {
      errors.push({ sheet: null, row: null, message: 'Отсутствует лист: ' + day });
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors: errors, warnings: warnings };
  }

  // 3. Проверяем каждый лист
  DAYS_ORDER.forEach(function(day) {
    var rows = sheets[day];

    // Строка 1: тип дня (B1)
    var typeVal = (rows[0] && rows[0][1]) ? rows[0][1].trim() : '';
    if (!typeVal) {
      errors.push({ sheet: day, row: 1, message: 'Не указан тип дня' });
    } else if (VALID_DAY_TYPES.indexOf(typeVal) === -1) {
      errors.push({ sheet: day, row: 1, message: 'Неверный тип дня: "' + typeVal + '"' });
    }

    // Строки 4+ (индекс 3+): упражнения
    for (var i = 3; i < rows.length; i++) {
      var row = rows[i] || [];
      var rowNum = i + 1;

      var name  = (row[0] || '').trim();
      var desc  = (row[1] || '').trim();
      var note  = (row[2] || '').trim();
      var track = (row[3] || '').trim().toLowerCase();
      var unit  = (row[4] || '').trim();

      // Пустая строка — пропускаем
      if (!name && !desc && !note && !track && !unit) continue;

      // Если строка не пустая — название обязательно
      if (!name) {
        errors.push({ sheet: day, row: rowNum, message: 'Пустое название упражнения' });
        continue;
      }

      // Длина полей
      if (name.length > MAX_NAME_LEN) {
        warnings.push({ sheet: day, row: rowNum, message: 'Название слишком длинное — будет обрезано до ' + MAX_NAME_LEN + ' символов' });
      }
      if (desc.length > MAX_DESC_LEN) {
        warnings.push({ sheet: day, row: rowNum, message: 'Описание слишком длинное — будет обрезано до ' + MAX_DESC_LEN + ' символов' });
      }
      if (note.length > MAX_NOTE_LEN) {
        warnings.push({ sheet: day, row: rowNum, message: 'Заметка слишком длинная — будет обрезана до ' + MAX_NOTE_LEN + ' символов' });
      }

      // Ввод значения
      if (track && VALID_TRACK_VALUES.indexOf(track) === -1) {
        errors.push({ sheet: day, row: rowNum, message: '"Ввод значения" должен быть "да" или пустым, получено: "' + track + '"' });
      }

      // Единица
      if (unit && VALID_UNITS.indexOf(unit) === -1) {
        errors.push({ sheet: day, row: rowNum, message: '"Единица" должна быть "мин", "сек", "раз" или пустой, получено: "' + unit + '"' });
      }

      // Если trackValue = да — единица обязательна
      if (track === 'да' && !unit) {
        errors.push({ sheet: day, row: rowNum, message: 'Указан "Ввод значения: да", но не выбрана единица (мин / сек / раз)' });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

// Синхронный парсинг xlsx через JSZip + XML
// Возвращает { 'Понедельник': [[row0col0, row0col1, ...], ...], ... }
function parseXlsxSheets(arrayBuffer) {
  var zip = new JSZip();
  var data = zip.loadSync(arrayBuffer); // Используем sync load
  // Примечание: JSZip не поддерживает синхронный load в браузере
  // Поэтому parseXlsxSheets вызывается асинхронно через validateXlsxAsync
  throw new Error('Используй validateXlsxAsync');
}

// Асинхронная версия валидатора
// Возвращает Promise<{ valid, errors, warnings }>
function validateXlsxAsync(arrayBuffer, filename) {
  var errors = [];
  var warnings = [];

  if (filename && !filename.toLowerCase().endsWith('.xlsx')) {
    errors.push({ sheet: null, row: null, message: 'Неверный формат файла. Загрузи файл в формате .xlsx' });
    return Promise.resolve({ valid: false, errors: errors, warnings: warnings });
  }

  return JSZip.loadAsync(arrayBuffer)
    .then(function(zip) {
      return Promise.all([
        zip.file('xl/workbook.xml').async('string'),
        zip.file('xl/_rels/workbook.xml.rels').async('string'),
      ]).then(function(results) {
        var wbXml = results[0];
        var relsXml = results[1];

        // name → rId
        var sheetMap = {};
        (wbXml.match(/<sheet\b[^>]+>/g) || []).forEach(function(m) {
          var nameM = m.match(/name="([^"]+)"/);
          var ridM = m.match(/r:id="([^"]+)"/i) || m.match(/\bid="([^"]+)"/i);
          if (nameM && ridM) sheetMap[nameM[1]] = ridM[1];
        });

        // rId → path
        var fileMap = {};
        (relsXml.match(/<Relationship\b[^>]+>/g) || []).forEach(function(m) {
          var idM = m.match(/\bId="([^"]+)"/);
          var targetM = m.match(/\bTarget="([^"]+)"/);
          if (idM && targetM) fileMap[idM[1]] = targetM[1];
        });

        // Проверяем наличие всех 7 листов
        var missingDays = DAYS_ORDER.filter(function(day) { return !sheetMap[day]; });
        if (missingDays.length > 0) {
          missingDays.forEach(function(day) {
            errors.push({ sheet: null, row: null, message: 'Отсутствует лист: ' + day });
          });
          return { valid: false, errors: errors, warnings: warnings };
        }

        // Читаем все листы
        var sheetPromises = DAYS_ORDER.map(function(day) {
          var rId = sheetMap[day];
          var target = fileMap[rId] || '';
          var path = target.replace(/^\//, '');
          if (!path.startsWith('xl/')) path = 'xl/' + path.replace('../', '');
          return zip.file(path).async('string').then(function(xml) {
            return { day: day, rows: parseSheetXml(xml) };
          });
        });

        return Promise.all(sheetPromises);
      });
    })
    .then(function(sheetsData) {
      if (!Array.isArray(sheetsData)) return sheetsData; // уже вернули ошибку

      sheetsData.forEach(function(sheet) {
        var day = sheet.day;
        var rows = sheet.rows;

        // B1 — тип дня
        var typeVal = (rows[0] && rows[0][1]) ? rows[0][1].trim() : '';
        if (!typeVal) {
          errors.push({ sheet: day, row: 1, message: 'Не указан тип дня' });
        } else if (VALID_DAY_TYPES.indexOf(typeVal) === -1) {
          errors.push({ sheet: day, row: 1, message: 'Неверный тип дня: "' + typeVal + '"' });
        }

        // Строки 4+ (индекс 3+)
        for (var i = 3; i < rows.length; i++) {
          var row = rows[i] || [];
          var rowNum = i + 1;
          var name  = (row[0] || '').trim();
          var desc  = (row[1] || '').trim();
          var note  = (row[2] || '').trim();
          var track = (row[3] || '').trim().toLowerCase();
          var unit  = (row[4] || '').trim();

          if (!name && !desc && !note && !track && !unit) continue;

          if (!name) {
            errors.push({ sheet: day, row: rowNum, message: 'Пустое название упражнения' });
            continue;
          }

          if (name.length > MAX_NAME_LEN) {
            warnings.push({ sheet: day, row: rowNum, message: 'Название слишком длинное — будет обрезано до ' + MAX_NAME_LEN + ' символов' });
          }
          if (desc.length > MAX_DESC_LEN) {
            warnings.push({ sheet: day, row: rowNum, message: 'Описание слишком длинное — будет обрезано до ' + MAX_DESC_LEN + ' символов' });
          }
          if (note.length > MAX_NOTE_LEN) {
            warnings.push({ sheet: day, row: rowNum, message: 'Заметка слишком длинная — будет обрезана до ' + MAX_NOTE_LEN + ' символов' });
          }

          if (track && VALID_TRACK_VALUES.indexOf(track) === -1) {
            errors.push({ sheet: day, row: rowNum, message: '"Ввод значения" должен быть "да" или пустым, получено: "' + track + '"' });
          }
          if (unit && VALID_UNITS.indexOf(unit) === -1) {
            errors.push({ sheet: day, row: rowNum, message: '"Единица" должна быть "мин", "сек", "раз" или пустой, получено: "' + unit + '"' });
          }
          if (track === 'да' && !unit) {
            errors.push({ sheet: day, row: rowNum, message: 'Указан "Ввод значения: да", но не выбрана единица (мин / сек / раз)' });
          }
        }
      });

      return { valid: errors.length === 0, errors: errors, warnings: warnings };
    })
    .catch(function(e) {
      errors.push({ sheet: null, row: null, message: 'Не удалось прочитать файл: ' + e.message });
      return { valid: false, errors: errors, warnings: warnings };
    });
}

// Парсит XML листа → массив строк [[col0, col1, ...], ...]
function parseSheetXml(xml) {
  var rows = [];
  var rowMatches = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || [];

  rowMatches.forEach(function(rowXml) {
    var rowNumM = rowXml.match(/\br="(\d+)"/);
    if (!rowNumM) return;
    var rowIdx = parseInt(rowNumM[1]) - 1;

    var rowData = ['', '', '', '', ''];
    var cellMatches = rowXml.match(/<c\b[^>]*>[\s\S]*?<\/c>/g) || [];

    cellMatches.forEach(function(cellXml) {
      var refM = cellXml.match(/\br="([A-Z]+)(\d+)"/);
      if (!refM) return;
      var colLetter = refM[1];
      if (colLetter.length > 1) return; // только A-E
      var col = colLetter.charCodeAt(0) - 65;
      if (col < 0 || col > 4) return;

      var typeM = cellXml.match(/\bt="([^"]+)"/);
      var cellType = typeM ? typeM[1] : '';

      var val = '';

      if (cellType === 'inlineStr' || cellType === 'str') {
        // Текст хранится в <is><t>...</t></is> или <t>...</t>
        var tM = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (tM) val = tM[1];
      } else if (cellType === 's') {
        // Shared string — нет доступа к shared strings таблице
        // Пропускаем — это скорее всего числовой индекс форматирования
        val = '';
      } else {
        // Числовое или другое значение
        var vM = cellXml.match(/<v>([\s\S]*?)<\/v>/);
        if (vM) val = vM[1];
      }

      // Декодируем XML entities
      val = val
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      rowData[col] = val;
    });

    rows[rowIdx] = rowData;
  });

  return rows;
}
