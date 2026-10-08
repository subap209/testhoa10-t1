import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, ArrowRight, CheckCircle2, Clock3, FileCheck2, FileSpreadsheet, KeyRound, LogOut, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { examApi } from "@/lib/examApi";
import { exams } from "@shared/examContent";

type Review = {
  sectionI: { number: number; given: string; expected: string; correct: boolean }[];
  sectionII: { number: number; statements: { label: string; given: boolean | null; expected: boolean; correct: boolean }[] }[];
  sectionIII: { number: number; given: string; expected: string; explanation: string; correct: boolean }[];
};
type ResultRow = {
  attemptId: string;
  studentName: string;
  className: string;
  examId: number;
  examTitle: string;
  topic: string;
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number;
  score: number;
  rawScore: number;
  maxScore: number;
  sectionScores: { sectionI: number; sectionII: number; sectionIII: number };
  googleSheetsSyncStatus: "not_requested" | "pending" | "synced" | "error";
  review: Review | null;
};
type ResultsResponse = { results: ResultRow[]; fetchedAt: string };
type ClassSummary = { className: string; attempts: number; submitted: number };
type SheetsStatus = {
  configured: boolean;
  connected: boolean;
  pending: number;
  errors: number;
  notRequested: number;
  spreadsheetName?: string;
  spreadsheetUrl?: string | null;
  sheetName?: string;
  headersReady?: boolean;
  empty?: boolean;
  resultRows?: number;
  error?: string;
};

