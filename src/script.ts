const clientId = import.meta.env.CLIENT_ID; // Replace with your client id
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

const userId = import.meta.env.USER_ID;
const playlistId = "0hiyrHTj0fN2utROshs3SW"; // my main playlist

if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    const accessToken = await getAccessToken(clientId, code);
    const profile = await fetchProfile(accessToken);
    let playlist = await fetchPlaylist(accessToken, playlistId);
    const playlistJson: any[] = playlist.items.map(i => i.track);
    const audioFeaturesJson: any[] = [];
    const combinedArray: any[] = [];
    while (playlist?.next) {
        const result = await fetch(playlist.next, {
            method: "GET", headers: { Authorization: `Bearer ${accessToken}` }
        });

        playlist = await result.json();
        if (playlist) {
            const songIds = playlist.items.map(i => i.track.id).join(',');
            const audioFeatures = await fetchAudioFeatures(accessToken, songIds);
            audioFeaturesJson.push(...audioFeatures['audio_features']);
            playlistJson.push(...playlist['items'].map(i => i.track));
        }
        
    }

    console.log(playlistJson[0]);
    console.log(audioFeaturesJson[0]);

    for (let i = 0; i < playlistJson.length; i++) {
        combinedArray.push({ ...playlistJson[i], ...audioFeaturesJson[i] });
    }

    // const filteredArray = combinedArray.filter(i => (i.key === 1) && i.mode === 1 && (i.tempo > 120 && i.tempo < 130) && i.energy > 0.8 && i.valence > 0.8);
    // console.log(filteredArray.length);
    // // console.log(combinedArray.filter(i => i.tempo > 120 && i.tempo < 130).map(i => i.uri).slice(0, 100));
    // const toBeAddedSongIds = filteredArray.map(i => i.uri);

    // const newPlaylistPayload = { description: 'maybe', name: 'songs similar to attitude', public: false };
    // const newPlaylist = await createPlaylist(accessToken, newPlaylistPayload);
    // // newPlaylist.id
    // if (newPlaylist) { 
    //     await addNewSongs(accessToken, newPlaylist.id, { position: 0, uris: toBeAddedSongIds });
    // }

    populateUI(profile);
}

export async function redirectToAuthCodeFlow(clientId: string) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("scope", "user-read-private user-read-email playlist-modify-public playlist-modify-private");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length: number) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}


export async function getAccessToken(clientId: string, code: string): Promise<string> {
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "http://localhost:5173/callback");
    params.append("code_verifier", verifier!);

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
    });

    const { access_token } = await result.json();
    return access_token;
}

async function fetchProfile(token: string): Promise<any> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function fetchPlaylist(token: string, playlistId: string): Promise<any> { 
     const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=0&limit=100&market=EN&locale=en`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function fetchAudioFeatures(token: string, ids: string): Promise<any> { 
     const result = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });

    return await result.json();
}

async function createPlaylist(token: string, payload: any): Promise<any> { 
    const result = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
    });

    return await result.json();
}

async function addNewSongs(token: string, playlistId: string, payload: any): Promise<any> { 
    const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
    });

    return await result.json();
}

function populateUI(profile: any) {
    document.getElementById("displayName")!.innerText = profile.display_name;
    if (profile.images[0]) {
        const profileImage = new Image(200, 200);
        profileImage.src = profile.images[0].url;
        document.getElementById("avatar")!.appendChild(profileImage);
    }
    document.getElementById("id")!.innerText = profile.id;
    document.getElementById("email")!.innerText = profile.email;
    document.getElementById("uri")!.innerText = profile.uri;
    document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
    document.getElementById("url")!.innerText = profile.href;
    document.getElementById("url")!.setAttribute("href", profile.href);
    document.getElementById("imgUrl")!.innerText = profile.images[0]?.url ?? '(no profile image)';
}