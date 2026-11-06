import * as http from "node:http";
import { Buffer } from 'node:buffer';
import { HOSTNAME, PORT, MIME_TYPES, STATUS_CODES, DEFAULT_MAX_AGE, DEMO_USER_NAME, DEMO_USER_PASSWORD } from "./options.old.js";

const users = [
  {
    username: DEMO_USER_NAME,
    password: DEMO_USER_PASSWORD
  }
]

const prepareJsonResponse = (response, status, message) => {
  const mimeType = MIME_TYPES.json;

  const responseData = JSON.stringify({ status: status, message: message });
  const contentLength = Buffer.byteLength(responseData, 'utf8');

  response.writeHead(status, {
    "Content-Type": mimeType,
    "Content-Length": contentLength,
    "Cache-Control": `max-age=${DEFAULT_MAX_AGE}`
  });
  response.end(responseData)
}

const validateUser = (users, username, password) => {
  if (typeof username !== "string") {
    return {
      status: STATUS_CODES.badRequest,
      message: "Incorrect or empty username"
    }
  }

  const user = users.find(user => user.username === username);

  if (!user) {
    return {
      status: STATUS_CODES.badRequest,
      message: "User not found"
    }
  }

  const isValidPassword = user.password === password;

  if (isValidPassword) {
    return {
      status: STATUS_CODES.success,
      message: "User authorized"
    }
  } else {
    return {
      status: STATUS_CODES.badRequest,
      message: "Invalid password"
    }
  }
}

const httpServer = http.createServer((request, response) => {
  const { url, method } = request;
  const path = url.toLowerCase();

  if (path === "/" && method === "GET") {
    prepareJsonResponse(response, STATUS_CODES.success, "Homepage")
  } else if (path === '/login' && method === "POST") {
    let body = [];
    request
      .on('data', chunk => {
        body.push(chunk);
      })
      .on('end', () => {
        const jsonData = Buffer.concat(body).toString();

        try {
          const objData = JSON.parse(jsonData);
          const { username, password } = objData;

          const userValidStatus = validateUser(users, username, password);
          prepareJsonResponse(response, userValidStatus.status, userValidStatus.message);
        } catch {
          prepareJsonResponse(response, STATUS_CODES.badRequest, "Invalid JSON body");
        }
      });
  }
  else {
    prepareJsonResponse(response, STATUS_CODES.not_found, "The requested resource is not found ");
  }
});

httpServer.listen(PORT);
console.log(`Server running at ${HOSTNAME}:${PORT}/`);
