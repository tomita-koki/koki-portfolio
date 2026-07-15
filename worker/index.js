// =============================================================================
// お問い合わせフォーム API（Cloudflare Worker）
// POST /api/contact を受けて、Turnstile 検証 → Resend でメール送信を行う。
// 静的アセット（dist/）は wrangler.toml の [assets] が先に処理するため、
// この Worker にはアセットに一致しないリクエストだけが届く。
// =============================================================================

const TYPE_LABELS = {
  coding: "コーディング代行",
  maintenance: "運用保守",
  other: "その他",
};

// 入力値の上限（暴走した長文・添付まがいの投稿を弾く）
const MAX_LENGTHS = {
  name: 100,
  company: 100,
  email: 254,
  message: 5000,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function validate(data) {
  const required = ["name", "email", "type", "message"];
  for (const key of required) {
    if (typeof data[key] !== "string" || data[key].trim() === "") {
      return "必須項目が入力されていません。";
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return "メールアドレスの形式が正しくありません。";
  }
  if (!(data.type in TYPE_LABELS)) {
    return "ご依頼の種別が不正です。";
  }
  for (const [key, max] of Object.entries(MAX_LENGTHS)) {
    if (typeof data[key] === "string" && data[key].length > max) {
      return "入力内容が長すぎます。";
    }
  }
  return null;
}

async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    }
  );
  if (!res.ok) return false;
  const result = await res.json();
  return result.success === true;
}

const FROM_ADDRESS = "お問い合わせ窓口｜koki-code <noreply@koki-code.com>";

async function sendViaResend(payload, env) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

// 管理者（自分）宛ての通知メール
function sendNotification(data, env) {
  const typeLabel = TYPE_LABELS[data.type];
  const text = [
    "ポートフォリオサイトからお問い合わせがありました。",
    "",
    `お名前: ${data.name}`,
    `会社名: ${data.company || "（未入力）"}`,
    `メールアドレス: ${data.email}`,
    `ご依頼の種別: ${typeLabel}`,
    "",
    "--- お問い合わせ内容 ---",
    data.message,
  ].join("\n");

  return sendViaResend(
    {
      from: FROM_ADDRESS,
      to: [env.CONTACT_TO],
      reply_to: data.email,
      subject: `【お問い合わせ】${typeLabel} - ${data.name}様`,
      text,
    },
    env
  );
}

// 問い合わせ者への自動返信メール
function sendAutoReply(data, env) {
  const typeLabel = TYPE_LABELS[data.type];
  const text = [
    `${data.name} 様`,
    "",
    "お問い合わせありがとうございます。",
    "以下の内容で受け付けました。2〜3営業日以内にご返信いたしますので、",
    "今しばらくお待ちください。",
    "",
    "--- お問い合わせ内容の控え ---",
    `お名前: ${data.name}`,
    `会社名: ${data.company || "（未入力）"}`,
    `ご依頼の種別: ${typeLabel}`,
    "",
    data.message,
    "-----------------------------",
    "",
    "※このメールは自動送信です。心当たりがない場合は破棄してください。",
    "",
    "koki｜Web制作・コーディング代行",
    "https://koki-code.com/",
  ].join("\n");

  return sendViaResend(
    {
      from: FROM_ADDRESS,
      to: [data.email],
      reply_to: env.CONTACT_TO,
      subject: "【自動返信】お問い合わせを受け付けました｜koki",
      text,
    },
    env
  );
}

async function handleContact(request, env, ctx) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "リクエストが不正です。" }, 400);
  }

  // ハニーポット: 人間には見えない欄が埋まっていたらボットとみなし、
  // 気付かれないよう成功を装って捨てる
  if (typeof data.website === "string" && data.website !== "") {
    return json({ ok: true });
  }

  const error = validate(data);
  if (error) {
    return json({ ok: false, error }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const human = await verifyTurnstile(
    data["cf-turnstile-response"],
    env.TURNSTILE_SECRET_KEY,
    ip
  );
  if (!human) {
    return json(
      { ok: false, error: "認証に失敗しました。ページを再読み込みしてもう一度お試しください。" },
      403
    );
  }

  const sent = await sendNotification(data, env);
  if (!sent) {
    return json(
      { ok: false, error: "送信に失敗しました。時間をおいてもう一度お試しください。" },
      502
    );
  }

  // 自動返信はレスポンスを待たせず裏で送る。失敗しても通知は届いているので
  // 問い合わせ自体は成立とみなす
  ctx.waitUntil(sendAutoReply(data, env));

  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ ok: false, error: "Method Not Allowed" }, 405);
      }
      return handleContact(request, env, ctx);
    }
    return new Response("Not Found", { status: 404 });
  },
};
