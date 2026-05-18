const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const serverless = require("serverless-http");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || "HUSSEIN_ADMIN_SECRET_2026";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateKey() {
  const p1 = crypto.randomBytes(3).toString("hex").toUpperCase();
  const p2 = crypto.randomBytes(3).toString("hex").toUpperCase();
  const p3 = crypto.randomBytes(3).toString("hex").toUpperCase();
  const p4 = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `HUS-${p1}-${p2}-${p3}-${p4}`;
}

function durationToMinutes(type, value) {
  const v = Number(value);

  if (!v || v <= 0) return null;

  switch (type) {
    case "minute":
      return v;
    case "hour":
      return v * 60;
    case "day":
      return v * 60 * 24;
    case "week":
      return v * 60 * 24 * 7;
    case "month":
      return v * 60 * 24 * 30;
    case "year":
      return v * 60 * 24 * 365;
    default:
      return null;
  }
}

function isAdmin(req) {
  const secret = req.headers["x-admin-secret"] || req.query.secret;
  return secret === ADMIN_SECRET;
}

async function logAttempt(deviceId, ip, success) {
  await supabase.from("attempts").insert({
    device_id: deviceId || "",
    ip: ip || "",
    success: !!success,
    created_at: Date.now()
  });
}

async function blockDevice(deviceId, reason) {
  if (!deviceId) return;

  await supabase.from("blocked_devices").upsert({
    device_id: deviceId,
    reason: reason,
    created_at: Date.now()
  });
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Hussein License Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body {
  font-family: Arial, sans-serif;
  background: linear-gradient(135deg, #06111f, #0b2740);
  color: white;
  padding: 25px;
}
.card {
  max-width: 900px;
  margin: auto;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  padding: 22px;
  border-radius: 18px;
  box-shadow: 0 20px 50px rgba(0,0,0,.3);
}
input, select, button {
  width: 100%;
  padding: 14px;
  margin: 8px 0;
  border-radius: 10px;
  border: none;
  font-size: 16px;
  box-sizing: border-box;
}
button {
  background: #38bdf8;
  color: #00111f;
  font-weight: bold;
  cursor: pointer;
}
.key {
  background: #020617;
  padding: 15px;
  border-radius: 10px;
  margin-top: 15px;
  direction: ltr;
  text-align: center;
  font-size: 17px;
  color: #facc15;
  word-break: break-all;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 25px;
  font-size: 13px;
  min-width: 760px;
}
td, th {
  border: 1px solid rgba(255,255,255,.15);
  padding: 8px;
  text-align: center;
}
.badge {
  padding: 5px 10px;
  border-radius: 10px;
}
.ok { background: #16a34a; }
.no { background: #dc2626; }
</style>
</head>
<body>
<div class="card">
  <h1>لوحة مفاتيح التفعيل</h1>
  <p>Developed by Hussein Ali</p>

  <h3>إنشاء مفتاح جديد</h3>

  <input id="secret" placeholder="رمز الإدارة ADMIN_SECRET">

  <input id="value" type="number" value="1" placeholder="المدة">

  <select id="type">
    <option value="minute">دقيقة</option>
    <option value="hour">ساعة</option>
    <option value="day">يوم</option>
    <option value="week">أسبوع</option>
    <option value="month">شهر</option>
    <option value="year">سنة</option>
  </select>

  <button onclick="createKey()">إنشاء مفتاح</button>

  <div id="result"></div>

  <h3>المفاتيح</h3>
  <button onclick="loadKeys()">تحديث القائمة</button>
  <div id="keys"></div>
</div>

<script>
async function createKey() {
  const secret = document.getElementById("secret").value;
  const value = document.getElementById("value").value;
  const type = document.getElementById("type").value;

  const res = await fetch("/admin/create-key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret
    },
    body: JSON.stringify({ value, type })
  });

  const data = await res.json();

  if (data.success) {
    document.getElementById("result").innerHTML =
      '<div class="key">' + data.key + '</div>';
    loadKeys();
  } else {
    document.getElementById("result").innerHTML =
      '<div class="key" style="color:#ef4444">' + data.message + '</div>';
  }
}

async function loadKeys() {
  const secret = document.getElementById("secret").value;

  const res = await fetch("/admin/licenses?secret=" + encodeURIComponent(secret));
  const data = await res.json();

  if (!data.success) {
    document.getElementById("keys").innerHTML = data.message;
    return;
  }

  let html = '<div class="table-wrap"><table><tr><th>ID</th><th>المفتاح</th><th>فعال</th><th>مستخدم</th><th>الجهاز</th><th>ينتهي</th><th>إجراء</th></tr>';

  data.licenses.forEach(k => {
    html += \`
      <tr>
        <td>\${k.id}</td>
        <td>\${k.plain_preview}</td>
        <td>\${k.is_active ? '<span class="badge ok">فعال</span>' : '<span class="badge no">متوقف</span>'}</td>
        <td>\${k.is_used ? "نعم" : "لا"}</td>
        <td>\${k.device_id || "-"}</td>
        <td>\${k.expires_at ? new Date(Number(k.expires_at)).toLocaleString() : "-"}</td>
        <td><button onclick="disableKey(\${k.id})">إيقاف</button></td>
      </tr>
    \`;
  });

  html += "</table></div>";
  document.getElementById("keys").innerHTML = html;
}

async function disableKey(id) {
  const secret = document.getElementById("secret").value;

  await fetch("/admin/disable-key/" + id, {
    method: "POST",
    headers: {
      "x-admin-secret": secret
    }
  });

  loadKeys();
}
</script>
</body>
</html>
  `);
});

app.post("/admin/create-key", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "غير مصرح"
      });
    }

    const { type, value } = req.body;
    const minutes = durationToMinutes(type, value);

    if (!minutes) {
      return res.json({
        success: false,
        message: "مدة غير صحيحة"
      });
    }

    const key = generateKey();
    const keyHash = hashKey(key);

    const { error } = await supabase.from("licenses").insert({
      key_hash: keyHash,
      plain_preview: key,
      duration_minutes: minutes,
      created_at: Date.now()
    });

    if (error) {
      return res.json({
        success: false,
        message: "فشل إنشاء المفتاح",
        error: error.message
      });
    }

    return res.json({
      success: true,
      key,
      duration_minutes: minutes
    });

  } catch (e) {
    return res.json({
      success: false,
      message: "خطأ بالسيرفر",
      error: e.message
    });
  }
});

