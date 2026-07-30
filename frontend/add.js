const form = document.getElementById('add-resource-form');
const errorMessage = document.getElementById('form-error');
const submitBtn = form.querySelector('button[type="submit"]');

initHeaderShrink([window]);

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.style.display = 'none';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const fileInput = document.getElementById('file');
  const hasUrl = form.url.value.trim();
  const hasFile = fileInput.files.length > 0;

  if (!hasUrl && !hasFile) {
    showError('Please provide a URL, upload a file, or both.');
    return;
  }

  submitBtn.disabled = true;
  try {
    let res;

    if (hasFile) {
      const formData = new FormData();
      formData.append('title', form.title.value);
      formData.append('subject', form.subject.value);
      formData.append('note', form.note.value);
      if (hasUrl) formData.append('url', form.url.value);
      formData.append('file', fileInput.files[0]);

      res = await fetch(`${API_BASE}/resources`, { method: 'POST', body: formData });
    } else {
      res = await fetch(`${API_BASE}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.value,
          subject: form.subject.value,
          url: form.url.value,
          note: form.note.value,
        }),
      });
    }

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    window.location.href = 'home.html';
  } catch (err) {
    showError('Could not reach the server. Is the backend running on http://localhost:3000?');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
  }
});
