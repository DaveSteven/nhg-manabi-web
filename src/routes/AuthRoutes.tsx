import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, MailCheck } from "lucide-react";
import { api } from "../lib/study";
import { BrandMark, FieldInput } from "../components/CommonUi";
import { Shell } from "../pages";

// T-028 自助注册（A18/D21）：/register /verify-email /forgot-password /reset-password 四个公开路由。
// 与登录页同构：Shell + login-card 单卡片居中，樱与墨主题变量自动适配日/夜。
// 后端契约：字段级错误 400 {"detail":{"errors":[{field,message}]}}；统一成功口径 200 {status, detail}。

type FieldErrors = Partial<Record<"username" | "email" | "password", string>>;

/** api() 把非 2xx 响应体原文塞进 Error.message；这里还原成用户可读文案。 */
export function parseAuthError(error: unknown): { message: string; fields: FieldErrors } {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  let detail: any = null;
  try {
    detail = JSON.parse(raw)?.detail;
  } catch {
    // 非 JSON：api() 的 429 等已翻译文案，或网络错误
  }
  if (detail && Array.isArray(detail.errors)) {
    const fields: FieldErrors = {};
    for (const item of detail.errors) {
      if (item?.field && !fields[item.field]) fields[item.field] = item.message;
    }
    const first = detail.errors[0]?.message || "提交内容有误，请检查后重试。";
    return { message: first, fields };
  }
  if (typeof detail === "string" && detail) return { message: detail, fields: {} };
  return { message: raw.includes("频繁") ? raw : "操作失败，请稍后重试。", fields: {} };
}

/** 60s 倒计时重发按钮：与后端 ≥60s 重发间隔一致。 */
function ResendButton({ onResend, label = "重新发送邮件" }: { onResend: () => Promise<void>; label?: string }) {
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setSeconds((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function click() {
    setBusy(true);
    try {
      await onResend();
      setSeconds(60);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="secondary-button" type="button" onClick={click} disabled={busy || seconds > 0}>
      {seconds > 0 ? `${seconds}s 后可${label}` : label}
    </button>
  );
}

function AuthCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="login-page">
      <div className="login-card auth-card">
        <div className="login-brand">
          <BrandMark size={52} />
          <div className="brand-title">
            JLPT <span>GO!</span>
          </div>
          <h2 className="auth-title">{title}</h2>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function AuthField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="auth-field">
      {children}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

function AuthLinks({ showRegister = true }: { showRegister?: boolean }) {
  return (
    <div className="login-links">
      {showRegister ? <Link to="/register">注册新账号</Link> : null}
      <Link to="/login">返回登录</Link>
    </div>
  );
}

/* ---- /register：注册 → 「请查收邮件」面板（含 60s 重发） ---- */

export function RegisterRoute() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    setFieldErrors({});
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
      });
      setSentEmail(email.trim());
      setDone(true);
    } catch (error) {
      const parsed = parseAuthError(error);
      // 字段级错误已在对应输入框下方展示，不重复显示顶部错误
      setMessage(Object.keys(parsed.fields).length ? "" : parsed.message);
      setFieldErrors(parsed.fields);
    }
  }

  async function resend() {
    try {
      const result = await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: sentEmail }),
      });
      // 后端发信失败也返回 200，detail 会带失败说明
      if (result?.detail && result.detail !== "ok") setMessage(result.detail);
      else setMessage("");
    } catch (error) {
      setMessage(parseAuthError(error).message);
    }
  }

  if (done) {
    return (
      <Shell>
        <AuthCard title="请查收邮件" subtitle={`验证邮件已发送至 ${sentEmail}`}>
          <div className="auth-done-panel">
            <MailCheck size={40} aria-hidden="true" />
            <p>点击邮件中的链接完成验证（24 小时内有效）。验证通过后即可用用户名登录。</p>
            {message ? <p className="form-error">{message}</p> : null}
            <ResendButton onResend={resend} label="重新发送验证邮件" />
            <Link className="secondary-button" to="/login">
              返回登录
            </Link>
          </div>
        </AuthCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <AuthCard>
        <form className="new-user-form" onSubmit={submit} noValidate>
          <AuthField label="用户名" error={fieldErrors.username}>
            <FieldInput label="用户名" value={username} onChange={setUsername} placeholder="小写英文、数字、下划线，登录时使用" />
          </AuthField>
          <AuthField label="邮箱" error={fieldErrors.email}>
            <FieldInput label="邮箱" value={email} onChange={setEmail} placeholder="用于接收验证邮件" type="email" />
          </AuthField>
          <AuthField label="密码" error={fieldErrors.password}>
            <FieldInput label="密码" value={password} onChange={setPassword} placeholder="设置密码" type="password" />
          </AuthField>
          <p className="auth-hint">密码 6–64 位，可使用字母、数字和常规符号（不含空格和反引号）</p>
          {message ? <p className="form-error">{message}</p> : null}
          <button className="primary-button" type="submit" disabled={!username.trim() || !email.trim() || !password}>
            注册
          </button>
        </form>
        <AuthLinks showRegister={false} />
      </AuthCard>
    </Shell>
  );
}

/* ---- /verify-email?token=：加载即验证，成功引导登录，失败可重发 ---- */

