const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "rsvp_data.json");

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize data file if not exists
if (!fs.existsSync(DATA_FILE)) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  } catch (err) {
    console.error("Error creating data file:", err);
  }
}

// API to handle RSVP
app.post("/api/rsvp", (req, res) => {
  const { name, guests } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nama wajib diisi" });
  }

  const newEntry = {
    name,
    guests: guests || [], // guests is an array of names
    timestamp: new Date().toISOString(),
  };

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Read Error:", err);
      // If file doesn't exist/read error, try to start fresh
      // return res.status(500).json({ error: 'Gagal membaca database' });
    }

    let currentData = [];
    try {
      currentData = data ? JSON.parse(data) : [];
    } catch (parseErr) {
      console.error("Parse Error:", parseErr);
      currentData = [];
    }
    currentData.push(newEntry);

    fs.writeFile(DATA_FILE, JSON.stringify(currentData, null, 2), (err) => {
      if (err) {
        console.error("Write Error:", err);
        return res.status(500).json({ error: "Gagal menyimpan data" });
      }
      res
        .status(200)
        .json({ message: "RSVP berhasil disimpan!", data: newEntry });
    });
  });
});

// Admin Export API
app.get("/api/admin/export", async (req, res) => {
  const { token } = req.query;

  // Simple hardcoded token check
  if (token !== "admin123") {
    return res
      .status(403)
      .send("<h1>Akses Ditolak</h1><p>Token admin salah.</p>");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("RSVP Data");

  worksheet.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "Nama Lengkap", key: "name", width: 30 },
    { header: "Jumlah Tamu", key: "guestCount", width: 15 },
    { header: "Nama Tamu", key: "guests", width: 50 },
    { header: "Waktu Daftar", key: "timestamp", width: 25 },
  ];

  if (fs.existsSync(DATA_FILE)) {
    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    let data = [];
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      data = [];
    }

    data.forEach((entry, index) => {
      worksheet.addRow({
        no: index + 1,
        name: entry.name,
        guestCount: entry.guests.length,
        guests: entry.guests ? entry.guests.join(", ") : "",
        timestamp: entry.timestamp,
      });
    });
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=RSVP_Data.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
