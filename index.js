import { createOauthHttpClient, looksLikeBnetAuthToken, getInitialToken as getInitialToken_base, } from "d2oauth-base";
export function createOauthHttpClientKV(apiKey, client_id, client_secret, bungieMembershipId, options = {}) {
    return createOauthHttpClient(apiKey, client_id, client_secret, () => readTokenFromLocalStorage(client_id, bungieMembershipId), (tokenMeta) => {
        saveTokenToLocalStorage(client_id, tokenMeta);
    }, options);
}
export async function setupToken(authorization_code, client_id, client_secret) {
    return await getInitialToken_base(authorization_code, client_id, client_secret, (tokenMeta) => {
        const json = JSON.stringify(tokenMeta);
        window.localStorage.setItem(`oauth_${client_id}_${tokenMeta.token.membership_id}`, json);
    });
}
export async function injectExistingBungieNetToken(client_id, 
/** a valid existing token, which we'll now start refreshing through this instance */
token, 
/** force this to be written into token storage as the new token, even if one already exists */
forceOverwrite) {
    if (!looksLikeBnetAuthToken(token)) {
        console.error(token);
        throw `this doesn't look like a token`;
    }
    const tokenMeta = {
        token,
        expires_at: 0,
        refresh_expires_at: Date.now() + token.refresh_expires_in * 1000,
    };
    // bail if there's already a token and overwrite isn't set
    if (readTokenFromLocalStorage(client_id, token.membership_id) &&
        !forceOverwrite) {
        console.info(`there's already a saved token, and forceOverwrite was not set`);
        return;
    }
    saveTokenToLocalStorage(client_id, tokenMeta);
}
export async function isOauthAlreadySetUp(client_id, bungieMembershipId) {
    if (!bungieMembershipId)
        bungieMembershipId = getLatestUsedBnetMember(client_id);
    return Boolean(bungieMembershipId &&
        readTokenFromLocalStorage(client_id, bungieMembershipId));
}
const oauthKey = /^oauth_\d+_/;
/** get all oauth-looking LS keys */
function getOauthLocalStorageKeys() {
    return Object.keys(localStorage).filter((kn) => oauthKey.test(kn));
}
export function readTokenFromLocalStorage(client_id, bungieMembershipId) {
    let lsKey = `oauth_${client_id}_${bungieMembershipId}`;
    return readTokenFromLocalStorageKey(lsKey);
}
export function readTokenFromLocalStorageKey(lsKey) {
    const localTokenMetaJson = window.localStorage.getItem(lsKey);
    if (!localTokenMetaJson) {
        console.error("no token found in localStorage");
        return;
    }
    const localTokenMeta = tryParse(localTokenMetaJson);
    if (!localTokenMeta) {
        console.error("local token has an unexpected structure (decode failed)");
        return;
    }
    if (!looksLikeBnetTokenMeta(localTokenMeta)) {
        console.error("local token has an unexpected structure (weird properties)");
        return;
    }
    return localTokenMeta;
}
function saveTokenToLocalStorage(client_id, tokenMeta) {
    const json = JSON.stringify(tokenMeta);
    window.localStorage.setItem(`oauth_${client_id}_${tokenMeta.token.membership_id}`, json);
}
export function collectValidOauthsFromLocalStorage(client_id) {
    const probably = [];
    const now = Date.now();
    for (const keyName of getOauthLocalStorageKeys()) {
        if (client_id && !keyName.includes(client_id))
            continue;
        const tokenMeta = readTokenFromLocalStorageKey(keyName);
        if (!tokenMeta || (tokenMeta.refresh_expires_at ?? 0) < now)
            continue;
        probably.push(tokenMeta);
    }
    return probably;
}
export function getLatestUsedBnetMember(client_id) {
    const allValid = collectValidOauthsFromLocalStorage(client_id);
    return allValid.sort((a, b) => b.expires_at - a.expires_at)[0]?.token
        .membership_id;
}
function looksLikeBnetTokenMeta(tokenMeta) {
    return (tokenMeta &&
        tokenMeta.expires_at &&
        (tokenMeta.refresh_expires_at === undefined ||
            typeof tokenMeta.refresh_expires_at === "number") &&
        looksLikeBnetAuthToken(tokenMeta.token));
}
/** suppresses JSON.parse errors and just returns undefined if something went wrong */
function tryParse(tokenJSON) {
    if (typeof tokenJSON === "string")
        try {
            return JSON.parse(tokenJSON);
        }
        catch { }
}
