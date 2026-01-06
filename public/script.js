// Wait for DOM to be ready
(function () {
  function initRSVP() {
    const guestList = document.getElementById("guestList");
    const addGuestBtn = document.getElementById("addGuestBtn");
    const rsvpForm = document.getElementById("rsvpForm");
    const rsvpMessage = document.getElementById("rsvpMessage");
    const submitBtn = document.getElementById("submitBtn");
    const rsvpSection = document.getElementById("rsvpSection");
    const thankYouSection = document.getElementById("thankYouSection");
    const nameInput = document.getElementById("name");

    // Check if elements exist
    if (!rsvpForm || !submitBtn || !nameInput) {
      console.error("RSVP elements not found");
      return;
    }

    // Get RSVP ID from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlRsvpId = urlParams.get("id");

    // State - prioritize URL param over localStorage
    let existingRsvpId = urlRsvpId || localStorage.getItem("ipfp_rsvp_id");
    let isEditMode = false;
    let isUrlBasedEdit = !!urlRsvpId; // Track if editing via URL

    // Initialize
    init();

    async function init() {
      if (existingRsvpId) {
        // Returning user - load existing data
        await loadExistingData();
      }
    }

    async function loadExistingData() {
      try {
        const response = await fetch(`/api/rsvp/${existingRsvpId}`);

        if (response.ok) {
          const data = await response.json();
          isEditMode = true;
          populateForm(data);
          updateUIForEditMode();
        } else if (response.status === 404) {
          // ID not found, clear localStorage
          localStorage.removeItem("ipfp_rsvp_id");
          localStorage.removeItem("ipfp_rsvp_submitted");
          existingRsvpId = null;
          isEditMode = false;
        }
      } catch (error) {
        console.error("Failed to load existing data:", error);
      }
    }

    function populateForm(data) {
      // Set name
      nameInput.value = data.name || "";

      // Clear existing guests
      guestList.innerHTML = "";

      // Add guests
      if (data.guests && data.guests.length > 0) {
        data.guests.forEach((guestName) => {
          addGuestInput(guestName);
        });
      }
    }

    function updateUIForEditMode() {
      // Change submit button text
      submitBtn.textContent = "Update Data";

      // Show status message at top of form
      showSuccessStatus();
    }

    function showSuccessStatus() {
      // Add success banner if not exists
      let statusBanner = document.getElementById("rsvpStatusBanner");
      if (!statusBanner) {
        statusBanner = document.createElement("div");
        statusBanner.id = "rsvpStatusBanner";
        statusBanner.className = "status-banner success";
        statusBanner.innerHTML = `
          <span class="status-icon">✓</span>
          <span>Data Anda sudah tersimpan. Anda dapat mengedit data di bawah ini.</span>
        `;
        const h3 = rsvpSection.querySelector("h3");
        if (h3) {
          rsvpSection.insertBefore(statusBanner, h3.nextSibling);
        }
      }
    }

    function addGuestInput(value = "") {
      const guestDiv = document.createElement("div");
      guestDiv.className = "guest-input-group";

      const input = document.createElement("input");
      input.type = "text";
      input.name = "guests[]";
      input.placeholder = "Nama Anggota Keluarga";
      input.required = true;
      input.value = value;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = () => guestDiv.remove();

      guestDiv.appendChild(input);
      guestDiv.appendChild(removeBtn);
      guestList.appendChild(guestDiv);

      return input;
    }

    // Add Guest Logic
    addGuestBtn.addEventListener("click", () => {
      const input = addGuestInput();
      input.focus();
    });

    // Form Submission
    rsvpForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Disable button
      submitBtn.disabled = true;
      submitBtn.textContent = isEditMode ? "Mengupdate..." : "Mengirim...";

      const name = nameInput.value;

      // Collect guests
      const guestInputs = document.querySelectorAll('input[name="guests[]"]');
      const guests = Array.from(guestInputs)
        .map((input) => input.value)
        .filter((val) => val.trim() !== "");

      const payload = { name, guests };

      try {
        let response;

        if (isEditMode && existingRsvpId) {
          // Update existing
          response = await fetch(`/api/rsvp/${existingRsvpId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          // Create new
          response = await fetch("/api/rsvp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        const result = await response.json();

        if (response.ok) {
          // Save ID for future edits
          if (result.data && result.data.id) {
            localStorage.setItem("ipfp_rsvp_id", result.data.id);
            existingRsvpId = result.data.id;
          }
          localStorage.setItem("ipfp_rsvp_submitted", "true");

          // Switch to edit mode
          isEditMode = true;
          updateUIForEditMode();

          // Show success feedback
          showFeedback("Data berhasil disimpan!", "success");

          // Scroll to thank you / confirmation
          showThankYouSection();
        } else {
          throw new Error(result.error || "Terjadi kesalahan.");
        }
      } catch (error) {
        console.error("Submit error:", error);
        showFeedback("Gagal menyimpan: " + error.message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEditMode ? "Update Data" : "Kirim Konfirmasi";
      }
    });

    function showFeedback(message, type) {
      rsvpMessage.textContent = message;
      rsvpMessage.className = `feedback-message ${type}`;
      rsvpMessage.classList.remove("hidden");

      setTimeout(() => {
        rsvpMessage.classList.add("hidden");
      }, 5000);
    }

    function showThankYouSection() {
      // Don't hide RSVP section, just scroll to thank you
      thankYouSection.classList.remove("hidden");

      // Add edit section if not exists
      let editSection = thankYouSection.querySelector(".edit-link-section");
      if (!editSection && existingRsvpId) {
        editSection = document.createElement("div");
        editSection.className = "edit-link-section";

        const editUrl = `${window.location.origin}${window.location.pathname}?id=${existingRsvpId}`;

        editSection.innerHTML = `
          <div class="edit-link-box">
            <p style="margin-bottom: 0.5rem; font-size: 0.9rem; color: #aaa;">Link untuk edit data Anda:</p>
            <div class="edit-link-container">
              <input type="text" value="${editUrl}" readonly class="edit-link-input" id="editLinkInput">
              <button class="btn-copy" onclick="copyEditLink()">📋 Copy</button>
            </div>
          </div>
          <button class="btn-edit-data btn-outline" onclick="document.getElementById('rsvpSection').scrollIntoView({ behavior: 'smooth', block: 'center' })">
            ✏️ Edit Data Anda
          </button>
        `;

        const content = thankYouSection.querySelector(".thank-you-content");
        if (content) {
          content.appendChild(editSection);
        }
      }

      setTimeout(() => {
        thankYouSection.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }

    // Copy link function - make it global
    window.copyEditLink = function () {
      const input = document.getElementById("editLinkInput");
      if (input) {
        input.select();
        document.execCommand("copy");

        // Show feedback
        const btn = document.querySelector(".btn-copy");
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = "✓ Copied!";
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }
      }
    };
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRSVP);
  } else {
    // DOM already loaded
    initRSVP();
  }
})();
