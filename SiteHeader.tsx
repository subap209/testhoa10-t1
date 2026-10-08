import { FlaskConical } from "lucide-react";

const AVATAR_SRC = "/manus-storage/ChatGPTImageMay5,2026,10_05_31PM_9003d539.png";

export default function SiteHeader({ teacher = false }: { teacher?: boolean }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="teacher-avatar" href="/" aria-label="Trang chủ THPT Quang Trung">
          <img src={AVATAR_SRC} alt="Ảnh đại diện giáo viên Hóa học" />
          <span className="avatar-online" aria-hidden="true" />
        </a>
        <a className="masthead" href="/" aria-label="THPT Quang Trung — Đề kiểm tra Hóa 10">
          <span className="masthead-school">THPT QUANG TRUNG</span>
          <span className="masthead-exam">ĐỀ KIỂM TRA HÓA 10 - TẬP 1</span>
        </a>
        <nav className="header-nav" aria-label="Điều hướng chính">
          <a className={`header-nav-link ${teacher ? "is-active" : ""}`} href={teacher ? "/" : "/teacher"}>
            <FlaskConical size={18} strokeWidth={2.2} />
            <span>{teacher ? "Trang học sinh" : "Giáo viên"}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