const TOKEN_KEY = "qt-hoa10-teacher-token";
function secondsLabel(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min} phút ${sec.toString().padStart(2, "0")} giây`;
}
function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
}
function displayTruth(value: boolean | null) {
  return value === null ? "—" : value ? "Đúng" : "Sai";
}
function syncStatusLabel(value: ResultRow["googleSheetsSyncStatus"]) {
  if (value === "synced") return "Đã đồng bộ";
  if (value === "error") return "Đồng bộ lỗi";
  if (value === "pending") return "Đang chờ đồng bộ";
  return "Chưa yêu cầu";
}

export default function Teacher() {
  const [token, setToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [selectedExam, setSelectedExam] = useState("all");
  const [search, setSearch] = useState("");
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loadError, setLoadError] = useState("");
  const [sheetStatus, setSheetStatus] = useState<SheetsStatus | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [sheetActionBusy, setSheetActionBusy] = useState(false);
  const [sheetActionError, setSheetActionError] = useState("");
  const [sheetActionMessage, setSheetActionMessage] = useState("");

  const loadResults = useCallback(async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const query = selectedExam === "all" ? "" : `?examId=${encodeURIComponent(selectedExam)}`;
      const payload = await examApi<ResultsResponse>(`/api/teacher/results${query}`, { headers: { Authorization: `Bearer ${token}` } });
      setResults(payload.results);
      setUpdatedAt(payload.fetchedAt);
      setLoadError("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Chưa tải được kết quả.";
      setLoadError(message);
      if (message.toLowerCase().includes("phiên giáo viên")) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedExam, token]);

  const loadSheetStatus = useCallback(async () => {
    if (!token) return;
    try {
      const payload = await examApi<SheetsStatus>("/api/teacher/google-sheets/status", { headers: { Authorization: `Bearer ${token}` } });
      setSheetStatus(payload);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Chưa tải được trạng thái Google Sheets.";
      setSheetStatus({ configured: false, connected: false, pending: 0, errors: 0, notRequested: 0, error: message });
      if (message.toLowerCase().includes("phiên giáo viên")) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    }
  }, [token]);

  const loadClasses = useCallback(async () => {
    if (!token) return;
    try {
      const payload = await examApi<{ classes: ClassSummary[] }>("/api/teacher/classes", { headers: { Authorization: `Bearer ${token}` } });
      setClasses(payload.classes);
      setSelectedClass(current => current && payload.classes.some(item => item.className === current) ? current : payload.classes[0]?.className ?? "");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Chưa tải được danh sách lớp.";
      setSheetActionError(message);
      if (message.toLowerCase().includes("phiên giáo viên")) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadResults(false);
    const interval = window.setInterval(() => void loadResults(true), 5000);
    return () => window.clearInterval(interval);
  }, [loadResults, token]);

  useEffect(() => {
    if (!token) return;
    void loadSheetStatus();
    void loadClasses();
    const interval = window.setInterval(() => {
      void loadSheetStatus();
      void loadClasses();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadClasses, loadSheetStatus, token]);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const payload = await examApi<{ token: string }>("/api/teacher/login", { method: "POST", body: JSON.stringify({ password }) });
      sessionStorage.setItem(TOKEN_KEY, payload.token);
      setToken(payload.token);
      setPassword("");
    } catch (cause) {
      setLoginError(cause instanceof Error ? cause.message : "Đăng nhập chưa thành công.");
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = async () => {
    if (token) {
      try { await examApi<void>("/api/teacher/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch { /* clear locally even if offline */ }
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setResults([]);
    setOpenAttempt(null);
  };

  const syncExistingResults = async () => {
    if (!token) return;
    setSheetActionBusy(true);
    setSheetActionError("");
    setSheetActionMessage("");
    try {
      const result = await examApi<{ queued: number }>("/api/teacher/google-sheets/backfill", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSheetActionMessage(result.queued ? `Đã đưa ${result.queued} kết quả cũ vào hàng đợi đồng bộ.` : "Không còn kết quả lịch sử nào cần đồng bộ.");
      setShowBackfillConfirm(false);
      void loadSheetStatus();
      void loadResults(true);
    } catch (cause) {
      setSheetActionError(cause instanceof Error ? cause.message : "Không thể đồng bộ kết quả lịch sử.");
    } finally {
      setSheetActionBusy(false);
    }
  };

  const deleteClassResults = async () => {
    if (!token || !selectedClass) return;
    setSheetActionBusy(true);
    setSheetActionError("");
    setSheetActionMessage("");
    try {
      const result = await examApi<{ className: string; deletedAttempts: number; deletedSheetRows: number }>("/api/teacher/classes/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ className: selectedClass, confirmationName: deleteConfirmation }),
      });
      setSheetActionMessage(`Đã xóa ${result.deletedAttempts} lượt thi của lớp ${result.className} trong website và ${result.deletedSheetRows} dòng trên Google Sheets.`);
      setShowDeleteConfirm(false);
      setDeleteConfirmation("");
      setSelectedClass("");
      void loadResults(true);
      void loadClasses();
      void loadSheetStatus();
    } catch (cause) {
      setSheetActionError(cause instanceof Error ? cause.message : "Không thể hoàn tất thao tác xóa lớp.");
    } finally {
      setSheetActionBusy(false);
    }
  };

  const filteredResults = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    if (!needle) return results;
    return results.filter(row => `${row.studentName} ${row.className} ${row.examTitle} ${row.topic}`.toLocaleLowerCase("vi").includes(needle));
  }, [results, search]);

  const selectedClassInfo = classes.find(item => item.className === selectedClass);

  const average = filteredResults.length ? filteredResults.reduce((sum, row) => sum + row.score, 0) / filteredResults.length : 0;
  const highest = filteredResults.length ? Math.max(...filteredResults.map(row => row.score)) : 0;
  const distribution = useMemo(() => Array.from({ length: 10 }, (_, index) => ({
    band: `${index}–${index + 1}`,
    students: filteredResults.filter(row => row.score >= index && (index === 9 ? row.score <= 10 : row.score < index + 1)).length,
  })), [filteredResults]);

  return (
    <div className="app-shell">
      <SiteHeader teacher />
      <main className="page-container teacher-page">
        {!token ? (
          <section className="teacher-login-layout">
            <div className="teacher-login-story">
              <div className="eyebrow"><span className="eyebrow-dot" /> BẢNG ĐIỀU KHIỂN GIÁO VIÊN</div>
              <h1>Theo dõi bài làm.<br /><em>Nắm trọn tiến độ lớp.</em></h1>
              <p>Kết quả được lưu tập trung và cập nhật ngay sau khi học sinh nộp bài. Lọc theo từng đề hoặc mở bài làm để xem đáp án chi tiết.</p>
              <div className="teacher-promise"><span><Activity size={19} /></span><div><b>Cập nhật tự động</b><small>Bảng kết quả làm mới mỗi 5 giây</small></div></div>
            </div>
            <form className="login-card teacher-login-card" onSubmit={handleLogin}>
              <div className="login-card-icon teacher-icon"><KeyRound size={22} /></div>
              <span className="eyebrow">DÀNH CHO GIÁO VIÊN</span>
              <h2>Đăng nhập</h2>
              <p>Nhập mật khẩu để xem kết quả bài làm.</p>
              <label className="field-label">Mật khẩu giáo viên
                <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" required />
              </label>
              {loginError && <div className="inline-alert" role="alert">{loginError}</div>}
              <button className="button-primary full-width" type="submit" disabled={loginBusy}>{loginBusy ? "Đang xác thực…" : "Vào bảng kết quả"}<ArrowRight size={18} /></button>
              <small className="form-note"><ShieldCheck size={14} /> Phiên đăng nhập được bảo vệ phía máy chủ.</small>
            </form>
          </section>
        ) : (
          <>
            <div className="teacher-heading-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> KHU VỰC GIÁO VIÊN</div>
                <h1>Bảng kết quả bài làm</h1>
                <p>Kết quả mới tự xuất hiện sau khi học sinh nộp bài.</p>
              </div>
              <div className="teacher-toolbar">
                <span className="live-indicator"><i /> ĐANG CẬP NHẬT</span>
                <button className="icon-button" type="button" aria-label="Tải lại kết quả" title="Tải lại kết quả" onClick={() => void loadResults(true)} disabled={refreshing}><RefreshCw size={17} className={refreshing ? "spin-once" : ""} /></button>
                <button className="icon-button logout-button" type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout()}><LogOut size={17} /></button>
              </div>
            </div>
            <div className="filter-row">
              <label className="filter-label">Xem theo đề
                <select value={selectedExam} onChange={event => { setSelectedExam(event.target.value); setOpenAttempt(null); }}>
                  <option value="all">Tất cả 25 đề</option>
                  {exams.map(exam => <option value={String(exam.id)} key={exam.id}>{exam.title} · {exam.topic}</option>)}
                </select>
              </label>
              <label className="filter-label search-filter">Tìm học sinh
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nhập tên hoặc lớp" />
              </label>
              <span className="updated-note">{updatedAt ? `Cập nhật ${new Date(updatedAt).toLocaleTimeString("vi-VN")}` : "Đang kết nối…"}</span>
            </div>
            {loadError && <div className="inline-alert" role="alert">{loadError}</div>}
            {sheetActionError && <div className="inline-alert" role="alert">{sheetActionError}</div>}
            {sheetActionMessage && <div className="sheet-action-success" role="status">{sheetActionMessage}</div>}
            <section className="sheet-management-card" aria-label="Google Sheets">
              <div className="sheet-management-top">
                <span className="sheet-brand-mark"><FileSpreadsheet size={21} /></span>
                <div className="sheet-management-copy">
                  <span className="eyebrow">GOOGLE SHEETS</span>
                  <h2>Lưu và xuất sổ kết quả</h2>
                  <p>Kết quả nộp bài được đồng bộ ở máy chủ; bảng tính có thể tải xuống dưới dạng Excel (.xlsx).</p>
                </div>
                <div className="sheet-management-actions">
                  {sheetStatus?.connected && sheetStatus.spreadsheetUrl && <a className="button-secondary sheet-open-link" href={sheetStatus.spreadsheetUrl} target="_blank" rel="noreferrer">Mở Google Sheet</a>}
                  {sheetStatus?.connected && sheetStatus.headersReady && sheetStatus.notRequested > 0 && <button className="button-secondary" type="button" onClick={() => { setSheetActionError(""); setShowBackfillConfirm(true); }}>Đồng bộ kết quả cũ ({sheetStatus.notRequested})</button>}
                </div>
              </div>
              <div className={`sheet-connection-status ${sheetStatus?.connected ? "is-connected" : "is-disconnected"}`} role="status">
                <span className="sheet-status-dot" />
                <span>{!sheetStatus ? "Đang kiểm tra kết nối…" : sheetStatus.connected ? (sheetStatus.headersReady ? `Đã kết nối ${sheetStatus.spreadsheetName} · tab ${sheetStatus.sheetName} · ${sheetStatus.resultRows ?? 0} dòng` : "Tab đích có cấu trúc khác dự kiến; chưa ghi hoặc xóa dữ liệu.") : sheetStatus.configured ? (sheetStatus.error ?? "Không kết nối được Apps Script.") : "Chưa cấu hình URL Apps Script và khóa đồng bộ trong máy chủ."}</span>
                {sheetStatus?.configured && <small>Chờ {sheetStatus.pending} · lỗi {sheetStatus.errors}</small>}
              </div>
            </section>
            <section className="class-reset-card" aria-label="Xóa dữ liệu theo lớp">
              <div className="class-reset-copy">
                <span className="eyebrow">QUẢN LÝ DỮ LIỆU</span>
                <h2>Xóa kết quả của một lớp</h2>
                <p>Chỉ xóa lớp được chọn khỏi website và Google Sheets. Hãy xuất bản Excel trước khi xóa.</p>
              </div>
              <div className="class-reset-controls">
                <label className="filter-label">Lớp cần xóa
                  <select value={selectedClass} onChange={event => setSelectedClass(event.target.value)} disabled={!classes.length}>
                    <option value="">Chọn lớp</option>
                    {classes.map(item => <option key={item.className} value={item.className}>{item.className} · {item.attempts} lượt</option>)}
                  </select>
                </label>
                <button className="button-danger" type="button" disabled={!selectedClassInfo || !sheetStatus?.connected || !sheetStatus.headersReady || sheetActionBusy} onClick={() => { setDeleteConfirmation(""); setSheetActionError(""); setShowDeleteConfirm(true); }}><Trash2 size={16} /> Xóa dữ liệu lớp</button>
              </div>
              {selectedClassInfo && <small className="class-reset-count">Lớp {selectedClassInfo.className}: {selectedClassInfo.attempts} lượt thi, gồm {selectedClassInfo.submitted} bài đã nộp.</small>}
            </section>
            <div className="teacher-stats">
              <article className="stat-card"><span className="stat-icon stat-teal"><FileCheck2 size={20} /></span><div><small>BÀI ĐÃ NỘP</small><strong>{filteredResults.length}</strong><span>theo bộ lọc hiện tại</span></div></article>
              <article className="stat-card"><span className="stat-icon stat-gold"><Activity size={20} /></span><div><small>ĐIỂM TRUNG BÌNH</small><strong>{average.toFixed(2)}<i>/10</i></strong><span>quy đổi phần I–III</span></div></article>
              <article className="stat-card"><span className="stat-icon stat-coral"><Users size={20} /></span><div><small>ĐIỂM CAO NHẤT</small><strong>{highest.toFixed(2)}<i>/10</i></strong><span>trong danh sách hiện tại</span></div></article>
            </div>
            <section className="chart-card">
              <div className="chart-heading"><div><span className="eyebrow">PHỔ ĐIỂM HỌC SINH</span><h2>Phân bố điểm bài làm</h2></div><span className="chart-total">{filteredResults.length} bài</span></div>
              {filteredResults.length ? (
                <div className="chart-frame">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={distribution} margin={{ top: 12, right: 14, left: -15, bottom: 0 }}>
                      <CartesianGrid stroke="#e6eeeb" strokeDasharray="4 5" vertical={false} />
                      <XAxis dataKey="band" axisLine={false} tickLine={false} tick={{ fill: "#788b88", fontSize: 12 }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#788b88", fontSize: 12 }} />
                      <Tooltip cursor={{ fill: "#eef8f6" }} contentStyle={{ borderRadius: 14, border: "1px solid #dce9e5", boxShadow: "0 10px 30px #17433e12" }} formatter={(value) => [`${value} học sinh`, "Số lượng"]} labelFormatter={(label) => `Điểm ${label}`} />
                      <Bar dataKey="students" fill="#21a69b" radius={[7, 7, 2, 2]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="chart-empty"><Activity size={23} /><span>Chưa có bài nộp trong bộ lọc này. Biểu đồ sẽ tự cập nhật khi có kết quả mới.</span></div>}
            </section>
            <section className="results-card">
              <div className="results-heading"><div><span className="eyebrow">SỔ KẾT QUẢ</span><h2>Bài làm của học sinh</h2></div><span className="results-count">{filteredResults.length} kết quả</span></div>
              {loading && !results.length ? <div className="loading-state"><span className="loading-spinner" />Đang tải kết quả…</div> : filteredResults.length ? (
                <div className="table-scroll">
                  <table className="results-table">
                    <thead><tr><th>Học sinh</th><th>Đề</th><th>Điểm</th><th>Điểm thành phần</th><th>Thời gian làm</th><th>Đã nộp lúc</th><th></th></tr></thead>
                    <tbody>
                      {filteredResults.map(row => (
                        <ResultRows key={row.attemptId} row={row} expanded={openAttempt === row.attemptId} onToggle={() => setOpenAttempt(openAttempt === row.attemptId ? null : row.attemptId)} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty-results"><span className="empty-icon"><FileCheck2 size={26} /></span><h3>Chưa có bài nộp</h3><p>Kết quả sẽ hiện tại đây ngay khi học sinh hoàn tất và nộp bài.</p></div>}
            </section>
          </>
        )}
      </main>
      {showBackfillConfirm && sheetStatus?.connected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowBackfillConfirm(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="backfill-title">
            <span className="modal-icon"><FileSpreadsheet size={22} /></span>
            <h2 id="backfill-title">Đồng bộ kết quả lịch sử?</h2>
            <p>{sheetStatus.notRequested} bài đã nộp từ trước sẽ được gửi lên Google Sheet. Dữ liệu hiện có trên Sheet sẽ được giữ nguyên; mã lượt thi ngăn việc ghi trùng.</p>
            <div className="modal-actions"><button className="button-secondary" type="button" onClick={() => setShowBackfillConfirm(false)}>Hủy</button><button className="button-primary" type="button" disabled={sheetActionBusy} onClick={() => void syncExistingResults()}>{sheetActionBusy ? "Đang đưa vào hàng đợi…" : "Xác nhận đồng bộ"}</button></div>
          </section>
        </div>
      )}
      {showDeleteConfirm && selectedClassInfo && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowDeleteConfirm(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-class-title">
            <span className="modal-icon delete-modal-icon"><Trash2 size={22} /></span>
            <h2 id="delete-class-title">Xóa dữ liệu lớp {selectedClassInfo.className}?</h2>
            <p>Thao tác sẽ xóa {selectedClassInfo.attempts} lượt thi trong website và các dòng của đúng lớp này trong Google Sheets. Không ảnh hưởng lớp khác và không thể hoàn tác. Hãy tải Excel làm bản sao trước.</p>
            <label className="field-label delete-confirm-label">Nhập chính xác tên lớp <strong>{selectedClassInfo.className}</strong>
              <input type="text" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" />
            </label>
            <div className="modal-actions"><button className="button-secondary" type="button" disabled={sheetActionBusy} onClick={() => setShowDeleteConfirm(false)}>Giữ dữ liệu</button><button className="button-danger" type="button" disabled={sheetActionBusy || deleteConfirmation.trim().replace(/\s+/g, " ") !== selectedClassInfo.className} onClick={() => void deleteClassResults()}>{sheetActionBusy ? "Đang xóa…" : "Xóa lớp đã chọn"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function ResultRows({ row, expanded, onToggle }: { row: ResultRow; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className={`result-row ${expanded ? "row-expanded" : ""}`}>
        <td><button type="button" className="student-result-button" onClick={onToggle}><span className="student-mini-avatar">{row.studentName.trim().charAt(0).toLocaleUpperCase("vi")}</span><span><strong>{row.studentName}</strong><small>Lớp {row.className}</small></span></button></td>
        <td><span className="table-exam-name">{row.examTitle}</span><small className="table-topic">{row.topic}</small></td>
        <td><span className={`score-pill ${row.score >= 8 ? "score-high" : row.score < 5 ? "score-low" : ""}`}>{row.score.toFixed(2)}</span><small className="score-scale">/ 10</small></td>
        <td><div className="section-mini-scores"><span>I <b>{row.sectionScores.sectionI.toFixed(2)}</b></span><span>II <b>{row.sectionScores.sectionII.toFixed(2)}</b></span><span>III <b>{row.sectionScores.sectionIII.toFixed(2)}</b></span></div></td>
        <td><span className="duration-cell"><Clock3 size={14} />{secondsLabel(row.durationSeconds)}</span></td>
        <td className="date-cell">{displayDate(row.submittedAt)}<small className={`sheet-sync-label sync-${row.googleSheetsSyncStatus}`}>Sheets · {syncStatusLabel(row.googleSheetsSyncStatus)}</small></td>
        <td><button type="button" className="detail-toggle" onClick={onToggle}>{expanded ? "Thu gọn" : "Chi tiết"}</button></td>
      </tr>
      {expanded && (
        <tr className="review-row"><td colSpan={7}><ReviewPanel review={row.review} /></td></tr>
      )}
    </>
  );
}

function ReviewPanel({ review }: { review: Review | null }) {
  if (!review) return <div className="review-missing">Chưa có dữ liệu đối chiếu đáp án của bài làm này.</div>;
  return (
    <div className="review-panel">
      <section className="review-section"><h3>Phần I · Trắc nghiệm</h3><div className="review-chip-list">{review.sectionI.map(item => <span className={`review-chip ${item.correct ? "review-correct" : "review-wrong"}`} key={item.number}>C{item.number}: {item.given} <i>→</i> {item.expected}</span>)}</div></section>
      <section className="review-section"><h3>Phần II · Đúng – sai</h3><div className="review-chip-list">{review.sectionII.flatMap(question => question.statements.map(item => <span className={`review-chip ${item.correct ? "review-correct" : "review-wrong"}`} key={`${question.number}-${item.label}`}>C{question.number}{item.label}: {displayTruth(item.given)} <i>→</i> {displayTruth(item.expected)}</span>))}</div></section>
      <section className="review-section"><h3>Phần III · Trả lời ngắn</h3><div className="review-short-list">{review.sectionIII.map(item => <article className={`review-short-item ${item.correct ? "review-correct" : "review-wrong"}`} key={item.number}><b>Câu {item.number}</b><p>Học sinh: {item.given}</p><p>Đáp án: {item.expected}</p>{item.explanation && <small>{item.explanation}</small>}</article>)}</div></section>
    </div>
  );
}
