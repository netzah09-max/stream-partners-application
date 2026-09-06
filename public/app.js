const form = document.querySelector("#application-form");
const statusBox = document.querySelector("#form-status");
const submitButton = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Sending application...", "neutral");
  submitButton.disabled = true;

  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      showErrors(result.errors);
      return;
    }

    form.reset();
    setStatus(
      `Application sent. We detected ${result.platform} and sent it to Discord for review.`,
      "success"
    );
  } catch {
    setStatus("Could not send the application right now. Please try again soon.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

function showErrors(errors = {}) {
  const firstError = Object.values(errors)[0] || "Please check the form and try again.";
  setStatus(firstError, "error");
}

function setStatus(message, tone) {
  statusBox.textContent = message;
  statusBox.dataset.tone = tone;
}
