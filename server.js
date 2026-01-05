const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

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

// Admin Dashboard - Serve HTML page
app.get("/admin/ipfp-rsvp-data-export-2026-gbeda-secure", (req, res) => {
  const exportType = req.query.export;

  if (exportType === "excel") {
    return handleExcelExport(req, res);
  } else if (exportType === "pdf") {
    return handlePDFExport(req, res);
  }

  // Serve the admin HTML page
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// API to get RSVP data as JSON
app.get("/api/admin/data", (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    let data = [];
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      data = [];
    }
    res.json(data);
  } else {
    res.json([]);
  }
});

// Excel Export Handler
async function handleExcelExport(req, res) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("RSVP Data");

  worksheet.columns = [
    { header: "No", key: "no", width: 5 },
    { header: "Nama Lengkap", key: "name", width: 30 },
    { header: "Jumlah Anggota", key: "guestCount", width: 15 },
    { header: "Nama Anggota Keluarga", key: "guests", width: 50 },
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
}

// PDF Export Handler
function handlePDFExport(req, res) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=RSVP_Data.pdf");

  doc.pipe(res);

  // Header
  doc.fontSize(20).text("RSVP Data - IPFP 2026", { align: "center" });
  doc
    .fontSize(12)
    .text("Pertemuan Anggota & Sambut Tahun Baru", { align: "center" });
  doc.moveDown(2);

  if (fs.existsSync(DATA_FILE)) {
    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    let data = [];
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      data = [];
    }

    if (data.length === 0) {
      doc.fontSize(12).text("Belum ada data RSVP", { align: "center" });
    } else {
      data.forEach((entry, index) => {
        doc.fontSize(14).text(`${index + 1}. ${entry.name}`, { bold: true });
        doc
          .fontSize(10)
          .text(`   Jumlah Anggota: ${entry.guests?.length || 0}`);
        if (entry.guests && entry.guests.length > 0) {
          doc.text(`   Nama Anggota: ${entry.guests.join(", ")}`);
        }
        doc.text(
          `   Waktu Daftar: ${new Date(entry.timestamp).toLocaleString(
            "id-ID"
          )}`
        );
        doc.moveDown(0.5);
      });
    }
  } else {
    doc.fontSize(12).text("Belum ada data RSVP", { align: "center" });
  }

  doc.end();
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
