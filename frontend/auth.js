// Shared by every page: reads/writes the JWT the backend issues at POST /login.
function getToken() {
  return sessionStorage.getItem('token');
}

function isLoggedIn() {
  return getToken() !== null;
}

function logout() {
  sessionStorage.removeItem('token');
}
