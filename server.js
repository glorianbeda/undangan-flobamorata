const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, "rsvp_data.json");
const VERSION_FILE = path.join(__dirname, "public", "version.json");

// Get current version (from version.json or use timestamp as fallback)
function getVersion() {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, "utf8"));
      return versionData.version || Date.now().toString();
    }
  } catch (e) {
    // Fallback
  }
  return Date.now().toString();
}

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API endpoint for version
app.get("/api/version", (req, res) => {
  res.json({ version: getVersion() });
});

// Static files with cache-control (always revalidate)
app.use(
  express.static(path.join(__dirname, "public"), {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // CSS, JS, HTML - always revalidate
      if (
        filePath.endsWith(".css") ||
        filePath.endsWith(".js") ||
        filePath.endsWith(".html")
      ) {
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
      }
      // Images & audio - cache for 1 day
      else if (filePath.match(/\.(jpg|jpeg|png|gif|mp3|mp4|webp)$/)) {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

// Initialize data file if not exists
if (!fs.existsSync(DATA_FILE)) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  } catch (err) {
    console.error("Error creating data file:", err);
  }
}

// Generate simple UUID
function generateId() {
  return (
    "rsvp_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

// Levenshtein distance for similarity detection
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// API to search RSVP by name (for user-side autocomplete)
app.get("/api/rsvp/search", (req, res) => {
  const query = req.query.q?.trim().toLowerCase();

  if (!query || query.length < 2) {
    return res.json([]);
  }

  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json([]);
    }

    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(rawData);

    const matches = data
      .filter((entry) => entry.name?.toLowerCase().includes(query))
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        guestCount: entry.guests?.length || 0,
      }))
      .slice(0, 10); // Limit to 10 results

    res.json(matches);
  } catch (err) {
    console.error("Search error:", err);
    res.json([]);
  }
});

// API to get similar names for admin (typo detection)
app.get("/api/admin/similar-names", (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ similarGroups: [], flaggedIds: [] });
    }

    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(rawData);

    const similarGroups = [];
    const flaggedIds = new Set();
    const processed = new Set();

    // Compare each name with others
    for (let i = 0; i < data.length; i++) {
      if (processed.has(data[i].id)) continue;

      const similarEntries = [data[i]];

      for (let j = i + 1; j < data.length; j++) {
        if (processed.has(data[j].id)) continue;

        const name1 = data[i].name?.trim() || "";
        const name2 = data[j].name?.trim() || "";

        // Skip if names are exactly the same (not a typo, just duplicate)
        if (name1.toLowerCase() === name2.toLowerCase()) continue;

        const distance = levenshteinDistance(name1, name2);
        const maxLen = Math.max(name1.length, name2.length);

        // Consider similar if distance <= 2 OR distance is less than 30% of max length
        if (distance <= 2 || (maxLen > 5 && distance / maxLen < 0.3)) {
          similarEntries.push(data[j]);
          processed.add(data[j].id);
          flaggedIds.add(data[j].id);
        }
      }

      if (similarEntries.length > 1) {
        // Flag all except the first (oldest) entry
        similarEntries.slice(1).forEach((e) => flaggedIds.add(e.id));
        similarGroups.push(
          similarEntries.map((e) => ({ id: e.id, name: e.name }))
        );
      }

      processed.add(data[i].id);
    }

    res.json({
      similarGroups,
      flaggedIds: Array.from(flaggedIds),
    });
  } catch (err) {
    console.error("Similar names error:", err);
    res.json({ similarGroups: [], flaggedIds: [] });
  }
});

// API to get RSVP by ID
app.get("/api/rsvp/:id", (req, res) => {
  const { id } = req.params;

  if (!fs.existsSync(DATA_FILE)) {
    return res.status(404).json({ error: "Data tidak ditemukan" });
  }

  try {
    const rawData = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(rawData);
    const entry = data.find((item) => item.id === id);

    if (!entry) {
      return res.status(404).json({ error: "RSVP tidak ditemukan" });
    }

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "Gagal membaca data" });
  }
});

// API to handle new RSVP
app.post("/api/rsvp", (req, res) => {
  const { name, guests } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nama wajib diisi" });
  }

  const newEntry = {
    id: generateId(),
    name,
    guests: guests || [],
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Read Error:", err);
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

// API to update existing RSVP
app.put("/api/rsvp/:id", (req, res) => {
  const { id } = req.params;
  const { name, guests } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nama wajib diisi" });
  }

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Read Error:", err);
      return res.status(500).json({ error: "Gagal membaca data" });
    }

    let currentData = [];
    try {
      currentData = data ? JSON.parse(data) : [];
    } catch (parseErr) {
      console.error("Parse Error:", parseErr);
      return res.status(500).json({ error: "Data corrupt" });
    }

    const index = currentData.findIndex((item) => item.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "RSVP tidak ditemukan" });
    }

    // Update entry
    currentData[index] = {
      ...currentData[index],
      name,
      guests: guests || [],
      updatedAt: new Date().toISOString(),
    };

    fs.writeFile(DATA_FILE, JSON.stringify(currentData, null, 2), (err) => {
      if (err) {
        console.error("Write Error:", err);
        return res.status(500).json({ error: "Gagal menyimpan data" });
      }
      res
        .status(200)
        .json({ message: "RSVP berhasil diupdate!", data: currentData[index] });
    });
  });
});

// API to delete RSVP entry
app.delete("/api/rsvp/:id", (req, res) => {
  const { id } = req.params;

  fs.readFile(DATA_FILE, "utf8", (err, data) => {
    if (err) {
      console.error("Read Error:", err);
      return res.status(500).json({ error: "Gagal membaca data" });
    }

    let currentData = [];
    try {
      currentData = data ? JSON.parse(data) : [];
    } catch (parseErr) {
      console.error("Parse Error:", parseErr);
      return res.status(500).json({ error: "Data corrupt" });
    }

    const index = currentData.findIndex((item) => item.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "RSVP tidak ditemukan" });
    }

    // Remove entry
    const deletedEntry = currentData.splice(index, 1)[0];

    fs.writeFile(DATA_FILE, JSON.stringify(currentData, null, 2), (err) => {
      if (err) {
        console.error("Write Error:", err);
        return res.status(500).json({ error: "Gagal menghapus data" });
      }
      res
        .status(200)
        .json({ message: "RSVP berhasil dihapus!", data: deletedEntry });
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
