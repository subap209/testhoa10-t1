import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, CheckCircle2, Clock3, GraduationCap, Send, ShieldCheck, UserRound } from "lucide-react";
import { exams, type Exam } from "@shared/examContent";
import SiteHeader from "@/components/SiteHeader";
import { examApi } from "@/lib/examApi";

type Student = { studentName: string; className: string };
type Answers = {
  sectionI: Record<string, string>;
  sectionII: Record<string, Record<string, boolean>>;
  sectionIII: Record<string, string>;
};
type ActiveAttempt = { attemptId: string; examId: number; startedAt: string; deadlineAt: string };
type SubmitResult = {
  score: number;
  rawScore: number;
  maxScore: number;
  submittedAt: string;
  durationSeconds: number;
  timedOut: boolean;
  sections: {
    sectionI: { score: number; max: number; correct: number; total: number };
    sectionII: { score: number; max: number; correctStatements: number; totalStatements: number };
    sectionIII: { score: number; max: number; correct: number; total: number };
  };
};

const EMPTY_ANSWERS: Answers = { sectionI: {}, sectionII: {}, sectionIII: {} };
const STUDENT_KEY = "qt-hoa10-student";
const ATTEMPT_KEY = "qt-hoa10-active";
const ANSWERS_KEY = "qt-hoa10-answers";

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function totalAnswerCount(answers: Answers) {
  return Object.keys(answers.sectionI).length
    + Object.values(answers.sectionII).reduce((sum, row) => sum + Object.keys(row).length, 0)
    + Object.values(answers.sectionIII).filter(value => value.trim().length > 0).length;
}

