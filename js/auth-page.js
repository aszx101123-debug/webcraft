import { supabase } from "./supabase-client.js";

const $ = selector => document.querySelector(selector);
const form = $("#auth-form");
const message = $("#auth-message");
const title = $("#auth-title");
const submit = $("#auth-submit");
const toggle = $("#auth-toggle");
const logout = $("#auth-logout");
const email = $("#auth-email");
const password = $("#auth-password");
const enter = $("#auth-enter");
const resend = $("#auth-resend");
const status = value => { message.textContent = value; };
let signup = false;

const requested = new URLSearchParams(location.search).get("next");
const next = requested && /^(?:[\w-]+\.html)(?:\?[^#]*)?$/.test(requested) ? requested : "play.html";
enter.href = next;
$("#auth-guest").href = next;

function friendlyError(error) {
  switch (error?.code) {
    case "invalid_credentials": return "이메일 또는 비밀번호가 올바르지 않습니다. 이메일 인증을 완료했는지도 확인하세요.";
    case "email_not_confirmed": return "이메일 인증이 필요합니다. 받은 편지함에서 최신 인증 메일을 확인하세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "요청 횟수가 많습니다. 잠시 후 다시 시도해 주세요.";
    case "email_exists":
    case "user_already_exists": return "이미 등록된 이메일입니다. 로그인으로 전환하세요.";
    default: return error?.message || "로그인에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
function setMode(isSignup) {
  signup = isSignup;
  title.textContent = signup ? "회원가입" : "로그인";
  submit.textContent = signup ? "계정 만들기" : "로그인";
  toggle.textContent = signup ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입";
  password.autocomplete = signup ? "new-password" : "current-password";
  resend.hidden = !signup;
  status("");
}
function loggedIn(user) {
  $("#auth-guest").hidden = true;
  form.hidden = true;
  toggle.hidden = true;
  resend.hidden = true;
  logout.hidden = false;
  enter.hidden = false;
  title.textContent = "로그인 완료";
  status("로그인되었습니다. 게임 시작 버튼을 눌러 주세요.");
}
const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
const searchParams = new URLSearchParams(location.search);
const linkError = hashParams.get("error_code") || searchParams.get("error_code");
if (linkError) {
  const detail = hashParams.get("error_description") || searchParams.get("error_description") || "";
  status(linkError === "otp_expired" || /expired|invalid/i.test(detail)
    ? "인증 링크가 만료되었거나 이미 사용되었습니다. 인증을 완료했다면 기존 이메일과 비밀번호로 로그인하세요."
    : "이메일 인증 링크를 처리하지 못했습니다. 로그인하거나 인증 이메일을 다시 요청하세요.");
  history.replaceState(null, "", location.pathname + (requested ? "?next=" + encodeURIComponent(requested) : ""));
}

try {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (user) loggedIn(user);
  else if (error && !linkError) status("로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.");
} catch (error) {
  status("인증 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.");
}

toggle.addEventListener("click", () => setMode(!signup));
form.addEventListener("submit", async event => {
  event.preventDefault();
  submit.disabled = true;
  status("확인 중...");
  try {
    const credentials = { email: email.value.trim(), password: password.value };
    const { data, error } = signup
      ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: new URL("auth.html", location.href).href } })
      : await supabase.auth.signInWithPassword(credentials);
    if (error) { status(friendlyError(error)); return; }
    if (data?.session) { location.assign(next); return; }
    if (signup) {
      status("확인 메일을 보냈습니다. 이메일 인증을 마친 뒤 로그인하세요. 이미 가입한 계정이면 로그인으로 전환하세요.");
      resend.hidden = false;
    } else status("로그인 세션을 만들지 못했습니다. 이메일 인증 후 다시 로그인하세요.");
  } catch (_) {
    status("인증 서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  } finally {
    submit.disabled = false;
  }
});

resend.addEventListener("click", async () => {
  if (!email.value.trim() || !email.validity.valid) {
    status("인증 메일을 받을 이메일 주소를 먼저 입력하세요.");
    email.focus(); return;
  }
  resend.disabled = true;
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.value.trim(),
      options: { emailRedirectTo: new URL("auth.html", location.href).href }
    });
    status(error ? friendlyError(error) : "인증 메일을 요청했습니다. 새로 도착한 메일을 확인하세요.");
  } catch (_) { status("메일 요청에 실패했습니다. 인터넷 연결을 확인하세요."); }
  finally { resend.disabled = false; }
});

logout.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) { status(friendlyError(error)); return; }
  location.replace("index.html");
});
