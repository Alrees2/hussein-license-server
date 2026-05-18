const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_SECRET = "HUSSEIN_ADMIN_SECRET_2026";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new sqlite3.Database("./license.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT UNIQUE NOT NULL,
      plain_preview TEXT,
      duration_minutes INTEGER NOT NULL,
      is_used INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      device_id TEXT,
      activated_at INTEGER,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blocked_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT UNIQUE NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT,
      ip TEXT,
      success INTEGER,
      created_at INTEGER NOT NULL
    )
  `);
});

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateKey() {
  const part1 = crypto.randomBytes(3).toString("hex").toUpperCase();
  const part2 = crypto.randomBytes(3).toString("hex").toUpperCase();
  const part3 = crypto.randomBytes(3).toString("hex").toUpperCase();
  const part4 = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `HUS-${part1}-${part2}-${part3}-${part4}`;
}

function durationToMinutes(type, value) {
  const v = Number(value);
  if (!v || v <= 0) return null;

  switch (type) {
    case "minute": return v;
    case "hour": return v * 60;
    case "day": return v * 60 * 24;
    case "week": return v * 60 * 24 * 7;
    case "month": return v * 60 * 24 * 30;
    case "year": return v * 60 * 24 * 365;
    default: return null;
  }
}

function isAdmin(req) {
  const secret = req.headers["x-admin-secret"] || req.query.secret;
  return secret === ADMIN_SECRET;
}

function logAttempt(deviceId, ip, success) {
  db.run(
    `INSERT INTO attempts (device_id, ip, success, created_at) VALUES (?, ?, ?, ?)`,
    [deviceId || "", ip || "", success ? 1 : 0, Date.now()]
  );
}

function blockDevice(deviceId, reason) {
  if (!deviceId) return;

  db.run(
    `INSERT OR IGNORE INTO blocked_devices (device_id, reason, created_at) VALUES (?, ?, ?)`,
    [deviceId, reason, Date.now()]
  );
}

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>Hussein License Admin</title>
<style>
body {
  font-family: Arial, sans-serif;
  background: linear-gradient(135deg, #06111f, #0b2740);
  color: white;
  padding: 30px;
}
.card {
  max-width: 850px;
  margin: auto;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  padding: 25px;
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
  font-size: 18px;
  color: #facc15;
  word-break: break-all;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 25px;
  font-size: 13px;
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

  let html = "<table><tr><th>ID</th><th>المفتاح</th><th>فعال</th><th>مستخدم</th><th>الجهاز</th><th>ينتهي</th><th>إجراء</th></tr>";

  data.licenses.forEach(k => {
    html += \`
      <tr>
        <td>\${k.id}</td>
        <td>\${k.plain_preview}</td>
        <td>\${k.is_active ? '<span class="badge ok">فعال</span>' : '<span class="badge no">متوقف</span>'}</td>
        <td>\${k.is_used ? "نعم" : "لا"}</td>
        <td>\${k.device_id || "-"}</td>
        <td>\${k.expires_at ? new Date(k.expires_at).toLocaleString() : "-"}</td>
        <td><button onclick="disableKey(\${k.id})">إيقاف</button></td>
      </tr>
    \`;
  });

  html += "</table>";
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

app.post("/admin/create-key", (req, res) => {
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

  db.run(
    `
    INSERT INTO licenses 
    (key_hash, plain_preview, duration_minutes, created_at) 
    VALUES (?, ?, ?, ?)
    `,
    [keyHash, key, minutes, Date.now()],
    function (err) {
      if (err) {
        return res.json({
          success: false,
          message: "فشل إنشاء المفتاح"
        });
      }

      res.json({
        success: true,
        key,
        duration_minutes: minutes
      });
    }
  );
});

app.get("/admin/licenses", (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "غير مصرح"
    });
  }

  db.all(
    `SELECT id, plain_preview, duration_minutes, is_used, is_active, device_id, activated_at, expires_at, created_at 
     FROM licenses 
     ORDER BY id DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.json({
          success: false,
          message: "خطأ بقراءة البيانات"
        });
      }

      res.json({
        success: true,
        licenses: rows
      });
    }
  );
});

