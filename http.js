import { HOSTNAME, PORT, MIME_TYPES, STATUS_CODES, DEFAULT_MAX_AGE, DEMO_USER_NAME, DEMO_USER_PASSWORD } from "./options.js";

const option = {
  basePath: `${HOSTNAME}:${PORT}`,
  mimeType: MIME_TYPES.json,
  get:  {
    path: "/",
    method: "GET"
  },
  post: {
    path: "/login",
    method: "POST",
    username: DEMO_USER_NAME,
    password: DEMO_USER_PASSWORD
  }
}

async function getData(option) {
  const { basePath, get } = option;
  const { path } = get;

  const url = basePath + path;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }
    const result = await response.json();
    console.log(result);
  } catch (error) {
    console.error(error.message);
  }
}

async function postData(option) {
  const { basePath, mimeType, post } = option;
  const { path, method, username, password } = post;

  const url = basePath + path;

  const bodyData = JSON.stringify({
    username: username,
    password: password
  });

  const headersData = {
    "Content-Type": mimeType,
    "Content-Length": Buffer.byteLength(bodyData, 'utf8'),
    "Cache-Control": `max-age=${DEFAULT_MAX_AGE}`
   }

  try {
    const response = await fetch(url, {
      method: method,
      headers: headersData,
      body: bodyData
    });

    const data = await response.json();
    const message = data.message;

    if (response.ok) {
      console.log(message)
    } else {
      throw new Error(message);
    }
  } catch (error) {
    console.error(error.message);
  }
}

getData(option);
postData(option)
