const form = document.querySelector("#application-form");
const statusBox = document.querySelector("#form-status");

if (form && statusBox) {
  const submitButton = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Sending application...", "neutral");
    submitButton.disabled = true;

    const payload = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.dataset.endpoint || "/api/applications";
    const applicationLabel = form.dataset.applicationLabel || "Application";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await readJsonResponse(response);

      if (!response.ok || !result.ok) {
        showErrors(result.errors);
        return;
      }

      form.reset();
      setStatus(getSuccessMessage({ applicationLabel, result }), "success");
    } catch {
      setStatus("Could not send the application right now. Please try again soon.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

function showErrors(errors = {}) {
  const firstError = Object.values(errors)[0] || "Please check the form and try again.";
  setStatus(firstError, "error");
}

function setStatus(message, tone) {
  statusBox.textContent = message;
  statusBox.dataset.tone = tone;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return {
    ok: false,
    errors: {
      form: "Could not send the application right now. Please try again soon."
    }
  };
}

function getSuccessMessage({ applicationLabel, result }) {
  if (result.platform) {
    return `${applicationLabel} sent. We detected ${result.platform} and sent it to Discord for review.`;
  }

  return `${applicationLabel} sent to Discord for review.`;
}