app.post("/admin/disable-key/:id", (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "غير مصرح"
    });
  }

  db.run(
    `UPDATE licenses SET is_active = 0 WHERE id = ?`,
    [req.params.id],
    function () {
      res.json({
        success: true,
        message: "تم إيقاف المفتاح"
      });
    }
  );
});

app.post("/api/activate", (req, res) => {
  const { license_key, device_id } = req.body;
  const ip = req.ip;

  if (!license_key || !device_id) {
    logAttempt(device_id, ip, false);
    return res.json({
      success: false,
      status: "missing_data",
      message: "البيانات ناقصة"
    });
  }

  db.get(
    `SELECT * FROM blocked_devices WHERE device_id = ?`,
    [device_id],
    (err, blocked) => {
      if (blocked) {
        return res.json({
          success: false,
          status: "blocked",
          message: "هذا الجهاز محظور"
        });
      }

      const keyHash = hashKey(license_key);

      db.get(
        `SELECT * FROM licenses WHERE key_hash = ?`,
        [keyHash],
        (err, license) => {
          if (!license) {
            logAttempt(device_id, ip, false);

            db.all(
              `
              SELECT * FROM attempts 
              WHERE device_id = ? AND success = 0 AND created_at > ?
              `,
              [device_id, Date.now() - 10 * 60 * 1000],
              (e, attempts) => {
                if (attempts && attempts.length >= 5) {
                  blockDevice(device_id, "محاولات مفاتيح خاطئة كثيرة");
                }
              }
            );

            return res.json({
              success: false,
              status: "invalid_key",
              message: "المفتاح غير صحيح"
            });
          }

          if (!license.is_active) {
            logAttempt(device_id, ip, false);
            return res.json({
              success: false,
              status: "disabled",
              message: "المفتاح متوقف"
            });
          }

          if (license.is_used && license.device_id !== device_id) {
            logAttempt(device_id, ip, false);
            return res.json({
              success: false,
              status: "already_used",
              message: "هذا المفتاح مستخدم على جهاز آخر"
            });
          }

          const now = Date.now();

          if (license.expires_at && now > license.expires_at) {
            logAttempt(device_id, ip, false);
            return res.json({
              success: false,
              status: "expired",
              message: "انتهت صلاحية المفتاح"
            });
          }

          if (!license.is_used) {
            const expiresAt = now + license.duration_minutes * 60 * 1000;

            db.run(
              `
              UPDATE licenses 
              SET is_used = 1, device_id = ?, activated_at = ?, expires_at = ?
              WHERE id = ?
              `,
              [device_id, now, expiresAt, license.id],
              function () {
                logAttempt(device_id, ip, true);

                return res.json({
                  success: true,
                  status: "activated",
                  message: "تم التفعيل بنجاح",
                  expires_at: expiresAt
                });
              }
            );
          } else {
            logAttempt(device_id, ip, true);

            return res.json({
              success: true,
              status: "active",
              message: "المفتاح فعال",
              expires_at: license.expires_at
            });
          }
        }
      );
    }
  );
});

app.post("/api/check", (req, res) => {
  const { device_id } = req.body;

  if (!device_id) {
    return res.json({
      success: false,
      status: "missing_device",
      message: "الجهاز غير معروف"
    });
  }

  db.get(
    `SELECT * FROM blocked_devices WHERE device_id = ?`,
    [device_id],
    (err, blocked) => {
      if (blocked) {
        return res.json({
          success: false,
          status: "blocked",
          message: "الجهاز محظور"
        });
      }

      db.get(
        `
        SELECT * FROM licenses 
        WHERE device_id = ? AND is_used = 1 
        ORDER BY id DESC 
        LIMIT 1
        `,
        [device_id],
        (err, license) => {
          if (!license) {
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

          if (now > license.expires_at) {
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
        }
      );
    }
  );
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`License server running on port ${PORT}`);
});
