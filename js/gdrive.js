// Google Drive sync — uses appDataFolder so the file is hidden from the user's Drive UI.
// Only this app can read/write it.

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'balance-sheet-data.json';
const DRIVE_API = 'https://www.googleapis.com/drive';

let _accessToken = null;
let _tokenClient = null;
let _fileId = null; // cached Drive file ID
let _onSignInChange = null;

export function isSignedIn() {
  return !!_accessToken;
}

export function getProfile() {
  const stored = localStorage.getItem('bs_gdrive_profile');
  return stored ? JSON.parse(stored) : null;
}

export function onSignInChange(callback) {
  _onSignInChange = callback;
}

export function initGoogleAuth(clientId) {
  if (!window.google?.accounts?.oauth2) {
    console.warn('Google Identity Services not loaded');
    return;
  }

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES + ' https://www.googleapis.com/auth/userinfo.profile',
    callback: async (response) => {
      if (response.error) {
        console.error('Auth error:', response.error);
        return;
      }
      _accessToken = response.access_token;

      // Fetch user profile
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${_accessToken}` }
        });
        const profile = await res.json();
        localStorage.setItem('bs_gdrive_profile', JSON.stringify({
          name: profile.name,
          email: profile.email,
          picture: profile.picture
        }));
      } catch (e) {
        console.warn('Failed to fetch profile', e);
      }

      if (_onSignInChange) _onSignInChange(true);
    }
  });
}

export function signIn() {
  if (!_tokenClient) return;
  _tokenClient.requestAccessToken({ prompt: 'consent' });
}

export function signOut() {
  if (_accessToken) {
    google.accounts.oauth2.revoke(_accessToken);
  }
  _accessToken = null;
  _fileId = null;
  localStorage.removeItem('bs_gdrive_profile');
  if (_onSignInChange) _onSignInChange(false);
}

// --- Drive file operations ---

async function driveRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${_accessToken}`,
      ...options.headers
    }
  });
  if (res.status === 401) {
    // Token expired — prompt re-auth
    _accessToken = null;
    if (_onSignInChange) _onSignInChange(false);
    throw new Error('Token expired');
  }
  return res;
}

async function findFile() {
  if (_fileId) return _fileId;

  const res = await driveRequest(
    `${DRIVE_API}/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}'&fields=files(id,modifiedTime)`
  );
  const data = await res.json();

  if (data.files && data.files.length > 0) {
    _fileId = data.files[0].id;
    return _fileId;
  }
  return null;
}

export async function loadFromDrive() {
  if (!_accessToken) return null;

  const fileId = await findFile();
  if (!fileId) return null;

  const res = await driveRequest(
    `${DRIVE_API}/v3/files/${fileId}?alt=media`
  );
  const data = await res.json();
  return data;
}

export async function saveToDrive(dataObj) {
  if (!_accessToken) return;

  const fileId = await findFile();
  const body = JSON.stringify(dataObj);

  if (fileId) {
    // Update existing file
    await driveRequest(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body
      }
    );
  } else {
    // Create new file in appDataFolder
    const metadata = {
      name: FILE_NAME,
      parents: ['appDataFolder']
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));

    const res = await driveRequest(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', body: form }
    );
    const created = await res.json();
    _fileId = created.id;
  }
}

export async function getLastModifiedTime() {
  if (!_accessToken) return null;

  const fileId = await findFile();
  if (!fileId) return null;

  const res = await driveRequest(
    `${DRIVE_API}/v3/files/${fileId}?fields=modifiedTime`
  );
  const data = await res.json();
  return data.modifiedTime ? new Date(data.modifiedTime) : null;
}