export function VerifyEmailRoute() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  // 重放已用链接：后端查激活状态幂等返回 already，展示「已激活」而非误导性「失效」
  const [already, setAlready] = useState(false);
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let alive = true;
    api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then((result) => {
        if (!alive) return;
        if (result?.status === "already") setAlready(true);
        setState("ok");
      })
      .catch((error) => {
        if (!alive) return;
        setMessage(parseAuthError(error).message);
        setState("failed");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function resend() {
    try {
      const result = await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      if (result?.detail && result.detail !== "ok") setMessage(result.detail);
      else {
        setMessage("");
        setResent(true);
      }
    } catch (error) {
      setMessage(parseAuthError(error).message);
    }
  }

  return (
    <Shell>
      <AuthCard
        title={
          state === "ok"
            ? already
              ? "该账号已激活"
              : "邮箱验证成功"
            : state === "loading"
              ? "正在验证…"
              : "链接无效或已过期"
        }
        subtitle={state === "ok" ? "账号已激活，现在可以登录了" : undefined}
      >
        {state === "ok" ? (
          <div className="auth-done-panel">
            <Link className="primary-button" to="/login">
              <LogIn size={18} aria-hidden="true" /> 去登录
            </Link>
          </div>
        ) : state === "failed" ? (
          <div className="auth-done-panel">
            <p>{message || "验证链接已失效。"}</p>
            <div className="new-user-form">
              <FieldInput label="邮箱" value={resendEmail} onChange={setResendEmail} placeholder="注册时填写的邮箱" type="email" />
            </div>
            {resent ? <p className="form-success">邮件已发送，请查收（若 60s 内刚发过会被暂时拦下，稍后再试）。</p> : null}
            <ResendButton onResend={resend} label="重新发送验证邮件" />
            <AuthLinks />
          </div>
        ) : null}
      </AuthCard>
    </Shell>
  );
}

/* ---- /forgot-password：统一成功口径 ---- */

export function ForgotPasswordRoute() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const result = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (result?.detail && result.detail !== "ok") setMessage(result.detail);
      else setDone(true);
    } catch (error) {
      setMessage(parseAuthError(error).message);
    }
  }

  if (done) {
    return (
      <Shell>
        <AuthCard title="请查收邮件" subtitle="如果该邮箱对应已激活的账号，重置邮件已发出">
          <div className="auth-done-panel">
            <MailCheck size={40} aria-hidden="true" />
            <p>点击邮件中的链接设置新密码（24 小时内有效）。B4 代建、未填邮箱的老账号暂不支持自助重置，请联系管理员。</p>
            <ResendButton
              onResend={async () => {
                try {
                  const result = await api("/api/auth/forgot-password", {
                    method: "POST",
                    body: JSON.stringify({ email: email.trim() }),
                  });
                  if (result?.detail && result.detail !== "ok") setMessage(result.detail);
                } catch (error) {
                  setMessage(parseAuthError(error).message);
                }
              }}
              label="重新发送重置邮件"
            />
            <AuthLinks showRegister={false} />
          </div>
        </AuthCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <AuthCard title="忘记密码" subtitle="填写注册邮箱，我们会发送重置链接">
        <form className="new-user-form" onSubmit={submit} noValidate>
          <FieldInput label="邮箱" value={email} onChange={setEmail} placeholder="注册时填写的邮箱" type="email" />
          {message ? <p className="form-error">{message}</p> : null}
          <button className="primary-button" type="submit" disabled={!email.trim()}>
            发送重置邮件
          </button>
        </form>
        <AuthLinks />
      </AuthCard>
    </Shell>
  );
}

/* ---- /reset-password?token=：新密码同注册规则，成功后旧会话全部失效 ---- */

export function ResetPasswordRoute() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setMessage("两次输入的密码不一致。");
      return;
    }
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (error) {
      setMessage(parseAuthError(error).message);
    }
  }

  if (done) {
    return (
      <Shell>
        <AuthCard title="密码已重置" subtitle="请使用新密码重新登录（原登录会话已全部失效）">
          <div className="auth-done-panel">
            <button className="primary-button" type="button" onClick={() => navigate("/login")}>
              <LogIn size={18} aria-hidden="true" /> 去登录
            </button>
          </div>
        </AuthCard>
      </Shell>
    );
  }

  if (!token) {
    return (
      <Shell>
        <AuthCard title="链接无效" subtitle="缺少重置凭证">
          <div className="auth-done-panel">
            <p>请从重置邮件中的链接进入；链接已失效时重新获取一封。</p>
            <Link className="primary-button" to="/forgot-password">
              重新获取重置邮件
            </Link>
          </div>
        </AuthCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <AuthCard title="设置新密码" subtitle="重置后原有登录会话将全部失效">
        <form className="new-user-form" onSubmit={submit} noValidate>
          <FieldInput label="新密码" value={password} onChange={setPassword} placeholder="设置新密码" type="password" />
          <FieldInput label="确认新密码" value={confirm} onChange={setConfirm} placeholder="再次输入新密码" type="password" />
          <p className="auth-hint">密码 6–64 位，可使用字母、数字和常规符号（不含空格和反引号）</p>
          {message ? <p className="form-error">{message}</p> : null}
          <button className="primary-button" type="submit" disabled={!password || !confirm}>
            重置密码
          </button>
        </form>
        <AuthLinks showRegister={false} />
      </AuthCard>
    </Shell>
  );
}
