import { supabase } from "./supabase-client.js";
const form = document.querySelector("#auth-form");
const message = document.querySelector("#auth-message");
const title = document.querySelector("#auth-title");
const submit = document.querySelector("#auth-submit");
const toggle = document.querySelector("#auth-toggle");
const logout = document.querySelector("#auth-logout");
const email = document.querySelector("#auth-email");
const password = document.querySelector("#auth-password");
let signup = false;
const target = new URLSearchParams(location.search).get("next");
const safeTarget = target && /^([a-zA-Z0-9_-]+\.html)(\?.*)?$/.test(target) ? target : "play.html";
const show = s => message.textContent = s;
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  form.hidden = true; logout.hidden = false; title.textContent = "내 계정";
  show(user.email + " 계정으로 로그인되어 있습니다.");
}
toggle.addEventListener("click", () => {
  signup = !signup; title.textContent = signup ? "회원가입" : "로그인";
  submit.textContent = signup ? "계정 만들기" : "로그인";
  toggle.textContent = signup ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입";
  show("");
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  submit.disabled = true;
  show("확인 중...");
  const credentials = { email: email.value.trim(), password: password.value };
  const result = signup
    ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: new URL("auth.html", location.href).href } })
    : await supabase.auth.signInWithPassword(credentials);
  submit.disabled = false;
  if (result.error) { show(result.error.message); return; }
  if (result.data.session) { location.replace(safeTarget); return; }
  show("인증 이메일을 보냈습니다. 메일에서 확인한 뒤 로그인하세요.");
});
logout.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) { show(error.message); return; }
  location.replace("index.html");
});
