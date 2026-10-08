const SPREADSHEET_ID = "1NIsa8jCc7CZ8gfvICtamE8UXjTO5ACbuviljuYG02jQ";
const SHEET_GID = 1289778487;
const SECRET_PROPERTY = "SYNC_SECRET";
const HEADERS = [
  "Mã lượt thi",
  "Họ tên",
  "Lớp",
  "Mã đề",
  "Tên đề",
  "Chủ đề",
  "Bắt đầu (ISO 8601)",
  "Nộp lúc (ISO 8601)",
  "Thời lượng (giây)",
  "Điểm / 10",
  "Điểm thô",
  "Tổng điểm thô",
  "Điểm phần I",
  "Điểm phần II",
  "Điểm phần III",
];

/** Web app endpoint. Deploy to run as the spreadsheet owner. */
function doPost(event) {
  try {
    const request = JSON.parse(event && event.postData && event.postData.contents || "{}");
    const expectedSecret = PropertiesService.getScriptProperties().getProperty(SECRET_PROPERTY) || "";
    if (expectedSecret.length < 32 || !constantTimeMatches_(request.sharedSecret, expectedSecret)) {
      return json_({ ok: false, code: "UNAUTHORIZED" });
    }

    const action = String(request.action || "");
    if (!["status", "upsertAttempt", "deleteClass"].includes(action)) {
      return json_({ ok: false, code: "INVALID_ACTION" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = spreadsheet.getSheetById(SHEET_GID);
      if (!sheet) return json_({ ok: false, code: "SHEET_NOT_FOUND" });

      if (action === "status") {
        const headerState = inspectHeaders_(sheet);
        return json_({
          ok: true,
          spreadsheetName: spreadsheet.getName(),
          spreadsheetUrl: spreadsheet.getUrl(),
          sheetName: sheet.getName(),
          sheetGid: SHEET_GID,
          headersReady: headerState.ready,
          empty: headerState.empty,
          resultRows: Math.max(0, sheet.getLastRow() - (headerState.empty ? 0 : 1)),
        });
      }

      if (action === "upsertAttempt") {
        const row = toRow_(request.attempt);
        if (!row) return json_({ ok: false, code: "INVALID_PAYLOAD" });
        const className = normalizeText_(request.attempt.className);
        const submittedAt = Date.parse(normalizeText_(request.attempt.submittedAt));
        const clearedAt = Number(PropertiesService.getScriptProperties().getProperty(clearMarkerKey_(className)) || 0);
        if (clearedAt && submittedAt <= clearedAt) {
          return json_({ ok: true, action: "ignored_after_class_clear" });
        }
        const headerState = prepareHeaders_(sheet);
        if (!headerState.ready) return json_({ ok: false, code: "HEADER_MISMATCH" });

        const lastRow = sheet.getLastRow();
        let matchedRow = null;
        if (lastRow > 1) {
          const match = sheet.getRange(2, 1, lastRow - 1, 1)
            .createTextFinder(row[0])
            .matchEntireCell(true)
            .findNext();
          if (match) matchedRow = match.getRow();
        }
        const targetRow = matchedRow || lastRow + 1;
        sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([row]);
        return json_({ ok: true, action: matchedRow ? "updated" : "inserted", row: targetRow });
      }

      const className = normalizeText_(request.className);
      if (!className || className.length > 40) return json_({ ok: false, code: "INVALID_PAYLOAD" });
      const headerState = inspectHeaders_(sheet);
      if (headerState.empty) {
        markClassCleared_(className);
        return json_({ ok: true, deletedRows: 0 });
      }
      if (!headerState.ready) return json_({ ok: false, code: "HEADER_MISMATCH" });

      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        markClassCleared_(className);
        return json_({ ok: true, deletedRows: 0 });
      }
      const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
      const keptRows = [];
      let deletedRows = 0;
      for (const row of rows) {
        if (normalizeText_(row[2]) === className) deletedRows += 1;
        else keptRows.push(row);
      }
      if (deletedRows > 0) {
        sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
        if (keptRows.length > 0) {
          sheet.getRange(2, 1, keptRows.length, HEADERS.length).setValues(keptRows);
        }
      }
      markClassCleared_(className);
      return json_({ ok: true, deletedRows: deletedRows });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error("Google Sheets bridge failed", error && error.message || "unknown error");
    return json_({ ok: false, code: "SERVER_ERROR" });
  }
}

function inspectHeaders_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow === 0 && lastColumn === 0) return { ready: true, empty: true };
  if (lastColumn > HEADERS.length || lastColumn < HEADERS.length) return { ready: false, empty: false };
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0];
  const ready = HEADERS.every((header, index) => String(current[index] || "").trim() === header);
  return { ready: ready, empty: false };
}

function prepareHeaders_(sheet) {
  const state = inspectHeaders_(sheet);
  if (!state.empty) return state;
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  return { ready: true, empty: false };
}

function toRow_(attempt) {
  if (!attempt || typeof attempt !== "object") return null;
  const attemptId = normalizeText_(attempt.attemptId);
  const studentName = safeTextCell_(attempt.studentName);
  const className = safeTextCell_(attempt.className);
  const examId = Number(attempt.examId);
  const examTitle = safeTextCell_(attempt.examTitle);
  const topic = safeTextCell_(attempt.topic);
  const startedAt = normalizeText_(attempt.startedAt);
  const submittedAt = normalizeText_(attempt.submittedAt);
  const durationSeconds = Number(attempt.durationSeconds);
  const score = Number(attempt.score);
  const rawScore = Number(attempt.rawScore);
  const maxScore = Number(attempt.maxScore);
  const sectionIScore = Number(attempt.sectionIScore);
  const sectionIIScore = Number(attempt.sectionIIScore);
  const sectionIIIScore = Number(attempt.sectionIIIScore);
  const numbers = [examId, durationSeconds, score, rawScore, maxScore, sectionIScore, sectionIIScore, sectionIIIScore];

  if (!/^[a-f0-9]{36}$/i.test(attemptId) || !studentName || !className || !examTitle || !startedAt || !submittedAt) return null;
  if (studentName.length > 120 || className.length > 40 || examTitle.length > 200 || topic.length > 200) return null;
  if (numbers.some(value => !Number.isFinite(value))) return null;
  if (examId < 1 || durationSeconds < 0 || score < 0 || score > 10) return null;
  if (Number.isNaN(Date.parse(startedAt)) || Number.isNaN(Date.parse(submittedAt))) return null;

  return [
    attemptId,
    studentName,
    className,
    examId,
    examTitle,
    topic,
    startedAt,
    submittedAt,
    durationSeconds,
    score,
    rawScore,
    maxScore,
    sectionIScore,
    sectionIIScore,
    sectionIIIScore,
  ];
}

function safeTextCell_(value) {
  const text = normalizeText_(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function normalizeText_(value) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ");
}

function clearMarkerKey_(className) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, className, Utilities.Charset.UTF_8);
  const digest = bytes.map(value => (value < 0 ? value + 256 : value).toString(16).padStart(2, "0")).join("");
  return "CLEARED_CLASS_" + digest;
}

function markClassCleared_(className) {
  PropertiesService.getScriptProperties().setProperty(clearMarkerKey_(className), String(Date.now()));
}

function constantTimeMatches_(provided, expected) {
  if (typeof provided !== "string" || !expected) return false;
  const left = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, provided, Utilities.Charset.UTF_8);
  const right = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, expected, Utilities.Charset.UTF_8);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= (left[index] ^ right[index]) & 0xff;
  return difference === 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
