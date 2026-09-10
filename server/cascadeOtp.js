"use strict";

const DEFAULT_BASE = "https://cascade.kz/api";

/** Keep digits only; KZ 8XXXXXXXXXX → 7XXXXXXXXXX. */
function normalizePhone(raw) {
  let digits = String(raw || "").replace(/\D+/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }
  return digits;
}

function phoneLooksValid(digits) {
  return digits.length >= 10 && digits.length <= 15;
}

function otpConfig() {
  const baseUrl = String(process.env.OTP_API_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const token = String(process.env.OTP_API_TOKEN || "").trim();
  return { baseUrl, token };
}

async function cascadeRequest(path, body) {
  const { baseUrl, token } = otpConfig();
  if (!token) {
    return { success: false, message: "OTP-сервис не настроен", status: 503 };
  }
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return { success: false, message: "Не удалось связаться с OTP-сервисом", status: 502 };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") {
    return { success: false, message: "Пустой ответ OTP-сервиса", status: res.status || 502 };
  }
  return { ...data, status: res.status };
}

/**
 * @param {string} phone
 * @param {{ purpose?: string, channel?: string, link?: string, link_expires_in?: number }} [options]
 */
async function sendOtp(phone, options = {}) {
  const normalized = normalizePhone(phone);
  if (!phoneLooksValid(normalized)) {
    return { success: false, message: "Неверный формат номера телефона", status: 422 };
  }
  const payload = {
    phone: normalized,
    purpose: options.purpose || "verification",
  };
  if (options.channel) payload.channel = options.channel;
  if (options.link) payload.link = options.link;
  if (options.link_expires_in != null) payload.link_expires_in = options.link_expires_in;
  return cascadeRequest("/otp/send", payload);
}

async function verifyOtp(phone, code, purpose = "verification") {
  const normalized = normalizePhone(phone);
  if (!phoneLooksValid(normalized)) {
    return { success: false, message: "Неверный формат номера телефона", status: 422 };
  }
  const cleanCode = String(code || "").replace(/\D+/g, "");
  if (cleanCode.length < 4) {
    return { success: false, message: "Введи код из сообщения", status: 422 };
  }
  return cascadeRequest("/otp/verify", {
    phone: normalized,
    code: cleanCode,
    purpose: purpose || "verification",
  });
}

module.exports = {
  normalizePhone,
  phoneLooksValid,
  otpConfig,
  sendOtp,
  verifyOtp,
};
