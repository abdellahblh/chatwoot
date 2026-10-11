/* global axios */
/**
 * Knowledge Base API client.
 *
 * NOT a subclass of ApiClient. ApiClient targets Chatwoot's own Rails API at
 * /api/v1/accounts/:id/... — this talks to the operator's SEPARATE FastAPI
 * backend, whose host is configured at runtime by the user. Different origin,
 * different auth, so it gets its own thin client.
 *
 * Config lives in uiSettings (see useKnowledgeBase). It is read on every call
 * rather than captured once, so changing the URL in Backend Settings takes
 * effect immediately without a page reload.
 */

const trimSlash = url => (url || '').replace(/\/+$/, '');

/**
 * @param {{baseUrl: string, token: string}} config
 * @returns {{ get: Function, post: Function, put: Function, del: Function }}
 */
export const createKbClient = ({ baseUrl, token }) => {
  const root = trimSlash(baseUrl);

  if (!root) {
    throw new Error('KB_NOT_CONFIGURED');
  }

  // The token rides in the query string because that is what the FastAPI
  // endpoints expect (they were built for the Dashboard App iframe, which can
  // only carry a URL). Keep both surfaces on one auth scheme.
  const withToken = path => {
    const separator = path.includes('?') ? '&' : '?';
    return `${root}/kb${path}${separator}token=${encodeURIComponent(token)}`;
  };

  const unwrap = async promise => {
    try {
      const { data } = await promise;
      return data;
    } catch (error) {
      // Translate transport failures into messages a store owner can act on.
      // "Network Error" tells them nothing; "check the URL" does.
      const status = error?.response?.status;
      if (status === 403) throw new Error('KB_BAD_TOKEN');
      if (status === 503) throw new Error('KB_TOKEN_NOT_SET');
      if (!error?.response) throw new Error('KB_UNREACHABLE');
      throw error;
    }
  };

  return {
    get: path => unwrap(axios.get(withToken(path))),
    post: (path, body) => unwrap(axios.post(withToken(path), body)),
    put: (path, body) => unwrap(axios.put(withToken(path), body)),
    del: path => unwrap(axios.delete(withToken(path))),
  };
};

export default createKbClient;
