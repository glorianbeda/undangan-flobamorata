document.addEventListener("DOMContentLoaded", () => {
  const guestList = document.getElementById("guestList");
  const addGuestBtn = document.getElementById("addGuestBtn");
  const rsvpForm = document.getElementById("rsvpForm");
  const rsvpMessage = document.getElementById("rsvpMessage");
  const submitBtn = document.getElementById("submitBtn");
  const rsvpSection = document.getElementById("rsvpSection");
  const thankYouSection = document.getElementById("thankYouSection");

  // Check if user has already submitted
  checkSubmissionStatus();

  function checkSubmissionStatus() {
    const hasSubmitted = localStorage.getItem("ipfp_rsvp_submitted");
    if (hasSubmitted === "true") {
      showThankYouPage();
    }
  }

  function showThankYouPage() {
    rsvpSection.classList.add("hidden");
    thankYouSection.classList.remove("hidden");

    // Scroll to thank you section
    setTimeout(() => {
      thankYouSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  // Add Guest Logic
  addGuestBtn.addEventListener("click", () => {
    const guestDiv = document.createElement("div");
    guestDiv.className = "guest-input-group";

    const input = document.createElement("input");
    input.type = "text";
    input.name = "guests[]";
    input.placeholder = "Nama Anggota Keluarga";
    input.required = true;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.onclick = () => guestDiv.remove();

    guestDiv.appendChild(input);
    guestDiv.appendChild(removeBtn);
    guestList.appendChild(guestDiv);

    // Focus new input
    input.focus();
  });

  // Form Submission
  rsvpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Check if already submitted
    if (localStorage.getItem("ipfp_rsvp_submitted") === "true") {
      alert("Anda sudah mengisi konfirmasi kehadiran sebelumnya.");
      showThankYouPage();
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim...";

    const name = document.getElementById("name").value;

    // Collect guests
    const guestInputs = document.querySelectorAll('input[name="guests[]"]');
    const guests = Array.from(guestInputs)
      .map((input) => input.value)
      .filter((val) => val.trim() !== "");

    const payload = {
      name,
      guests,
    };

    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        // Success - Mark as submitted
        localStorage.setItem("ipfp_rsvp_submitted", "true");

        // Show thank you page
        showThankYouPage();
      } else {
        throw new Error(result.error || "Terjadi kesalahan.");
      }
    } catch (error) {
      alert("Gagal mengirim konfirmasi: " + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Kirim Konfirmasi";
    }
  });
});