export default function Home() {
  const [student, setStudent] = useState<Student | null>(() => readSession<Student>(STUDENT_KEY));
  const [nameInput, setNameInput] = useState(() => readSession<Student>(STUDENT_KEY)?.studentName ?? "");
  const [classInput, setClassInput] = useState(() => readSession<Student>(STUDENT_KEY)?.className ?? "");
  const [active, setActive] = useState<ActiveAttempt | null>(() => readSession<ActiveAttempt>(ATTEMPT_KEY));
  const [answers, setAnswers] = useState<Answers>(() => readSession<Answers>(ANSWERS_KEY) ?? EMPTY_ANSWERS);
  const [remaining, setRemaining] = useState(1800);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [autoSubmitFailed, setAutoSubmitFailed] = useState(false);
  const [completed, setCompleted] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");
  const [startLoading, setStartLoading] = useState<number | null>(null);
  const submitLock = useRef(false);
  const autoSubmitStarted = useRef(false);
  const exam = useMemo(() => active ? exams.find(item => item.id === active.examId) ?? null : null, [active]);

  useEffect(() => {
    if (student) sessionStorage.setItem(STUDENT_KEY, JSON.stringify(student));
    else sessionStorage.removeItem(STUDENT_KEY);
  }, [student]);

  useEffect(() => {
    if (active) {
      sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(active));
      sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    } else {
      sessionStorage.removeItem(ATTEMPT_KEY);
      sessionStorage.removeItem(ANSWERS_KEY);
    }
  }, [active, answers]);

  const submitActive = useCallback(async (timedOut = false) => {
    if (!active || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await examApi<SubmitResult>("/api/exam-attempts/submit", {
        method: "POST",
        body: JSON.stringify({ attemptId: active.attemptId, answers }),
      });
      setCompleted(result);
      setActive(null);
      setAnswers(EMPTY_ANSWERS);
      setShowSubmitConfirm(false);
      setAutoSubmitFailed(false);
      setError("");
    } catch (cause) {
      submitLock.current = false;
      setError(cause instanceof Error ? cause.message : "Chưa nộp được bài. Hãy kiểm tra mạng rồi thử lại.");
      if (timedOut) setAutoSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  }, [active, answers]);

  useEffect(() => {
    autoSubmitStarted.current = false;
  }, [active?.attemptId]);

  useEffect(() => {
    if (!active) return;
    const deadline = Date.parse(active.deadlineAt);
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitStarted.current) {
        autoSubmitStarted.current = true;
        void submitActive(true);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [active?.attemptId, active?.deadlineAt, submitActive]);

  const handleStudentLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = nameInput.trim().replace(/\s+/g, " ");
    const cleanClass = classInput.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || !cleanClass) {
      setError("Em vui lòng nhập đầy đủ họ tên và lớp.");
      return;
    }
    setStudent({ studentName: cleanName, className: cleanClass });
    setError("");
  };

  const startExam = async (selected: Exam) => {
    if (!student || startLoading !== null) return;
    setStartLoading(selected.id);
    setError("");
    setCompleted(null);
    submitLock.current = false;
    autoSubmitStarted.current = false;
    setAutoSubmitFailed(false);
    try {
      const started = await examApi<ActiveAttempt>("/api/exam-attempts/start", {
        method: "POST",
        body: JSON.stringify({ studentName: student.studentName, className: student.className, examId: selected.id }),
      });
      setAnswers({ sectionI: {}, sectionII: {}, sectionIII: {} });
      setRemaining(1800);
      setActive({ ...started, examId: selected.id });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chưa thể bắt đầu bài thi. Vui lòng thử lại.");
    } finally {
      setStartLoading(null);
    }
  };

  const changeChoice = (questionNumber: number, label: string) => {
    setAnswers(previous => ({ ...previous, sectionI: { ...previous.sectionI, [String(questionNumber)]: label } }));
  };
  const changeTruth = (questionNumber: number, label: string, value: boolean) => {
    setAnswers(previous => ({
      ...previous,
      sectionII: { ...previous.sectionII, [String(questionNumber)]: { ...previous.sectionII[String(questionNumber)], [label]: value } },
    }));
  };
  const changeShortAnswer = (questionNumber: number, value: string) => {
    setAnswers(previous => ({ ...previous, sectionIII: { ...previous.sectionIII, [String(questionNumber)]: value } }));
  };

  const answered = totalAnswerCount(answers);
  const totalResponses = exam
    ? exam.parts.sectionI.length + exam.parts.sectionII.reduce((sum, question) => sum + question.statements.length, 0) + exam.parts.sectionIII.length
    : 0;

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-container">
        {active && exam ? (
          <>
            <div className="exam-topline">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> PHÒNG KIỂM TRA TRỰC TUYẾN</div>
                <h1>{exam.title} <span className="title-separator">·</span> {exam.topic}</h1>
                <p className="muted-line">{student?.studentName} <span>•</span> Lớp {student?.className} <span>•</span> Chỉ gồm Phần I, II và III</p>
              </div>
              <a className="subtle-link" href="/" onClick={event => { event.preventDefault(); setError("Em hãy nộp bài trước khi rời phòng kiểm tra."); }}>
                Đang làm bài
              </a>
            </div>

            <div className="exam-layout">
              <div className="exam-content">
                <section className="exam-section" id="part-i">
                  <div className="section-heading">
                    <div className="section-marker">I</div>
                    <div><h2>Trắc nghiệm nhiều lựa chọn</h2><p>Chọn một đáp án đúng nhất cho mỗi câu.</p></div>
                    <span className="question-count">{exam.parts.sectionI.length} câu</span>
                  </div>
                  <div className="question-stack">
                    {exam.parts.sectionI.map((question, index) => (
                      <article className="question-card" id={`mcq-${question.number}`} key={`i-${question.number}`}>
                        <div className="question-line"><span className="question-number">{index + 1}</span><p>{question.prompt}</p></div>
                        {question.figure && <figure className="question-figure"><img src={question.figure} alt={`Hình minh họa câu ${question.number}, ${exam.title}`} loading="lazy" /></figure>}
                        <div className="choice-list">
                          {question.choices.map(choice => (
                            <label className={`choice-option ${answers.sectionI[String(question.number)] === choice.label ? "is-selected" : ""}`} key={choice.label}>
                              <input type="radio" name={`mcq-${question.number}`} value={choice.label} checked={answers.sectionI[String(question.number)] === choice.label} onChange={() => changeChoice(question.number, choice.label)} />
                              <span className="choice-letter">{choice.label}</span>
                              <span className="choice-text">{choice.text}</span>
                            </label>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="exam-section" id="part-ii">
                  <div className="section-heading">
                    <div className="section-marker marker-coral">II</div>
                    <div><h2>Trắc nghiệm đúng – sai</h2><p>Với mỗi ý a), b), c), d), chọn Đúng hoặc Sai.</p></div>
                    <span className="question-count">{exam.parts.sectionII.length} câu</span>
                  </div>
                  <div className="question-stack">
                    {exam.parts.sectionII.map((question, index) => (
                      <article className="question-card" id={`tf-${question.number}`} key={`ii-${question.number}`}>
                        <div className="question-line"><span className="question-number number-coral">{index + 1}</span><p>{question.prompt}</p></div>
                        {question.figure && <figure className="question-figure"><img src={question.figure} alt={`Hình minh họa câu ${question.number}, ${exam.title}`} loading="lazy" /></figure>}
                        <div className="statement-list">
                          {question.statements.map(statement => {
                            const value = answers.sectionII[String(question.number)]?.[statement.label];
                            return (
                              <div className="statement-row" key={statement.label}>
                                <p><strong>{statement.label})</strong> {statement.text}</p>
                                <div className="truth-controls" role="group" aria-label={`Ý ${statement.label}`}>
                                  <button type="button" className={`truth-button ${value === true ? "is-true" : ""}`} aria-pressed={value === true} onClick={() => changeTruth(question.number, statement.label, true)}>Đúng</button>
                                  <button type="button" className={`truth-button ${value === false ? "is-false" : ""}`} aria-pressed={value === false} onClick={() => changeTruth(question.number, statement.label, false)}>Sai</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="exam-section" id="part-iii">
                  <div className="section-heading">
                    <div className="section-marker marker-gold">III</div>
                    <div><h2>Câu trả lời ngắn</h2><p>Nhập đáp án theo đúng yêu cầu của từng câu; có thể dùng dấu phẩy hoặc dấu chấm thập phân.</p></div>
                    <span className="question-count">{exam.parts.sectionIII.length} câu</span>
                  </div>
                  <div className="question-stack">
                    {exam.parts.sectionIII.map((question, index) => (
                      <article className="question-card short-question" id={`short-${question.number}`} key={`iii-${question.number}`}>
                        <div className="question-line"><span className="question-number number-gold">{index + 1}</span><p>{question.prompt}</p></div>
                        {question.figure && <figure className="question-figure"><img src={question.figure} alt={`Hình minh họa câu ${question.number}, ${exam.title}`} loading="lazy" /></figure>}
                        <label className="answer-input-wrap">
                          <span>Đáp án của em</span>
                          <input type="text" value={answers.sectionIII[String(question.number)] ?? ""} onChange={event => changeShortAnswer(question.number, event.target.value)} placeholder="Nhập câu trả lời ngắn" autoComplete="off" />
                        </label>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="exam-sidebar">
                <div className={`timer-card ${remaining <= 300 ? "timer-warning" : ""}`}>
                  <div className="timer-top"><Clock3 size={18} /><span>THỜI GIAN CÒN LẠI</span></div>
                  <div className="timer-value" aria-live="polite">{formatTimer(remaining)}</div>
                  <p>{remaining === 0 ? "Đang gửi bài làm…" : "Bài sẽ tự nộp khi hết giờ."}</p>
                  <div className="timer-progress"><span style={{ width: `${Math.max(0, remaining / 1800 * 100)}%` }} /></div>
                </div>
                <div className="progress-card">
                  <div className="progress-title"><span>Tiến độ trả lời</span><strong>{answered}/{totalResponses}</strong></div>
                  <div className="answer-progress"><span style={{ width: `${totalResponses ? answered / totalResponses * 100 : 0}%` }} /></div>
                  <p>{Math.max(0, totalResponses - answered)} ý/câu chưa trả lời</p>
                  <div className="part-jump-links">
                    <a href="#part-i"><span>I</span> Phần I <b>{exam.parts.sectionI.length}</b></a>
                    <a href="#part-ii"><span className="jump-coral">II</span> Phần II <b>{exam.parts.sectionII.length}</b></a>
                    <a href="#part-iii"><span className="jump-gold">III</span> Phần III <b>{exam.parts.sectionIII.length}</b></a>
                  </div>
                </div>
                <div className="submit-panel">
                  <ShieldCheck size={22} />
                  <strong>Sẵn sàng nộp bài?</strong>
                  <p>Hãy rà soát các câu còn trống trước khi nộp.</p>
                  {autoSubmitFailed ? (
                    <button className="button-primary full-width" type="button" disabled={submitting} onClick={() => void submitActive(true)}>
                      {submitting ? "Đang nộp…" : "Thử nộp bài lại"}
                    </button>
                  ) : (
                    <button className="button-primary full-width" type="button" disabled={submitting} onClick={() => setShowSubmitConfirm(true)}>
                      <Send size={17} /> {submitting ? "Đang nộp…" : "Nộp bài"}
                    </button>
                  )}
                </div>
                <p className="privacy-note"><Check size={15} /> Bài làm được lưu an toàn sau khi nộp.</p>
              </aside>
            </div>
          </>
        ) : completed ? (
          <section className="result-card student-result">
            <div className="result-icon"><CheckCircle2 size={36} /></div>
            <span className="eyebrow">{completed.timedOut ? "ĐÃ HẾT GIỜ" : "BÀI LÀM ĐÃ ĐƯỢC GHI NHẬN"}</span>
            <h1>Nộp bài thành công</h1>
            <p className="muted-line">Kết quả đã được gửi tới giáo viên.</p>
            <div className="score-bubble"><strong>{completed.score.toFixed(2)}</strong><span>/ 10</span></div>
            <div className="section-score-grid">
              <div><span>Phần I</span><strong>{completed.sections.sectionI.score.toFixed(2)} / {completed.sections.sectionI.max.toFixed(2)}</strong><small>{completed.sections.sectionI.correct}/{completed.sections.sectionI.total} câu đúng</small></div>
              <div><span>Phần II</span><strong>{completed.sections.sectionII.score.toFixed(2)} / {completed.sections.sectionII.max.toFixed(2)}</strong><small>{completed.sections.sectionII.correctStatements}/{completed.sections.sectionII.totalStatements} ý đúng</small></div>
              <div><span>Phần III</span><strong>{completed.sections.sectionIII.score.toFixed(2)} / {completed.sections.sectionIII.max.toFixed(2)}</strong><small>{completed.sections.sectionIII.correct}/{completed.sections.sectionIII.total} câu đúng</small></div>
            </div>
            <p className="score-footnote">Điểm được quy đổi theo các phần I–III đã làm; phần tự luận không nằm trong bài thi trực tuyến.</p>
            <button className="button-primary result-back" type="button" onClick={() => setCompleted(null)}>Quay lại danh sách đề <ArrowRight size={17} /></button>
          </section>
        ) : student ? (
          <>
            <section className="welcome-band">
              <div className="welcome-copy">
                <div className="eyebrow"><span className="eyebrow-dot" /> HỌC KỲ I · HÓA HỌC LỚP 10</div>
                <h1>Chọn đề em muốn bắt đầu.</h1>
                <p>Mỗi đề có 30 phút. Em có thể làm lần lượt từng phần và nộp khi hoàn thành.</p>
              </div>
              <div className="welcome-stamp"><BookOpen size={25} /><span>25 đề<br /><b>đang mở</b></span></div>
            </section>
            <div className="student-strip">
              <div className="student-chip"><span className="student-chip-icon"><UserRound size={18} /></span><div><small>HỌC SINH</small><strong>{student.studentName}</strong></div><i /> <div><small>LỚP</small><strong>{student.className}</strong></div></div>
              <button className="text-button" type="button" onClick={() => { setStudent(null); setError(""); }}>Đổi thông tin</button>
            </div>
            {error && <div className="inline-alert" role="alert">{error}</div>}
            <div className="list-heading"><div><h2>Danh sách đề kiểm tra</h2><p>Chọn một đề để vào phòng làm bài.</p></div><span className="total-exams-pill">25 ĐỀ</span></div>
            <div className="exam-grid">
              {exams.map((item, index) => (
                <article className="exam-choice-card" key={item.id}>
                  <div className="exam-card-top"><span className={`exam-number-badge badge-${index % 4}`}>{String(item.id).padStart(2, "0")}</span><span className="time-pill"><Clock3 size={14} /> 30 phút</span></div>
                  <div className="exam-card-body"><span className="topic-kicker">{item.topic}</span><h3>{item.title}</h3><p>Phần I · Phần II · Phần III</p></div>
                  <button className="exam-start-button" type="button" onClick={() => void startExam(item)} disabled={startLoading !== null}>
                    {startLoading === item.id ? "Đang mở đề…" : "Bắt đầu làm bài"}<ArrowRight size={17} />
                  </button>
                </article>
              ))}
            </div>
          </>
        ) : (
          <section className="login-layout">
            <div className="login-story">
              <div className="eyebrow"><span className="eyebrow-dot" /> THPT QUANG TRUNG</div>
              <h1>Học chắc từng phần.<br /><em>Tự tin vào phòng thi.</em></h1>
              <p>25 đề Hóa học lớp 10 được sắp theo từng chủ đề học kỳ I. Đọc kỹ câu hỏi, chọn đáp án và theo dõi thời gian ngay trên màn hình.</p>
              <div className="login-facts">
                <div><span className="fact-icon"><Clock3 size={18} /></span><span><b>30 phút</b><small>cho mỗi đề</small></span></div>
                <div><span className="fact-icon fact-icon-gold"><GraduationCap size={19} /></span><span><b>25 đề</b><small>theo nội dung học kỳ I</small></span></div>
              </div>
              <div className="molecule-decoration" aria-hidden="true"><span /><span /><span /><span /></div>
            </div>
            <form className="login-card" onSubmit={handleStudentLogin}>
              <div className="login-card-icon"><GraduationCap size={24} /></div>
              <span className="eyebrow">KHU VỰC HỌC SINH</span>
              <h2>Vào làm bài</h2>
              <p>Nhập thông tin để chọn đề kiểm tra.</p>
              <label className="field-label">Họ và tên
                <input type="text" value={nameInput} onChange={event => setNameInput(event.target.value)} placeholder="Ví dụ: Nguyễn Minh Anh" autoComplete="name" required minLength={2} maxLength={120} />
              </label>
              <label className="field-label">Lớp
                <input type="text" value={classInput} onChange={event => setClassInput(event.target.value)} placeholder="Ví dụ: 10A1" required maxLength={40} />
              </label>
              {error && <div className="inline-alert" role="alert">{error}</div>}
              <button className="button-primary full-width" type="submit">Tiếp tục <ArrowRight size={18} /></button>
              <small className="form-note">Thông tin này giúp giáo viên xem kết quả bài làm của em.</small>
            </form>
          </section>
        )}
        {error && active && <div className="floating-alert" role="alert">{error}</div>}
      </main>

      {showSubmitConfirm && active && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowSubmitConfirm(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <span className="modal-icon"><Send size={22} /></span>
            <h2 id="confirm-title">Nộp bài kiểm tra?</h2>
            <p>Em đã trả lời {answered} trên {totalResponses} ý/câu. Sau khi nộp, em không thể sửa bài làm này.</p>
            <div className="modal-actions"><button className="button-secondary" type="button" onClick={() => setShowSubmitConfirm(false)}>Kiểm tra lại</button><button className="button-primary" type="button" disabled={submitting} onClick={() => void submitActive(false)}>{submitting ? "Đang nộp…" : "Xác nhận nộp"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
