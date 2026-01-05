document.addEventListener("DOMContentLoaded", () => {
  const guestList = document.getElementById("guestList");
  const addGuestBtn = document.getElementById("addGuestBtn");
  const rsvpForm = document.getElementById("rsvpForm");
  const rsvpMessage = document.getElementById("rsvpMessage");
  const submitBtn = document.getElementById("submitBtn");

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
        // Success
        rsvpMessage.textContent =
          "Terima kasih! Konfirmasi kehadiran Anda telah tersimpan.";
        rsvpMessage.className = "";
        rsvpForm.reset();
        guestList.innerHTML = ""; // Clear guests
      } else {
        throw new Error(result.error || "Terjadi kesalahan.");
      }
    } catch (error) {
      rsvpMessage.textContent = "Gagal mengirim konfirmasi: " + error.message;
      rsvpMessage.style.borderColor = "#e74c3c";
      rsvpMessage.style.backgroundColor = "rgba(231, 76, 60, 0.2)";
      rsvpMessage.style.color = "#e74c3c";
      rsvpMessage.className = "";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Kirim Konfirmasi";
    }
  });
});