app.get("/admin/licenses", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "غير مصرح"
      });
    }

    const { data, error } = await supabase
      .from("licenses")
      .select("id, plain_preview, duration_minutes, is_used, is_active, device_id, activated_at, expires_at, created_at")
      .order("id", { ascending: false });

    if (error) {
      return res.json({
        success: false,
        message: "خطأ بقراءة البيانات",
        error: error.message
      });
    }

    return res.json({
      success: true,
      licenses: data || []
    });

  } catch (e) {
    return res.json({
      success: false,
      message: "خطأ بالسيرفر",
      error: e.message
    });
  }
});

app.post("/admin/disable-key/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "غير مصرح"
      });
    }

    const { error } = await supabase
      .from("licenses")
      .update({ is_active: false })
      .eq("id", req.params.id);

    if (error) {
      return res.json({
        success: false,
        message: "فشل إيقاف المفتاح",
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: "تم إيقاف المفتاح"
    });

  } catch (e) {
    return res.json({
      success: false,
      message: "خطأ بالسيرفر",
      error: e.message
    });
  }
});

app.post("/api/activate", async (req, res) => {
  try {
    const { license_key, device_id } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";

    if (!license_key || !device_id) {
      await logAttempt(device_id, ip, false);

      return res.json({
        success: false,
        status: "missing_data",
        message: "البيانات ناقصة"
      });
    }

    const { data: blocked } = await supabase
      .from("blocked_devices")
      .select("*")
      .eq("device_id", device_id)
      .maybeSingle();

    if (blocked) {
      return res.json({
        success: false,
        status: "blocked",
        message: "هذا الجهاز محظور"
      });
    }

    const keyHash = hashKey(license_key);

    const { data: license, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (error || !license) {
      await logAttempt(device_id, ip, false);

      const tenMinAgo = Date.now() - 10 * 60 * 1000;

      const { data: attempts } = await supabase
        .from("attempts")
        .select("id")
        .eq("device_id", device_id)
        .eq("success", false)
        .gt("created_at", tenMinAgo);

      if (attempts && attempts.length >= 5) {
        await blockDevice(device_id, "محاولات مفاتيح خاطئة كثيرة");
      }

      return res.json({
        success: false,
        status: "invalid_key",
        message: "المفتاح غير صحيح"
      });
    }

    if (!license.is_active) {
      await logAttempt(device_id, ip, false);

      return res.json({
        success: false,
        status: "disabled",
        message: "المفتاح متوقف"
      });
    }

    if (license.is_used && license.device_id !== device_id) {
      await logAttempt(device_id, ip, false);

      return res.json({
        success: false,
        status: "already_used",
        message: "هذا المفتاح مستخدم على جهاز آخر"
      });
    }

    const now = Date.now();

    if (license.expires_at && now > Number(license.expires_at)) {
      await logAttempt(device_id, ip, false);

      return res.json({
        success: false,
        status: "expired",
        message: "انتهت صلاحية المفتاح"
      });
    }

    if (!license.is_used) {
      const expiresAt = now + Number(license.duration_minutes) * 60 * 1000;

      const { error: updateError } = await supabase
        .from("licenses")
        .update({
          is_used: true,
          device_id: device_id,
          activated_at: now,
          expires_at: expiresAt
        })
        .eq("id", license.id);

      if (updateError) {
        return res.json({
          success: false,
          status: "update_error",
          message: "فشل تفعيل المفتاح",
          error: updateError.message
        });
      }

      await logAttempt(device_id, ip, true);

      return res.json({
        success: true,
        status: "activated",
        message: "تم التفعيل بنجاح",
        expires_at: expiresAt
      });
    }

    await logAttempt(device_id, ip, true);

    return res.json({
      success: true,
      status: "active",
      message: "المفتاح فعال",
      expires_at: license.expires_at
    });

  } catch (e) {
    return res.json({
      success: false,
      status: "server_error",
      message: "خطأ بالسيرفر",
      error: e.message
    });
  }
});

app.post("/api/check", async (req, res) => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      return res.json({
        success: false,
        status: "missing_device",
        message: "الجهاز غير معروف"
      });
    }

    const { data: blocked } = await supabase
      .from("blocked_devices")
      .select("*")
      .eq("device_id", device_id)
      .maybeSingle();

    if (blocked) {
      return res.json({
        success: false,
        status: "blocked",
        message: "الجهاز محظور"
      });
    }

    const { data: license, error } = await supabase
      .from("licenses")
      .select("*")
      .eq("device_id", device_id)
      .eq("is_used", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !license) {
      return res.json({
        success: false,
        status: "not_activated",
        message: "التطبيق غير مفعل"
      });
    }

    if (!license.is_active) {
      return res.json({
        success: false,
        status: "disabled",
        message: "تم إيقاف التفعيل"
      });
    }

    const now = Date.now();

    if (now > Number(license.expires_at)) {
      return res.json({
        success: false,
        status: "expired",
        message: "انتهت مدة التفعيل"
      });
    }

    return res.json({
      success: true,
      status: "active",
      message: "التطبيق فعال",
      expires_at: license.expires_at
    });

  } catch (e) {
    return res.json({
      success: false,
      status: "server_error",
      message: "خطأ بالسيرفر",
      error: e.message
    });
  }
});

module.exports.handler = serverless(app);
